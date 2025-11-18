const { Client } = require('pg');

// Database configuration
const dbConfig = {
  host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || 'CWF_Dev_2025!',
  ssl: {
    rejectUnauthorized: false
  }
};

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } catch (error) {
    console.error('SQL Error:', error);
    console.error('SQL Query:', sql);
    throw error;
  } finally {
    await client.end();
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, queryStringParameters } = event;
  const pathParts = path.split('/').filter(p => p);
  
  try {
    // CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };

    // Handle preflight requests
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    // Route handling
    if (httpMethod === 'POST' && pathParts[pathParts.length - 1] === 'actions') {
      // POST /api/actions - Create or Update action
      const body = JSON.parse(event.body || '{}');
      const { id, created_by, updated_by, ...actionData } = body;
      
      // Helper to format array values based on column type
      const formatArrayValue = (key, value) => {
        if (!Array.isArray(value)) return value;
        if (key === 'participants') {
          return value.length === 0 ? 'ARRAY[]::uuid[]' : `ARRAY[${value.map(v => `'${v}'`).join(',')}]::uuid[]`;
        }
        if (key === 'required_tools' || key === 'attachments') {
          return value.length === 0 ? 'ARRAY[]::text[]' : `ARRAY[${value.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]::text[]`;
        }
        return `'${JSON.stringify(value)}'::jsonb`;
      };
      
      // Set audit fields - generate UUID if not provided
      const userId = created_by || updated_by || require('crypto').randomUUID();
      
      // Check if action exists if id is provided
      let isUpdate = false;
      if (id) {
        try {
          const checkResult = await queryJSON(`SELECT id FROM actions WHERE id = '${id}' LIMIT 1`);
          isUpdate = checkResult.length > 0;
        } catch (error) {
          console.log('Error checking action existence:', error);
        }
      }
      
      if (isUpdate) {
        // Update existing action - use simple string interpolation for now
        const updatePairs = [`updated_by = '${userId}'`]; // Always update the updated_by field
        for (const [key, value] of Object.entries(actionData)) {
          if (key !== 'id' && value !== undefined) {
            let escapedValue;
            if (value === null) {
              escapedValue = 'NULL';
            } else if (typeof value === 'string') {
              escapedValue = `'${value.replace(/'/g, "''")}'`;
            } else if (Array.isArray(value)) {
              escapedValue = formatArrayValue(key, value);
            } else if (typeof value === 'boolean') {
              escapedValue = value;
            } else {
              escapedValue = value;
            }
            updatePairs.push(`${key} = ${escapedValue}`);
          }
        }
        
        const sql = `
          UPDATE actions 
          SET ${updatePairs.join(', ')}, updated_at = NOW()
          WHERE id = '${id}'
          RETURNING *
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      } else {
        // Create new action - generate UUID
        const uuid = require('crypto').randomUUID();
        
        // Add audit fields for creation
        const fieldsWithAudit = ['id', 'created_by', 'updated_by', ...Object.keys(actionData)];
        const valuesWithAudit = [uuid, userId, userId, ...Object.values(actionData)];
        
        const escapedValuesWithAudit = valuesWithAudit.map((v, idx) => {
          if (v === null) {
            return 'NULL';
          } else if (typeof v === 'string') {
            return `'${v.replace(/'/g, "''")}'`;
          } else if (Array.isArray(v)) {
            const key = fieldsWithAudit[idx];
            return formatArrayValue(key, v);
          } else if (typeof v === 'boolean') {
            return v;
          } else {
            return v;
          }
        });
        
        const sql = `
          INSERT INTO actions (${fieldsWithAudit.join(', ')}, created_at, updated_at)
          VALUES (${escapedValuesWithAudit.join(', ')}, NOW(), NOW())
          RETURNING *
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    if (httpMethod === 'GET' && pathParts[pathParts.length - 1] === 'my-actions') {
      // GET /api/actions/my-actions
      const { cognitoUserId } = queryStringParameters || {};
      if (!cognitoUserId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'cognitoUserId parameter required' })
        };
      }

      const sql = `
        SELECT 
          a.*,
          om.full_name as assigned_to_name,
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score,
          CASE WHEN updates.action_id IS NOT NULL THEN true ELSE false END as has_implementation_updates
        FROM actions a
        LEFT JOIN organization_members om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        WHERE om.cognito_user_id = '${cognitoUserId}'
        ORDER BY a.created_at DESC
      `;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result })
      };
    }

    if (httpMethod === 'GET' && pathParts[pathParts.length - 1] === 'actions') {
      // GET /api/actions
      const { limit, offset = 0, assigned_to, status } = queryStringParameters || {};
      
      let whereConditions = [];
      if (assigned_to) {
        whereConditions.push(`a.assigned_to = '${assigned_to}'`);
      }
      if (status) {
        if (status === 'unresolved') {
          whereConditions.push(`a.status IN ('not_started', 'in_progress', 'blocked')`);
        } else {
          whereConditions.push(`a.status = '${status}'`);
        }
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const limitClause = limit ? `LIMIT ${limit} OFFSET ${offset}` : '';
      
      const sql = `
        SELECT 
          a.*,
          om.full_name as assigned_to_name,
          om.favorite_color as assigned_to_color,
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score,
          CASE WHEN updates.action_id IS NOT NULL THEN true ELSE false END as has_implementation_updates,
          (
            SELECT COUNT(*) 
            FROM action_implementation_updates aiu 
            WHERE aiu.action_id = a.id
          ) as implementation_update_count
        FROM actions a
        LEFT JOIN organization_members om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        ${whereClause} 
        ORDER BY a.created_at DESC 
        ${limitClause}
      `;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result })
      };
    }

    // Default 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
