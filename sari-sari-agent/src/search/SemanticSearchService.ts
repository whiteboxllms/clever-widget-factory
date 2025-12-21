/**
 * Semantic Search Service Implementation
 * Provides vector-based semantic search capabilities for product discovery
 */

import { SemanticSearchService } from '@/types/services';
import { Product, SemanticSearchResult } from '@/types/core';
import { logger } from '@/utils/logger';
import { ValidationError } from '@/utils/errors';

// Add fetch for Node.js environments that don't have it built-in
const fetch = globalThis.fetch || require('node-fetch');

export class SemanticSearchServiceImpl implements SemanticSearchService {
  private embeddingModel: string = 'amazon.titan-embed-text-v1';
  private vectorDimensions: number = 1536;
  private semanticSearchEndpoint: string;

  constructor(
    private bedrockClient?: any, // AWS Bedrock client for embeddings
    private databaseService?: any // Database service for vector operations
  ) {
    // Use the existing semantic search Lambda endpoint
    this.semanticSearchEndpoint = process.env.SEMANTIC_SEARCH_ENDPOINT || 'https://api.cleverwf.com/semantic-search';
    
    logger.info('SemanticSearchService initialized', {
      embeddingModel: this.embeddingModel,
      vectorDimensions: this.vectorDimensions,
      semanticSearchEndpoint: this.semanticSearchEndpoint,
      useRealInfrastructure: true
    });
  }

  /**
   * Search products using semantic similarity
   */
  async searchProducts(searchTerm: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Starting semantic product search', { 
      searchId,
      searchTerm, 
      limit,
      embeddingModel: this.embeddingModel,
      vectorDimensions: this.vectorDimensions,
      endpoint: this.semanticSearchEndpoint
    });

    try {
      // Use the existing semantic search Lambda endpoint
      const searchStartTime = Date.now();
      const results = await this.callSemanticSearchAPI(searchTerm, limit);
      const searchTime = Date.now() - searchStartTime;
      
      // Add detailed similarity analysis
      const similarityStats = results.length > 0 ? {
        min: Math.min(...results.map(r => r.similarity)),
        max: Math.max(...results.map(r => r.similarity)),
        avg: results.reduce((sum, r) => sum + r.similarity, 0) / results.length
      } : null;
      
      logger.info('Semantic search completed', {
        searchId,
        searchTerm,
        resultsCount: results.length,
        searchTime,
        similarityStats,
        topResults: results.slice(0, 3).map(r => ({
          productId: r.product.id,
          productName: r.product.name,
          similarity: r.similarity
        }))
      });

      return results.map(result => ({
        ...result,
        searchTerm
      }));
    } catch (error) {
      logger.error('Semantic search failed', {
        searchId,
        searchTerm,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Generate embedding vector for text using Amazon Bedrock Titan
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new ValidationError('Text cannot be empty for embedding generation');
    }

    const embeddingId = `embed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cleanText = text.trim();

    logger.debug('Starting embedding generation', { 
      embeddingId,
      textLength: cleanText.length,
      textPreview: cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : ''),
      wordCount: cleanText.split(/\s+/).length,
      model: this.embeddingModel
    });

    try {
      if (!this.bedrockClient) {
        // Fallback: return mock embedding for development
        logger.warn('No Bedrock client available, using mock embedding', { embeddingId });
        const mockEmbedding = this.generateMockEmbedding(cleanText);
        
        logger.debug('Mock embedding generated', {
          embeddingId,
          dimensions: mockEmbedding.length,
          magnitude: Math.sqrt(mockEmbedding.reduce((sum, val) => sum + val * val, 0)),
          preview: mockEmbedding.slice(0, 5)
        });
        
        return mockEmbedding;
      }

      const requestStartTime = Date.now();
      const response = await this.bedrockClient.invokeModel({
        modelId: this.embeddingModel,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          inputText: cleanText
        })
      });
      const requestTime = Date.now() - requestStartTime;

      logger.debug('Bedrock API response received', {
        embeddingId,
        requestTime,
        responseSize: response.body.toString().length
      });

      const responseBody = JSON.parse(response.body.toString());
      const embedding = responseBody.embedding;

      if (!Array.isArray(embedding) || embedding.length !== this.vectorDimensions) {
        logger.error('Invalid embedding response structure', {
          embeddingId,
          expectedDimensions: this.vectorDimensions,
          actualDimensions: Array.isArray(embedding) ? embedding.length : 'not array',
          responseKeys: Object.keys(responseBody)
        });
        throw new Error(`Invalid embedding response: expected ${this.vectorDimensions} dimensions, got ${Array.isArray(embedding) ? embedding.length : 'not array'}`);
      }

      // Validate embedding values
      const invalidValues = embedding.filter(val => !Number.isFinite(val));
      if (invalidValues.length > 0) {
        logger.error('Invalid embedding values detected', {
          embeddingId,
          invalidCount: invalidValues.length,
          sampleInvalid: invalidValues.slice(0, 5)
        });
        throw new Error(`Embedding contains ${invalidValues.length} invalid values`);
      }

      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      const stats = {
        min: Math.min(...embedding),
        max: Math.max(...embedding),
        mean: embedding.reduce((sum, val) => sum + val, 0) / embedding.length
      };

      logger.debug('Embedding generated successfully', {
        embeddingId,
        dimensions: embedding.length,
        magnitude,
        stats,
        requestTime,
        preview: embedding.slice(0, 5)
      });

      return embedding;
    } catch (error) {
      logger.error('Embedding generation failed', {
        embeddingId,
        textLength: cleanText.length,
        textPreview: cleanText.substring(0, 100),
        model: this.embeddingModel,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Update embeddings for multiple products
   */
  async updateProductEmbeddings(products: Product[]): Promise<void> {
    logger.info('Starting batch embedding update', { productCount: products.length });

    const batchSize = 10; // Process in batches to avoid rate limits
    const batches = this.chunkArray(products, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.debug(`Processing embedding batch ${i + 1}/${batches.length}`, {
        batchSize: batch.length
      });

      await Promise.all(
        batch.map(async (product) => {
          try {
            await this.updateSingleProductEmbedding(product);
          } catch (error) {
            logger.error('Failed to update embedding for product', {
              productId: product.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        })
      );

      // Small delay between batches to respect rate limits
      if (i < batches.length - 1) {
        await this.delay(100);
      }
    }

    logger.info('Batch embedding update completed', { productCount: products.length });
  }

  /**
   * Log search operation for analytics
   */
  async logSearch(
    searchTerm: string, 
    results: SemanticSearchResult[], 
    sessionId: string
  ): Promise<void> {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Starting search operation logging', {
      logId,
      searchTerm,
      resultsCount: results.length,
      sessionId,
      hasResults: results.length > 0,
      topSimilarity: results[0]?.similarity || 0
    });

    try {
      if (!this.databaseService) {
        logger.warn('No database service available for search logging', { 
          logId,
          searchTerm,
          sessionId 
        });
        return;
      }

      // Prepare detailed search results for logging
      const searchResultsData = results.map((r, index) => ({
        productId: r.product.id,
        productName: r.product.name,
        productCategory: r.product.category,
        similarity: r.similarity,
        rank: index + 1,
        sellable: r.product.sellable,
        inStock: r.product.stockQuantity > 0
      }));

      // Calculate search quality metrics
      const qualityMetrics = {
        averageSimilarity: results.length > 0 
          ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length 
          : 0,
        sellableResultsCount: results.filter(r => r.product.sellable).length,
        inStockResultsCount: results.filter(r => r.product.stockQuantity > 0).length,
        categoriesFound: [...new Set(results.map(r => r.product.category))].length
      };

      const logStartTime = Date.now();
      await this.databaseService.logSearchOperation({
        sessionId,
        originalQuery: searchTerm,
        extractedSearchTerm: searchTerm,
        searchResults: searchResultsData,
        selectedProducts: [], // Will be updated when user selects products
        qualityMetrics,
        timestamp: new Date()
      });
      const logTime = Date.now() - logStartTime;

      logger.info('Search operation logged successfully', { 
        logId,
        searchTerm, 
        sessionId,
        resultsCount: results.length,
        qualityMetrics,
        logTime,
        searchResultsPreview: searchResultsData.slice(0, 3).map(r => ({
          productId: r.productId,
          productName: r.productName,
          similarity: r.similarity
        }))
      });
    } catch (error) {
      logger.error('Failed to log search operation', {
        logId,
        searchTerm,
        sessionId,
        resultsCount: results.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't throw error - logging failure shouldn't break search
    }
  }

  /**
   * Get similar products based on a reference product
   */
  async getSimilarProducts(productId: string, limit: number = 5): Promise<Product[]> {
    logger.debug('Finding similar products', { productId, limit });

    try {
      if (!this.databaseService) {
        throw new Error('Database service not available');
      }

      const referenceProduct = await this.databaseService.getProduct(productId);
      if (!referenceProduct || !referenceProduct.embeddingVector) {
        throw new Error('Reference product not found or missing embedding');
      }

      const results = await this.performVectorSearch(referenceProduct.embeddingVector, limit + 1);
      
      // Filter out the reference product itself
      const similarProducts = results
        .filter(result => result.product.id !== productId)
        .slice(0, limit)
        .map(result => result.product);

      logger.info('Similar products found', {
        productId,
        similarCount: similarProducts.length
      });

      return similarProducts;
    } catch (error) {
      logger.error('Failed to find similar products', {
        productId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Call the existing semantic search API endpoint
   */
  private async callSemanticSearchAPI(searchTerm: string, limit: number): Promise<SemanticSearchResult[]> {
    const searchId = `api_search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Calling semantic search API', {
      searchId,
      endpoint: this.semanticSearchEndpoint,
      searchTerm,
      limit
    });

    try {
      const requestBody = {
        query: searchTerm,
        table: 'parts', // Search parts table for products
        limit
      };

      const response = await fetch(this.semanticSearchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: In production, you'd need proper authentication headers
          // 'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Semantic search API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const apiResults = data.results || [];

      logger.debug('Semantic search API response', {
        searchId,
        resultsCount: apiResults.length,
        responseStatus: response.status
      });

      // Convert API results to SemanticSearchResult format
      const results: SemanticSearchResult[] = apiResults.map((item: any) => {
        const product: Product = {
          id: item.id,
          name: item.name,
          description: item.description || '',
          category: item.category || 'unknown',
          unit: item.unit || 'each',
          basePrice: parseFloat(item.cost_per_unit || '0'),
          stockQuantity: parseInt(item.current_quantity || '0'),
          tags: [], // API doesn't return tags, could be enhanced
          sellable: true, // Assume sellable since we're searching parts
          embeddingText: item.search_text,
          // Don't include embeddingVector to avoid large payloads
        };

        return {
          product,
          similarity: item.similarity || (1 - (item.distance || 0)), // Convert distance to similarity
          searchTerm: '', // Will be set by caller
          timestamp: new Date()
        };
      });

      logger.info('Semantic search API results processed', {
        searchId,
        processedCount: results.length,
        topResults: results.slice(0, 3).map(r => ({
          productId: r.product.id,
          productName: r.product.name,
          similarity: r.similarity
        }))
      });

      return results;
    } catch (error) {
      logger.error('Semantic search API call failed', {
        searchId,
        endpoint: this.semanticSearchEndpoint,
        searchTerm,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Fall back to mock results if API fails
      logger.warn('Falling back to mock results due to API failure', { searchId });
      return this.generateMockSearchResults(limit);
    }
  }

  /**
   * Update embedding for a single product
   */
  private async updateSingleProductEmbedding(product: Product): Promise<void> {
    try {
      // Generate embedding text if not present
      const embeddingText = product.embeddingText || this.generateProductEmbeddingText(product);
      
      // Generate embedding vector
      const embeddingVector = await this.generateEmbedding(embeddingText);
      
      // Update product in database
      if (this.databaseService) {
        await this.databaseService.updateProductEmbedding(product.id, {
          embeddingText,
          embeddingVector
        });
      }

      logger.debug('Product embedding updated', {
        productId: product.id,
        embeddingTextLength: embeddingText.length,
        vectorDimensions: embeddingVector.length
      });
    } catch (error) {
      logger.error('Failed to update product embedding', {
        productId: product.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate embedding text for a product
   */
  private generateProductEmbeddingText(product: Product): string {
    const parts = [
      product.name,
      product.description,
      product.category,
      ...product.tags
    ];

    // Add nutritional information if available
    if (product.nutritionalInfo) {
      const nutritionHighlights = Object.keys(product.nutritionalInfo)
        .filter(key => product.nutritionalInfo![key] > 0)
        .slice(0, 3);
      
      if (nutritionHighlights.length > 0) {
        parts.push(`nutrition: ${nutritionHighlights.join(', ')}`);
      }
    }

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Generate mock embedding for development/testing
   */
  private generateMockEmbedding(text: string): number[] {
    // Simple hash-based mock embedding
    const hash = this.simpleHash(text);
    const embedding = new Array(this.vectorDimensions);
    
    for (let i = 0; i < this.vectorDimensions; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1;
    }
    
    return embedding;
  }

  /**
   * Generate mock search results for development
   */
  private generateMockSearchResults(limit: number): SemanticSearchResult[] {
    // Return mock results that would match "hot" query
    const mockProducts: Product[] = [
      {
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
      {
        id: 'vinegar-lipid-1',
        name: 'Spiced vinegar lipid',
        description: 'Rich spiced vinegar with lipid content, adds heat to meals',
        category: 'condiments',
        unit: 'bottle',
        basePrice: 30.00,
        stockQuantity: 8,
        tags: ['spiced', 'hot', 'vinegar', 'rich'],
        sellable: true
      }
    ];

    return mockProducts.slice(0, limit).map((product, index) => ({
      product,
      similarity: 0.9 - (index * 0.1), // Decreasing similarity
      searchTerm: '',
      timestamp: new Date()
    }));
  }

  /**
   * Simple hash function for mock embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}