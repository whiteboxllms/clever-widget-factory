/**
 * Enhanced Inventory Service with sellability controls
 * Integrates with existing farm RDS database while adding customer-facing controls
 */

import { db } from '@/database/connection';
import { ProductModel } from '@/models/Product';
import { 
  Product, 
  ProductFilter, 
  ProductDetails, 
  AvailabilityInfo, 
  CartItem,
  SemanticSearchResult 
} from '@/types/core';
import { SemanticSearchServiceImpl } from '@/search/SemanticSearchService';
import { 
  InventoryService as IInventoryService, 
  ReservationResult, 
  StockTransaction 
} from '@/types/services';
import { 
  DatabaseError, 
  ProductNotFoundError, 
  InsufficientStockError, 
  InventoryError 
} from '@/utils/errors';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class InventoryService implements IInventoryService {
  private readonly reservationTimeoutMs = 15 * 60 * 1000; // 15 minutes
  private semanticSearchService: SemanticSearchServiceImpl;

  constructor() {
    // Initialize semantic search service
    this.semanticSearchService = new SemanticSearchServiceImpl();
  }

  /**
   * Get all available products with optional filtering
   */
  async getAvailableProducts(filters?: ProductFilter): Promise<Product[]> {
    try {
      let sql = 'SELECT * FROM parts WHERE 1=1';
      const params: any[] = [];

      // Apply filters
      if (filters?.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters?.inStock) {
        sql += ' AND current_quantity > 0';
      }

      if (filters?.priceRange) {
        sql += ' AND base_price BETWEEN ? AND ?';
        params.push(filters.priceRange[0], filters.priceRange[1]);
      }

      // Don't filter by sellable here - this method returns ALL products
      sql += ' ORDER BY name ASC';

      logger.debug('Fetching available products', { 
        filters, 
        paramCount: params.length 
      });

      const rows = await db.query<any[]>(sql, params);
      
      const products = rows.map(row => this.mapRowToProduct(row));
      
      logger.info('Retrieved available products', { 
        count: products.length,
        filters 
      });

      return products;
    } catch (error) {
      logger.error('Failed to get available products', { filters, error });
      throw new InventoryError(`Failed to retrieve products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get only sellable products (customer-facing)
   */
  async getSellableProducts(filters?: ProductFilter): Promise<Product[]> {
    try {
      let sql = 'SELECT * FROM parts WHERE sellable = true';
      const params: any[] = [];

      // Apply additional filters
      if (filters?.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters?.inStock !== false) { // Default to in-stock only for customers
        sql += ' AND current_quantity > 0';
      }

      if (filters?.priceRange) {
        sql += ' AND base_price BETWEEN ? AND ?';
        params.push(filters.priceRange[0], filters.priceRange[1]);
      }

      // Filter out expired products for customers
      sql += ' AND (expiry_date IS NULL OR expiry_date > NOW())';
      sql += ' ORDER BY name ASC';

      logger.debug('Fetching sellable products', { 
        filters, 
        paramCount: params.length 
      });

      const rows = await db.query<any[]>(sql, params);
      
      const products = rows.map(row => this.mapRowToProduct(row));
      
      // Additional validation using ProductModel
      const validProducts = products.filter(product => {
        try {
          const productModel = new ProductModel(product);
          return productModel.isSellable();
        } catch (error) {
          logger.warn('Invalid product data found', { productId: product.id, error });
          return false;
        }
      });

      logger.info('Retrieved sellable products', { 
        totalCount: products.length,
        sellableCount: validProducts.length,
        filters 
      });

      return validProducts;
    } catch (error) {
      logger.error('Failed to get sellable products', { filters, error });
      throw new InventoryError(`Failed to retrieve sellable products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search products using semantic similarity
   */
  async searchProductsSemantically(searchTerm: string, filters?: ProductFilter): Promise<SemanticSearchResult[]> {
    try {
      logger.debug('Starting semantic product search in InventoryService', { 
        searchTerm, 
        filters,
        originalQuery: searchTerm 
      });

      // Step 1: Extract the actual product search term from the user query
      // For now, use simple keyword extraction - this should be enhanced with NLP service
      const extractedTerm = this.extractProductSearchTerm(searchTerm);
      
      logger.info('Extracted product search term', {
        originalQuery: searchTerm,
        extractedTerm,
        extractionMethod: 'simple_keyword'
      });

      // Step 2: Use SemanticSearchService for actual vector search
      let results: SemanticSearchResult[];
      
      try {
        results = await this.semanticSearchService.searchProducts(extractedTerm, 20);
        
        logger.debug('Semantic search service returned results', {
          extractedTerm,
          resultsCount: results.length,
          topSimilarity: results[0]?.similarity || 0
        });
      } catch (semanticError) {
        logger.warn('Semantic search service failed, falling back to text search', {
          extractedTerm,
          error: semanticError instanceof Error ? semanticError.message : 'Unknown error'
        });
        
        // Fallback to traditional text search
        results = await this.performTextSearch(extractedTerm);
      }

      // Step 3: Apply inventory-specific filters
      const filteredResults = await this.applyInventoryFilters(results, filters);

      logger.info('Semantic search completed with filtering', { 
        originalQuery: searchTerm,
        extractedTerm,
        rawResultsCount: results.length,
        filteredResultsCount: filteredResults.length,
        topSimilarity: filteredResults[0]?.similarity || 0,
        filters,
        topResults: filteredResults.slice(0, 3).map(r => ({
          productId: r.product.id,
          productName: r.product.name,
          similarity: r.similarity,
          hasSpiceInName: r.product.name.toLowerCase().includes('spice'),
          hasSpiceInDescription: r.product.description.toLowerCase().includes('spice'),
          hasSpiceInTags: r.product.tags.some(tag => tag.toLowerCase().includes('spice'))
        }))
      });

      return filteredResults;
    } catch (error) {
      logger.error('Failed to perform semantic search', { 
        searchTerm, 
        filters, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new InventoryError(`Failed to perform semantic search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract product search term from user query
   * This is a simple implementation - should be enhanced with NLP service
   */
  private extractProductSearchTerm(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    // Remove common query prefixes
    const cleanedQuery = query
      .replace(/^(show|find|get|search|look for|what do you have|do you have)/i, '')
      .replace(/\b(products?|items?|things?|stuff)\b/gi, '')
      .replace(/\b(with|that are|that is)\b/gi, '')
      .trim();

    // Extract key product characteristics
    const productKeywords = [
      'spice', 'spicy', 'hot', 'sweet', 'sour', 'bitter', 'salty',
      'fresh', 'organic', 'natural', 'dried', 'canned', 'bottled',
      'vinegar', 'sauce', 'oil', 'pepper', 'salt', 'sugar',
      'vegetable', 'fruit', 'meat', 'dairy', 'grain', 'herb'
    ];

    // Find matching keywords
    const foundKeywords = productKeywords.filter(keyword => 
      cleanedQuery.includes(keyword)
    );

    const extractedTerm = foundKeywords.length > 0 
      ? foundKeywords.join(' ') 
      : cleanedQuery || userQuery;

    logger.debug('Product search term extraction', {
      originalQuery: userQuery,
      cleanedQuery,
      foundKeywords,
      extractedTerm
    });

    return extractedTerm;
  }

  /**
   * Perform traditional text search as fallback
   */
  private async performTextSearch(searchTerm: string): Promise<SemanticSearchResult[]> {
    logger.debug('Performing fallback text search', { searchTerm });

    try {
      // Try full-text search first
      let sql = `
        SELECT *, 
               MATCH(name, description, tags) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance_score
        FROM parts 
        WHERE MATCH(name, description, tags) AGAINST(? IN NATURAL LANGUAGE MODE)
        AND sellable = true 
        AND current_quantity > 0
        AND (expiry_date IS NULL OR expiry_date > NOW())
        ORDER BY relevance_score DESC LIMIT 20
      `;
      
      let rows = await db.query<any[]>(sql, [searchTerm, searchTerm]);
      
      // If no full-text results, fall back to LIKE search
      if (rows.length === 0) {
        logger.debug('No full-text results, using LIKE search', { searchTerm });
        
        sql = `
          SELECT *, 1.0 as relevance_score
          FROM parts 
          WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)
          AND sellable = true 
          AND current_quantity > 0
          AND (expiry_date IS NULL OR expiry_date > NOW())
          ORDER BY name ASC LIMIT 20
        `;
        
        const likePattern = `%${searchTerm}%`;
        rows = await db.query<any[]>(sql, [likePattern, likePattern, likePattern]);
      }

      const results: SemanticSearchResult[] = rows.map((row, index) => ({
        product: this.mapRowToProduct(row),
        similarity: Math.min(row.relevance_score / 10, 1.0) || (0.8 - index * 0.05),
        searchTerm,
        timestamp: new Date()
      }));

      logger.debug('Text search completed', {
        searchTerm,
        resultsCount: results.length,
        searchMethod: rows.length > 0 ? 'fulltext' : 'like'
      });

      return results;
    } catch (error) {
      logger.error('Text search failed', { searchTerm, error });
      return [];
    }
  }

  /**
   * Apply inventory-specific filters to search results
   */
  private async applyInventoryFilters(
    results: SemanticSearchResult[], 
    filters?: ProductFilter
  ): Promise<SemanticSearchResult[]> {
    let filteredResults = results;

    // Apply sellable filter (default to true)
    if (filters?.sellableOnly !== false) {
      filteredResults = filteredResults.filter(result => result.product.sellable);
    }

    // Apply stock filter (default to in-stock only)
    if (filters?.inStock !== false) {
      filteredResults = filteredResults.filter(result => result.product.stockQuantity > 0);
    }

    // Apply category filter
    if (filters?.category) {
      filteredResults = filteredResults.filter(result => 
        result.product.category.toLowerCase() === filters.category!.toLowerCase()
      );
    }

    // Apply price range filter
    if (filters?.priceRange) {
      const [minPrice, maxPrice] = filters.priceRange;
      filteredResults = filteredResults.filter(result => 
        result.product.basePrice >= minPrice && result.product.basePrice <= maxPrice
      );
    }

    // Filter out expired products
    filteredResults = filteredResults.filter(result => {
      if (!result.product.expiryDate) return true;
      return result.product.expiryDate > new Date();
    });

    logger.debug('Applied inventory filters', {
      originalCount: results.length,
      filteredCount: filteredResults.length,
      filters
    });

    return filteredResults;
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(productId: string): Promise<ProductDetails> {
    try {
      const sql = `
        SELECT p.*, 
               CASE 
                 WHEN p.harvest_date IS NOT NULL 
                 THEN DATEDIFF(NOW(), p.harvest_date) 
                 ELSE NULL 
               END as days_since_harvest
        FROM parts p 
        WHERE p.id = ?
      `;

      logger.debug('Fetching product details', { productId });

      const rows = await db.query<any[]>(sql, [productId]);
      
      if (rows.length === 0) {
        throw new ProductNotFoundError(productId);
      }

      const row = rows[0];
      const product = this.mapRowToProduct(row);
      
      // Enhance with additional details
      const productDetails: ProductDetails = {
        ...product,
        origin: this.determineOrigin(row),
        freshness: this.calculateFreshness(row.days_since_harvest),
        certifications: this.parseCertifications(row.certifications),
        storageInstructions: row.storage_instructions || undefined
      };

      logger.info('Retrieved product details', { productId });

      return productDetails;
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        throw error;
      }
      
      logger.error('Failed to get product details', { productId, error });
      throw new InventoryError(`Failed to retrieve product details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check product availability for specific quantity
   */
  async checkAvailability(productId: string, quantity: number): Promise<AvailabilityInfo> {
    try {
      const sql = `
        SELECT current_quantity, 
               COALESCE(SUM(r.quantity), 0) as reserved_quantity
        FROM parts p
        LEFT JOIN reservations r ON p.id = r.part_id 
          AND r.expires_at > NOW() 
          AND r.status = 'active'
        WHERE p.id = ?
        GROUP BY p.id, p.current_quantity
      `;

      logger.debug('Checking product availability', { productId, quantity });

      const rows = await db.query<any[]>(sql, [productId]);
      
      if (rows.length === 0) {
        throw new ProductNotFoundError(productId);
      }

      const row = rows[0];
      const availableQuantity = row.current_quantity - row.reserved_quantity;
      const available = availableQuantity >= quantity;

      let alternatives: Product[] = [];
      if (!available) {
        // Find similar products as alternatives
        alternatives = await this.findAlternatives(productId);
      }

      const availabilityInfo: AvailabilityInfo = {
        available,
        quantity: availableQuantity,
        reservedQuantity: row.reserved_quantity,
        alternatives
      };

      // Add estimated restock date if out of stock
      if (!available) {
        availabilityInfo.estimatedRestockDate = await this.getEstimatedRestockDate(productId);
      }

      logger.info('Checked product availability', { 
        productId, 
        requestedQuantity: quantity,
        available,
        availableQuantity 
      });

      return availabilityInfo;
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        throw error;
      }
      
      logger.error('Failed to check availability', { productId, quantity, error });
      throw new InventoryError(`Failed to check availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reserve items for purchase
   */
  async reserveItems(items: CartItem[]): Promise<ReservationResult> {
    const reservationId = uuidv4();
    const expiresAt = new Date(Date.now() + this.reservationTimeoutMs);
    const failedItems: CartItem[] = [];

    try {
      // Start transaction for atomic reservation
      await db.query('START TRANSACTION');

      for (const item of items) {
        const availability = await this.checkAvailability(item.productId, item.quantity);
        
        if (!availability.available) {
          failedItems.push(item);
          continue;
        }

        // Create reservation record
        await db.query(
          'INSERT INTO reservations (id, product_id, quantity, expires_at, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [uuidv4(), item.productId, item.quantity, expiresAt, 'active']
        );

        logger.debug('Item reserved', { 
          productId: item.productId, 
          quantity: item.quantity,
          reservationId 
        });
      }

      if (failedItems.length > 0) {
        await db.query('ROLLBACK');
        
        logger.warn('Some items could not be reserved', { 
          reservationId,
          failedCount: failedItems.length,
          totalCount: items.length 
        });

        return {
          success: false,
          failedItems,
          message: `${failedItems.length} items could not be reserved due to insufficient stock`
        };
      }

      await db.query('COMMIT');

      logger.info('Items reserved successfully', { 
        reservationId,
        itemCount: items.length,
        expiresAt 
      });

      return {
        success: true,
        reservationId,
        expiresAt
      };

    } catch (error) {
      await db.query('ROLLBACK');
      
      logger.error('Failed to reserve items', { items, error });
      throw new InventoryError(`Failed to reserve items: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update stock levels
   */
  async updateStock(transactions: StockTransaction[]): Promise<void> {
    try {
      await db.query('START TRANSACTION');

      for (const transaction of transactions) {
        // Update stock quantity
        const sql = `
          UPDATE products 
          SET stock_quantity = stock_quantity + ?, 
              updated_at = NOW() 
          WHERE id = ?
        `;

        await db.query(sql, [transaction.quantityChange, transaction.productId]);

        // Log the transaction
        await db.query(
          'INSERT INTO stock_transactions (id, product_id, quantity_change, transaction_type, reference, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [uuidv4(), transaction.productId, transaction.quantityChange, transaction.type, transaction.reference]
        );

        logger.debug('Stock updated', { 
          productId: transaction.productId,
          quantityChange: transaction.quantityChange,
          type: transaction.type 
        });
      }

      await db.query('COMMIT');

      logger.info('Stock transactions completed', { 
        transactionCount: transactions.length 
      });

    } catch (error) {
      await db.query('ROLLBACK');
      
      logger.error('Failed to update stock', { transactions, error });
      throw new InventoryError(`Failed to update stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Toggle product sellability
   */
  async toggleSellability(productId: string, sellable: boolean): Promise<void> {
    try {
      const sql = 'UPDATE parts SET sellable = ?, updated_at = NOW() WHERE id = ?';
      
      const result = await db.query<any>(sql, [sellable, productId]);
      
      if (result.affectedRows === 0) {
        throw new ProductNotFoundError(productId);
      }

      logger.info('Product sellability updated', { 
        productId, 
        sellable 
      });

    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        throw error;
      }
      
      logger.error('Failed to toggle sellability', { productId, sellable, error });
      throw new InventoryError(`Failed to update sellability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get products with low stock
   */
  async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    try {
      const sql = 'SELECT * FROM parts WHERE current_quantity <= ? AND current_quantity > 0 ORDER BY current_quantity ASC';
      
      const rows = await db.query<any[]>(sql, [threshold]);
      const products = rows.map(row => this.mapRowToProduct(row));

      logger.info('Retrieved low stock products', { 
        count: products.length,
        threshold 
      });

      return products;
    } catch (error) {
      logger.error('Failed to get low stock products', { threshold, error });
      throw new InventoryError(`Failed to retrieve low stock products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(category: string, sellableOnly: boolean = false): Promise<Product[]> {
    try {
      let sql = 'SELECT * FROM parts WHERE category = ?';
      const params = [category];

      if (sellableOnly) {
        sql += ' AND sellable = true AND stock_quantity > 0';
      }

      sql += ' ORDER BY name ASC';

      const rows = await db.query<any[]>(sql, params);
      const products = rows.map(row => this.mapRowToProduct(row));

      logger.info('Retrieved products by category', { 
        category,
        count: products.length,
        sellableOnly 
      });

      return products;
    } catch (error) {
      logger.error('Failed to get products by category', { category, sellableOnly, error });
      throw new InventoryError(`Failed to retrieve products by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search products by name or description
   */
  async searchProducts(query: string, sellableOnly: boolean = false): Promise<Product[]> {
    try {
      let sql = `
        SELECT * FROM parts 
        WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)
      `;
      const searchTerm = `%${query}%`;
      const params = [searchTerm, searchTerm, searchTerm];

      if (sellableOnly) {
        sql += ' AND sellable = true AND current_quantity > 0';
      }

      sql += ' ORDER BY name ASC LIMIT 50';

      const rows = await db.query<any[]>(sql, params);
      const products = rows.map(row => this.mapRowToProduct(row));

      logger.info('Product search completed', { 
        query,
        count: products.length,
        sellableOnly 
      });

      return products;
    } catch (error) {
      logger.error('Failed to search products', { query, sellableOnly, error });
      throw new InventoryError(`Failed to search products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map database row to Product object
   */
  private mapRowToProduct(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      category: row.category,
      unit: row.unit,
      basePrice: parseFloat(row.base_price),
      stockQuantity: parseInt(row.stock_quantity),
      harvestDate: row.harvest_date ? new Date(row.harvest_date) : undefined,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      nutritionalInfo: row.nutritional_info ? JSON.parse(row.nutritional_info) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      sellable: Boolean(row.sellable),
      embeddingText: row.embedding_text || undefined,
      embeddingVector: row.embedding_vector ? JSON.parse(row.embedding_vector) : undefined
    };
  }

  /**
   * Determine product origin
   */
  private determineOrigin(row: any): string {
    // This could be enhanced based on your farm's data structure
    return row.origin || 'Local Farm';
  }

  /**
   * Calculate freshness based on days since harvest
   */
  private calculateFreshness(daysSinceHarvest: number | null): 'excellent' | 'good' | 'fair' | undefined {
    if (daysSinceHarvest === null) return undefined;
    
    if (daysSinceHarvest <= 1) return 'excellent';
    if (daysSinceHarvest <= 3) return 'good';
    if (daysSinceHarvest <= 7) return 'fair';
    return undefined; // Too old to be considered fresh
  }

  /**
   * Parse certifications from database
   */
  private parseCertifications(certifications: string | null): string[] {
    if (!certifications) return [];
    
    try {
      return JSON.parse(certifications);
    } catch {
      return certifications.split(',').map(cert => cert.trim());
    }
  }

  /**
   * Find alternative products
   */
  private async findAlternatives(productId: string): Promise<Product[]> {
    try {
      // Get the original product's category
      const originalProduct = await db.query<any[]>(
        'SELECT category FROM products WHERE id = ?',
        [productId]
      );

      if (originalProduct.length === 0) return [];

      const category = originalProduct[0].category;

      // Find similar products in the same category that are sellable and in stock
      const alternatives = await db.query<any[]>(
        'SELECT * FROM products WHERE category = ? AND id != ? AND sellable = true AND stock_quantity > 0 ORDER BY name ASC LIMIT 3',
        [category, productId]
      );

      return alternatives.map(row => this.mapRowToProduct(row));
    } catch (error) {
      logger.warn('Failed to find alternatives', { productId, error });
      return [];
    }
  }

  /**
   * Get estimated restock date
   */
  private async getEstimatedRestockDate(productId: string): Promise<Date | undefined> {
    try {
      // This is a placeholder - you could implement based on your restocking patterns
      // For now, estimate 7 days from now
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + 7);
      return estimatedDate;
    } catch (error) {
      logger.warn('Failed to get estimated restock date', { productId, error });
      return undefined;
    }
  }

  /**
   * Clean up expired reservations
   */
  async cleanupExpiredReservations(): Promise<number> {
    try {
      const result = await db.query<any>(
        'DELETE FROM reservations WHERE expires_at < NOW() AND status = "active"'
      );

      const cleanedCount = result.affectedRows || 0;

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired reservations', { count: cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired reservations', error);
      return 0;
    }
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();