const { Client } = require('pg');

const getDbConfig = () => ({
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  console.log('Analytics Lambda Event:', JSON.stringify(event, null, 2));
  
  const path = event.path || event.rawPath;
  const method = event.httpMethod || event.requestContext?.http?.method;
  const queryParams = event.queryStringParameters || {};
  
  const authContext = event.requestContext?.authorizer || {};
  const organizationId = authContext.organization_id;
  
  console.log('Auth context:', authContext);
  console.log('Organization ID:', organizationId);
  
  if (!organizationId) {
    console.error('Missing organization_id from authorizer');
    return {
      statusCode: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Unauthorized: No organization context' })
    };
  }

  const client = new Client(getDbConfig());
  
  try {
    await client.connect();
    
    if (path.endsWith('/analytics/action_updates') && method === 'GET') {
      const { start_date, end_date, user_ids } = queryParams;
      
      console.log('Query params:', { start_date, end_date, user_ids, user_ids_type: typeof user_ids, user_ids_isArray: Array.isArray(user_ids) });
      
      if (!start_date || !end_date) {
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'start_date and end_date required' })
        };
      }
      
      let userFilter = '';
      if (user_ids) {
        // Handle comma-separated string or array
        const userIdArray = Array.isArray(user_ids) 
          ? user_ids 
          : user_ids.includes(',') 
            ? user_ids.split(',').map(id => id.trim()) 
            : [user_ids];
        if (userIdArray.length > 0) {
          const userIdList = userIdArray.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
          userFilter = `AND aiu.updated_by IN (${userIdList})`;
        }
      }
      
      const query = `
        SELECT 
          aiu.created_at,
          aiu.updated_by
        FROM action_implementation_updates aiu
        JOIN actions a ON aiu.action_id = a.id
        WHERE a.organization_id = $1
          AND aiu.created_at >= $2::timestamp
          AND aiu.created_at <= $3::timestamp
          ${userFilter}
        ORDER BY aiu.created_at
      `;
      
      console.log('Executing query:', query);
      console.log('Query params:', [organizationId, start_date, end_date]);
      
      const result = await client.query(query, [organizationId, start_date, end_date]);
      
      console.log('Query result count:', result.rows.length);
      
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,OPTIONS'
        },
        body: JSON.stringify({ data: result.rows })
      };
    }
    
    return {
      statusCode: 404,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
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
  } finally {
    await client.end();
  }
};
