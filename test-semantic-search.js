/**
 * Test script to verify semantic search is working
 */

async function testSemanticSearch() {
  console.log('🔍 Testing Semantic Search Integration...\n');
  
  const testQueries = [
    'What products are spicy',
    'show products with spice', 
    'what do you have that is hot',
    'find vinegar products'
  ];
  
  for (const query of testQueries) {
    console.log(`📝 Testing query: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:3001/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          table: 'parts',
          limit: 5
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Success: Found ${data.count || 0} results`);
        console.log(`   Method: ${data.method || 'semantic_search'}`);
        
        if (data.results && data.results.length > 0) {
          console.log('   Results:');
          data.results.forEach((item, index) => {
            console.log(`     ${index + 1}. ${item.name}`);
            if (item.description) {
              console.log(`        Description: ${item.description.substring(0, 60)}...`);
            }
            if (item.similarity !== undefined) {
              console.log(`        Similarity: ${item.similarity}`);
            }
          });
          
          // Check if we got the wrong results
          const hasSpiceProducts = data.results.some(item => 
            item.name.toLowerCase().includes('spice') || 
            (item.description && item.description.toLowerCase().includes('spice'))
          );
          
          const hasPureVinegar = data.results.some(item => 
            item.name.toLowerCase().includes('pure vinegar')
          );
          
          if (query.toLowerCase().includes('spic')) {
            if (hasSpiceProducts) {
              console.log('   🌶️  GOOD: Found spicy products as expected');
            } else {
              console.log('   ⚠️  WARNING: No spicy products found');
            }
            
            if (hasPureVinegar) {
              console.log('   ❌ PROBLEM: Found "Pure vinegar" - should not appear for spice query');
            } else {
              console.log('   ✅ GOOD: No "Pure vinegar" in results');
            }
          }
        } else {
          console.log('   📭 No results found');
        }
      } else {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Network Error: ${error.message}`);
    }
    
    console.log(''); // Empty line between tests
  }
}

// Run the test
testSemanticSearch().catch(console.error);