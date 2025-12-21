/**
 * Enhanced Semantic Search Handler
 * 
 * Extends existing semantic search with enhanced pipeline capabilities:
 * - Natural language price filtering
 * - Negation handling
 * - Stock level management
 * - Backward compatibility with existing API
 */

const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');
const { generateEmbedding } = require('./shared/embeddings');
const QueryProcessor = require('./src/pipeline/QueryProcessor');

// Initialize query processor
const queryProcessor = new QueryProcessor();

/**
 * Enhanced handler that supports both legacy and new pipeline modes
 */
exports.handler = async (event) => {
  console.log('Enhanced semantic search with pipeline support');
  
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
    const { 
      query: searchQuery, 
      table = 'tools', 
      limit = 10,
      enhanced = false,  // Flag to enable enhanced pipeline
      debug = false      // Flag to include debug information
    } = body;
    
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    if (!['tools', 'parts'].includes(table)) {
      return error('table must be "tools" or "parts"', 400);
    }

    // Choose processing mode based on enhanced flag
    if (enhanced) {
      return await handleEnhancedSearch(searchQuery, table, organizationId, limit, debug);
    } else {
      return await handleLegacySearch(searchQuery, table, organizationId, limit);
    }
    
  } catch (err) {
    console.error('Semantic search error:', err);
    return error(err.message, 500);
  }
};

/**
 * Enhanced search with full pipeline processing
 */
async function handleEnhancedSearch(searchQuery, table, organizationId, limit, debug) {
  const startTime = Date.now();
  
  try {
    console.log('Processing enhanced search query:', searchQuery);
    
    // Step 1: Process query through pipeline
    const queryComponents = queryProcessor.processQuery(searchQuery);
    console.log('Query components:', JSON.stringify(queryComponents, null, 2));
    
    // Step 2: Generate embedding for semantic query
    const queryEmbedding = await generateEmbedding(queryComponents.semantic_query);
    console.log('Generated embedding for:', queryComponents.semantic_query);
    
    // Step 3: Build enhanced SQL query
    const sql = queryProcessor.buildEnhancedQuery(queryComponents, table, organizationId, limit);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    if (debug) {
      console.log('Enhanced SQL query:', sql.replace(embeddingStr, '[...embedding...]'));
    }
    
    // Step 4: Execute search
    const results = await query(sql.replace('$1::vector', `'${embeddingStr}'::vector`));
    console.log('Raw search results:', results.length);
    
    // Step 5: Apply negation filtering
    const filteredResults = queryProcessor.applyNegationFiltering(results, queryComponents.negated_terms);
    console.log('After negation filtering:', filteredResults.length);
    
    // Step 6: Format results with enhanced metadata
    const formattedResponse = queryProcessor.formatResults(filteredResults, queryComponents, table);
    
    // Add debug information if requested
    if (debug) {
      formattedResponse.debug = {
        processing_time_ms: Date.now() - startTime,
        embedding_dimensions: queryEmbedding.length,
        sql_query: sql.replace(embeddingStr, '[...embedding...]'),
        negation_filtering_applied: queryComponents.has_negations,
        price_filtering_applied: queryComponents.has_price_filter
      };
    }
    
    console.log('Enhanced search completed in', Date.now() - startTime, 'ms');
    return success(formattedResponse);
    
  } catch (err) {
    console.error('Enhanced search error:', err);
    throw err;
  }
}

/**
 * Legacy search for backward compatibility
 */
async function handleLegacySearch(searchQuery, table, organizationId, limit) {
  console.log('Processing legacy search query:', searchQuery);
  
  // Use existing logic from original handler
  const queryEmbedding = await generateEmbedding(searchQuery);
  console.log('Query embedding dimensions:', queryEmbedding.length);
  
  if (queryEmbedding.length !== 1536) {
    console.warn(`Warning: Query embedding has ${queryEmbedding.length} dimensions, expected 1536`);
  }
  
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  const escapedOrgId = organizationId.replace(/'/g, "''");
  const orgFilter = `AND organization_id = '${escapedOrgId}'`;
  
  // Original SQL queries
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
  
  console.log('Executing legacy semantic search SQL query for', table);
  
  const results = await query(sql);
  console.log('Legacy search returned', results.length, 'results');
  
  return success({ 
    results, 
    query: searchQuery, 
    table,
    count: results.length 
  });
}