const { query } = require('@cwf/db');
const { getAuthorizerContext } = require('@cwf/authorizerContext');
const { success, error, corsResponse } = require('@cwf/response');
const { generateEmbeddingV1 } = require('@cwf/embeddings');

/**
 * Unified Search Lambda
 * 
 * Provides cross-entity semantic search across parts, tools, actions, issues, and policies
 * using the unified_embeddings table.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.1, 10.2, 10.3
 */

exports.handler = async (event) => {
  console.log('Unified semantic search handler');
  
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
    const { query: searchQuery, entity_types, limit = 10 } = body;
    
    // Validate required parameters
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    // Validate limit
    if (limit > 100) {
      return error('limit cannot exceed 100', 400);
    }
    
    console.log(`Searching for: "${searchQuery}" (limit: ${limit}, entity_types: ${entity_types || 'all'})`);
    
    // Generate query embedding using Titan v1 (1536 dimensions)
    console.log('Generating query embedding via Bedrock');
    const queryEmbedding = await generateEmbeddingV1(searchQuery);
    console.log(`Generated embedding with ${queryEmbedding.length} dimensions`);
    
    // Verify embedding dimensions
    if (queryEmbedding.length !== 1536) {
      console.warn(`Warning: Query embedding has ${queryEmbedding.length} dimensions, expected 1536`);
    }
    
    // Format embedding as PostgreSQL vector literal
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Build organization filter (escape single quotes to prevent SQL injection)
    const escapedOrgId = organizationId.replace(/'/g, "''");
    
    // Build entity type filter if specified
    let entityTypeFilter = '';
    if (entity_types && Array.isArray(entity_types) && entity_types.length > 0) {
      const escapedTypes = entity_types.map(t => `'${t.replace(/'/g, "''")}'`).join(',');
      entityTypeFilter = `AND entity_type IN (${escapedTypes})`;
    }
    
    // Build SQL query for vector similarity search
    // Using <=> operator for cosine distance (lower is better)
    // Similarity = 1 - distance (higher is better)
    const sql = `
      SELECT 
        entity_type,
        entity_id,
        embedding_source,
        (embedding <=> '${embeddingStr}'::vector) as distance,
        (1 - (embedding <=> '${embeddingStr}'::vector)) as similarity
      FROM unified_embeddings
      WHERE organization_id = '${escapedOrgId}'
        ${entityTypeFilter}
      ORDER BY distance
      LIMIT ${limit}
    `;
    
    console.log('Executing unified semantic search');
    console.log('SQL (embedding truncated):', sql.replace(embeddingStr, '[...embedding...]'));
    
    // Execute search query
    const results = await query(sql);
    
    console.log(`Found ${results.length} results`);
    
    // Return results with metadata
    return success({ 
      results, 
      query: searchQuery,
      entity_types: entity_types || 'all',
      count: results.length 
    });
    
  } catch (err) {
    console.error('Unified semantic search error:', err);
    
    // Provide more specific error messages for common issues
    if (err.message.includes('dimensions') || err.message.includes('dimension')) {
      return error(`Vector dimension mismatch: ${err.message}`, 500);
    }
    
    if (err.message.includes('operator does not exist') || 
        err.message.includes('<=>') ||
        err.message.includes('vector') ||
        err.message.includes('pgvector')) {
      return error('Vector search not available. Please ensure pgvector extension is enabled.', 500);
    }
    
    return error(err.message, 500);
  }
};
