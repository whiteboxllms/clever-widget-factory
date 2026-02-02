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
          ? await getObservation(pathParameters.id, authContext, headers)
          : await listObservations(authContext, headers);
      case 'POST':
        return await createObservation(event, authContext, headers);
      case 'PUT':
        return await updateObservation(event, pathParameters?.id, authContext, headers);
      case 'DELETE':
        return await deleteObservation(pathParameters?.id, authContext, headers);
      default:
        return errorResponse(405, 'Method not allowed', headers);
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
    return errorResponse(500, error.message, headers);
  }
};

async function listObservations(authContext, headers) {
  const client = await getDbClient();
  
  try {
    const orgFilter = buildOrganizationFilter(authContext, 'o');
    
    const sql = `
      SELECT 
        o.*,
        om.full_name as observed_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', op.id,
              'photo_url', op.photo_url,
              'photo_description', op.photo_description,
              'photo_order', op.photo_order
            ) ORDER BY op.photo_order
          ) FILTER (WHERE op.id IS NOT NULL),
          '[]'
        ) as photos,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ol.id,
              'entity_type', ol.entity_type,
              'entity_id', ol.entity_id
            )
          ) FILTER (WHERE ol.id IS NOT NULL),
          '[]'
        ) as links
      FROM observations o
      LEFT JOIN organization_members om ON o.observed_by = om.user_id
      LEFT JOIN observation_photos op ON o.id = op.observation_id
      LEFT JOIN observation_links ol ON o.id = ol.observation_id
      WHERE ${orgFilter.condition}
      GROUP BY o.id, om.full_name
      ORDER BY o.observed_at DESC
    `;

    const result = await client.query(sql);
    return successResponse(result.rows, headers);
  } finally {
    client.release();
  }
}

async function getObservation(id, authContext, headers) {
  const client = await getDbClient();
  
  try {
    const orgFilter = buildOrganizationFilter(authContext, 'o');
    console.log('🔍 orgFilter:', JSON.stringify(orgFilter));
    console.log('🔍 id:', id, 'type:', typeof id);
    
    const sql = `
      SELECT 
        o.*,
        om.full_name as observed_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', op.id,
              'photo_url', op.photo_url,
              'photo_description', op.photo_description,
              'photo_order', op.photo_order
            ) ORDER BY op.photo_order
          ) FILTER (WHERE op.id IS NOT NULL),
          '[]'
        ) as photos,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', ol.id,
              'entity_type', ol.entity_type,
              'entity_id', ol.entity_id
            )
          ) FILTER (WHERE ol.id IS NOT NULL),
          '[]'
        ) as links
      FROM observations o
      LEFT JOIN organization_members om ON o.observed_by = om.user_id
      LEFT JOIN observation_photos op ON o.id = op.observation_id
      LEFT JOIN observation_links ol ON o.id = ol.observation_id
      WHERE o.id = ${formatSqlValue(id)}::uuid AND ${orgFilter.condition}
      GROUP BY o.id, om.full_name
    `;

    console.log('🔍 Full SQL:', sql);
    const result = await client.query(sql);
    
    if (result.rows.length === 0) {
      return errorResponse(404, 'Observation not found', headers);
    }
    
    return successResponse(result.rows[0], headers);
  } finally {
    client.release();
  }
}

async function createObservation(event, authContext, headers) {
  const body = JSON.parse(event.body || '{}');
  const { observation_text, observed_at, photos = [], links = [] } = body;
  const organizationId = authContext.organization_id;
  const userId = authContext.user_id;

  const client = await getDbClient();
  
  try {
    await client.query('BEGIN');

    const obsSql = `
      INSERT INTO observations (
        organization_id,
        observation_text,
        observed_by,
        observed_at
      ) VALUES (
        ${formatSqlValue(organizationId)},
        ${formatSqlValue(observation_text)},
        ${formatSqlValue(userId)},
        ${formatSqlValue(observed_at || new Date().toISOString())}
      )
      RETURNING *
    `;
    
    const obsResult = await client.query(obsSql);
    const observation = obsResult.rows[0];

    if (photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        await client.query(`
          INSERT INTO observation_photos (
            observation_id,
            photo_url,
            photo_description,
            photo_order
          ) VALUES (
            ${formatSqlValue(observation.id)},
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
          INSERT INTO observation_links (
            observation_id,
            entity_type,
            entity_id
          ) VALUES (
            ${formatSqlValue(observation.id)},
            ${formatSqlValue(link.entity_type)},
            ${formatSqlValue(link.entity_id)}
          )
        `);
      }
    }

    await client.query('COMMIT');

    return await getObservation(observation.id, authContext, headers);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateObservation(event, id, authContext, headers) {
  const body = JSON.parse(event.body || '{}');
  const { observation_text, observed_at, photos, links } = body;
  const organizationId = authContext.organization_id;

  const client = await getDbClient();
  
  try {
    await client.query('BEGIN');

    const updates = [];
    if (observation_text !== undefined) updates.push(`observation_text = ${formatSqlValue(observation_text)}`);
    if (observed_at !== undefined) updates.push(`observed_at = ${formatSqlValue(observed_at)}`);
    
    if (updates.length > 0) {
      const sql = `
        UPDATE observations
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = ${formatSqlValue(id)}::uuid AND organization_id = ${formatSqlValue(organizationId)}::uuid
        RETURNING *
      `;
      
      const result = await client.query(sql);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return errorResponse(404, 'Observation not found', headers);
      }
    }

    if (photos !== undefined) {
      await client.query(`DELETE FROM observation_photos WHERE observation_id = ${formatSqlValue(id)}`);
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        await client.query(`
          INSERT INTO observation_photos (
            observation_id,
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
      await client.query(`DELETE FROM observation_links WHERE observation_id = ${formatSqlValue(id)}`);
      
      for (const link of links) {
        await client.query(`
          INSERT INTO observation_links (
            observation_id,
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

    return await getObservation(id, authContext, headers);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteObservation(id, authContext, headers) {
  const organizationId = authContext.organization_id;
  const client = await getDbClient();
  
  try {
    const sql = `
      DELETE FROM observations
      WHERE id = ${formatSqlValue(id)}::uuid AND organization_id = ${formatSqlValue(organizationId)}::uuid
      RETURNING id
    `;
    
    const result = await client.query(sql);
    
    if (result.rows.length === 0) {
      return errorResponse(404, 'Observation not found', headers);
    }
    
    return successResponse({ message: 'Observation deleted', id }, headers);
  } finally {
    client.release();
  }
}
