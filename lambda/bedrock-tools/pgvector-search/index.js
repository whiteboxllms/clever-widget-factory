/**
 * Conversational pgvector Search Tool for Bedrock Agent
 * 
 * This Lambda function provides semantic product search with conversational context
 * for the Bedrock Agent to use in generating personalized product recommendations.
 */

const { query } = require('./shared/db');
const { generateEmbedding } = require('./shared/embeddings');

/**
 * Main Lambda handler for Bedrock Agent tool invocation
 */
exports.handler = async (event) => {
  console.log('Conversational pgvector search tool invoked:', JSON.stringify(event, null, 2));
  
  try {
    // Extract parameters from Bedrock Agent event
    const { inputText, parameters } = event;
    
    // Parse search parameters
    const searchQuery = parameters?.query || inputText || '';
    const maxResults = parseInt(parameters?.limit) || 5;
    const priceMin = parameters?.priceMin ? parseFloat(parameters.priceMin) : null;
    const priceMax = parameters?.priceMax ? parseFloat(parameters.priceMax) : null;
    const excludeTerms = parameters?.excludeTerms ? parameters.excludeTerms.split(',') : [];
    
    console.log('Search parameters:', {
      searchQuery,
      maxResults,
      priceMin,
      priceMax,
      excludeTerms
    });
    
    if (!searchQuery.trim()) {
      return {
        statusCode: 400,
        body: {
          error: 'Search query is required',
          conversationalContext: {
            originalQuery: searchQuery,
            interpretedIntent: 'invalid_query',
            suggestedFollowUp: 'Please tell me what kind of product you\'re looking for!'
          }
        }
      };
    }
    
    // Perform conversational search
    const searchResult = await performConversationalSearch(
      searchQuery,
      maxResults,
      priceMin,
      priceMax,
      excludeTerms
    );
    
    console.log('Search completed:', {
      productsFound: searchResult.products.length,
      totalFound: searchResult.totalFound
    });
    
    return {
      statusCode: 200,
      body: searchResult
    };
    
  } catch (error) {
    console.error('Search tool error:', error);
    return {
      statusCode: 500,
      body: {
        error: error.message,
        conversationalContext: {
          originalQuery: event.inputText || '',
          interpretedIntent: 'search_error',
          suggestedFollowUp: 'I\'m having trouble searching right now. Could you try asking in a different way?'
        }
      }
    };
  }
};

/**
 * Performs semantic search with conversational context
 */
async function performConversationalSearch(searchQuery, maxResults, priceMin, priceMax, excludeTerms) {
  console.log('Starting conversational search for:', searchQuery);
  
  // Generate embedding for the search query
  const queryEmbedding = await getEmbedding(searchQuery);
  console.log('Generated embedding with dimensions:', queryEmbedding.length);
  
  // Build and execute search query
  const products = await searchProducts(queryEmbedding, maxResults, priceMin, priceMax, excludeTerms);
  console.log('Found products:', products.length);
  
  // Add conversational context to each product
  const productsWithContext = await addConversationalContext(products, searchQuery);
  
  // Determine search intent and suggestions
  const searchContext = analyzeSearchIntent(searchQuery, products.length);
  
  return {
    products: productsWithContext,
    searchContext,
    totalFound: products.length
  };
}

/**
 * Generates embedding using the shared embedding service
 */
async function getEmbedding(text) {
  try {
    return await generateEmbedding(text);
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw new Error('Failed to generate embedding for search query');
  }
}

/**
 * Searches products using vector similarity with filters
 */
async function searchProducts(queryEmbedding, limit, priceMin, priceMax, excludeTerms) {
  try {
    // Build SQL query with vector similarity and filters
    let sql = `
      SELECT 
        id,
        name,
        description,
        price,
        stock_level,
        category,
        unit,
        harvest_date,
        expiry_date,
        tags,
        sellable,
        1 - (embedding_vector <=> '[${queryEmbedding.join(',')}]'::vector) AS similarity_score
      FROM products 
      WHERE sellable = true
        AND stock_level > 0
    `;
    
    // Add price filters
    if (priceMin !== null) {
      sql += ` AND price >= ${priceMin}`;
    }
    
    if (priceMax !== null) {
      sql += ` AND price <= ${priceMax}`;
    }
    
    // Add exclusion filters (simple text matching for now)
    if (excludeTerms.length > 0) {
      const exclusions = excludeTerms.map(term => `description NOT ILIKE '%${term}%'`);
      sql += ` AND ${exclusions.join(' AND ')}`;
    }
    
    // Order by similarity and limit results
    sql += `
      ORDER BY embedding_vector <=> '[${queryEmbedding.join(',')}]'::vector
      LIMIT ${limit}
    `;
    
    console.log('Executing search query');
    const results = await query(sql);
    
    return results;
    
  } catch (error) {
    console.error('Product search error:', error);
    throw error;
  }
}

/**
 * Adds conversational context to products for agent storytelling
 */
async function addConversationalContext(products, originalQuery) {
  return products.map(product => {
    // Generate relevance reason based on similarity and query
    const relevanceReason = generateRelevanceReason(product, originalQuery);
    
    // Extract key selling points
    const sellingPoints = extractSellingPoints(product);
    
    // Suggest complementary items (simplified for now)
    const complementaryItems = suggestComplementaryItems(product);
    
    return {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stockLevel: product.stock_level,
        category: product.category,
        unit: product.unit,
        harvestDate: product.harvest_date,
        expiryDate: product.expiry_date,
        tags: product.tags || []
      },
      similarity: parseFloat(product.similarity_score),
      relevanceReason,
      sellingPoints,
      complementaryItems,
      stockDescription: getStockDescription(product.stock_level),
      freshness: getFreshnessDescription(product.harvest_date, product.expiry_date)
    };
  });
}

/**
 * Generates a conversational reason why this product matches the search
 */
function generateRelevanceReason(product, query) {
  const queryLower = query.toLowerCase();
  const descLower = product.description.toLowerCase();
  const nameLower = product.name.toLowerCase();
  
  // Check for direct matches
  if (nameLower.includes(queryLower)) {
    return `This ${product.name} directly matches what you're looking for`;
  }
  
  // Check for category matches
  if (queryLower.includes('hot') || queryLower.includes('spicy')) {
    if (descLower.includes('spice') || descLower.includes('hot') || descLower.includes('chili')) {
      return `Perfect for adding heat to your cooking - this has the spicy kick you want`;
    }
  }
  
  if (queryLower.includes('noodle') || queryLower.includes('pasta')) {
    if (nameLower.includes('noodle') || nameLower.includes('pasta') || nameLower.includes('pancit')) {
      return `Great choice for a quick and satisfying meal`;
    }
  }
  
  // Default relevance based on similarity
  if (product.similarity_score > 0.8) {
    return `This is a top match for your search - very similar to what you described`;
  } else if (product.similarity_score > 0.6) {
    return `This could be exactly what you need based on your description`;
  } else {
    return `This might work well for what you're looking for`;
  }
}

/**
 * Extracts key selling points for conversational recommendations
 */
function extractSellingPoints(product) {
  const points = [];
  
  // Price point
  if (product.price < 20) {
    points.push('Very affordable option');
  } else if (product.price < 50) {
    points.push('Great value for money');
  } else {
    points.push('Premium quality product');
  }
  
  // Stock level
  if (product.stock_level > 10) {
    points.push('Plenty in stock');
  } else if (product.stock_level > 0) {
    points.push('Limited quantity available');
  }
  
  // Freshness
  if (product.harvest_date) {
    const daysOld = Math.floor((Date.now() - new Date(product.harvest_date)) / (1000 * 60 * 60 * 24));
    if (daysOld < 3) {
      points.push('Freshly harvested');
    } else if (daysOld < 7) {
      points.push('Very fresh');
    }
  }
  
  // Category-specific points
  if (product.category === 'vegetables') {
    points.push('Farm fresh vegetables');
  } else if (product.category === 'condiments') {
    points.push('Essential for cooking');
  }
  
  return points.slice(0, 3); // Limit to top 3 points
}

/**
 * Suggests complementary items (simplified implementation)
 */
function suggestComplementaryItems(product) {
  const suggestions = [];
  
  if (product.name.toLowerCase().includes('noodle')) {
    suggestions.push('cooking oil', 'vegetables', 'soy sauce');
  } else if (product.name.toLowerCase().includes('vinegar')) {
    suggestions.push('garlic', 'onions', 'chili');
  } else if (product.category === 'vegetables') {
    suggestions.push('cooking oil', 'garlic', 'onions');
  }
  
  return suggestions.slice(0, 2); // Limit to 2 suggestions
}

/**
 * Gets conversational stock description
 */
function getStockDescription(stockLevel) {
  if (stockLevel > 20) {
    return 'plenty in stock';
  } else if (stockLevel > 10) {
    return 'good stock available';
  } else if (stockLevel > 5) {
    return 'limited stock';
  } else if (stockLevel > 0) {
    return 'only a few left';
  } else {
    return 'out of stock';
  }
}

/**
 * Gets freshness description based on dates
 */
function getFreshnessDescription(harvestDate, expiryDate) {
  if (!harvestDate && !expiryDate) {
    return 'good quality';
  }
  
  if (harvestDate) {
    const daysOld = Math.floor((Date.now() - new Date(harvestDate)) / (1000 * 60 * 60 * 24));
    if (daysOld < 1) {
      return 'harvested today';
    } else if (daysOld < 3) {
      return 'freshly harvested';
    } else if (daysOld < 7) {
      return 'very fresh';
    } else {
      return 'good quality';
    }
  }
  
  if (expiryDate) {
    const daysUntilExpiry = Math.floor((new Date(expiryDate) - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry > 7) {
      return 'long shelf life';
    } else if (daysUntilExpiry > 3) {
      return 'use within a week';
    } else if (daysUntilExpiry > 0) {
      return 'use soon';
    } else {
      return 'check expiry date';
    }
  }
  
  return 'good quality';
}

/**
 * Analyzes search intent and provides conversational context
 */
function analyzeSearchIntent(query, resultCount) {
  const queryLower = query.toLowerCase();
  
  let interpretedIntent = 'general_search';
  let suggestedFollowUp = null;
  
  // Detect specific intents
  if (queryLower.includes('cheap') || queryLower.includes('affordable') || queryLower.includes('budget')) {
    interpretedIntent = 'budget_search';
    suggestedFollowUp = 'Would you like me to show you more budget-friendly options?';
  } else if (queryLower.includes('fresh') || queryLower.includes('new')) {
    interpretedIntent = 'freshness_search';
    suggestedFollowUp = 'I can also show you what was harvested most recently if you\'d like!';
  } else if (queryLower.includes('hot') || queryLower.includes('spicy')) {
    interpretedIntent = 'spicy_search';
    suggestedFollowUp = 'Are you looking for mild heat or something really spicy?';
  } else if (queryLower.includes('cook') || queryLower.includes('recipe')) {
    interpretedIntent = 'cooking_search';
    suggestedFollowUp = 'What kind of dish are you planning to make?';
  }
  
  // Adjust follow-up based on results
  if (resultCount === 0) {
    suggestedFollowUp = 'I didn\'t find exactly what you\'re looking for. Could you describe it differently?';
  } else if (resultCount === 1) {
    suggestedFollowUp = 'I found one great option! Would you like to see similar products too?';
  } else if (resultCount >= 5) {
    suggestedFollowUp = 'I found several good options! Would you like me to narrow it down based on price or freshness?';
  }
  
  return {
    originalQuery: query,
    interpretedIntent,
    suggestedFollowUp
  };
}