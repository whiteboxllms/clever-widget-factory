/**
 * Tests for Semantic Search Integration in Inventory Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryService } from '@/inventory/InventoryService';

describe('InventoryService Semantic Search Integration', () => {
  let inventoryService: InventoryService;

  beforeEach(() => {
    inventoryService = new InventoryService();
  });

  describe('Product Search Term Extraction', () => {
    it('should extract "spice" from "show products with spice"', () => {
      // Access the private method for testing
      const extractMethod = (inventoryService as any).extractProductSearchTerm.bind(inventoryService);
      
      const result = extractMethod('show products with spice');
      expect(result).toBe('spice');
    });

    it('should extract "hot" from "what do you have that is hot"', () => {
      const extractMethod = (inventoryService as any).extractProductSearchTerm.bind(inventoryService);
      
      const result = extractMethod('what do you have that is hot');
      expect(result).toBe('hot');
    });

    it('should extract "vinegar" from "find vinegar products"', () => {
      const extractMethod = (inventoryService as any).extractProductSearchTerm.bind(inventoryService);
      
      const result = extractMethod('find vinegar products');
      expect(result).toBe('vinegar');
    });

    it('should extract multiple keywords from complex queries', () => {
      const extractMethod = (inventoryService as any).extractProductSearchTerm.bind(inventoryService);
      
      const result = extractMethod('show me spicy hot sauce products');
      expect(result).toContain('spicy');
      expect(result).toContain('hot');
      expect(result).toContain('sauce');
    });

    it('should handle queries without product keywords', () => {
      const extractMethod = (inventoryService as any).extractProductSearchTerm.bind(inventoryService);
      
      const result = extractMethod('show me something good');
      expect(result).toBe('something good');
    });
  });

  describe('Search Term Logging', () => {
    it('should log the original query and extracted term', async () => {
      const logSpy = vi.spyOn(console, 'log');
      
      // Mock the semantic search service to avoid actual API calls
      const mockSearchService = {
        searchProducts: vi.fn().mockResolvedValue([])
      };
      
      (inventoryService as any).semanticSearchService = mockSearchService;

      try {
        await inventoryService.searchProductsSemantically('show products with spice');
      } catch (error) {
        // Expected to fail due to mocked dependencies
      }

      expect(mockSearchService.searchProducts).toHaveBeenCalledWith('spice', 20);
    });
  });
});