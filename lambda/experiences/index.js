const { Pool } = require('pg');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse } = require('/opt/nodejs/response');
const success = (data) => successResponse(data);
const error = (message, statusCode = 500) => errorResponse(statusCode, message);

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

  const { httpMethod, pathParameters, queryStringParameters, path } = event;
  
  let authContext;
  let organizationId;
  let userId;
  
  try {
    authContext = getAuthorizerContext(event);
    organizationId = authContext?.organization_id;
    userId = authContext?.user_id;
  } catch (err) {
    console.error('Error getting authorizer context:', err);
    organizationId = null;
    userId = null;
  }

  if (!organizationId) {
    return error('Organization ID not found', 401);
  }

  try {
    // GET /api/experiences - List experiences with filters
    if (httpMethod === 'GET' && path === '/api/experiences') {
      const entity_type = queryStringParameters?.entity_type;
      const entity_id = queryStringParameters?.entity_id;
      const limit = parseInt(queryStringParameters?.limit || '50', 10);
      const offset = parseInt(queryStringParameters?.offset || '0', 10);

      // Build query with filters
      let query = `
        SELECT 
          e.id,
          e.entity_type,
          e.entity_id,
          e.organization_id,
          e.created_by,
          e.created_at
        FROM experiences e
        WHERE e.organization_id = $1
      `;
      const params = [organizationId];
      let paramIndex = 2;

      if (entity_type) {
        query += ` AND e.entity_type = $${paramIndex}`;
        params.push(entity_type);
        paramIndex++;
      }

      if (entity_id) {
        query += ` AND e.entity_id = $${paramIndex}`;
        params.push(entity_id);
        paramIndex++;
      }

      query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const experiencesResult = await pool.query(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM experiences e
        WHERE e.organization_id = $1
      `;
      const countParams = [organizationId];
      let countParamIndex = 2;

      if (entity_type) {
        countQuery += ` AND e.entity_type = $${countParamIndex}`;
        countParams.push(entity_type);
        countParamIndex++;
      }

      if (entity_id) {
        countQuery += ` AND e.entity_id = $${countParamIndex}`;
        countParams.push(entity_id);
        countParamIndex++;
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total, 10);

      // Fetch components for each experience
      const experiences = await Promise.all(
        experiencesResult.rows.map(async (experience) => {
          const componentsResult = await pool.query(
            `SELECT 
               ec.id,
               ec.experience_id,
               ec.component_type,
               ec.state_id,
               ec.action_id,
               ec.organization_id,
               ec.created_at,
               s.id as state_id_detail,
               s.state_text,
               s.captured_at,
               s.photos,
               a.id as action_id_detail,
               a.title as action_title,
               a.description as action_description,
               a.created_at as action_created_at
             FROM experience_components ec
             LEFT JOIN states s ON ec.state_id = s.id
             LEFT JOIN actions a ON ec.action_id = a.id
             WHERE ec.experience_id = $1
             ORDER BY 
               CASE ec.component_type
                 WHEN 'initial_state' THEN 1
                 WHEN 'action' THEN 2
                 WHEN 'final_state' THEN 3
               END`,
            [experience.id]
          );

          const components = {};
          componentsResult.rows.forEach((comp) => {
            if (comp.component_type === 'initial_state' || comp.component_type === 'final_state') {
              components[comp.component_type] = {
                id: comp.id,
                experience_id: comp.experience_id,
                component_type: comp.component_type,
                state_id: comp.state_id,
                organization_id: comp.organization_id,
                created_at: comp.created_at,
                state: comp.state_id_detail ? {
                  id: comp.state_id_detail,
                  state_text: comp.state_text,
                  captured_at: comp.captured_at,
                  photos: comp.photos
                } : null
              };
            } else if (comp.component_type === 'action') {
              components.action = {
                id: comp.id,
                experience_id: comp.experience_id,
                component_type: comp.component_type,
                action_id: comp.action_id,
                organization_id: comp.organization_id,
                created_at: comp.created_at,
                action: comp.action_id_detail ? {
                  id: comp.action_id_detail,
                  title: comp.action_title,
                  description: comp.action_description,
                  created_at: comp.action_created_at
                } : null
              };
            }
          });

          return {
            ...experience,
            components
          };
        })
      );

      return success({
        data: experiences,
        pagination: {
          total,
          limit,
          offset
        }
      });
    }

    // GET /api/experiences/:id - Get single experience with all components
    if (httpMethod === 'GET' && pathParameters?.id) {
      const experienceId = pathParameters.id;

      // Fetch experience
      const experienceResult = await pool.query(
        `SELECT * FROM experiences WHERE id = $1 AND organization_id = $2`,
        [experienceId, organizationId]
      );

      if (experienceResult.rows.length === 0) {
        return error('Experience not found', 404);
      }

      const experience = experienceResult.rows[0];

      // Fetch entity details based on entity_type
      let entity = null;
      if (experience.entity_type === 'tool') {
        const toolResult = await pool.query(
          `SELECT id, name, category FROM tools WHERE id = $1`,
          [experience.entity_id]
        );
        entity = toolResult.rows[0] || null;
      } else if (experience.entity_type === 'part') {
        const partResult = await pool.query(
          `SELECT id, name, category FROM parts WHERE id = $1`,
          [experience.entity_id]
        );
        entity = partResult.rows[0] || null;
      }

      // Fetch components with details
      const componentsResult = await pool.query(
        `SELECT 
           ec.id,
           ec.experience_id,
           ec.component_type,
           ec.state_id,
           ec.action_id,
           ec.organization_id,
           ec.created_at,
           s.id as state_id_detail,
           s.state_text,
           s.captured_at,
           s.photos,
           a.id as action_id_detail,
           a.title as action_title,
           a.description as action_description,
           a.created_at as action_created_at
         FROM experience_components ec
         LEFT JOIN states s ON ec.state_id = s.id
         LEFT JOIN actions a ON ec.action_id = a.id
         WHERE ec.experience_id = $1
         ORDER BY 
           CASE ec.component_type
             WHEN 'initial_state' THEN 1
             WHEN 'action' THEN 2
             WHEN 'final_state' THEN 3
           END`,
        [experienceId]
      );

      const components = {};
      componentsResult.rows.forEach((comp) => {
        if (comp.component_type === 'initial_state' || comp.component_type === 'final_state') {
          components[comp.component_type] = {
            id: comp.id,
            experience_id: comp.experience_id,
            component_type: comp.component_type,
            state_id: comp.state_id,
            organization_id: comp.organization_id,
            created_at: comp.created_at,
            state: comp.state_id_detail ? {
              id: comp.state_id_detail,
              state_text: comp.state_text,
              captured_at: comp.captured_at,
              photos: comp.photos
            } : null
          };
        } else if (comp.component_type === 'action') {
          components.action = {
            id: comp.id,
            experience_id: comp.experience_id,
            component_type: comp.component_type,
            action_id: comp.action_id,
            organization_id: comp.organization_id,
            created_at: comp.created_at,
            action: comp.action_id_detail ? {
              id: comp.action_id_detail,
              title: comp.action_title,
              description: comp.action_description,
              created_at: comp.action_created_at
            } : null
          };
        }
      });

      return success({
        ...experience,
        entity,
        components
      });
    }

    // POST /api/experiences - Create new experience
    if (httpMethod === 'POST' && path === '/api/experiences') {
      let body;
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return error('Invalid JSON in request body', 400);
      }
      
      const { entity_type, entity_id, initial_state_id, action_id, final_state_id } = body;

      // Validate required fields
      if (!entity_type || !entity_id || !final_state_id) {
        return error('entity_type, entity_id, and final_state_id are required', 400);
      }

      // Validate entity_type
      if (!['tool', 'part'].includes(entity_type)) {
        return error('entity_type must be "tool" or "part"', 400);
      }

      // Start transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create experience record
        const experienceResult = await client.query(
          `INSERT INTO experiences 
           (entity_type, entity_id, organization_id, created_by, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [entity_type, entity_id, organizationId, userId]
        );

        const experience = experienceResult.rows[0];

        // Create components object to return
        const components = {};

        // Create initial_state component if provided
        if (initial_state_id) {
          const initialStateResult = await client.query(
            `INSERT INTO experience_components 
             (experience_id, component_type, state_id, organization_id, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING *`,
            [experience.id, 'initial_state', initial_state_id, organizationId]
          );

          // Fetch state details
          const stateResult = await client.query(
            `SELECT id, state_text, captured_at, photos FROM states WHERE id = $1`,
            [initial_state_id]
          );

          components.initial_state = {
            ...initialStateResult.rows[0],
            state: stateResult.rows[0]
          };
        }

        // Create action component if provided
        if (action_id) {
          const actionResult = await client.query(
            `INSERT INTO experience_components 
             (experience_id, component_type, action_id, organization_id, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING *`,
            [experience.id, 'action', action_id, organizationId]
          );

          // Fetch action details
          const actionDetailsResult = await client.query(
            `SELECT id, title, description, created_at FROM actions WHERE id = $1`,
            [action_id]
          );

          components.action = {
            ...actionResult.rows[0],
            action: actionDetailsResult.rows[0]
          };
        }

        // Create final_state component (required)
        const finalStateResult = await client.query(
          `INSERT INTO experience_components 
           (experience_id, component_type, state_id, organization_id, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [experience.id, 'final_state', final_state_id, organizationId]
        );

        // Fetch state details
        const finalStateDetailsResult = await client.query(
          `SELECT id, state_text, captured_at, photos FROM states WHERE id = $1`,
          [final_state_id]
        );

        components.final_state = {
          ...finalStateResult.rows[0],
          state: finalStateDetailsResult.rows[0]
        };

        await client.query('COMMIT');

        return success({
          ...experience,
          components
        });

      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    }

    return error('Not found', 404);

  } catch (err) {
    console.error('Error:', err);
    return error(err.message, 500);
  }
};
