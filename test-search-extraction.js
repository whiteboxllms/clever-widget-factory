// Test the search term extraction logic
function extractProductSearchTerm(userQuery) {
  const query = userQuery.toLowerCase();
  
  // Remove common query prefixes
  const cleanedQuery = query
    .replace(/^(show|find|get|search|look for|what do you have|do you have|what)/i, '')
    .replace(/\b(products?|items?|things?|stuff)\b/gi, '')
    .replace(/\b(with|that are|that is|are)\b/gi, '')
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

  const extractedTerm = uniqueKeywords.length > 0 
    ? uniqueKeywords.join(' ') 
    : cleanedQuery || userQuery;

  console.log('🔍 Product search term extraction:', {
    originalQuery: userQuery,
    cleanedQuery,
    foundKeywords,
    mappedKeywords,
    uniqueKeywords,
    extractedTerm
  });

  return extractedTerm;
}

// Test cases
console.log('=== Testing Search Term Extraction ===');

const testQueries = [
  "What products are spicy",
  "Show me spicy items", 
  "I don't like spicy - what options are there",
  "Do you have anything not spicy",
  "Show me products without spice",
  "I want something sweet",
  "Avoid hot sauce",
  "No spicy products please",
  "What vinegar do you have"
];

testQueries.forEach(query => {
  console.log(`\nInput: "${query}"`);
  const result = extractProductSearchTerm(query);
  console.log(`Output: "${result}"`);
});