const { Client } = require('pg');
const { getAuthorizerContext, buildOrganizationFilter } = require('./shared/authorizerContext');

// Database configuration
// SECURITY: Password must be provided via environment variable
if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required');
}

const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
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
  } finally {
    await client.end();
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, queryStringParameters } = event;
  const authContext = getAuthorizerContext(event);
  const accessibleOrgIds = authContext.accessible_organization_ids || [];
  
  if (accessibleOrgIds.length === 0) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Organization access context not available' })
    };
  }
  
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

    // My actions endpoint - filter by Cognito user ID
    if (httpMethod === 'GET' && path.includes('/my-actions')) {
      const { cognitoUserId } = queryStringParameters || {};
      if (!cognitoUserId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'cognitoUserId parameter required' })
        };
      }

      const sql = `SELECT json_agg(row_to_json(t)) FROM (
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
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Action implementation updates endpoint
    if (httpMethod === 'GET' && path.endsWith('/action_implementation_updates')) {
      const { action_id, limit = 50 } = queryStringParameters || {};
      
      if (!action_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'action_id parameter required' })
        };
      }
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM action_implementation_updates 
        WHERE action_id = '${action_id}' 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // POST/PUT action (create/update)
    if ((httpMethod === 'POST' || httpMethod === 'PUT') && path.endsWith('/actions')) {
      const body = JSON.parse(event.body || '{}');
      const { id, created_by, updated_by, updated_at, completed_at, ...actionData } = body;
      
      const userId = created_by || updated_by || require('crypto').randomUUID();
      
      if (id) {
        // Update
        const updates = [];
        for (const [key, val] of Object.entries(actionData)) {
          if (val === undefined) continue;
          if (val === null) updates.push(`${key} = NULL`);
          else if (typeof val === 'string') updates.push(`${key} = '${val.replace(/'/g, "''")}'`);
          else if (typeof val === 'boolean') updates.push(`${key} = ${val}`);
          else if (Array.isArray(val)) {
            if (key === 'participants') {
              updates.push(`${key} = ARRAY[${val.map(v => `'${v}'`).join(',')}]::uuid[]`);
            } else if (key === 'required_tools' || key === 'attachments') {
              updates.push(`${key} = ARRAY[${val.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]::text[]`);
            } else {
              updates.push(`${key} = '${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
            }
          } else if (typeof val === 'object') updates.push(`${key} = '${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
          else updates.push(`${key} = ${val}`);
        }
        updates.push(`updated_by = '${userId}'`);
        if (completed_at) updates.push(`completed_at = '${completed_at}'`);
        
        const sql = `UPDATE actions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = '${id}' RETURNING *`;
        const result = await queryJSON(sql);
        return { statusCode: 200, headers, body: JSON.stringify({ data: result[0] }) };
      } else {
        // Create
        const uuid = require('crypto').randomUUID();
        const fields = ['id', 'created_by', 'updated_by', ...Object.keys(actionData)];
        const values = [`'${uuid}'`, `'${userId}'`, `'${userId}'`];
        
        for (const [key, val] of Object.entries(actionData)) {
          if (val === null) {
            values.push('NULL');
          } else if (typeof val === 'string') {
            values.push(`'${val.replace(/'/g, "''")}'`);
          } else if (typeof val === 'boolean') {
            values.push(val);
          } else if (Array.isArray(val)) {
            if (key === 'participants') {
              values.push(`ARRAY[${val.map(v => `'${v}'`).join(',')}]::uuid[]`);
            } else if (key === 'required_tools' || key === 'attachments') {
              values.push(`ARRAY[${val.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]::text[]`);
            } else {
              values.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
            }
          } else if (typeof val === 'object') {
            values.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
          } else {
            values.push(val);
          }
        }
        
        const sql = `INSERT INTO actions (${fields.join(', ')}, created_at, updated_at) VALUES (${values.join(', ')}, NOW(), NOW()) RETURNING *`;
        const result = await queryJSON(sql);
        return { statusCode: 201, headers, body: JSON.stringify({ data: result[0] }) };
      }
    }

    // Actions endpoint
    if (httpMethod === 'GET' && path.endsWith('/actions')) {
      const { limit, offset = 0, assigned_to, status } = queryStringParameters || {};
      
      const orgFilter = buildOrganizationFilter(authContext, 'a');
      let whereConditions = [];
      if (orgFilter.condition) whereConditions.push(orgFilter.condition);
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
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          a.*,
          om.full_name as assigned_to_name,
          om.favorite_color as assigned_to_color,
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score,
          CASE WHEN updates.action_id IS NOT NULL THEN true ELSE false END as has_implementation_updates,
          COALESCE((
            SELECT COUNT(*) 
            FROM action_implementation_updates aiu 
            WHERE aiu.action_id = a.id
          ), 0) as implementation_update_count
        FROM actions a
        LEFT JOIN profiles om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        ${whereClause} 
        ORDER BY a.created_at DESC 
        ${limitClause}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
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