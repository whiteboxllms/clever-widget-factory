/**
 * Test script to verify the semantic search API endpoint works correctly
 */

const API_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';

async function testSemanticSearch() {
  console.log('🧪 Testing semantic search API endpoint...');
  
  const testQueries = [
    'something hot',
    'vinegar',
    'spicy items',
    'I want something hot and spicy',
    'do you have vinegar?'
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/semantic-search`, {
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

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        continue;
      }

      const data = await response.json();
      console.log('✅ Response structure:', {
        hasResults: !!data.results,
        hasData: !!data.data,
        resultCount: data.results?.length || data.data?.results?.length || 0,
        keys: Object.keys(data)
      });

      // Show first result details
      const results = data.results || data.data?.results || [];
      if (results.length > 0) {
        const firstResult = results[0];
        console.log('📋 First result:', {
          name: firstResult.name,
          description: firstResult.description?.substring(0, 100) + '...',
          similarity: firstResult.similarity || firstResult.distance,
          sellable: firstResult.sellable,
          cost_per_unit: firstResult.cost_per_unit
        });
      }

    } catch (error) {
      console.error(`❌ Error testing query "${query}":`, error.message);
    }
  }
}

// Run the test
testSemanticSearch().catch(console.error);