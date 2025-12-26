/**
 * Enhanced Semantic Search Handler
 * 
 * Implements the enhanced search pipeline with:
 * - Natural language query processing
 * - Price constraint extraction
 * - Negation handling
 * - Vector similarity search
 * - Stock level management
 */

const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');
const { generateEmbedding } = require('./shared/embeddings');
const QueryProcessor = require('./src/pipeline/QueryProcessor');

// Initialize query processor
const queryProcessor = new QueryProcessor();

/**
 * Enhanced semantic search handler
 */
exports.handler = async (event) => {
  console.log('Enhanced semantic search pipeline');
  
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
      debug = false      // Flag to include debug information
    } = body;
    
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    if (!['tools', 'parts'].includes(table)) {
      return error('table must be "tools" or "parts"', 400);
    }

    return await handleEnhancedSearch(searchQuery, table, organizationId, limit, debug);
    
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
    
    console.log('SQL before replacement:', sql.substring(0, 200));
    console.log('Looking for parameter: $1::vector');
    
    // Replace ALL $1::vector placeholders with the actual embedding
    const finalSql = sql.replace(/\$1::vector/g, `'${embeddingStr}'::vector`);
    
    console.log('SQL after replacement:', finalSql.substring(0, 200));
    
    if (debug) {
      console.log('Enhanced SQL query:', finalSql.substring(0, 500) + '...');
    }
    
    // Step 4: Execute search
    const results = await query(finalSql);
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
        sql_query: sql.substring(0, 500) + '...',
        query_components: queryComponents,
        negation_filtering_applied: queryComponents.has_negations,
        price_filtering_applied: queryComponents.has_price_filter,
        results_before_negation: results.length,
        results_after_negation: filteredResults.length
      };
    }
    
    console.log('Enhanced search completed in', Date.now() - startTime, 'ms');
    return success(formattedResponse);
    
  } catch (err) {
    console.error('Enhanced search error:', err);
    throw err;
  }
}
