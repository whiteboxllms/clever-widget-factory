const { generateEmbeddingV1 } = require('@cwf/embeddings');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { summarizeAction, summarizeIssue, shouldSummarize } = require('./ai-summarizer');
const {
  composePartEmbeddingSource,
  composeToolEmbeddingSource,
  composeActionEmbeddingSource,
  composeIssueEmbeddingSource,
  composePolicyEmbeddingSource
} = require('/opt/nodejs/lib/embedding-composition');

const lambda = new LambdaClient({ region: 'us-west-2' });

// Configuration flags for migration
const WRITE_TO_UNIFIED = process.env.WRITE_TO_UNIFIED !== 'false'; // default true
const WRITE_TO_INLINE = process.env.WRITE_TO_INLINE !== 'false'; // default true
const USE_AI_SUMMARIZATION = process.env.USE_AI_SUMMARIZATION === 'true'; // default false

/**
 * Write embedding to unified_embeddings table
 * @param {string} entityType - Entity type (part, tool, action, issue, policy)
 * @param {string} entityId - Entity UUID
 * @param {string} embeddingSource - Text used to generate embedding
 * @param {number[]} embedding - Embedding vector (1536 dimensions)
 * @param {string} organizationId - Organization UUID
 */
async function writeToUnifiedTable(entityType, entityId, embeddingSource, embedding, organizationId) {
  const embeddingArray = `[${embedding.join(',')}]`;
  const escapedSource = embeddingSource.replace(/'/g, "''");
  const escapedOrgId = organizationId.replace(/'/g, "''");
  const escapedEntityType = entityType.replace(/'/g, "''");
  const escapedEntityId = entityId.replace(/'/g, "''");
  
  const sql = `
    INSERT INTO unified_embeddings (entity_type, entity_id, embedding_source, model_version, embedding, organization_id)
    VALUES ('${escapedEntityType}', '${escapedEntityId}', '${escapedSource}', 'titan-v1', '${embeddingArray}'::vector, '${escapedOrgId}')
    ON CONFLICT (entity_type, entity_id, model_version) 
    DO UPDATE SET 
      embedding_source = EXCLUDED.embedding_source,
      embedding = EXCLUDED.embedding,
      updated_at = NOW()
  `;
  
  const response = await lambda.send(new InvokeCommand({
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  console.log('Unified table write result:', result);
  return result;
}

/**
 * Write embedding to inline columns (backward compatibility for parts and tools)
 * @param {string} table - Table name (parts or tools)
 * @param {string} id - Entity UUID
 * @param {string} embeddingSource - Text used to generate embedding
 * @param {number[]} embedding - Embedding vector (1536 dimensions)
 */
async function writeToInlineColumns(table, id, embeddingSource, embedding) {
  // Only for parts and tools (backward compatibility)
  if (!['parts', 'tools'].includes(table)) {
    return;
  }
  
  const embeddingArray = `[${embedding.join(',')}]`;
  const escapedSource = embeddingSource.replace(/'/g, "''");
  const escapedId = id.replace(/'/g, "''");
  
  const sql = `
    UPDATE ${table} 
    SET search_text = '${escapedSource}', 
        search_embedding = '${embeddingArray}'::vector 
    WHERE id = '${escapedId}'
  `;
  
  const response = await lambda.send(new InvokeCommand({
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  console.log('Inline columns write result:', result);
  return result;
}

/**
 * Compose or summarize embedding source based on entity type and configuration
 * @param {string} entityType - Entity type
 * @param {Object} fields - Entity fields
 * @param {Array<string>} [assets] - Related assets (for actions)
 * @returns {Promise<string>} - Embedding source text
 */
async function getEmbeddingSource(entityType, fields, assets = []) {
  // If AI summarization is enabled and entity should be summarized
  if (USE_AI_SUMMARIZATION && shouldSummarize(entityType, fields)) {
    console.log(`Using AI summarization for ${entityType}`);
    
    if (entityType === 'action') {
      return await summarizeAction({ ...fields, assets });
    } else if (entityType === 'issue') {
      return await summarizeIssue(fields);
    }
  }
  
  // Otherwise use standard composition
  console.log(`Using standard composition for ${entityType}`);
  
  switch (entityType) {
    case 'part':
      return composePartEmbeddingSource(fields);
    case 'tool':
      return composeToolEmbeddingSource(fields);
    case 'action':
      return composeActionEmbeddingSource(fields);
    case 'issue':
      return composeIssueEmbeddingSource(fields);
    case 'policy':
      return composePolicyEmbeddingSource(fields);
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

exports.handler = async (event) => {
  console.log('Processing embedding generation events');
  console.log(`Configuration: WRITE_TO_UNIFIED=${WRITE_TO_UNIFIED}, WRITE_TO_INLINE=${WRITE_TO_INLINE}, USE_AI_SUMMARIZATION=${USE_AI_SUMMARIZATION}`);
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      let { entity_type, entity_id, embedding_source, organization_id, fields, assets } = message;
      
      console.log(`Processing ${entity_type} ${entity_id}`);
      
      // Validate entity type (includes action variants like action_existing_state)
      const validTypes = ['part', 'tool', 'action', 'issue', 'policy', 'action_existing_state'];
      if (!validTypes.includes(entity_type)) {
        console.log(`Skipping ${entity_type} - not a valid entity type`);
        continue;
      }
      
      // Validate organization_id
      if (!organization_id) {
        console.log(`No organization_id for ${entity_type} ${entity_id}`);
        continue;
      }
      
      // Get embedding source - either from message or compose/summarize from fields
      if (!embedding_source || !embedding_source.trim()) {
        if (fields) {
          console.log(`Composing embedding_source from fields`);
          embedding_source = await getEmbeddingSource(entity_type, fields, assets);
        } else {
          console.log(`No embedding_source or fields for ${entity_type} ${entity_id}`);
          continue;
        }
      }
      
      // Validate embedding_source
      if (!embedding_source || !embedding_source.trim()) {
        console.log(`Empty embedding_source after composition for ${entity_type} ${entity_id}`);
        continue;
      }
      
      // Generate embedding
      console.log(`Generating embedding for: ${embedding_source.substring(0, 100)}...`);
      const embedding = await generateEmbeddingV1(embedding_source);
      console.log(`Generated embedding (${embedding.length} dimensions)`);
      
      // Validate embedding dimensions
      if (embedding.length !== 1536) {
        throw new Error(`Invalid embedding dimensions: expected 1536, got ${embedding.length}`);
      }
      
      // Write to unified table
      if (WRITE_TO_UNIFIED) {
        console.log(`Writing to unified_embeddings table`);
        await writeToUnifiedTable(entity_type, entity_id, embedding_source, embedding, organization_id);
      }
      
      // Write to inline columns (backward compatibility for parts and tools)
      if (WRITE_TO_INLINE) {
        const table = entity_type === 'part' ? 'parts' : entity_type === 'tool' ? 'tools' : null;
        if (table) {
          console.log(`Writing to inline columns in ${table}`);
          await writeToInlineColumns(table, entity_id, embedding_source, embedding);
        }
      }
      
      console.log(`Successfully processed ${entity_type} ${entity_id}`);
    } catch (error) {
      console.error('Error processing record:', error);
      throw error; // Let SQS retry
    }
  }
  
  return { statusCode: 200, body: 'Success' };
};
