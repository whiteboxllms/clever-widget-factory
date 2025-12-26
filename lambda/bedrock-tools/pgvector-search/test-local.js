/**
 * Local test for the conversational pgvector search tool
 * Run with: node test-local.js
 */

const { handler } = require('./index');

async function testConversationalSearch() {
  console.log('Testing conversational pgvector search tool...\n');
  
  // Test cases
  const testCases = [
    {
      name: 'Hot/Spicy Items Search',
      event: {
        inputText: 'something hot',
        parameters: {
          query: 'something hot',
          limit: '3'
        }
      }
    },
    {
      name: 'Budget Noodles Search',
      event: {
        inputText: 'noodles under 30 pesos',
        parameters: {
          query: 'noodles',
          limit: '3',
          priceMax: '30'
        }
      }
    },
    {
      name: 'Cooking Ingredients Search',
      event: {
        inputText: 'ingredients for cooking',
        parameters: {
          query: 'cooking ingredients',
          limit: '5'
        }
      }
    },
    {
      name: 'Fresh Vegetables Search',
      event: {
        inputText: 'fresh vegetables',
        parameters: {
          query: 'fresh vegetables',
          limit: '4'
        }
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n=== ${testCase.name} ===`);
    console.log('Input:', JSON.stringify(testCase.event, null, 2));
    
    try {
      const result = await handler(testCase.event);
      console.log('Status:', result.statusCode);
      
      if (result.statusCode === 200) {
        const body = result.body;
        console.log('Products found:', body.products.length);
        console.log('Search context:', body.searchContext);
        
        // Show first product with conversational context
        if (body.products.length > 0) {
          const firstProduct = body.products[0];
          console.log('\nFirst product:');
          console.log('- Name:', firstProduct.product.name);
          console.log('- Price:', firstProduct.product.price);
          console.log('- Relevance reason:', firstProduct.relevanceReason);
          console.log('- Selling points:', firstProduct.sellingPoints);
          console.log('- Stock description:', firstProduct.stockDescription);
          console.log('- Freshness:', firstProduct.freshness);
          console.log('- Complementary items:', firstProduct.complementaryItems);
        }
      } else {
        console.log('Error:', result.body);
      }
      
    } catch (error) {
      console.error('Test failed:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testConversationalSearch()
    .then(() => {
      console.log('\nAll tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testConversationalSearch };