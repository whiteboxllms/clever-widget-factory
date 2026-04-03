'use strict';

const { Pool } = require('pg');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse } = require('/opt/nodejs/response');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { validateStateSpaceModel } = require('./shared/validation');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });
const EMBEDDINGS_QUEUE_URL = process.env.EMBEDDINGS_QUEUE_URL ||
  'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';

/**
 * Compose embedding source from model fields.
 * Joins non-empty values with '. '
 */
function composeEmbeddingSource(name, description, modelDescriptionPrompt) {
  return [name, description, modelDescriptionPrompt]
    .filter(s => s && s.trim())
    .join('. ');
}

/**
 * Send an SQS message to queue embedding generation for a model.
 */
async function queueEmbedding(modelId, organizationId, embeddingSource) {
  if (!embeddingSource || !embeddingSource.trim()) {
    console.log('Empty embedding source for model', modelId, '— skipping SQS send');
    return;
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: EMBEDDINGS_QUEUE_URL,
    MessageBody: JSON.stringify({
      entity_type: 'state_space_model',
      entity_id: modelId,
      embedding_source: embeddingSource,
      organization_id: organizationId
    })
  }));

  console.log('Queued embedding for state_space_model', modelId);
}

/**
 * Parse the request body from the event.
 */
function parseBody(event) {
  return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
}

exports.handler = async (event) => {
  console.log('cwf-state-space-lambda', event.httpMethod, event.path);

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
    return errorResponse(401, 'Organization ID not found');
  }

  try {

    // ---------------------------------------------------------------
    // POST /api/state-space-models — Create a new model
    // ---------------------------------------------------------------
    if (httpMethod === 'POST' && path === '/api/state-space-models') {
      let body;
      try {
        body = parseBody(event);
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return errorResponse(400, 'Invalid JSON in request body');
      }

      const { model_definition, is_public } = body;

      if (!model_definition) {
        return errorResponse(400, 'model_definition is required');
      }

      // Validate model_definition with Zod + dimension checks
      const validation = validateStateSpaceModel(model_definition);
      if (!validation.success) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Validation failed', errors: validation.errors })
        };
      }

      const name = model_definition.model_metadata?.name;
      const description = model_definition.model_metadata?.description || null;
      const version = model_definition.model_metadata?.version || '1.0.0';
      const author = model_definition.model_metadata?.author || null;
      const modelDescriptionPrompt = model_definition.model_description_prompt || '';
      const createdBy = authContext?.cognito_user_id || null;

      const result = await pool.query(
        `INSERT INTO state_space_models
         (organization_id, name, description, version, author, model_definition, is_public, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [organizationId, name, description, version, author, JSON.stringify(model_definition), is_public || false, createdBy]
      );

      const created = result.rows[0];

      // Queue embedding generation (fire-and-forget)
      try {
        const embeddingSource = composeEmbeddingSource(name, description, modelDescriptionPrompt);
        await queueEmbedding(created.id, organizationId, embeddingSource);
      } catch (sqsErr) {
        console.error('Failed to queue embedding for model', created.id, sqsErr);
      }

      return successResponse({ data: created });
    }

    // ---------------------------------------------------------------
    // GET /api/state-space-models/by-entity — Models by entity
    // ---------------------------------------------------------------
    if (httpMethod === 'GET' && path === '/api/state-space-models/by-entity') {
      const entityType = queryStringParameters?.entity_type;
      const entityId = queryStringParameters?.entity_id;

      if (!entityType || !entityId) {
        return errorResponse(400, 'entity_type and entity_id query parameters are required');
      }

      const result = await pool.query(
        `SELECT m.*, a.id AS association_id, a.entity_type, a.entity_id, a.created_at AS associated_at
         FROM state_space_model_associations a
         JOIN state_space_models m ON m.id = a.model_id
         WHERE a.entity_type = $1 AND a.entity_id = $2
           AND (m.organization_id = $3 OR m.is_public = true)
         ORDER BY a.created_at DESC`,
        [entityType, entityId, organizationId]
      );

      return successResponse({ data: result.rows });
    }

    // ---------------------------------------------------------------
    // GET /api/state-space-models — List org models + public models
    // ---------------------------------------------------------------
    if (httpMethod === 'GET' && path === '/api/state-space-models') {
      const result = await pool.query(
        `SELECT * FROM state_space_models
         WHERE organization_id = $1 OR is_public = true
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return successResponse({ data: result.rows });
    }

    // ---------------------------------------------------------------
    // GET /api/state-space-models/:id — Single model
    // ---------------------------------------------------------------
    if (httpMethod === 'GET' && pathParameters?.id) {
      const result = await pool.query(
        `SELECT * FROM state_space_models
         WHERE id = $1 AND (organization_id = $2 OR is_public = true)`,
        [pathParameters.id, organizationId]
      );

      if (result.rows.length === 0) {
        return errorResponse(404, 'State space model not found');
      }

      return successResponse({ data: result.rows[0] });
    }

    // ---------------------------------------------------------------
    // PUT /api/state-space-models/:id — Update model
    // ---------------------------------------------------------------
    if (httpMethod === 'PUT' && pathParameters?.id) {
      let body;
      try {
        body = parseBody(event);
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return errorResponse(400, 'Invalid JSON in request body');
      }

      const { model_definition, is_public } = body;

      if (!model_definition) {
        return errorResponse(400, 'model_definition is required');
      }

      // Validate model_definition with Zod + dimension checks
      const validation = validateStateSpaceModel(model_definition);
      if (!validation.success) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Validation failed', errors: validation.errors })
        };
      }

      const name = model_definition.model_metadata?.name;
      const description = model_definition.model_metadata?.description || null;
      const version = model_definition.model_metadata?.version || '1.0.0';
      const author = model_definition.model_metadata?.author || null;
      const modelDescriptionPrompt = model_definition.model_description_prompt || '';

      // Scope update to organization-owned models only
      const result = await pool.query(
        `UPDATE state_space_models
         SET name = $1,
             description = $2,
             version = $3,
             author = $4,
             model_definition = $5,
             is_public = $6,
             updated_at = NOW()
         WHERE id = $7 AND organization_id = $8
         RETURNING *`,
        [name, description, version, author, JSON.stringify(model_definition), is_public !== undefined ? is_public : false, pathParameters.id, organizationId]
      );

      if (result.rows.length === 0) {
        return errorResponse(404, 'State space model not found');
      }

      const updated = result.rows[0];

      // Queue embedding generation (fire-and-forget)
      try {
        const embeddingSource = composeEmbeddingSource(name, description, modelDescriptionPrompt);
        await queueEmbedding(updated.id, organizationId, embeddingSource);
      } catch (sqsErr) {
        console.error('Failed to queue embedding for model', updated.id, sqsErr);
      }

      return successResponse({ data: updated });
    }

    // ---------------------------------------------------------------
    // DELETE /api/state-space-models/:id — Delete model (cascade)
    // ---------------------------------------------------------------
    if (httpMethod === 'DELETE' && path.match(/^\/api\/state-space-models\/[^/]+$/) && !path.includes('/associations')) {
      const id = pathParameters?.id;
      if (!id) {
        return errorResponse(400, 'Model ID is required');
      }

      const result = await pool.query(
        'DELETE FROM state_space_models WHERE id = $1 AND organization_id = $2 RETURNING *',
        [id, organizationId]
      );

      if (result.rows.length === 0) {
        return errorResponse(404, 'State space model not found');
      }

      return successResponse({ data: { message: 'State space model deleted successfully' } });
    }

    // ---------------------------------------------------------------
    // POST /api/state-space-models/:id/associations — Create association
    // ---------------------------------------------------------------
    if (httpMethod === 'POST' && path.includes('/associations') && pathParameters?.id) {
      let body;
      try {
        body = parseBody(event);
      } catch (parseErr) {
        console.error('Error parsing request body:', parseErr);
        return errorResponse(400, 'Invalid JSON in request body');
      }

      const { entity_type, entity_id } = body;

      if (!entity_type || !entity_id) {
        return errorResponse(400, 'entity_type and entity_id are required');
      }

      // Verify the model exists and belongs to the organization (or is public)
      const modelCheck = await pool.query(
        'SELECT id FROM state_space_models WHERE id = $1 AND (organization_id = $2 OR is_public = true)',
        [pathParameters.id, organizationId]
      );

      if (modelCheck.rows.length === 0) {
        return errorResponse(404, 'State space model not found');
      }

      const result = await pool.query(
        `INSERT INTO state_space_model_associations (model_id, entity_type, entity_id, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (model_id, entity_type, entity_id) DO UPDATE SET created_at = state_space_model_associations.created_at
         RETURNING *`,
        [pathParameters.id, entity_type, entity_id]
      );

      return successResponse({ data: result.rows[0] });
    }

    // ---------------------------------------------------------------
    // DELETE /api/state-space-models/:modelId/associations/:associationId
    // ---------------------------------------------------------------
    if (httpMethod === 'DELETE' && path.includes('/associations/')) {
      const modelId = pathParameters?.modelId || pathParameters?.id;
      const associationId = path.split('/associations/')[1];

      if (!modelId || !associationId) {
        return errorResponse(400, 'modelId and associationId are required');
      }

      // Verify the model belongs to the organization
      const modelCheck = await pool.query(
        'SELECT id FROM state_space_models WHERE id = $1 AND organization_id = $2',
        [modelId, organizationId]
      );

      if (modelCheck.rows.length === 0) {
        return errorResponse(404, 'State space model not found');
      }

      const result = await pool.query(
        'DELETE FROM state_space_model_associations WHERE id = $1 AND model_id = $2 RETURNING *',
        [associationId, modelId]
      );

      if (result.rows.length === 0) {
        return errorResponse(404, 'Association not found');
      }

      return successResponse({ data: { message: 'Association deleted successfully' } });
    }

    return errorResponse(404, 'Not found');

  } catch (err) {
    console.error('Error:', err);

    // Handle unique constraint violations (PostgreSQL error code 23505)
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('association')) {
        return errorResponse(409, 'Association already exists');
      }
      return errorResponse(409, 'A model with this name, author, and version already exists');
    }

    return errorResponse(500, err.message);
  }
};
