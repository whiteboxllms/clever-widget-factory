/**
 * Shared NLP Utilities
 * 
 * Common natural language processing functions that can be used across
 * different services (semantic-search, sari-sari-agent, etc.)
 */

/**
 * Extract price constraints from natural language text
 * 
 * @param {string} text - Input text to analyze
 * @returns {Object} Price constraints with min/max values
 */
function extractPriceConstraints(text) {
  const constraints = { min: null, max: null };
  
  if (!text || typeof text !== 'string') {
    return constraints;
  }
  
  // Patterns for price extraction
  const patterns = {
    under: /(?:under|below|less than|<=?)\s*(\d+(?:\.\d+)?)/i,
    above: /(?:above|over|more than|>=?)\s*(\d+(?:\.\d+)?)/i,
    between: /(?:between|from)\s*(\d+(?:\.\d+)?)\s*(?:and|to)\s*(\d+(?:\.\d+)?)/i
  };
  
  // Check for "under X" pattern
  const underMatch = text.match(patterns.under);
  if (underMatch) {
    constraints.max = parseFloat(underMatch[1]);
  }
  
  // Check for "above X" pattern  
  const aboveMatch = text.match(patterns.above);
  if (aboveMatch) {
    constraints.min = parseFloat(aboveMatch[1]);
  }
  
  // Check for "between X and Y" pattern (overrides individual constraints)
  const betweenMatch = text.match(patterns.between);
  if (betweenMatch) {
    constraints.min = parseFloat(betweenMatch[1]);
    constraints.max = parseFloat(betweenMatch[2]);
  }
  
  return constraints;
}

/**
 * Extract negated terms from natural language text
 * 
 * @param {string} text - Input text to analyze
 * @returns {Array<string>} Array of negated terms
 */
function extractNegatedTerms(text) {
  const negatedTerms = [];
  
  if (!text || typeof text !== 'string') {
    return negatedTerms;
  }
  
  // Negation patterns
  const patterns = [
    /\bno\s+(\w+)/gi,
    /\bnot\s+(\w+)/gi,
    /\bavoid\s+(\w+)/gi,
    /\bwithout\s+(\w+)/gi,
    /don't\s+like\s+(\w+)/gi,
    /don't\s+want\s+(\w+)/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      negatedTerms.push(match[1].toLowerCase().trim());
    }
  }
  
  return [...new Set(negatedTerms)]; // Remove duplicates
}

/**
 * Clean text by removing price and negation terms to extract semantic content
 * 
 * @param {string} text - Input text to clean
 * @param {Object} priceConstraints - Previously extracted price constraints
 * @param {Array<string>} negatedTerms - Previously extracted negated terms
 * @returns {string} Cleaned semantic text
 */
function extractSemanticContent(text, priceConstraints = null, negatedTerms = []) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let cleanedText = text;
  
  // Remove price-related phrases
  const pricePatterns = [
    /(?:under|below|less than|<=?)\s*\d+(?:\.\d+)?(?:\s*pesos)?/gi,
    /(?:above|over|more than|>=?)\s*\d+(?:\.\d+)?(?:\s*pesos)?/gi,
    /(?:between|from)\s*\d+(?:\.\d+)?\s*(?:and|to)\s*\d+(?:\.\d+)?(?:\s*pesos)?/gi
  ];
  
  for (const pattern of pricePatterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  
  // Remove negation phrases
  const negationPatterns = [
    /\bno\s+\w+/gi,
    /\bnot\s+\w+/gi,
    /\bavoid\s+\w+/gi,
    /\bwithout\s+\w+/gi,
    /don't\s+like\s+\w+/gi,
    /don't\s+want\s+\w+/gi
  ];
  
  for (const pattern of negationPatterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  
  // Clean up extra whitespace and punctuation
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  cleanedText = cleanedText.replace(/^[,\s]+|[,\s]+$/g, '');
  
  // If cleaned text is empty, return original
  if (!cleanedText || cleanedText.length === 0) {
    cleanedText = text;
  }
  
  return cleanedText;
}

/**
 * Validate if text contains price-related terms
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if price terms are found
 */
function hasPriceTerms(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const priceKeywords = [
    'under', 'below', 'less than', 'above', 'over', 'more than',
    'between', 'from', 'to', 'pesos', 'price', 'cost', 'cheap', 'expensive'
  ];
  
  const lowerText = text.toLowerCase();
  return priceKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Validate if text contains negation terms
 * 
 * @param {string} text - Text to check
 * @returns {boolean} True if negation terms are found
 */
function hasNegationTerms(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  const negationKeywords = [
    'no ', 'not ', 'avoid', 'without', "don't like", "don't want"
  ];
  
  const lowerText = text.toLowerCase();
  return negationKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Process complete natural language query into structured components
 * 
 * @param {string} query - Raw natural language query
 * @returns {Object} Structured query components
 */
function processNaturalLanguageQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  const trimmedQuery = query.trim();
  
  // Extract components
  const priceConstraints = extractPriceConstraints(trimmedQuery);
  const negatedTerms = extractNegatedTerms(trimmedQuery);
  const semanticContent = extractSemanticContent(trimmedQuery, priceConstraints, negatedTerms);
  
  return {
    original_query: query,
    semantic_query: semanticContent,
    price_min: priceConstraints.min,
    price_max: priceConstraints.max,
    negated_terms: negatedTerms,
    has_price_filter: priceConstraints.min !== null || priceConstraints.max !== null,
    has_negations: negatedTerms.length > 0,
    has_price_terms: hasPriceTerms(trimmedQuery),
    has_negation_terms: hasNegationTerms(trimmedQuery)
  };
}

/**
 * Apply negation filtering to search results
 * 
 * @param {Array} results - Search results to filter
 * @param {Array<string>} negatedTerms - Terms to exclude
 * @returns {Array} Filtered results
 */
function applyNegationFiltering(results, negatedTerms) {
  if (!Array.isArray(results) || !Array.isArray(negatedTerms) || negatedTerms.length === 0) {
    return results;
  }
  
  return results.filter(result => {
    const searchText = `${result.name || ''} ${result.description || ''}`.toLowerCase();
    
    // Exclude if any negated term is found in the product text
    return !negatedTerms.some(term => 
      searchText.includes(term.toLowerCase())
    );
  });
}

module.exports = {
  extractPriceConstraints,
  extractNegatedTerms,
  extractSemanticContent,
  hasPriceTerms,
  hasNegationTerms,
  processNaturalLanguageQuery,
  applyNegationFiltering
};