const { Pool } = require('pg');
const { getAuthorizerContext } = require('@cwf/authorizerContext');
const { success, error } = require('@cwf/response');
const { logRequest } = require('@cwf/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  const startTime = Date.now();
  logRequest(event, 'cwf-explorations-lambda');

  const { httpMethod, pathParameters, queryStringParameters, path } = event;
  const authContext = getAuthorizerContext(event);
  const organizationId = authContext.organization_id;

  if (!organizationId) {
    return error('Organization ID not found', 401);
  }

  try {
    // GET /api/explorations - List or get by action_id
    if (httpMethod === 'GET' && path === '/api/explorations') {
      const actionId = queryStringParameters?.action_id;
      
      if (actionId) {
        const result = await pool.query(
          'SELECT * FROM exploration WHERE action_id = $1',
          [actionId]
        );
        return success(result.rows);
      }
      
      const result = await pool.query(
        'SELECT * FROM exploration ORDER BY created_at DESC'
      );
      return success(result.rows);
    }

    // GET /api/explorations/{id}
    if (httpMethod === 'GET' && pathParameters?.id) {
      const result = await pool.query(
        'SELECT * FROM exploration WHERE id = $1',
        [pathParameters.id]
      );
      
      if (result.rows.length === 0) {
        return error('Exploration not found', 404);
      }
      
      return success(result.rows[0]);
    }

    // POST /api/explorations
    if (httpMethod === 'POST' && path === '/api/explorations') {
      const body = JSON.parse(event.body);
      const { action_id, exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos } = body;

      if (!action_id || !exploration_code) {
        return error('action_id and exploration_code are required', 400);
      }

      const result = await pool.query(
        `INSERT INTO exploration 
         (action_id, exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [action_id, exploration_code, exploration_notes_text || null, metrics_text || null, public_flag || false, key_photos || []]
      );

      return success(result.rows[0]);
    }

    // PUT /api/explorations (update by action_id)
    if (httpMethod === 'PUT' && path === '/api/explorations' && !pathParameters?.id) {
      const body = JSON.parse(event.body);
      const { action_id, exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos } = body;

      if (!action_id) {
        return error('action_id is required', 400);
      }

      const result = await pool.query(
        `UPDATE exploration 
         SET exploration_code = COALESCE($1, exploration_code),
             exploration_notes_text = COALESCE($2, exploration_notes_text),
             metrics_text = COALESCE($3, metrics_text),
             public_flag = COALESCE($4, public_flag),
             key_photos = COALESCE($5, key_photos),
             updated_at = NOW()
         WHERE action_id = $6
         RETURNING *`,
        [exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos, action_id]
      );

      if (result.rows.length === 0) {
        return error('Exploration not found', 404);
      }

      return success(result.rows[0]);
    }

    // PUT /api/explorations/{id}
    if (httpMethod === 'PUT' && pathParameters?.id) {
      const body = JSON.parse(event.body);
      const { exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos } = body;

      const result = await pool.query(
        `UPDATE exploration 
         SET exploration_code = COALESCE($1, exploration_code),
             exploration_notes_text = COALESCE($2, exploration_notes_text),
             metrics_text = COALESCE($3, metrics_text),
             public_flag = COALESCE($4, public_flag),
             key_photos = COALESCE($5, key_photos),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos, pathParameters.id]
      );

      if (result.rows.length === 0) {
        return error('Exploration not found', 404);
      }

      return success(result.rows[0]);
    }

    // DELETE /api/explorations/{id}
    if (httpMethod === 'DELETE' && pathParameters?.id) {
      const result = await pool.query(
        'DELETE FROM exploration WHERE id = $1 RETURNING *',
        [pathParameters.id]
      );

      if (result.rows.length === 0) {
        return error('Exploration not found', 404);
      }

      return success({ message: 'Exploration deleted successfully' });
    }

    // GET /api/explorations/check-code/{code}
    if (httpMethod === 'GET' && path.includes('/check-code/')) {
      const code = pathParameters?.code;
      
      if (!code) {
        return error('Code parameter is required', 400);
      }

      const result = await pool.query(
        'SELECT EXISTS(SELECT 1 FROM exploration WHERE exploration_code = $1) as exists',
        [code]
      );

      return success({ exists: result.rows[0].exists });
    }

    // GET /api/explorations/codes-by-prefix/{prefix}
    if (httpMethod === 'GET' && path.includes('/codes-by-prefix/')) {
      const prefix = pathParameters?.prefix;
      
      if (!prefix) {
        return error('Prefix parameter is required', 400);
      }

      const result = await pool.query(
        'SELECT exploration_code FROM exploration WHERE exploration_code LIKE $1 ORDER BY exploration_code',
        [`${prefix}%`]
      );

      return success({ codes: result.rows.map(r => r.exploration_code) });
    }

    // GET /api/explorations/list
    if (httpMethod === 'GET' && path === '/api/explorations/list') {
      const result = await pool.query(`
        SELECT 
          e.id as exploration_id,
          e.exploration_code,
          e.exploration_notes_text,
          e.metrics_text,
          e.key_photos,
          e.public_flag,
          e.created_at,
          a.id as action_id,
          a.title,
          a.description as state_text,
          a.policy as summary_policy_text,
          a.created_by as explorer_id
        FROM exploration e
        JOIN actions a ON e.action_id = a.id
        ORDER BY e.created_at DESC
      `);

      return success(result.rows);
    }

    return error('Not found', 404);

  } catch (err) {
    console.error('Error:', err);
    return error(err.message, 500);
  }
};
