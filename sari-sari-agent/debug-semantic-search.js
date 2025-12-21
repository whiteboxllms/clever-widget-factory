/**
 * Debug script to test semantic search functionality
 */

const { SemanticSearchServiceImpl } = require('./src/search/SemanticSearchService');

async function testSemanticSearch() {
  console.log('🔍 Testing Semantic Search...');
  
  // Create service without database (should use mocks)
  const searchService = new SemanticSearchServiceImpl();
  
  try {
    console.log('\n1. Testing search for "spice"...');
    const results = await searchService.searchProducts('spice', 5);
    
    console.log(`Found ${results.length} results:`);
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.product.name} (similarity: ${result.similarity})`);
      console.log(`     Description: ${result.product.description}`);
      console.log(`     Tags: ${result.product.tags.join(', ')}`);
      console.log('');
    });
    
    console.log('\n2. Testing search for "hot"...');
    const hotResults = await searchService.searchProducts('hot', 5);
    
    console.log(`Found ${hotResults.length} results:`);
    hotResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.product.name} (similarity: ${result.similarity})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testSemanticSearch();