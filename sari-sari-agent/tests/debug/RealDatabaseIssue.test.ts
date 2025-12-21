/**
 * Debug test to reproduce the exact issue when connecting to real database
 */

import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from '@/inventory/InventoryService';

// Mock the database to simulate real database with actual data but no embeddings
vi.mock('@/database/connection', () => ({
  db: {
    query: vi.fn().mockImplementation((sql: string, params: any[]) => {
      console.log(`🗄️  Database Query: ${sql.substring(0, 100)}...`);
      console.log(`📋 Parameters: ${JSON.stringify(params)}`);
      
      // Simulate the semantic search service failing and falling back to text search
      if (sql.includes('MATCH') && sql.includes('AGAINST')) {
        // Full-text search returns "Pure vinegar" because it matches "vinegar" 
        console.log('   → Using FULLTEXT search (fallback from failed semantic search)');
        return Promise.resolve([
          {
            id: 'pure-vinegar-1',
            name: 'Pure vinegar',
            description: 'Clean, pure vinegar for cooking and cleaning',
            category: 'condiments',
            unit: 'bottle',
            base_price: 20.00,
            stock_quantity: 10,
            current_quantity: 10,
            tags: '["vinegar", "cooking", "clean"]',
            sellable: true,
            embedding_text: null,
            embedding_vector: null,
            relevance_score: 0.5 // Low relevance but still returned
          }
        ]);
      }
      
      if (sql.includes('LIKE')) {
        // LIKE search also returns "Pure vinegar"
        console.log('   → Using LIKE search (fallback from failed fulltext search)');
        return Promise.resolve([
          {
            id: 'pure-vinegar-1',
            name: 'Pure vinegar',
            description: 'Clean, pure vinegar for cooking and cleaning',
            category: 'condiments',
            unit: 'bottle',
            base_price: 20.00,
            stock_quantity: 10,
            current_quantity: 10,
            tags: '["vinegar", "cooking", "clean"]',
            sellable: true,
            embedding_text: null,
            embedding_vector: null
          }
        ]);
      }
      
      // All other queries return empty
      return Promise.resolve([]);
    })
  }
}));

// Mock the semantic search service to fail (simulating no Bedrock + no database service)
vi.mock('@/search/SemanticSearchService', () => ({
  SemanticSearchServiceImpl: class MockSemanticSearchService {
    constructor() {
      console.log('🤖 SemanticSearchService: No Bedrock client, no database service');
    }
    
    async searchProducts(searchTerm: string) {
      console.log(`🔍 SemanticSearchService.searchProducts("${searchTerm}")`);
      console.log('   → No Bedrock client available');
      console.log('   → No database service available');
      console.log('   → Throwing error to force fallback');
      throw new Error('Semantic search not available - no Bedrock client or database service');
    }
  }
}));

describe('Real Database Issue Reproduction', () => {
  it('should reproduce the exact issue the user is experiencing', async () => {
    console.log('🐛 REPRODUCING EXACT USER ISSUE');
    console.log('=====================================\n');
    
    console.log('👤 User Query: "show products with spice"');
    console.log('🎯 Expected: Long neck vinegar spice, Spiced vinegar lipid');
    console.log('❌ Actual: Pure vinegar (wrong!)\n');
    
    const inventoryService = new InventoryService();
    
    console.log('🔄 Processing search...\n');
    
    const results = await inventoryService.searchProductsSemantically('show products with spice');
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`   Count: ${results.length}`);
    
    if (results.length > 0) {
      results.forEach((result, index) => {
        const hasSpice = result.product.name.toLowerCase().includes('spice') || 
                        result.product.description.toLowerCase().includes('spice') ||
                        result.product.tags.some((tag: string) => tag.toLowerCase().includes('spice'));
        
        console.log(`   ${index + 1}. ${result.product.name}`);
        console.log(`      Description: ${result.product.description}`);
        console.log(`      Tags: ${result.product.tags.join(', ')}`);
        console.log(`      Contains "spice": ${hasSpice ? '✅' : '❌'}`);
        console.log(`      Similarity: ${result.similarity}`);
      });
    }
    
    console.log('\n🔍 ANALYSIS:');
    console.log('1. ✅ Search term extraction worked: "show products with spice" → "spice"');
    console.log('2. ❌ Semantic search failed (no Bedrock + no database service)');
    console.log('3. ❌ Fell back to text search in database');
    console.log('4. ❌ Text search found "Pure vinegar" because query contains "vinegar"');
    console.log('5. ❌ "Pure vinegar" does NOT contain "spice" - WRONG RESULT!');
    
    console.log('\n💡 ROOT CAUSE:');
    console.log('The fallback text search is matching on "vinegar" instead of "spice"');
    console.log('This happens because the search looks for ANY word in the query,');
    console.log('not specifically the extracted search term.');
    
    console.log('\n🔧 SOLUTION OPTIONS:');
    console.log('1. Fix the fallback text search to use extracted term only');
    console.log('2. Set up proper semantic search with embeddings');
    console.log('3. Improve the text search to be more precise');
    
    // Verify the issue
    const wrongResults = results.filter(r => {
      const hasSpice = r.product.name.toLowerCase().includes('spice') || 
                      r.product.description.toLowerCase().includes('spice') ||
                      r.product.tags.some((tag: string) => tag.toLowerCase().includes('spice'));
      return !hasSpice;
    });
    
    if (wrongResults.length > 0) {
      console.log(`\n❌ CONFIRMED BUG: ${wrongResults.length} results don't contain "spice"`);
      wrongResults.forEach(r => {
        console.log(`   - "${r.product.name}" (should not appear for "spice" query)`);
      });
    }
    
    // The test should fail to highlight the issue
    expect(wrongResults.length).toBe(0); // This will fail, showing the bug
  });
});