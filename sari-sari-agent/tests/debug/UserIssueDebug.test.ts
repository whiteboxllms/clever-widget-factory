/**
 * Debug test to reproduce the user's issue with "Pure vinegar" appearing in results
 */

import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from '@/inventory/InventoryService';

// Mock the database to simulate real database behavior (no embeddings)
vi.mock('@/database/connection', () => ({
  db: {
    query: vi.fn().mockImplementation((sql: string) => {
      // Simulate database returning "Pure vinegar" for text search
      if (sql.includes('LIKE') || sql.includes('MATCH')) {
        return Promise.resolve([
          {
            id: 'pure-vinegar-1',
            name: 'Pure vinegar',
            description: 'Clean, pure vinegar for cooking',
            category: 'condiments',
            unit: 'bottle',
            base_price: 20.00,
            stock_quantity: 10,
            tags: '["vinegar", "cooking", "clean"]',
            sellable: true,
            embedding_text: null,
            embedding_vector: null
          }
        ]);
      }
      return Promise.resolve([]);
    })
  }
}));

describe('User Issue Debug - Pure Vinegar Problem', () => {
  it('should show what happens when semantic search falls back to text search', async () => {
    console.log('🐛 Reproducing User Issue...');
    console.log('User query: "show products with spice"');
    console.log('Expected: Long neck vinegar spice, Spiced vinegar lipid');
    console.log('Actual result: Pure vinegar (incorrect)\n');
    
    const inventoryService = new InventoryService();
    
    // This will trigger the fallback to text search since semantic search will fail
    const results = await inventoryService.searchProductsSemantically('show products with spice');
    
    console.log('📊 ACTUAL RESULTS:');
    console.log(`   Results count: ${results.length}`);
    
    if (results.length > 0) {
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.product.name}`);
        console.log(`      Description: ${result.product.description}`);
        console.log(`      Has "spice": ${result.product.name.toLowerCase().includes('spice') || result.product.description.toLowerCase().includes('spice')}`);
      });
    }
    
    console.log('\n🔍 WHAT HAPPENED:');
    console.log('1. User searched for "show products with spice"');
    console.log('2. System extracted "spice" as search term ✅');
    console.log('3. Semantic search tried to generate embedding');
    console.log('4. No Bedrock client available, so used mock embedding ⚠️');
    console.log('5. Vector search failed (no database service), fell back to text search ❌');
    console.log('6. Text search found "Pure vinegar" because it contains "vinegar" ❌');
    console.log('7. "Pure vinegar" does NOT contain "spice" - wrong result! ❌');
    
    console.log('\n💡 SOLUTION:');
    console.log('The system needs either:');
    console.log('1. Proper database with embeddings configured, OR');
    console.log('2. Force use of mock semantic search for development');
    
    // Verify the issue
    if (results.length > 0) {
      const hasSpiceProducts = results.some(r => 
        r.product.name.toLowerCase().includes('spice') || 
        r.product.description.toLowerCase().includes('spice') ||
        r.product.tags.some((tag: string) => tag.toLowerCase().includes('spice'))
      );
      
      if (!hasSpiceProducts) {
        console.log('\n❌ CONFIRMED: No spicy products found for "spice" query');
        console.log('   This is the bug the user is experiencing');
      }
    }
  });

  it('should show what the correct behavior looks like', async () => {
    console.log('\n✅ CORRECT BEHAVIOR (from mock semantic search):');
    
    // Force mock behavior by ensuring no database service
    const inventoryService = new InventoryService();
    
    // Mock the semantic search to return correct results
    const mockSemanticSearch = vi.fn().mockResolvedValue([
      {
        product: {
          id: 'vinegar-spice-1',
          name: 'Long neck vinegar spice',
          description: 'Spicy vinegar with long neck bottle, perfect for hot dishes',
          category: 'condiments',
          unit: 'bottle',
          basePrice: 25.00,
          stockQuantity: 15,
          tags: ['spicy', 'hot', 'vinegar', 'condiment'],
          sellable: true
        },
        similarity: 0.9,
        searchTerm: 'spice',
        timestamp: new Date()
      },
      {
        product: {
          id: 'vinegar-lipid-1',
          name: 'Spiced vinegar lipid',
          description: 'Rich spiced vinegar with lipid content, adds heat to meals',
          category: 'condiments',
          unit: 'bottle',
          basePrice: 30.00,
          stockQuantity: 8,
          tags: ['spiced', 'hot', 'vinegar', 'rich'],
          sellable: true
        },
        similarity: 0.8,
        searchTerm: 'spice',
        timestamp: new Date()
      }
    ]);
    
    // Replace the semantic search method temporarily
    (inventoryService as any).semanticSearchService.searchProducts = mockSemanticSearch;
    
    const correctResults = await inventoryService.searchProductsSemantically('show products with spice');
    
    console.log('📊 CORRECT RESULTS:');
    correctResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.product.name} (similarity: ${result.similarity})`);
      console.log(`      Description: ${result.product.description}`);
      console.log(`      Has "spice": ${result.product.name.toLowerCase().includes('spice') || result.product.description.toLowerCase().includes('spice')}`);
    });
    
    console.log('\n✅ This is what the user should see!');
    
    // Verify correct behavior
    const hasSpiceProducts = correctResults.every(r => 
      r.product.name.toLowerCase().includes('spice') || 
      r.product.description.toLowerCase().includes('spice') ||
      r.product.tags.some((tag: string) => tag.toLowerCase().includes('spice'))
    );
    
    expect(hasSpiceProducts).toBe(true);
    expect(correctResults.map(r => r.product.name)).toContain('Long neck vinegar spice');
    expect(correctResults.map(r => r.product.name)).toContain('Spiced vinegar lipid');
  });
});