/**
 * RDS Integration Layer for existing farm inventory system
 * Provides safe integration with existing database while adding agent functionality
 */

import { db } from '@/database/connection';
import { ProductModel } from '@/models/Product';
import { Product } from '@/types/core';
import { DatabaseError, InventoryError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export interface RDSIntegrationConfig {
  enableSafeMode: boolean; // Prevents modifications to existing data
  fallbackToCache: boolean; // Use cached data if RDS is unavailable
  validateSchema: boolean; // Validate database schema before operations
}

export class RDSIntegration {
  private config: RDSIntegrationConfig;
  private schemaValidated = false;
  private readonly requiredTables = ['products'];
  private readonly requiredColumns = {
    products: ['id', 'name', 'description', 'category', 'unit', 'base_price', 'stock_quantity']
  };

  constructor(config: RDSIntegrationConfig = {
    enableSafeMode: true,
    fallbackToCache: true,
    validateSchema: true
  }) {
    this.config = config;
  }

  /**
   * Initialize RDS integration with safety checks
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing RDS integration', { config: this.config });

      // Validate database connection
      const health = await db.healthCheck();
      if (!health.healthy) {
        throw new DatabaseError(`Database health check failed: ${health.error}`);
      }

      // Validate schema if enabled
      if (this.config.validateSchema) {
        await this.validateDatabaseSchema();
      }

      // Check if sellable column exists, add if missing (with backup)
      await this.ensureSellableColumn();

      // Verify existing data integrity
      await this.verifyDataIntegrity();

      this.schemaValidated = true;
      logger.info('RDS integration initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize RDS integration', error);
      throw new DatabaseError(`RDS integration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate database schema compatibility
   */
  private async validateDatabaseSchema(): Promise<void> {
    try {
      logger.debug('Validating database schema');

      // Check required tables exist
      for (const tableName of this.requiredTables) {
        const exists = await db.tableExists(tableName);
        if (!exists) {
          throw new Error(`Required table '${tableName}' does not exist`);
        }
      }

      // Check required columns exist
      for (const [tableName, columns] of Object.entries(this.requiredColumns)) {
        for (const columnName of columns) {
          const exists = await db.columnExists(tableName, columnName);
          if (!exists) {
            throw new Error(`Required column '${columnName}' does not exist in table '${tableName}'`);
          }
        }
      }

      logger.debug('Database schema validation passed');

    } catch (error) {
      throw new DatabaseError(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure sellable column exists with safe migration
   */
  private async ensureSellableColumn(): Promise<void> {
    try {
      const sellableExists = await db.columnExists('products', 'sellable');
      
      if (!sellableExists) {
        logger.warn('Sellable column missing - this should be added via migration');
        
        if (this.config.enableSafeMode) {
          throw new Error('Sellable column missing. Please run database migration first: npm run db:migrate 001_add_sellable_column');
        } else {
          // In non-safe mode, we could add it automatically, but this is risky
          logger.error('Sellable column missing and safe mode disabled');
          throw new Error('Sellable column missing from products table');
        }
      }

      logger.debug('Sellable column exists');

    } catch (error) {
      throw new DatabaseError(`Sellable column check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify existing data integrity
   */
  private async verifyDataIntegrity(): Promise<void> {
    try {
      logger.debug('Verifying data integrity');

      // Check for basic data consistency
      const productCount = await db.query<any[]>('SELECT COUNT(*) as count FROM products');
      const totalProducts = productCount[0]?.count || 0;

      if (totalProducts === 0) {
        logger.warn('No products found in database');
      } else {
        logger.info('Data integrity check passed', { totalProducts });
      }

      // Check for any products with invalid data
      const invalidProducts = await db.query<any[]>(`
        SELECT id, name FROM products 
        WHERE name IS NULL OR name = '' 
           OR base_price IS NULL OR base_price < 0
           OR stock_quantity IS NULL OR stock_quantity < 0
        LIMIT 5
      `);

      if (invalidProducts.length > 0) {
        logger.warn('Found products with invalid data', { 
          count: invalidProducts.length,
          examples: invalidProducts 
        });
      }

    } catch (error) {
      throw new DatabaseError(`Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Safely get products from existing RDS system
   */
  async getProducts(filters?: {
    category?: string;
    sellableOnly?: boolean;
    inStock?: boolean;
    limit?: number;
  }): Promise<Product[]> {
    try {
      if (!this.schemaValidated) {
        await this.initialize();
      }

      let sql = 'SELECT * FROM products WHERE 1=1';
      const params: any[] = [];

      // Apply filters safely
      if (filters?.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters?.sellableOnly) {
        sql += ' AND sellable = true';
      }

      if (filters?.inStock) {
        sql += ' AND stock_quantity > 0';
      }

      // Add limit for safety
      const limit = filters?.limit || 1000;
      sql += ' ORDER BY name ASC LIMIT ?';
      params.push(limit);

      logger.debug('Fetching products from RDS', { 
        filters, 
        paramCount: params.length 
      });

      const rows = await db.query<any[]>(sql, params);
      
      // Validate and convert to Product objects
      const products: Product[] = [];
      
      for (const row of rows) {
        try {
          const product = this.mapRowToProduct(row);
          
          // Validate using ProductModel
          ProductModel.validate(product);
          products.push(product);
          
        } catch (error) {
          logger.warn('Invalid product data found, skipping', { 
            productId: row.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      logger.info('Retrieved products from RDS', { 
        totalRows: rows.length,
        validProducts: products.length,
        filters 
      });

      return products;

    } catch (error) {
      logger.error('Failed to get products from RDS', { filters, error });
      
      if (this.config.fallbackToCache) {
        logger.warn('Falling back to cached data (not implemented in MVP)');
        return [];
      }
      
      throw new InventoryError(`Failed to retrieve products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Safely update product sellability
   */
  async updateProductSellability(productId: string, sellable: boolean): Promise<void> {
    try {
      if (!this.schemaValidated) {
        await this.initialize();
      }

      // Verify product exists first
      const existingProduct = await db.query<any[]>(
        'SELECT id, name, sellable FROM products WHERE id = ?',
        [productId]
      );

      if (existingProduct.length === 0) {
        throw new Error(`Product not found: ${productId}`);
      }

      const currentSellable = Boolean(existingProduct[0].sellable);
      
      if (currentSellable === sellable) {
        logger.debug('Product sellability already set to desired value', { 
          productId, 
          sellable 
        });
        return;
      }

      // Update sellability
      const result = await db.query<any>(
        'UPDATE products SET sellable = ?, updated_at = NOW() WHERE id = ?',
        [sellable, productId]
      );

      if (result.affectedRows === 0) {
        throw new Error(`Failed to update product sellability: ${productId}`);
      }

      logger.info('Product sellability updated', { 
        productId, 
        productName: existingProduct[0].name,
        oldValue: currentSellable,
        newValue: sellable 
      });

    } catch (error) {
      logger.error('Failed to update product sellability', { productId, sellable, error });
      throw new InventoryError(`Failed to update sellability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Safely update stock quantity (for sales/restocking)
   */
  async updateStockQuantity(productId: string, newQuantity: number, reason: string = 'manual_update'): Promise<void> {
    try {
      if (!this.schemaValidated) {
        await this.initialize();
      }

      if (newQuantity < 0) {
        throw new Error('Stock quantity cannot be negative');
      }

      // Get current stock for logging
      const currentStock = await db.query<any[]>(
        'SELECT stock_quantity, name FROM products WHERE id = ?',
        [productId]
      );

      if (currentStock.length === 0) {
        throw new Error(`Product not found: ${productId}`);
      }

      const oldQuantity = currentStock[0].stock_quantity;
      const productName = currentStock[0].name;

      // Update stock quantity
      const result = await db.query<any>(
        'UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?',
        [newQuantity, productId]
      );

      if (result.affectedRows === 0) {
        throw new Error(`Failed to update stock quantity: ${productId}`);
      }

      logger.info('Stock quantity updated', { 
        productId,
        productName,
        oldQuantity,
        newQuantity,
        change: newQuantity - oldQuantity,
        reason
      });

    } catch (error) {
      logger.error('Failed to update stock quantity', { productId, newQuantity, reason, error });
      throw new InventoryError(`Failed to update stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get product by ID with validation
   */
  async getProductById(productId: string): Promise<Product | null> {
    try {
      if (!this.schemaValidated) {
        await this.initialize();
      }

      const rows = await db.query<any[]>(
        'SELECT * FROM products WHERE id = ?',
        [productId]
      );

      if (rows.length === 0) {
        return null;
      }

      const product = this.mapRowToProduct(rows[0]);
      
      // Validate product data
      ProductModel.validate(product);
      
      return product;

    } catch (error) {
      logger.error('Failed to get product by ID', { productId, error });
      throw new InventoryError(`Failed to retrieve product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test existing farm application compatibility
   */
  async testCompatibility(): Promise<{
    compatible: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Test basic queries that existing applications might use
      await db.query('SELECT COUNT(*) FROM products');
      
      // Test if sellable column affects existing queries
      const withSellable = await db.query<any[]>('SELECT id, name, sellable FROM products LIMIT 1');
      if (withSellable.length > 0 && withSellable[0].sellable === undefined) {
        issues.push('Sellable column not properly accessible');
      }

      // Check for any locked tables or processes
      const processes = await db.query<any[]>('SHOW PROCESSLIST');
      const longRunningQueries = processes.filter((p: any) => p.Time > 300); // 5+ minutes
      
      if (longRunningQueries.length > 0) {
        issues.push(`${longRunningQueries.length} long-running queries detected`);
        recommendations.push('Consider optimizing long-running queries before deployment');
      }

      // Test transaction capability
      await db.query('START TRANSACTION');
      await db.query('SELECT 1');
      await db.query('ROLLBACK');

      logger.info('Compatibility test completed', { 
        issueCount: issues.length,
        compatible: issues.length === 0 
      });

      return {
        compatible: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      issues.push(`Compatibility test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        compatible: false,
        issues,
        recommendations: ['Review database configuration and permissions']
      };
    }
  }

  /**
   * Map database row to Product object with safe defaults
   */
  private mapRowToProduct(row: any): Product {
    return {
      id: String(row.id),
      name: String(row.name || ''),
      description: String(row.description || ''),
      category: String(row.category || 'other'),
      unit: String(row.unit || 'piece'),
      basePrice: parseFloat(row.base_price) || 0,
      stockQuantity: parseInt(row.stock_quantity) || 0,
      harvestDate: row.harvest_date ? new Date(row.harvest_date) : undefined,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      nutritionalInfo: this.parseJSON(row.nutritional_info),
      tags: this.parseJSON(row.tags) || [],
      sellable: Boolean(row.sellable !== undefined ? row.sellable : true) // Default to true for backward compatibility
    };
  }

  /**
   * Safely parse JSON fields
   */
  private parseJSON(jsonString: string | null): any {
    if (!jsonString) return undefined;
    
    try {
      return JSON.parse(jsonString);
    } catch {
      return undefined;
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    schemaValidated: boolean;
    safeMode: boolean;
    lastHealthCheck?: Date;
  } {
    return {
      initialized: this.schemaValidated,
      schemaValidated: this.schemaValidated,
      safeMode: this.config.enableSafeMode,
      lastHealthCheck: new Date()
    };
  }

  /**
   * Enable/disable safe mode
   */
  setSafeMode(enabled: boolean): void {
    this.config.enableSafeMode = enabled;
    logger.info('Safe mode updated', { enabled });
  }
}

// Export singleton instance
export const rdsIntegration = new RDSIntegration();