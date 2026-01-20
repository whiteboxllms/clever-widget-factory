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
  
  let authContext;
  let organizationId;
  
  try {
    authContext = getAuthorizerContext(event);
    organizationId = authContext?.organization_id;
  } catch (err) {
    console.error('Error getting authorizer context:', err);
    organizationId = null;
  }

  if (!organizationId) {
    return error('Organization ID not found', 401);
  }

  try {
    // GET /api/explorations - List or get by action_id
    if (httpMethod === 'GET' && path === '/api/explorations') {
      const actionId = queryStringParameters?.action_id;
      const status = queryStringParameters?.status;
      
      if (actionId) {
        // Get explorations linked to this action via junction table
        const result = await pool.query(
          `SELECT e.*, COUNT(ae.action_id) as action_count
           FROM exploration e
           LEFT JOIN action_exploration ae ON e.id = ae.exploration_id
           WHERE e.id IN (
             SELECT exploration_id FROM action_exploration WHERE action_id = $1
           )
           GROUP BY e.id
           ORDER BY e.created_at DESC`,
          [actionId]
        );
        return success(result.rows);
      }
      
      // List explorations with optional status filter
      let query = `SELECT e.*, COUNT(ae.action_id) as action_count
                   FROM exploration e
                   LEFT JOIN action_exploration ae ON e.id = ae.exploration_id`;
      const params = [];
      
      if (status) {
        const statuses = status.split(',').map(s => s.trim());
        query += ` WHERE e.status = ANY($1)`;
        params.push(statuses);
      }
      
      query += ` GROUP BY e.id ORDER BY e.created_at DESC`;
      
      const result = await pool.query(query, params);
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

    // POST /api/explorations - Create new exploration
    if (httpMethod === 'POST' && path === '/api/explorations') {
      let body;
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return error('Invalid JSON in request body', 400);
      }
      
      const { exploration_code, exploration_notes_text, metrics_text, public_flag, status } = body;

      // exploration_code is required
      if (!exploration_code) {
        return error('exploration_code is required', 400);
      }

      // Check if code already exists
      const codeCheck = await pool.query(
        'SELECT id FROM exploration WHERE exploration_code = $1',
        [exploration_code]
      );

      if (codeCheck.rows.length > 0) {
        return error('Exploration code already exists', 409);
      }

      // Create exploration
      const result = await pool.query(
        `INSERT INTO exploration 
         (exploration_code, exploration_notes_text, metrics_text, public_flag, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [exploration_code, exploration_notes_text || null, metrics_text || null, public_flag || false, status || 'in_progress']
      );

      return success(result.rows[0]);
    }

    // PUT /api/explorations (update by exploration_id in body)
    if (httpMethod === 'PUT' && path === '/api/explorations' && !pathParameters?.id) {
      let body;
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return error('Invalid JSON in request body', 400);
      }
      
      const { exploration_id, exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos } = body;

      if (!exploration_id) {
        return error('exploration_id is required', 400);
      }

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
        [exploration_code, exploration_notes_text, metrics_text, public_flag, key_photos, exploration_id]
      );

      if (result.rows.length === 0) {
        return error('Exploration not found', 404);
      }

      return success(result.rows[0]);
    }

    // PUT /api/explorations/{id}
    if (httpMethod === 'PUT' && pathParameters?.id) {
      let body;
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return error('Invalid JSON in request body', 400);
      }
      
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

    // POST /api/actions/{actionId}/explorations - Link action to multiple explorations
    if (httpMethod === 'POST' && path.includes('/explorations') && (pathParameters?.actionId || pathParameters?.id)) {
      const actionId = pathParameters.actionId || pathParameters.id;
      let body;
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return error('Invalid JSON in request body', 400);
      }
      
      const { exploration_ids } = body;

      if (!actionId || !exploration_ids || !Array.isArray(exploration_ids) || exploration_ids.length === 0) {
        return error('actionId and exploration_ids array are required', 400);
      }

      // Verify action exists
      const actionCheck = await pool.query(
        'SELECT * FROM actions WHERE id = $1',
        [actionId]
      );

      if (actionCheck.rows.length === 0) {
        return error('Action not found', 404);
      }

      const action = actionCheck.rows[0];

      // Verify all explorations exist and are not integrated
      const explorationCheck = await pool.query(
        'SELECT id, status FROM exploration WHERE id = ANY($1)',
        [exploration_ids]
      );

      if (explorationCheck.rows.length !== exploration_ids.length) {
        return error('One or more explorations not found', 404);
      }

      // Check if any exploration is integrated
      const integratedExp = explorationCheck.rows.find(e => e.status === 'integrated');
      if (integratedExp) {
        return error('Cannot link to archived exploration', 409);
      }

      // Insert links into junction table
      const linkPromises = exploration_ids.map(expId =>
        pool.query(
          `INSERT INTO action_exploration (action_id, exploration_id, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           ON CONFLICT (action_id, exploration_id) DO UPDATE SET updated_at = NOW()`,
          [actionId, expId]
        )
      );

      await Promise.all(linkPromises);

      // Get all linked explorations for response
      const linkedExplorations = await pool.query(
        `SELECT e.*
         FROM exploration e
         WHERE e.id = ANY($1)
         ORDER BY e.created_at DESC`,
        [exploration_ids]
      );

      return success({
        action: { ...action, exploration_ids: exploration_ids },
        explorations: linkedExplorations.rows
      });
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
      const { status = 'in_progress,ready_for_analysis' } = queryStringParameters || {};
      
      const statuses = status.split(',').map(s => s.trim());
      
      const result = await pool.query(`
        SELECT 
          e.id,
          e.exploration_code,
          e.exploration_notes_text,
          e.metrics_text,
          e.public_flag,
          e.status,
          e.created_at,
          e.updated_at,
          COUNT(ae.action_id) as action_count
        FROM exploration e
        LEFT JOIN action_exploration ae ON e.id = ae.exploration_id
        WHERE e.status = ANY($1::exploration_status[])
        GROUP BY e.id
        ORDER BY e.created_at DESC
      `, [statuses]);

      return success(result.rows);
    }

    // DELETE /api/actions/{actionId}/explorations/{explorationId} - Unlink action from exploration
    if (httpMethod === 'DELETE' && path.includes('/explorations/') && (pathParameters?.actionId || pathParameters?.id)) {
      const actionId = pathParameters.actionId || pathParameters.id;
      const explorationId = path.split('/explorations/')[1];

      if (!actionId || !explorationId) {
        return error('actionId and explorationId are required', 400);
      }

      // Verify action exists
      const actionCheck = await pool.query(
        'SELECT * FROM actions WHERE id = $1',
        [actionId]
      );

      if (actionCheck.rows.length === 0) {
        return error('Action not found', 404);
      }

      // Delete the link
      await pool.query(
        'DELETE FROM action_exploration WHERE action_id = $1 AND exploration_id = $2',
        [actionId, explorationId]
      );

      const action = actionCheck.rows[0];
      return success({
        action: { ...action, exploration_ids: [] },
        message: 'Exploration unlinked successfully'
      });
    }

    return error('Not found', 404);

  } catch (err) {
    console.error('Error:', err);
    return error(err.message, 500);
  }
};
