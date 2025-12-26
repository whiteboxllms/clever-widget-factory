// Test the natural language preserving search term extraction
function extractProductSearchTerm(userQuery) {
  const query = userQuery.toLowerCase();
  
  // For semantic search, we want to preserve the natural language
  // including negation words like "not spicy", "don't like spicy"
  // The semantic search should be able to understand these naturally
  
  // Only do minimal cleaning - remove obvious non-product words
  const cleanedQuery = query
    .replace(/^(show me|find me|get me|what do you have|do you have)\s*/i, '')
    .replace(/\b(products?|items?|things?|stuff)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If the cleaned query is too short or generic, use the original
  const extractedTerm = cleanedQuery.length > 2 ? cleanedQuery : userQuery;

  console.log('🔍 Product search term extraction:', {
    originalQuery: userQuery,
    cleanedQuery,
    extractedTerm
  });

  return extractedTerm;
}

// Test cases
console.log('=== Testing Natural Language Preserving Search Term Extraction ===');

const testQueries = [
  "What products are spicy",
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
  console.log(`Will be sent to semantic search as: "${result}"`);
});