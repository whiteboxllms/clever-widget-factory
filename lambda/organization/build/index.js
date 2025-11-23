const { Client } = require('pg');
const { getAuthorizerContext } = require('./shared/authorizerContext');

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

    // Organization members endpoint
    if (httpMethod === 'GET' && path.endsWith('/organization_members')) {
      const orgIdsList = accessibleOrgIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT user_id, full_name, role, cognito_user_id
        FROM organization_members
        WHERE is_active = true 
          AND full_name IS NOT NULL 
          AND trim(full_name) != ''
          AND organization_id IN (${orgIdsList})
        ORDER BY full_name
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // All organization members endpoint (for management)
    if (httpMethod === 'GET' && path.includes('/organization_members/all')) {
      const { organization_id = '00000000-0000-0000-0000-000000000001' } = queryStringParameters || {};
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT user_id, full_name, role, is_active, created_at, super_admin, organization_id
        FROM organization_members
        WHERE organization_id = '${organization_id}'
        ORDER BY is_active DESC, full_name NULLS LAST
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Find organization member by email
    if (httpMethod === 'GET' && path.includes('/organization_members/by-email')) {
      const { email } = queryStringParameters || {};
      if (!email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email parameter required' })
        };
      }

      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT user_id, full_name, role, email, cognito_user_id
        FROM organization_members
        WHERE email = '${email}' AND is_active = true
        LIMIT 1
      ) t;`;
      
      const result = await queryJSON(sql);
      const member = result?.[0]?.json_agg?.[0] || null;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: member })
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