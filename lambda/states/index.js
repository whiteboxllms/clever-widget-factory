const { getAuthorizerContext, buildOrganizationFilter } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse } = require('/opt/nodejs/response');
const { getDbClient } = require('/opt/nodejs/db');
const { formatSqlValue } = require('/opt/nodejs/sqlUtils');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

exports.handler = async (event) => {
  const { httpMethod, pathParameters } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const authContext = getAuthorizerContext(event);
  const organizationId = authContext.organization_id;

  if (!organizationId) {
    console.error('❌ ERROR: organization_id missing from authorizer context');
    return errorResponse(500, 'Server configuration error', headers);
  }

  try {
    switch (httpMethod) {
      case 'GET':
        return pathParameters?.id 
          ? await getState(pathParameters.id, authContext, headers)
          : await listStates(event, authContext, headers);
      case 'POST':
        return await createState(event, authContext, headers);
      case 'PUT':
        return await updateState(event, pathParameters?.id, authContext, headers);
      case 'DELETE':
        return await deleteState(pathParameters?.id, authContext, headers);
      default:
        return errorResponse(405, 'Method not allowed', headers);
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
    return errorResponse(500, error.message, headers);
  }
};

async function listStates(event, authContext, headers) {
  const client = await getDbClient();
  
  try {
    const queryParams = event.queryStringParameters || {};
    const { entity_type, entity_id } = queryParams;
    
    const orgFilter = buildOrganizationFilter(authContext, 's');
    console.log('🔍 listStates orgFilter:', JSON.stringify(orgFilter));
    console.log('🔍 authContext:', JSON.stringify(authContext));
    console.log('🔍 queryParams:', JSON.stringify(queryParams));
    
    // Temporary: bypass filter for testing
    const whereClause = orgFilter.condition === '1=0' 
      ? `s.organization_id = '${authContext.organization_id}'`
      : orgFilter.condition;
    
    // Add entity filtering if provided
    let entityFilter = '';
    if (entity_type && entity_id) {
      entityFilter = ` AND sl.entity_type = ${formatSqlValue(entity_type)} AND sl.entity_id = ${formatSqlValue(entity_id)}::uuid`;
    }
    
    const sql = `
      SELECT 
        s.id,
        s.organization_id,
        s.state_text as observation_text,
        s.captured_by,
        s.captured_at,
        s.created_at,
        s.updated_at,
        om.full_name as captured_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sp.id,
              'photo_url', sp.photo_url,
              'photo_description', sp.photo_description,
              'photo_order', sp.photo_order
            ) ORDER BY sp.photo_order
          ) FILTER (WHERE sp.id IS NOT NULL),
          '[]'
        ) as photos,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', sl.id,
              'entity_type', sl.entity_type,
              'entity_id', sl.entity_id
            )
          ) FILTER (WHERE sl.id IS NOT NULL),
          '[]'
        ) as links
      FROM states s
      LEFT JOIN organization_members om ON s.captured_by = om.user_id
      LEFT JOIN state_photos sp ON s.id = sp.state_id
      LEFT JOIN state_links sl ON s.id = sl.state_id
      WHERE ${whereClause}${entityFilter}
      GROUP BY s.id, s.organization_id, s.state_text, s.captured_by, s.captured_at, s.created_at, s.updated_at, om.full_name
      ORDER BY s.captured_at DESC
    `;

    console.log('🔍 Full SQL:', sql);
    const result = await client.query(sql);
    return successResponse(result.rows, headers);
  } finally {
    client.release();
  }
}

async function getState(id, authContext, headers) {
  const client = await getDbClient();
  
  try {
    const orgFilter = buildOrganizationFilter(authContext, 's');
    console.log('🔍 orgFilter:', JSON.stringify(orgFilter));
    console.log('🔍 id:', id, 'type:', typeof id);
    
    const sql = `
      SELECT 
        s.id,
        s.organization_id,
        s.state_text as observation_text,
        s.captured_by,
        s.captured_at,
        s.created_at,
        s.updated_at,
        om.full_name as captured_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sp.id,
              'photo_url', sp.photo_url,
              'photo_description', sp.photo_description,
              'photo_order', sp.photo_order
            ) ORDER BY sp.photo_order
          ) FILTER (WHERE sp.id IS NOT NULL),
          '[]'
        ) as photos,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', sl.id,
              'entity_type', sl.entity_type,
              'entity_id', sl.entity_id
            )
          ) FILTER (WHERE sl.id IS NOT NULL),
          '[]'
        ) as links
      FROM states s
      LEFT JOIN organization_members om ON s.captured_by = om.user_id
      LEFT JOIN state_photos sp ON s.id = sp.state_id
      LEFT JOIN state_links sl ON s.id = sl.state_id
      WHERE s.id = ${formatSqlValue(id)}::uuid AND ${orgFilter.condition}
      GROUP BY s.id, s.organization_id, s.state_text, s.captured_by, s.captured_at, s.created_at, s.updated_at, om.full_name
    `;

    console.log('🔍 Full SQL:', sql);
    const result = await client.query(sql);
    
    if (result.rows.length === 0) {
      return errorResponse(404, 'State not found', headers);
    }
    
    return successResponse(result.rows[0], headers);
  } finally {
    client.release();
  }
}

async function createState(event, authContext, headers) {
  const body = JSON.parse(event.body || '{}');
  const { state_text, captured_at, photos = [], links = [] } = body;
  const organizationId = authContext.organization_id;
  const userId = authContext.user_id;

  // Validation: Require at least one of state_text OR photos
  const hasText = state_text && state_text.trim().length > 0;
  const hasPhotos = photos && photos.length > 0;
  
  if (!hasText && !hasPhotos) {
    return errorResponse(400, 'Please add observation text or at least one photo', headers);
  }

  const client = await getDbClient();
  
  try {
    await client.query('BEGIN');

    const stateSql = `
      INSERT INTO states (
        organization_id,
        state_text,
        captured_by,
        captured_at
      ) VALUES (
        ${formatSqlValue(organizationId)},
        ${formatSqlValue(state_text)},
        ${formatSqlValue(userId)},
        ${formatSqlValue(captured_at || new Date().toISOString())}
      )
      RETURNING *
    `;
    
    const stateResult = await client.query(stateSql);
    const state = stateResult.rows[0];

    if (photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        await client.query(`
          INSERT INTO state_photos (
            state_id,
            photo_url,
            photo_description,
            photo_order
          ) VALUES (
            ${formatSqlValue(state.id)},
            ${formatSqlValue(photo.photo_url)},
            ${formatSqlValue(photo.photo_description)},
            ${formatSqlValue(photo.photo_order ?? i)}
          )
        `);
      }
    }

    if (links.length > 0) {
      for (const link of links) {
        await client.query(`
          INSERT INTO state_links (
            state_id,
            entity_type,
            entity_id
          ) VALUES (
            ${formatSqlValue(state.id)},
            ${formatSqlValue(link.entity_type)},
            ${formatSqlValue(link.entity_id)}
          )
        `);
      }
    }

    await client.query('COMMIT');

    return await getState(state.id, authContext, headers);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateState(event, id, authContext, headers) {
  const body = JSON.parse(event.body || '{}');
  const { state_text, captured_at, photos, links } = body;
  const organizationId = authContext.organization_id;

  const client = await getDbClient();
  
  try {
    await client.query('BEGIN');

    // Validation: If updating text or photos, ensure at least one will remain
    // First, get current state to check what exists
    const currentStateSql = `
      SELECT 
        s.state_text,
        COALESCE(
          json_agg(sp.id) FILTER (WHERE sp.id IS NOT NULL),
          '[]'
        ) as photo_ids
      FROM states s
      LEFT JOIN state_photos sp ON s.id = sp.state_id
      WHERE s.id = ${formatSqlValue(id)}::uuid AND s.organization_id = ${formatSqlValue(organizationId)}::uuid
      GROUP BY s.id, s.state_text
    `;
    
    const currentStateResult = await client.query(currentStateSql);
    if (currentStateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return errorResponse(404, 'State not found', headers);
    }
    
    const currentState = currentStateResult.rows[0];
    
    // Determine final state after update
    const finalText = state_text !== undefined ? state_text : currentState.state_text;
    const finalPhotos = photos !== undefined ? photos : currentState.photo_ids;
    
    const hasText = finalText && finalText.trim().length > 0;
    const hasPhotos = Array.isArray(finalPhotos) && finalPhotos.length > 0;
    
    if (!hasText && !hasPhotos) {
      await client.query('ROLLBACK');
      return errorResponse(400, 'Please add observation text or at least one photo', headers);
    }

    const updates = [];
    if (state_text !== undefined) updates.push(`state_text = ${formatSqlValue(state_text)}`);
    if (captured_at !== undefined) updates.push(`captured_at = ${formatSqlValue(captured_at)}`);
    
    if (updates.length > 0) {
      const sql = `
        UPDATE states
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = ${formatSqlValue(id)}::uuid AND organization_id = ${formatSqlValue(organizationId)}::uuid
        RETURNING *
      `;
      
      const result = await client.query(sql);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return errorResponse(404, 'State not found', headers);
      }
    }

    if (photos !== undefined) {
      await client.query(`DELETE FROM state_photos WHERE state_id = ${formatSqlValue(id)}`);
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        await client.query(`
          INSERT INTO state_photos (
            state_id,
            photo_url,
            photo_description,
            photo_order
          ) VALUES (
            ${formatSqlValue(id)},
            ${formatSqlValue(photo.photo_url)},
            ${formatSqlValue(photo.photo_description)},
            ${formatSqlValue(photo.photo_order ?? i)}
          )
        `);
      }
    }

    if (links !== undefined) {
      await client.query(`DELETE FROM state_links WHERE state_id = ${formatSqlValue(id)}`);
      
      for (const link of links) {
        await client.query(`
          INSERT INTO state_links (
            state_id,
            entity_type,
            entity_id
          ) VALUES (
            ${formatSqlValue(id)},
            ${formatSqlValue(link.entity_type)},
            ${formatSqlValue(link.entity_id)}
          )
        `);
      }
    }

    await client.query('COMMIT');

    return await getState(id, authContext, headers);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteState(id, authContext, headers) {
  const organizationId = authContext.organization_id;
  const client = await getDbClient();
  
  try {
    const sql = `
      DELETE FROM states
      WHERE id = ${formatSqlValue(id)}::uuid AND organization_id = ${formatSqlValue(organizationId)}::uuid
      RETURNING id
    `;
    
    const result = await client.query(sql);
    
    if (result.rows.length === 0) {
      return errorResponse(404, 'State not found', headers);
    }
    
    return successResponse({ message: 'State deleted', id }, headers);
  } finally {
    client.release();
  }
}
