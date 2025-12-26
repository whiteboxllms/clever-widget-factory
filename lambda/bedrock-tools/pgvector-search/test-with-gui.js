/**
 * Test the Bedrock search tool to verify it's ready for GUI testing
 * This simulates how the Bedrock Agent would call the function
 */

const { handler } = require('./index');

async function testForGUI() {
  console.log('🧪 Testing Bedrock Search Tool for GUI Integration');
  console.log('='.repeat(50));
  
  // Test case that simulates Bedrock Agent invocation
  const testEvent = {
    inputText: 'noodles under 30 pesos',
    parameters: {
      query: 'noodles under 30 pesos',
      limit: '3',
      priceMax: '30'
    }
  };
  
  console.log('📝 Test Query: "noodles under 30 pesos"');
  console.log('💰 Price Filter: Under 30 pesos');
  console.log('📊 Limit: 3 results');
  console.log('');
  
  try {
    console.log('🔍 Executing search...');
    const result = await handler(testEvent);
    
    if (result.statusCode === 200) {
      const response = result.body;
      
      console.log('✅ Search successful!');
      console.log('📊 Results found:', response.products.length);
      console.log('🎯 Search context:', response.searchContext.interpretedIntent);
      
      if (response.products.length > 0) {
        console.log('\n🛍️  Sample Product (for GUI display):');
        const product = response.products[0];
        console.log('   Name:', product.product.name);
        console.log('   Price: ₱' + product.product.price);
        console.log('   Stock:', product.stockDescription);
        console.log('   Why relevant:', product.relevanceReason);
        console.log('   Selling points:', product.sellingPoints.join(', '));
        
        if (product.complementaryItems.length > 0) {
          console.log('   Goes well with:', product.complementaryItems.join(', '));
        }
      }
      
      if (response.searchContext.suggestedFollowUp) {
        console.log('\n💬 Agent follow-up suggestion:');
        console.log('   "' + response.searchContext.suggestedFollowUp + '"');
      }
      
      console.log('\n🎯 GUI Integration Status: ✅ READY');
      console.log('   - Lambda function works correctly');
      console.log('   - Returns conversational product data');
      console.log('   - Includes selling points and context');
      console.log('   - Ready for Bedrock Agent integration');
      
    } else {
      console.log('❌ Search failed with status:', result.statusCode);
      console.log('Error:', result.body.error);
      
      console.log('\n🎯 GUI Integration Status: ❌ NOT READY');
      console.log('   - Fix the error above before proceeding');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('\n🎯 GUI Integration Status: ❌ NOT READY');
    console.log('   - Check database connection and embeddings service');
    console.log('   - Ensure products table has embedding_vector data');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Next Steps if READY:');
  console.log('   1. Deploy: ./scripts/deploy-bedrock-search.sh');
  console.log('   2. Create Bedrock Agent in AWS Console');
  console.log('   3. Test in Bedrock Agent GUI with same query');
  console.log('   4. Integrate with your React chat interface');
}

// Run the test
if (require.main === module) {
  testForGUI()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testForGUI };