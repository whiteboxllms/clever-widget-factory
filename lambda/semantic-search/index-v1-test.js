const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

async function generateEmbedding(text) {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ 
      inputText: text
    })
  });
  
  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.embedding;
}

exports.handler = async (event) => {
  console.log('V1 Semantic search test');
  
  const { httpMethod } = event;
  
  if (httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  if (httpMethod !== 'POST') {
    return error('Method not allowed', 405);
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { query: searchQuery, table = 'tools', limit = 10 } = body;
    
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    if (!['tools', 'parts'].includes(table)) {
      return error('table must be "tools" or "parts"', 400);
    }
    
    // Generate V1 embedding for search query
    const queryEmbedding = await generateEmbedding(searchQuery);
    console.log('V1 Query embedding dimensions:', queryEmbedding.length);
    
    // Search using V1 embeddings
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const sql = `
      SELECT 
        id,
        name,
        description,
        category,
        storage_location,
        ${table === 'parts' ? 'current_quantity,' : ''}
        (search_embedding <=> '${embeddingStr}'::vector) as similarity_score
      FROM ${table}
      WHERE search_embedding IS NOT NULL
      ORDER BY similarity_score
      LIMIT ${limit}
    `;
    
    console.log('Executing V1 SQL query for', table);
    
    try {
      const results = await query(sql);
      console.log('V1 Query returned', results.length, 'results');
      return success({ results, query: searchQuery, table, version: 'v1' });
    } catch (queryError) {
      console.error('V1 Database query failed:', queryError.message);
      throw queryError;
    }
    
  } catch (err) {
    console.error('V1 Semantic search error:', err);
    return error(err.message, 500);
  }
};
