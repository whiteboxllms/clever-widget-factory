/**
 * Tests for Semantic Search Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticSearchServiceImpl } from '@/search/SemanticSearchService';
import { Product } from '@/types/core';

describe('SemanticSearchService', () => {
  let searchService: SemanticSearchServiceImpl;
  let mockBedrockClient: any;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockBedrockClient = {
      invokeModel: vi.fn()
    };

    mockDatabaseService = {
      getProduct: vi.fn(),
      logSearchOperation: vi.fn(),
      vectorSearch: vi.fn(),
      updateProductEmbedding: vi.fn()
    };

    searchService = new SemanticSearchServiceImpl(mockBedrockClient, mockDatabaseService);
  });

  describe('generateEmbedding', () => {
    it('should generate embedding using Bedrock client', async () => {
      const mockEmbedding = new Array(1536).fill(0).map((_, i) => Math.sin(i * 0.1));
      
      mockBedrockClient.invokeModel.mockResolvedValue({
        body: {
          toString: () => JSON.stringify({ embedding: mockEmbedding })
        }
      });

      const result = await searchService.generateEmbedding('test product description');

      expect(result).toHaveLength(1536);
      expect(mockBedrockClient.invokeModel).toHaveBeenCalledWith({
        modelId: 'amazon.titan-embed-text-v1',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: 'test product description'
        })
      });
    });

    it('should generate mock embedding when no Bedrock client', async () => {
      const serviceWithoutBedrock = new SemanticSearchServiceImpl();
      
      const result = await serviceWithoutBedrock.generateEmbedding('test text');

      expect(result).toHaveLength(1536);
      expect(result.every(val => typeof val === 'number')).toBe(true);
    });

    it('should throw error for empty text', async () => {
      await expect(searchService.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
    });
  });

  describe('searchProducts', () => {
    it('should return mock results when no database service', async () => {
      const serviceWithoutDb = new SemanticSearchServiceImpl();
      
      const results = await serviceWithoutDb.searchProducts('hot', 5);

      expect(results).toHaveLength(2); // Mock returns 2 hot products
      expect(results[0].product.name).toBe('Long neck vinegar spice');
      expect(results[1].product.name).toBe('Spiced vinegar lipid');
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it('should perform vector search with database service', async () => {
      const mockResults = [
        {
          product: {
            id: 'test-1',
            name: 'Test Product',
            description: 'Hot and spicy',
            category: 'condiments',
            unit: 'bottle',
            basePrice: 25,
            stockQuantity: 10,
            tags: ['hot', 'spicy'],
            sellable: true
          },
          similarity: 0.9
        }
      ];

      mockDatabaseService.vectorSearch.mockResolvedValue(mockResults);

      const results = await searchService.searchProducts('hot spicy', 10);

      expect(results).toHaveLength(1);
      expect(results[0].product.name).toBe('Test Product');
      expect(results[0].similarity).toBe(0.9);
      expect(mockDatabaseService.vectorSearch).toHaveBeenCalledWith({
        vector: expect.any(Array),
        limit: 10,
        threshold: 0.1
      });
    });
  });

  describe('updateProductEmbeddings', () => {
    it('should process products in batches', async () => {
      const products: Product[] = Array.from({ length: 25 }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        description: `Description ${i}`,
        category: 'test',
        unit: 'piece',
        basePrice: 10,
        stockQuantity: 5,
        tags: ['test'],
        sellable: true
      }));

      mockBedrockClient.invokeModel.mockResolvedValue({
        body: {
          toString: () => JSON.stringify({ 
            embedding: new Array(1536).fill(0.1) 
          })
        }
      });

      await searchService.updateProductEmbeddings(products);

      // Should be called 25 times (once per product)
      expect(mockBedrockClient.invokeModel).toHaveBeenCalledTimes(25);
      expect(mockDatabaseService.updateProductEmbedding).toHaveBeenCalledTimes(25);
    });
  });

  describe('logSearch', () => {
    it('should log search operation to database', async () => {
      const searchResults = [
        {
          product: {
            id: 'test-1',
            name: 'Test Product',
            description: 'Test',
            category: 'test',
            unit: 'piece',
            basePrice: 10,
            stockQuantity: 5,
            tags: [],
            sellable: true
          },
          similarity: 0.9,
          searchTerm: 'test',
          timestamp: new Date()
        }
      ];

      await searchService.logSearch('test query', searchResults, 'session-123');

      expect(mockDatabaseService.logSearchOperation).toHaveBeenCalledWith({
        sessionId: 'session-123',
        originalQuery: 'test query',
        extractedSearchTerm: 'test query',
        searchResults: [
          {
            productId: 'test-1',
            similarity: 0.9
          }
        ],
        selectedProducts: [],
        timestamp: expect.any(Date)
      });
    });

    it('should not throw error when logging fails', async () => {
      mockDatabaseService.logSearchOperation.mockRejectedValue(new Error('Database error'));

      await expect(
        searchService.logSearch('test', [], 'session-123')
      ).resolves.not.toThrow();
    });
  });

  describe('getSimilarProducts', () => {
    it('should find similar products based on reference product', async () => {
      const referenceProduct = {
        id: 'ref-1',
        name: 'Reference Product',
        embeddingVector: new Array(1536).fill(0.5)
      };

      const similarResults = [
        {
          product: referenceProduct,
          similarity: 1.0
        },
        {
          product: {
            id: 'similar-1',
            name: 'Similar Product',
            description: 'Similar to reference',
            category: 'test',
            unit: 'piece',
            basePrice: 15,
            stockQuantity: 3,
            tags: [],
            sellable: true
          },
          similarity: 0.8
        }
      ];

      mockDatabaseService.getProduct.mockResolvedValue(referenceProduct);
      mockDatabaseService.vectorSearch.mockResolvedValue(similarResults);

      const results = await searchService.getSimilarProducts('ref-1', 5);

      expect(results).toHaveLength(1); // Reference product filtered out
      expect(results[0].id).toBe('similar-1');
      expect(mockDatabaseService.vectorSearch).toHaveBeenCalledWith({
        vector: referenceProduct.embeddingVector,
        limit: 6, // limit + 1 to account for filtering
        threshold: 0.1
      });
    });

    it('should throw error when reference product not found', async () => {
      mockDatabaseService.getProduct.mockResolvedValue(null);

      await expect(
        searchService.getSimilarProducts('nonexistent', 5)
      ).rejects.toThrow('Reference product not found');
    });
  });
});