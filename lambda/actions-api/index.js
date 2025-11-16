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
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score
        FROM actions a
        LEFT JOIN organization_members om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
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
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score
        FROM actions a
        LEFT JOIN organization_members om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
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
