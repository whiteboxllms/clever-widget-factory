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
  console.log('Semantic search using Titan v1 embeddings (1536 dimensions)');
  
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
    
    // Generate embedding for search query using v1 model (Titan v1 = 1536 dimensions)
    const queryEmbedding = await generateEmbedding(searchQuery);
    console.log('Query embedding dimensions:', queryEmbedding.length);
    
    // Verify embedding dimensions match expected (1536 for v1)
    if (queryEmbedding.length !== 1536) {
      console.warn(`Warning: Query embedding has ${queryEmbedding.length} dimensions, expected 1536`);
    }
    
    // Format embedding as PostgreSQL vector literal
    // pgvector requires format: [1,2,3] for vector type
    // Use array_to_string for better compatibility with large vectors
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Build organization filter (escape single quotes to prevent SQL injection)
    const escapedOrgId = organizationId.replace(/'/g, "''");
    const orgFilter = `AND organization_id = '${escapedOrgId}'`;
    
    // First, check if stored embeddings have the correct dimensions
    // This diagnostic query helps identify dimension mismatches
    const diagnosticSql = `
      SELECT 
        id,
        name,
        array_length(search_embedding::float[], 1) as stored_dimensions
      FROM ${table}
      WHERE search_embedding IS NOT NULL
        ${orgFilter}
      LIMIT 1
    `;
    
    try {
      const diagnosticResults = await query(diagnosticSql);
      if (diagnosticResults.length > 0) {
        console.log('Stored embedding dimensions:', diagnosticResults[0].stored_dimensions);
        if (diagnosticResults[0].stored_dimensions !== queryEmbedding.length) {
          console.error(`Dimension mismatch! Stored: ${diagnosticResults[0].stored_dimensions}, Query: ${queryEmbedding.length}`);
          return error(`Embedding dimension mismatch. Stored embeddings have ${diagnosticResults[0].stored_dimensions} dimensions, but query embedding has ${queryEmbedding.length} dimensions.`, 500);
        }
      }
    } catch (diagError) {
      console.warn('Diagnostic query failed (non-fatal):', diagError.message);
      // Continue with main query even if diagnostic fails
    }
    
    // Search the specified table using search_embedding column (v1)
    // pgvector will automatically match dimensions if both vectors are properly formatted
    // Note: <=> operator returns distance (lower is better, 0 = identical)
    // IMPORTANT: Must return ALL fields that CombinedAssetGrid expects (image_url, status, etc.)
    // or cards will show "Unknown" category and missing images
    const sql = table === 'tools' ? `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.category,
        t.storage_location,
        t.image_url,
        t.status,
        t.serial_number,
        t.accountable_person_id,
        t.parent_structure_id,
        parent_tool.name as parent_structure_name,
        t.search_text,
        (t.search_embedding <=> '${embeddingStr}'::vector) as distance,
        (1 - (t.search_embedding <=> '${embeddingStr}'::vector)) as similarity
      FROM ${table} t
      LEFT JOIN tools parent_tool ON t.parent_structure_id = parent_tool.id
      WHERE t.search_embedding IS NOT NULL
        AND t.organization_id = '${escapedOrgId}'
      ORDER BY distance
      LIMIT ${limit}
    ` : `
      SELECT 
        id,
        name,
        description,
        category,
        storage_location,
        image_url,
        current_quantity,
        minimum_quantity,
        unit,
        cost_per_unit,
        search_text,
        (search_embedding <=> '${embeddingStr}'::vector) as distance,
        (1 - (search_embedding <=> '${embeddingStr}'::vector)) as similarity
      FROM ${table}
      WHERE search_embedding IS NOT NULL
        ${orgFilter}
      ORDER BY distance
      LIMIT ${limit}
    `;
    
    console.log('Executing semantic search SQL query for', table);
    // Log SQL without full embedding to avoid log spam
    console.log('SQL (embedding truncated):', sql.replace(embeddingStr, '[...embedding...]'));
    
    try {
      const results = await query(sql);
      console.log('Semantic search returned', results.length, 'results');
      return success({ 
        results, 
        query: searchQuery, 
        table,
        count: results.length 
      });
    } catch (queryError) {
      console.error('Database query failed:', queryError.message, queryError.stack);
      // Check if it's a dimension mismatch error
      if (queryError.message.includes('dimensions') || queryError.message.includes('dimension')) {
        console.error('Vector dimension mismatch detected');
        return error(`Vector dimension mismatch: ${queryError.message}`, 500);
      }
      // Check if it's a pgvector extension error
      if (queryError.message.includes('operator does not exist') || 
          queryError.message.includes('<=>') ||
          queryError.message.includes('vector') ||
          queryError.message.includes('pgvector')) {
        console.error('pgvector extension may not be enabled or <=> operator not available');
        return error('Vector search not available. Please ensure pgvector extension is enabled.', 500);
      }
      throw queryError;
    }
    
  } catch (err) {
    console.error('Semantic search error:', err);
    return error(err.message, 500);
  }
};
