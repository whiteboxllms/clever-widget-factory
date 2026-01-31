const { query } = require('@cwf/db');
const { getAuthorizerContext } = require('@cwf/authorizerContext');
const { success, error, corsResponse } = require('@cwf/response');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const {
  composePartEmbeddingSource,
  composeToolEmbeddingSource,
  composeActionEmbeddingSource,
  composeIssueEmbeddingSource,
  composePolicyEmbeddingSource
} = require('/opt/nodejs/lib/embedding-composition');

const sqs = new SQSClient({ region: 'us-west-2' });
const EMBEDDINGS_QUEUE_URL = process.env.EMBEDDINGS_QUEUE_URL || 
  'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';

/**
 * Embeddings Regenerate Lambda
 * 
 * Provides API endpoint to regenerate embeddings for a specific entity.
 * Fetches the entity from the appropriate table, composes embedding_source,
 * and sends an SQS message for async embedding generation.
 * 
 * Requirements: 7.3, 7.4, 10.4, 10.5
 */

// Map entity types to their database tables and composition functions
const ENTITY_CONFIG = {
  part: {
    table: 'parts',
    composeFn: composePartEmbeddingSource
  },
  tool: {
    table: 'tools',
    composeFn: composeToolEmbeddingSource
  },
  action: {
    table: 'actions',
    composeFn: composeActionEmbeddingSource
  },
  issue: {
    table: 'issues',
    composeFn: composeIssueEmbeddingSource
  },
  policy: {
    table: 'policy',
    composeFn: composePolicyEmbeddingSource
  }
};

exports.handler = async (event) => {
  console.log('Embeddings regenerate handler');
  
  const { httpMethod } = event;
  
  if (httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  if (httpMethod !== 'POST') {
    return error('Method not allowed', 405);
  }
  
  try {
    // Get organization context from authorizer
    const authContext = getAuthorizerContext(event);
    const organizationId = authContext.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id from authorizer context');
      return error('Unauthorized', 401);
    }
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { entity_type, entity_id } = body;
    
    // Validate required parameters
    if (!entity_type) {
      return error('entity_type is required', 400);
    }
    
    if (!entity_id) {
      return error('entity_id is required', 400);
    }
    
    // Validate entity_type
    const entityConfig = ENTITY_CONFIG[entity_type];
    if (!entityConfig) {
      const validTypes = Object.keys(ENTITY_CONFIG).join(', ');
      return error(`Invalid entity_type. Must be one of: ${validTypes}`, 400);
    }
    
    console.log(`Regenerating embedding for ${entity_type} ${entity_id}`);
    
    // Escape values to prevent SQL injection
    const escapedOrgId = organizationId.replace(/'/g, "''");
    const escapedEntityId = entity_id.replace(/'/g, "''");
    
    // Fetch entity from appropriate table
    const sql = `
      SELECT * 
      FROM ${entityConfig.table}
      WHERE id = '${escapedEntityId}'
        AND organization_id = '${escapedOrgId}'
      LIMIT 1
    `;
    
    console.log(`Fetching entity from ${entityConfig.table}`);
    const results = await query(sql);
    
    if (!results || results.length === 0) {
      console.log(`Entity not found: ${entity_type} ${entity_id}`);
      return error(`${entity_type} not found or access denied`, 404);
    }
    
    const entity = results[0];
    console.log(`Found ${entity_type}:`, entity.id);
    
    // Compose embedding_source using entity-specific composition function
    const embeddingSource = entityConfig.composeFn(entity);
    
    if (!embeddingSource || !embeddingSource.trim()) {
      console.log(`No embedding_source composed for ${entity_type} ${entity_id}`);
      return error('Cannot generate embedding: entity has no content to embed', 400);
    }
    
    console.log(`Composed embedding_source (${embeddingSource.length} chars): ${embeddingSource.substring(0, 100)}...`);
    
    // Send SQS message for embedding generation
    const sqsMessage = {
      entity_type,
      entity_id,
      embedding_source: embeddingSource,
      organization_id: organizationId
    };
    
    console.log('Sending SQS message for embedding generation');
    await sqs.send(new SendMessageCommand({
      QueueUrl: EMBEDDINGS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage)
    }));
    
    console.log(`Successfully queued embedding regeneration for ${entity_type} ${entity_id}`);
    
    // Return success response
    return success({
      message: 'Embedding regeneration queued successfully',
      entity_type,
      entity_id,
      embedding_source_length: embeddingSource.length
    });
    
  } catch (err) {
    console.error('Embeddings regenerate error:', err);
    
    // Provide more specific error messages for common issues
    if (err.message.includes('relation') && err.message.includes('does not exist')) {
      return error(`Entity table not found: ${err.message}`, 500);
    }
    
    if (err.message.includes('SQS') || err.message.includes('queue')) {
      return error(`Failed to queue embedding generation: ${err.message}`, 500);
    }
    
    return error(err.message, 500);
  }
};
