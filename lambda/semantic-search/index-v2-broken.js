const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

async function generateEmbedding(text) {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ 
      inputText: text,
      dimensions: 1024,
      normalize: true
    })
  });
  
  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.embedding;
}

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
    const { query: searchQuery, table = 'tools', limit = 10 } = body;
    
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    if (!['tools', 'parts'].includes(table)) {
      return error('table must be "tools" or "parts"', 400);
    }
    
    // Generate embedding for search query
    const queryEmbedding = await generateEmbedding(searchQuery);
    console.log('Query embedding dimensions:', queryEmbedding.length);
    
    // Search the specified table using new search_embedding_v2 column
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const sql = `
      SELECT 
        id,
        name,
        description,
        category,
        storage_location,
        ${table === 'parts' ? 'current_quantity,' : ''}
        search_text,
        (search_embedding_v2 <=> '${embeddingStr}'::vector) as similarity_score
      FROM ${table}
      WHERE search_embedding_v2 IS NOT NULL
      ORDER BY similarity_score
      LIMIT ${limit}
    `;
    
    console.log('Executing SQL query for', table);
    
    // TEST: Simple query without vector comparison
    const testSql = `SELECT id, name, search_text FROM ${table} WHERE search_embedding_v2 IS NOT NULL LIMIT 5`;
    console.log('TEST SQL:', testSql);
    
    try {
      const results = await query(testSql);
      console.log('Query returned', results.length, 'results');
      return success({ results, query: searchQuery, table });
    } catch (queryError) {
      console.error('Database query failed:', queryError.message, queryError.stack);
      throw queryError;
    }
    
  } catch (err) {
    console.error('Semantic search error:', err);
    return error(err.message, 500);
  }
};
