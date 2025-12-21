/**
 * Debug test for semantic search functionality
 */

import { describe, it, expect } from 'vitest';
import { SemanticSearchServiceImpl } from '@/search/SemanticSearchService';

describe('Semantic Search Debug', () => {
  it('should return mock results for spice search', async () => {
    console.log('🔍 Testing Semantic Search...');
    
    // Create service without database (should use mocks)
    const searchService = new SemanticSearchServiceImpl();
    
    console.log('\n1. Testing search for "spice"...');
    const results = await searchService.searchProducts('spice', 5);
    
    console.log(`Found ${results.length} results:`);
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.product.name} (similarity: ${result.similarity})`);
      console.log(`     Description: ${result.product.description}`);
      console.log(`     Tags: ${result.product.tags.join(', ')}`);
      console.log('');
    });
    
    // Verify we get the expected mock results
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].product.name).toBe('Long neck vinegar spice');
    expect(results[1].product.name).toBe('Spiced vinegar lipid');
  });

  it('should return mock results for hot search', async () => {
    const searchService = new SemanticSearchServiceImpl();
    
    console.log('\n2. Testing search for "hot"...');
    const hotResults = await searchService.searchProducts('hot', 5);
    
    console.log(`Found ${hotResults.length} results:`);
    hotResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.product.name} (similarity: ${result.similarity})`);
    });
    
    expect(hotResults.length).toBeGreaterThan(0);
    expect(hotResults[0].product.name).toBe('Long neck vinegar spice');
  });
});