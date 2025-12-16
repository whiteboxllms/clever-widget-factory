/**
 * Tests for RDS Integration Layer
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { RDSIntegration } from '@/inventory/RDSIntegration';
import { db } from '@/database/connection';
import { DatabaseError, InventoryError } from '@/utils/errors';

// Mock the database connection
vi.mock('@/database/connection', () => ({
  db: {
    healthCheck: vi.fn(),
    tableExists: vi.fn(),
    columnExists: vi.fn(),
    query: vi.fn(),
  }
}));

describe('RDSIntegration', () => {
  let rdsIntegration: RDSIntegration;
  let mockHealthCheck: Mock;
  let mockTableExists: Mock;
  let mockColumnExists: Mock;
  let mockQuery: Mock;

  beforeEach(() => {
    rdsIntegration = new RDSIntegration({
      enableSafeMode: true,
      fallbackToCache: false,
      validateSchema: true
    });

    mockHealthCheck = db.healthCheck as Mock;
    mockTableExists = db.tableExists as Mock;
    mockColumnExists = db.columnExists as Mock;
    mockQuery = db.query as Mock;

    // Reset all mocks
    mockHealthCheck.mockClear();
    mockTableExists.mockClear();
    mockColumnExists.mockClear();
    mockQuery.mockClear();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid schema', async () => {
      // Mock successful health check
      mockHealthCheck.mockResolvedValue({ healthy: true });
      
      // Mock table exists
      mockTableExists.mockResolvedValue(true);
      
      // Mock required columns exist
      mockColumnExists.mockImplementation((table, column) => {
        const requiredColumns = ['id', 'name', 'description', 'category', 'unit', 'base_price', 'stock_quantity', 'sellable'];
        return Promise.resolve(requiredColumns.includes(column));
      });

      // Mock data integrity check
      mockQuery.mockResolvedValue([{ count: 100 }]);

      await expect(rdsIntegration.initialize()).resolves.not.toThrow();
    });

    it('should fail initialization with unhealthy database', async () => {
      mockHealthCheck.mockResolvedValue({ 
        healthy: false, 
        error: 'Connection timeout' 
      });

      await expect(rdsIntegration.initialize()).rejects.toThrow(DatabaseError);
    });

    it('should fail initialization with missing required table', async () => {
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(false); // products table missing

      await expect(rdsIntegration.initialize()).rejects.toThrow(DatabaseError);
    });

    it('should fail initialization with missing sellable column in safe mode', async () => {
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      
      // Mock all required columns exist except sellable
      mockColumnExists.mockImplementation((table, column) => {
        const existingColumns = ['id', 'name', 'description', 'category', 'unit', 'base_price', 'stock_quantity'];
        return Promise.resolve(existingColumns.includes(column));
      });

      await expect(rdsIntegration.initialize()).rejects.toThrow(DatabaseError);
    });

    it('should warn about invalid data during integrity check', async () => {
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      mockColumnExists.mockResolvedValue(true);
      
      // Mock data integrity check with invalid products
      mockQuery
        .mockResolvedValueOnce([{ count: 100 }]) // Total products
        .mockResolvedValueOnce([ // Invalid products
          { id: '1', name: null },
          { id: '2', name: '' }
        ]);

      await expect(rdsIntegration.initialize()).resolves.not.toThrow();
    });
  });

  describe('getProducts', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      mockColumnExists.mockResolvedValue(true);
      mockQuery.mockResolvedValue([{ count: 100 }]);
      
      await rdsIntegration.initialize();
      mockQuery.mockClear();
    });

    it('should retrieve products with filters', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Tomatoes',
          description: 'Fresh tomatoes',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 100,
          sellable: true
        }
      ];

      mockQuery.mockResolvedValue(mockProducts);

      const result = await rdsIntegration.getProducts({
        category: 'vegetables',
        sellableOnly: true,
        inStock: true,
        limit: 50
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tomatoes');
      expect(result[0].sellable).toBe(true);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('category = ?'),
        expect.arrayContaining(['vegetables', 50])
      );
    });

    it('should handle invalid product data gracefully', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Valid Product',
          description: 'Valid description',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 100,
          sellable: true
        },
        {
          id: '2',
          name: null, // Invalid - will be skipped
          description: 'Invalid product',
          category: 'vegetables',
          unit: 'kg',
          base_price: -5.99, // Invalid price
          stock_quantity: 100,
          sellable: true
        }
      ];

      mockQuery.mockResolvedValue(mockProducts);

      const result = await rdsIntegration.getProducts();

      // Should only return valid products
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Product');
    });

    it('should apply default limit for safety', async () => {
      mockQuery.mockResolvedValue([]);

      await rdsIntegration.getProducts();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        expect.arrayContaining([1000])
      );
    });
  });

  describe('updateProductSellability', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      mockColumnExists.mockResolvedValue(true);
      mockQuery.mockResolvedValue([{ count: 100 }]);
      
      await rdsIntegration.initialize();
      mockQuery.mockClear();
    });

    it('should update product sellability', async () => {
      // Mock existing product check
      mockQuery
        .mockResolvedValueOnce([{ 
          id: '1', 
          name: 'Test Product', 
          sellable: false 
        }]) // Product exists with different sellable value
        .mockResolvedValueOnce({ affectedRows: 1 }); // Update successful

      await expect(rdsIntegration.updateProductSellability('1', true)).resolves.not.toThrow();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products SET sellable = ?'),
        [true, '1']
      );
    });

    it('should skip update if sellability is already set', async () => {
      // Mock existing product with same sellable value
      mockQuery.mockResolvedValueOnce([{ 
        id: '1', 
        name: 'Test Product', 
        sellable: true 
      }]);

      await expect(rdsIntegration.updateProductSellability('1', true)).resolves.not.toThrow();

      // Should only call SELECT, not UPDATE
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-existent product', async () => {
      mockQuery.mockResolvedValueOnce([]); // Product not found

      await expect(rdsIntegration.updateProductSellability('nonexistent', true)).rejects.toThrow(InventoryError);
    });
  });

  describe('updateStockQuantity', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      mockColumnExists.mockResolvedValue(true);
      mockQuery.mockResolvedValue([{ count: 100 }]);
      
      await rdsIntegration.initialize();
      mockQuery.mockClear();
    });

    it('should update stock quantity', async () => {
      // Mock existing product
      mockQuery
        .mockResolvedValueOnce([{ 
          stock_quantity: 50, 
          name: 'Test Product' 
        }]) // Current stock
        .mockResolvedValueOnce({ affectedRows: 1 }); // Update successful

      await expect(rdsIntegration.updateStockQuantity('1', 75, 'restock')).resolves.not.toThrow();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products SET stock_quantity = ?'),
        [75, '1']
      );
    });

    it('should reject negative stock quantities', async () => {
      await expect(rdsIntegration.updateStockQuantity('1', -5)).rejects.toThrow(InventoryError);
    });

    it('should throw error for non-existent product', async () => {
      mockQuery.mockResolvedValueOnce([]); // Product not found

      await expect(rdsIntegration.updateStockQuantity('nonexistent', 10)).rejects.toThrow(InventoryError);
    });
  });

  describe('getProductById', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      mockColumnExists.mockResolvedValue(true);
      mockQuery.mockResolvedValue([{ count: 100 }]);
      
      await rdsIntegration.initialize();
      mockQuery.mockClear();
    });

    it('should return product by ID', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        description: 'Test description',
        category: 'vegetables',
        unit: 'kg',
        base_price: 5.99,
        stock_quantity: 100,
        sellable: true
      };

      mockQuery.mockResolvedValue([mockProduct]);

      const result = await rdsIntegration.getProductById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.name).toBe('Test Product');
    });

    it('should return null for non-existent product', async () => {
      mockQuery.mockResolvedValue([]);

      const result = await rdsIntegration.getProductById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('testCompatibility', () => {
    beforeEach(async () => {
      // Setup successful initialization
      mockHealthCheck.mockResolvedValue({ healthy: true });
      mockTableExists.mockResolvedValue(true);
      mockColumnExists.mockResolvedValue(true);
      mockQuery.mockResolvedValue([{ count: 100 }]);
      
      await rdsIntegration.initialize();
      mockQuery.mockClear();
    });

    it('should pass compatibility test with healthy system', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: 100 }]) // Product count
        .mockResolvedValueOnce([{ id: '1', name: 'Test', sellable: true }]) // Sellable test
        .mockResolvedValueOnce([]) // No long-running processes
        .mockResolvedValueOnce(undefined) // START TRANSACTION
        .mockResolvedValueOnce([{ result: 1 }]) // SELECT 1
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await rdsIntegration.testCompatibility();

      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect long-running queries', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: 100 }]) // Product count
        .mockResolvedValueOnce([{ id: '1', name: 'Test', sellable: true }]) // Sellable test
        .mockResolvedValueOnce([
          { Id: 1, Time: 600, Info: 'Long running query' } // 10 minutes
        ]) // Long-running process
        .mockResolvedValueOnce(undefined) // START TRANSACTION
        .mockResolvedValueOnce([{ result: 1 }]) // SELECT 1
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await rdsIntegration.testCompatibility();

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('1 long-running queries detected');
      expect(result.recommendations).toContain('Consider optimizing long-running queries before deployment');
    });
  });

  describe('configuration', () => {
    it('should return current status', () => {
      const status = rdsIntegration.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('schemaValidated');
      expect(status).toHaveProperty('safeMode');
      expect(status).toHaveProperty('lastHealthCheck');
    });

    it('should allow safe mode toggle', () => {
      const initialStatus = rdsIntegration.getStatus();
      expect(initialStatus.safeMode).toBe(true);

      rdsIntegration.setSafeMode(false);
      
      const updatedStatus = rdsIntegration.getStatus();
      expect(updatedStatus.safeMode).toBe(false);
    });
  });
});