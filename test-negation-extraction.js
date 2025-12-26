// Test the updated search term extraction logic with negation support
function extractProductSearchTerm(userQuery) {
  const query = userQuery.toLowerCase();
  
  // Check for negation patterns
  const negationPatterns = [
    /\b(don't|do not|dont)\s+(like|want|need)\b/,
    /\b(not|no|avoid|without|except)\b/,
    /\b(i\s+don't|i\s+do\s+not)\b/,
    /\b(nothing|none)\s+(with|that|has)\b/
  ];
  
  const hasNegation = negationPatterns.some(pattern => pattern.test(query));
  
  // Remove common query prefixes
  const cleanedQuery = query
    .replace(/^(show|find|get|search|look for|what do you have|do you have|what)/i, '')
    .replace(/\b(products?|items?|things?|stuff)\b/gi, '')
    .replace(/\b(with|that are|that is|are)\b/gi, '')
    .replace(/\b(options|alternatives|choices)\b/gi, '')
    .trim();

  // Map common variations to searchable terms
  const termMappings = {
    'spicy': 'spice',
    'hot': 'spice',
    'chili': 'sili',
    'pepper': 'sili',
    'sweet': 'sweet',
    'sour': 'vinegar',
    'bitter': 'bitter',
    'salty': 'salt'
  };

  // Extract key product characteristics
  const productKeywords = [
    'spice', 'spicy', 'hot', 'sweet', 'sour', 'bitter', 'salty',
    'fresh', 'organic', 'natural', 'dried', 'canned', 'bottled',
    'vinegar', 'sauce', 'oil', 'pepper', 'salt', 'sugar',
    'vegetable', 'fruit', 'meat', 'dairy', 'grain', 'herb',
    'chili', 'sili'
  ];

  // Find matching keywords and apply mappings
  const foundKeywords = productKeywords.filter(keyword => 
    cleanedQuery.includes(keyword)
  );

  // Apply term mappings to improve search results
  const mappedKeywords = foundKeywords.map(keyword => 
    termMappings[keyword] || keyword
  );

  // Remove duplicates
  const uniqueKeywords = [...new Set(mappedKeywords)];

  let extractedTerm;
  
  if (hasNegation && uniqueKeywords.length > 0) {
    // For negated queries, we need to return products that DON'T have these characteristics
    extractedTerm = `NOT_${uniqueKeywords.join('_')}`;
  } else {
    extractedTerm = uniqueKeywords.length > 0 
      ? uniqueKeywords.join(' ') 
      : cleanedQuery || userQuery;
  }

  console.log('🔍 Product search term extraction:', {
    originalQuery: userQuery,
    cleanedQuery,
    hasNegation,
    foundKeywords,
    mappedKeywords,
    uniqueKeywords,
    extractedTerm
  });

  return extractedTerm;
}

// Test cases
console.log('=== Testing Search Term Extraction with Negation Support ===');

const testQueries = [
  "What products are spicy",
  "Show me spicy items", 
  "I don't like spicy - what options are there",
  "Do you have anything not spicy",
  "Show me products without spice",
  "I want something sweet",
  "Avoid hot sauce",
  "No spicy products please",
  "What vinegar do you have",
  "Don't want hot food",
  "I do not like bitter things"
];

testQueries.forEach(query => {
  console.log(`\nInput: "${query}"`);
  const result = extractProductSearchTerm(query);
  console.log(`Output: "${result}"`);
  console.log(`Expected behavior: ${result.startsWith('NOT_') ? 'Filter OUT products with these characteristics' : 'Search FOR products with these characteristics'}`);
});