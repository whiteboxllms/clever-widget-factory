const { Client } = require('pg');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');

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

// Helper to execute parameterized SQL
async function queryParams(sql, params) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(sql, params);
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
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Organization-Id,X-Connection-Id',
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
      const filterUserId = queryStringParameters?.cognito_user_id;
      
      let sql;
      if (filterUserId) {
        // Return all memberships for a specific user across ALL their orgs
        // Don't filter by accessibleOrgIds here — this is needed for org switching
        // Security: user can only query their own memberships (cognito_user_id from authorizer)
        const requestingUserId = authContext.cognito_user_id;
        const targetUserId = filterUserId === requestingUserId ? filterUserId : null;
        
        if (!targetUserId) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Can only query your own memberships' })
          };
        }
        
        sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT user_id, cognito_user_id, organization_id, full_name, role, favorite_color, is_active
          FROM organization_members
          WHERE cognito_user_id = '${targetUserId.replace(/'/g, "''")}'
            AND is_active = true
          ORDER BY created_at ASC
        ) t;`;
      } else {
        // Default: deduplicated list of all members across accessible orgs
        sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT DISTINCT ON (cognito_user_id) cognito_user_id as user_id, full_name, role, cognito_user_id, favorite_color, is_active
          FROM organization_members
          WHERE full_name IS NOT NULL 
            AND trim(full_name) != ''
            AND cognito_user_id IS NOT NULL
            AND organization_id IN (${orgIdsList})
          ORDER BY cognito_user_id, full_name
        ) t;`;
      }
      
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

    // Create organization (admin only)
    if (httpMethod === 'POST' && path.endsWith('/organizations')) {
      // Only admins can create organizations
      if (authContext.user_role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Only admin users can create organizations' })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { name, subdomain } = body;

      if (!name || !name.trim()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Organization name is required' })
        };
      }

      // Create the organization
      const createOrgSql = `
        INSERT INTO organizations (name, subdomain, is_active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        RETURNING id, name, subdomain, is_active, created_at, updated_at;
      `;
      const orgRows = await queryParams(createOrgSql, [name.trim(), subdomain || null]);
      const newOrg = orgRows[0];

      // Add the creating user as an admin member of the new organization
      const addMemberSql = `
        INSERT INTO organization_members (organization_id, user_id, cognito_user_id, role, is_active, created_at)
        VALUES ($1, $2, $2, 'admin', true, NOW())
        ON CONFLICT DO NOTHING;
      `;
      await queryParams(addMemberSql, [newOrg.id, authContext.cognito_user_id]);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ data: newOrg })
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