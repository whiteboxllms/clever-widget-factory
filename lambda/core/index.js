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
  } finally {
    await client.end();
  }
}



exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path } = event;
  
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

    // Health check endpoint
    if (httpMethod === 'GET' && path.endsWith('/health')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }

    // Schema endpoint
    if (httpMethod === 'GET' && path.endsWith('/schema')) {
      const schema = {
        version: 1,
        tables: {
          actions: ['id', 'title', 'description', 'assigned_to', 'status', 'created_at', 'updated_at'],
          tools: ['id', 'name', 'description', 'category', 'status', 'serial_number', 'storage_location'],
          parts: ['id', 'name', 'description', 'category', 'current_quantity', 'minimum_quantity'],
          organization_members: ['user_id', 'full_name', 'role'],
          missions: ['id', 'title', 'description', 'created_by', 'created_at', 'updated_at']
        },
        last_updated: Date.now()
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(schema)
      };
    }

    // Tools endpoint
    if (httpMethod === 'GET' && path.endsWith('/tools')) {
      const { limit = 50, offset = 0 } = event.queryStringParameters || {};
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, name, description, category, status, serial_number, 
               parent_structure_id, storage_location, legacy_storage_vicinity,
               accountable_person_id, 
               CASE 
                 WHEN image_url LIKE '%supabase.co%' THEN 
                   REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
                 ELSE image_url 
               END as image_url,
               created_at, updated_at
        FROM tools ORDER BY name LIMIT ${limit} OFFSET ${offset}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Parts endpoint
    if (httpMethod === 'GET' && path.endsWith('/parts')) {
      const { limit = 50, offset = 0 } = event.queryStringParameters || {};
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT id, name, description, category, current_quantity, minimum_quantity, 
               unit, parent_structure_id, storage_location, legacy_storage_vicinity, 
               accountable_person_id, 
               CASE 
                 WHEN image_url LIKE '%supabase.co%' THEN 
                   REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
                 ELSE image_url 
               END as image_url,
               created_at, updated_at 
        FROM parts ORDER BY name LIMIT ${limit} OFFSET ${offset}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Issues endpoint
    if (httpMethod === 'GET' && path.endsWith('/issues')) {
      const { context_type, status } = event.queryStringParameters || {};
      let whereConditions = [];
      if (context_type) whereConditions.push(`context_type = '${context_type}'`);
      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',').map(s => `'${s}'`).join(',');
          whereConditions.push(`status IN (${statuses})`);
        } else {
          whereConditions.push(`status = '${status}'`);
        }
      }
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM issues ${whereClause} ORDER BY reported_at DESC
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Parts orders endpoint
    if (httpMethod === 'GET' && path.endsWith('/parts_orders')) {
      const { status } = event.queryStringParameters || {};
      let whereClause = '';
      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',').map(s => `'${s}'`).join(',');
          whereClause = `WHERE status IN (${statuses})`;
        } else {
          whereClause = `WHERE status = '${status}'`;
        }
      }
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM parts_orders ${whereClause} ORDER BY ordered_at DESC
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Organization members endpoint
    if (path.endsWith('/organization_members')) {
      if (httpMethod === 'GET') {
        const { cognito_user_id } = event.queryStringParameters || {};
        let whereClause = cognito_user_id ? `WHERE cognito_user_id = '${cognito_user_id}'` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM organization_members ${whereClause}
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { cognito_user_id, full_name } = body;
        
        if (!cognito_user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'cognito_user_id required' })
          };
        }
        
        // Update organization member full_name
        const sql = `
          UPDATE organization_members 
          SET full_name = '${full_name || ''}'
          WHERE cognito_user_id = '${cognito_user_id}'
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result })
        };
      }
    }

    // Profiles endpoint
    if (path.endsWith('/profiles')) {
      if (httpMethod === 'GET') {
        const { user_id } = event.queryStringParameters || {};
        let whereClause = user_id ? `WHERE user_id = '${user_id}'` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM profiles ${whereClause}
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { user_id, full_name, favorite_color } = body;
        
        if (!user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'user_id required' })
          };
        }
        
        // Upsert profile
        const sql = `
          INSERT INTO profiles (user_id, full_name, favorite_color, updated_at) 
          VALUES ('${user_id}', '${full_name || ''}', ${favorite_color ? `'${favorite_color}'` : 'NULL'}, NOW())
          ON CONFLICT (user_id) 
          DO UPDATE SET 
            full_name = EXCLUDED.full_name,
            favorite_color = ${favorite_color ? `'${favorite_color}'` : 'NULL'},
            updated_at = NOW()
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result })
        };
      }
    }

    // Checkouts endpoint
    if (httpMethod === 'GET' && path.endsWith('/checkouts')) {
      const { returned } = event.queryStringParameters || {};
      let whereClause = '';
      if (returned === 'false') {
        whereClause = 'WHERE returned = false';
      } else if (returned === 'true') {
        whereClause = 'WHERE returned = true';
      }
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM checkouts ${whereClause} ORDER BY checkout_date DESC
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Missions endpoint
    if (path.endsWith('/missions')) {
      if (httpMethod === 'GET') {
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM missions ORDER BY created_at DESC
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { 
          title, 
          problem_statement, 
          created_by, 
          qa_assigned_to,
          template_id,
          template_name,
          template_color,
          template_icon,
          organization_id
        } = body;
        
        if (!title || !created_by) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'title and created_by are required' })
          };
        }
        
        // Map Cognito user ID to database user_id if needed
        let dbUserId = created_by;
        if (created_by.includes('-')) {
          // If it looks like a UUID, assume it's already a database user_id
          dbUserId = created_by;
        } else {
          // If it's a Cognito user ID, look up the database user_id
          const userLookupSql = `SELECT user_id FROM organization_members WHERE cognito_user_id = '${created_by}' LIMIT 1;`;
          const userResult = await queryJSON(userLookupSql);
          if (userResult && userResult.length > 0) {
            dbUserId = userResult[0].user_id;
          } else {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'User not found in organization' })
            };
          }
        }
        
        // Map qa_assigned_to if provided
        let dbQaUserId = qa_assigned_to;
        if (qa_assigned_to && !qa_assigned_to.includes('-')) {
          const qaUserLookupSql = `SELECT user_id FROM organization_members WHERE cognito_user_id = '${qa_assigned_to}' LIMIT 1;`;
          const qaUserResult = await queryJSON(qaUserLookupSql);
          if (qaUserResult && qaUserResult.length > 0) {
            dbQaUserId = qaUserResult[0].user_id;
          }
        }
        
        const orgId = organization_id || '00000000-0000-0000-0000-000000000001';
        
        // Try without organization_id to see if there's a default or trigger
        const sql = `
          INSERT INTO missions (
            title, 
            problem_statement, 
            created_by, 
            qa_assigned_to,
            status, 
            template_id,
            template_name,
            template_color,
            template_icon,
            created_at, 
            updated_at
          ) VALUES (
            '${title.replace(/'/g, "''")}', 
            '${(problem_statement || '').replace(/'/g, "''")}', 
            '${dbUserId}', 
            ${dbQaUserId ? `'${dbQaUserId}'` : 'NULL'},
            'planning',
            ${template_id ? `'${template_id}'` : 'NULL'},
            ${template_name ? `'${template_name.replace(/'/g, "''")}'` : 'NULL'},
            ${template_color ? `'${template_color}'` : 'NULL'},
            ${template_icon ? `'${template_icon}'` : 'NULL'},
            NOW(), 
            NOW()
          )
          RETURNING *;
        `;
        
        console.log('SQL:', sql);
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Actions endpoint with full details
    if (httpMethod === 'GET' && path.endsWith('/actions')) {
      const { limit, offset = 0, assigned_to, status } = event.queryStringParameters || {};
      
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
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          a.*,
          om.full_name as assigned_to_name,
          om.favorite_color as assigned_to_color,
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score,
          CASE WHEN updates.action_id IS NOT NULL THEN true ELSE false END as has_implementation_updates,
          COALESCE(update_counts.count, 0) as implementation_update_count,
          -- Asset details
          CASE WHEN a.asset_id IS NOT NULL THEN
            json_build_object(
              'id', assets.id,
              'name', assets.name,
              'category', assets.category
            )
          END as asset,
          -- Issue tool details  
          CASE WHEN a.issue_tool_id IS NOT NULL THEN
            json_build_object(
              'id', issue_tools.id,
              'name', issue_tools.name,
              'category', issue_tools.category
            )
          END as issue_tool,
          -- Mission details
          CASE WHEN a.mission_id IS NOT NULL THEN
            json_build_object(
              'id', missions.id,
              'title', missions.title,
              'mission_number', missions.mission_number
            )
          END as mission,
          -- Participants details
          CASE WHEN participants.participants IS NOT NULL THEN
            participants.participants
          END as participants_details
        FROM actions a
        LEFT JOIN profiles om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        LEFT JOIN (
          SELECT action_id, COUNT(*) as count
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
          GROUP BY action_id
        ) update_counts ON a.id = update_counts.action_id
        LEFT JOIN tools assets ON a.asset_id = assets.id
        LEFT JOIN tools issue_tools ON a.issue_tool_id = issue_tools.id
        LEFT JOIN missions ON a.mission_id = missions.id
        LEFT JOIN (
          SELECT 
            ap.action_id,
            json_agg(
              json_build_object(
                'user_id', om_part.user_id,
                'full_name', om_part.full_name,
                'favorite_color', om_part.favorite_color
              )
            ) as participants
          FROM action_participants ap
          LEFT JOIN profiles om_part ON ap.user_id = om_part.user_id
          GROUP BY ap.action_id
        ) participants ON a.id = participants.action_id
        ${whereClause} 
        ORDER BY a.updated_at DESC 
        ${limitClause}
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
      const { action_id, limit = 50 } = event.queryStringParameters || {};
      
      if (!action_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'action_id parameter required' })
        };
      }
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          aiu.*,
          om.full_name as updated_by_name,
          om.favorite_color as updated_by_color
        FROM action_implementation_updates aiu
        LEFT JOIN profiles om ON aiu.updated_by = om.user_id
        WHERE aiu.action_id = '${action_id}' 
        ORDER BY aiu.created_at DESC 
        LIMIT ${limit}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Generic query endpoint
    if (httpMethod === 'POST' && path.endsWith('/query')) {
      const body = JSON.parse(event.body || '{}');
      const { sql, params = [] } = body;
      
      if (!sql) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'SQL query required' })
        };
      }

      // Simple parameter substitution (not production-ready)
      let finalSql = sql;
      params.forEach((param, i) => {
        finalSql = finalSql.replace(`$${i + 1}`, `'${param}'`);
      });
      
      const jsonSql = `SELECT json_agg(row_to_json(t)) FROM (${finalSql}) t;`;
      const result = await queryJSON(jsonSql);
      
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