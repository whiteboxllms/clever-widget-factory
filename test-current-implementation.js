/**
 * Test the current SariSariChat implementation
 */

// Copy of the current extractProductSearchTerm function
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

console.log('=== Testing Current Implementation ===');

const testQueries = [
  "i don't like spicy - what options are there",
  "What products are spicy",
  "Show me spicy items",
  "I want something not hot"
];

testQueries.forEach(query => {
  console.log(`\nTesting: "${query}"`);
  const result = extractProductSearchTerm(query);
  console.log(`Result: "${result}"`);
  
  if (query.includes("don't like spicy")) {
    if (result.includes("don't like spicy")) {
      console.log('✅ CORRECT: Preserved negation');
    } else {
      console.log('❌ WRONG: Lost negation, got:', result);
    }
  }
});