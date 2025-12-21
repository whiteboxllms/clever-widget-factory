/**
 * Debug script to show what semantic search is actually doing
 * This demonstrates the difference between mock behavior and real database behavior
 */

const { InventoryService } = require('./dist/inventory/InventoryService.js');

async function debugSemanticSearch() {
  console.log('🔍 Debugging Semantic Search Issue\n');
  
  const inventoryService = new InventoryService();
  
  console.log('1. Testing with "show products with spice"...\n');
  
  try {
    const results = await inventoryService.searchProductsSemantically('show products with spice');
    
    console.log('📊 RESULTS ANALYSIS:');
    console.log(`   Total results: ${results.length}`);
    console.log(`   Search term extracted: "${results[0]?.searchTerm || 'N/A'}"`);
    console.log('');
    
    console.log('📋 PRODUCTS FOUND:');
    results.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.product.name}`);
      console.log(`      Description: ${result.product.description}`);
      console.log(`      Tags: ${result.product.tags.join(', ')}`);
      console.log(`      Similarity: ${result.similarity}`);
      console.log(`      Has "spice" in name: ${result.product.name.toLowerCase().includes('spice')}`);
      console.log(`      Has "spice" in description: ${result.product.description.toLowerCase().includes('spice')}`);
      console.log(`      Has "spice" in tags: ${result.product.tags.some(tag => tag.toLowerCase().includes('spice'))}`);
      console.log('');
    });
    
    // Check if we got the expected results
    const expectedProducts = ['Long neck vinegar spice', 'Spiced vinegar lipid'];
    const foundProducts = results.map(r => r.product.name);
    
    console.log('✅ EXPECTED vs ACTUAL:');
    expectedProducts.forEach(expected => {
      const found = foundProducts.includes(expected);
      console.log(`   ${found ? '✅' : '❌'} ${expected}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    });
    
    if (foundProducts.includes('Pure vinegar')) {
      console.log('   ❌ Pure vinegar: FOUND (should NOT be found for "spice" query)');
    }
    
    console.log('\n🔧 DIAGNOSIS:');
    if (results.length === 0) {
      console.log('   No results returned - check database connection and data');
    } else if (foundProducts.includes('Pure vinegar')) {
      console.log('   Getting "Pure vinegar" suggests fallback to text search');
      console.log('   This happens when semantic search fails and system uses LIKE queries');
    } else if (expectedProducts.every(p => foundProducts.includes(p))) {
      console.log('   ✅ Semantic search working correctly!');
    } else {
      console.log('   Unexpected results - check semantic search implementation');
    }
    
  } catch (error) {
    console.error('❌ Error during semantic search:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run the debug
debugSemanticSearch().catch(console.error);