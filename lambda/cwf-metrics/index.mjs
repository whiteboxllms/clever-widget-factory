import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath || '';
  const pathParams = event.pathParameters || {};
  
  // CORS headers for all responses
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
  
  // Extract organization_id from authorizer context
  const organizationId = event.requestContext?.authorizer?.organization_id;
  
  if (!organizationId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: No organization context' })
    };
  }

  try {
    const toolId = pathParams.id; // API Gateway uses {id} not {tool_id}
    const metricId = pathParams.metric_id || pathParams.metricId;

    // GET /api/tools/{id}/metrics - List all metrics for a tool
    if (httpMethod === 'GET' && toolId && !metricId) {
      const result = await executeQuery(
        `SELECT metric_id, tool_id, name, unit, benchmark_value, details, created_at, organization_id
         FROM metrics
         WHERE tool_id = $1 AND organization_id = $2
         ORDER BY created_at DESC`,
        [toolId, organizationId]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ metrics: result.rows })
      };
    }

    // POST /api/tools/{id}/metrics - Create a new metric
    if (httpMethod === 'POST' && toolId) {
      const body = JSON.parse(event.body || '{}');
      const { name, unit, benchmark_value, details } = body;

      if (!name || !name.trim()) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Name is required' })
        };
      }

      const result = await executeQuery(
        `INSERT INTO metrics (tool_id, name, unit, benchmark_value, details, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING metric_id, tool_id, name, unit, benchmark_value, details, created_at, organization_id`,
        [toolId, name.trim(), unit || null, benchmark_value || null, details || null, organizationId]
      );

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ metric: result.rows[0] })
      };
    }

    // PUT /api/tools/{id}/metrics/{metric_id} - Update a metric
    if (httpMethod === 'PUT' && toolId && metricId) {
      const body = JSON.parse(event.body || '{}');
      const { name, unit, benchmark_value, details } = body;

      if (!name || !name.trim()) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Name is required' })
        };
      }

      const result = await executeQuery(
        `UPDATE metrics
         SET name = $1, unit = $2, benchmark_value = $3, details = $4
         WHERE metric_id = $5 AND tool_id = $6 AND organization_id = $7
         RETURNING metric_id, tool_id, name, unit, benchmark_value, details, created_at, organization_id`,
        [name.trim(), unit || null, benchmark_value || null, details || null, metricId, toolId, organizationId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Metric not found' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ metric: result.rows[0] })
      };
    }

    // DELETE /api/tools/{id}/metrics/{metric_id} - Delete a metric
    if (httpMethod === 'DELETE' && toolId && metricId) {
      const result = await executeQuery(
        `DELETE FROM metrics
         WHERE metric_id = $1 AND tool_id = $2 AND organization_id = $3
         RETURNING metric_id`,
        [metricId, toolId, organizationId]
      );

      if (result.rows.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Metric not found' })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true })
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
