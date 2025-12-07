const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');
const { generateEmbedding } = require('./shared/embeddings');

exports.handler = async (event) => {
  console.log('Semantic search event:', JSON.stringify(event, null, 2));
  
  const { httpMethod } = event;
  
  if (httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  if (httpMethod !== 'POST') {
    return error('Method not allowed', 405);
  }
  
  try {
    const authContext = getAuthorizerContext(event);
    const organizationId = authContext.organization_id;
    
    if (!organizationId) {
      console.error('Missing organization_id from authorizer context');
      return error('Unauthorized', 401);
    }
    
    const body = JSON.parse(event.body || '{}');
    const { query: searchQuery, table = 'parts', limit = 10 } = body;
    
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(searchQuery);
    
    // Search the specified table
    const sql = `
      SELECT 
        id,
        name,
        description,
        category,
        storage_location,
        current_quantity,
        (search_embedding <=> '[${queryEmbedding.join(',')}]') as similarity_score
      FROM ${table}
      WHERE organization_id = '${organizationId}'
        AND search_embedding IS NOT NULL
      ORDER BY similarity_score
      LIMIT ${limit}
    `;
    
    const results = await query(sql);
    
    return success({ results, query: searchQuery, table });
    
  } catch (err) {
    console.error('Semantic search error:', err);
    return error(err.message, 500);
  }
};
