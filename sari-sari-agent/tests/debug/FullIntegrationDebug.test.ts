/**
 * Debug test for full semantic search integration
 */

import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from '@/inventory/InventoryService';

// Mock the database connection to avoid real database calls
vi.mock('@/database/connection', () => ({
  db: {
    query: vi.fn().mockResolvedValue([]) // Return empty results to force semantic search
  }
}));

describe('Full Semantic Search Integration Debug', () => {
  it('should use semantic search when database returns no results', async () => {
    console.log('🔍 Testing Full Integration...');
    
    const inventoryService = new InventoryService();
    
    console.log('\n1. Testing search for "show products with spice"...');
    const results = await inventoryService.searchProductsSemantically('show products with spice');
    
    console.log(`Found ${results.length} results:`);
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.product.name} (similarity: ${result.similarity})`);
      console.log(`     Description: ${result.product.description}`);
      console.log(`     Tags: ${result.product.tags.join(', ')}`);
      console.log(`     Sellable: ${result.product.sellable}`);
      console.log(`     Stock: ${result.product.stockQuantity}`);
      console.log('');
    });
    
    // Should get semantic search results, not database results
    expect(results.length).toBeGreaterThan(0);
    
    // Should extract "spice" and find spicy products
    const productNames = results.map(r => r.product.name);
    expect(productNames).toContain('Long neck vinegar spice');
    expect(productNames).toContain('Spiced vinegar lipid');
    
    // Should NOT contain "Pure vinegar" since that's not in the mock data
    expect(productNames).not.toContain('Pure vinegar');
  });

  it('should extract correct search terms', async () => {
    const inventoryService = new InventoryService();
    
    console.log('\n2. Testing various search queries...');
    
    const testCases = [
      { query: 'show products with spice', expectedTerm: 'spice' },
      { query: 'what do you have that is hot', expectedTerm: 'hot' },
      { query: 'find vinegar products', expectedTerm: 'vinegar' },
      { query: 'spicy hot sauce', expectedTerm: 'spicy hot sauce' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\nTesting: "${testCase.query}"`);
      const results = await inventoryService.searchProductsSemantically(testCase.query);
      
      console.log(`  - Expected term: "${testCase.expectedTerm}"`);
      console.log(`  - Results: ${results.length} products found`);
      
      if (results.length > 0) {
        console.log(`  - Top result: ${results[0].product.name} (${results[0].similarity})`);
      }
    }
  });
});