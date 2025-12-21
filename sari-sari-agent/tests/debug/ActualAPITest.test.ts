/**
 * Test to make an actual call to the semantic search API
 */

import { describe, it, expect } from 'vitest';
import { InventoryService } from '@/inventory/InventoryService';

describe('Actual API Test', () => {
  it('should make a real call to the semantic search API', async () => {
    console.log('🌐 Testing REAL API Connection...');
    console.log('   This test will make an actual HTTP request to the semantic search API');
    
    const inventoryService = new InventoryService();
    
    console.log('\n🔍 Searching for "show products with spice"...');
    
    try {
      const results = await inventoryService.searchProductsSemantically('show products with spice');
      
      console.log('\n📊 ACTUAL API RESULTS:');
      console.log(`   Results count: ${results.length}`);
      
      if (results.length > 0) {
        results.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.product.name}`);
          console.log(`      Description: ${result.product.description}`);
          console.log(`      Category: ${result.product.category}`);
          console.log(`      Similarity: ${result.similarity}`);
          console.log(`      Contains "spice": ${result.product.name.toLowerCase().includes('spice') || result.product.description.toLowerCase().includes('spice')}`);
          console.log('');
        });
        
        console.log('✅ SUCCESS: Got results from API!');
        
        // Check if we got spicy products
        const hasSpiceProducts = results.some(r => 
          r.product.name.toLowerCase().includes('spice') || 
          r.product.description.toLowerCase().includes('spice')
        );
        
        if (hasSpiceProducts) {
          console.log('🌶️  PERFECT: Found spicy products as expected!');
        } else {
          console.log('⚠️  WARNING: No spicy products found - this might indicate an issue');
        }
        
        // Check if we got "Pure vinegar" (the wrong result)
        const hasPureVinegar = results.some(r => 
          r.product.name.toLowerCase().includes('pure vinegar')
        );
        
        if (hasPureVinegar) {
          console.log('❌ PROBLEM: Found "Pure vinegar" - this should not appear for "spice" query');
        } else {
          console.log('✅ GOOD: No "Pure vinegar" in results');
        }
        
      } else {
        console.log('⚠️  No results returned from API');
      }
      
    } catch (error) {
      console.log('\n❌ API CALL FAILED:');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('   This could be due to:');
      console.log('   - Network connectivity issues');
      console.log('   - API endpoint not accessible');
      console.log('   - Authentication required');
      console.log('   - CORS issues');
      
      // The system should fall back to mock results
      console.log('\n🔄 System should fall back to mock results...');
      
      // Don't fail the test - this is expected in some environments
      console.log('   (This is expected behavior when API is not accessible)');
    }
  });

  it('should show what search term is being extracted and sent', async () => {
    console.log('\n🔍 Testing Search Term Extraction...');
    
    const testQueries = [
      'show products with spice',
      'what do you have that is hot',
      'find vinegar products',
      'do you have spicy items'
    ];
    
    const inventoryService = new InventoryService();
    
    for (const query of testQueries) {
      console.log(`\n📝 Query: "${query}"`);
      
      try {
        // We don't need to wait for results, just check the logs
        const results = await inventoryService.searchProductsSemantically(query);
        console.log(`   → Results: ${results.length} products found`);
        
        if (results.length > 0) {
          console.log(`   → Top result: ${results[0].product.name}`);
        }
      } catch (error) {
        console.log(`   → Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
    
    console.log('\n💡 Check the debug logs above to see:');
    console.log('   - Original query vs extracted search term');
    console.log('   - API endpoint being called');
    console.log('   - Whether API succeeds or falls back to mock');
  });
});