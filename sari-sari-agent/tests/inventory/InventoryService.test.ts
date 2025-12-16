/**
 * Unit tests for InventoryService
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { InventoryService } from '@/inventory/InventoryService';
import { db } from '@/database/connection';
import { ProductNotFoundError, InsufficientStockError, InventoryError } from '@/utils/errors';
import { createMockProduct } from '../utils/test-helpers';

// Mock the database connection
vi.mock('@/database/connection', () => ({
  db: {
    query: vi.fn(),
  }
}));

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockDbQuery: Mock;

  beforeEach(() => {
    inventoryService = new InventoryService();
    mockDbQuery = db.query as Mock;
    mockDbQuery.mockClear();
  });

  describe('getAvailableProducts', () => {
    it('should return all products without filters', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Tomatoes',
          description: 'Fresh tomatoes',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 100,
          sellable: true,
          tags: '["fresh", "organic"]'
        },
        {
          id: '2',
          name: 'Carrots',
          description: 'Orange carrots',
          category: 'vegetables',
          unit: 'kg',
          base_price: 3.99,
          stock_quantity: 50,
          sellable: false,
          tags: '["fresh"]'
        }
      ];

      mockDbQuery.mockResolvedValue(mockProducts);

      const result = await inventoryService.getAvailableProducts();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Tomatoes');
      expect(result[0].sellable).toBe(true);
      expect(result[1].name).toBe('Carrots');
      expect(result[1].sellable).toBe(false);
    });

    it('should apply category filter', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Tomatoes',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 100,
          sellable: true,
          tags: '[]'
        }
      ];

      mockDbQuery.mockResolvedValue(mockProducts);

      await inventoryService.getAvailableProducts({ category: 'vegetables' });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('category = ?'),
        ['vegetables']
      );
    });

    it('should apply price range filter', async () => {
      mockDbQuery.mockResolvedValue([]);

      await inventoryService.getAvailableProducts({ priceRange: [5, 10] });

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('base_price BETWEEN ? AND ?'),
        [5, 10]
      );
    });

    it('should handle database errors', async () => {
      mockDbQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(inventoryService.getAvailableProducts()).rejects.toThrow(InventoryError);
    });
  });

  describe('getSellableProducts', () => {
    it('should return only sellable products', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Tomatoes',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 100,
          sellable: true,
          tags: '[]'
        }
      ];

      mockDbQuery.mockResolvedValue(mockProducts);

      const result = await inventoryService.getSellableProducts();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('sellable = true'),
        []
      );
      expect(result).toHaveLength(1);
      expect(result[0].sellable).toBe(true);
    });

    it('should filter out expired products', async () => {
      mockDbQuery.mockResolvedValue([]);

      await inventoryService.getSellableProducts();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('expiry_date IS NULL OR expiry_date > NOW()'),
        []
      );
    });

    it('should apply in-stock filter by default', async () => {
      mockDbQuery.mockResolvedValue([]);

      await inventoryService.getSellableProducts();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('stock_quantity > 0'),
        []
      );
    });
  });

  describe('getProductDetails', () => {
    it('should return detailed product information', async () => {
      const mockProduct = {
        id: '1',
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        category: 'vegetables',
        unit: 'kg',
        base_price: 5.99,
        stock_quantity: 100,
        harvest_date: '2024-12-10',
        sellable: true,
        tags: '["fresh", "organic"]',
        days_since_harvest: 5,
        storage_instructions: 'Keep in cool, dry place'
      };

      mockDbQuery.mockResolvedValue([mockProduct]);

      const result = await inventoryService.getProductDetails('1');

      expect(result.id).toBe('1');
      expect(result.name).toBe('Tomatoes');
      expect(result.origin).toBeDefined();
      expect(result.freshness).toBeDefined();
      expect(result.storageInstructions).toBe('Keep in cool, dry place');
    });

    it('should throw ProductNotFoundError for non-existent product', async () => {
      mockDbQuery.mockResolvedValue([]);

      await expect(inventoryService.getProductDetails('nonexistent')).rejects.toThrow(ProductNotFoundError);
    });
  });

  describe('checkAvailability', () => {
    it('should return availability information', async () => {
      const mockAvailability = [
        {
          stock_quantity: 100,
          reserved_quantity: 10
        }
      ];

      mockDbQuery.mockResolvedValue(mockAvailability);

      const result = await inventoryService.checkAvailability('1', 50);

      expect(result.available).toBe(true);
      expect(result.quantity).toBe(90); // 100 - 10 reserved
      expect(result.reservedQuantity).toBe(10);
    });

    it('should indicate unavailable when insufficient stock', async () => {
      const mockAvailability = [
        {
          stock_quantity: 10,
          reserved_quantity: 5
        }
      ];

      // Mock the availability check and alternatives search
      mockDbQuery
        .mockResolvedValueOnce(mockAvailability) // First call for availability
        .mockResolvedValueOnce([{ category: 'vegetables' }]) // Second call for original product category
        .mockResolvedValueOnce([]); // Third call for alternatives

      const result = await inventoryService.checkAvailability('1', 10);

      expect(result.available).toBe(false);
      expect(result.quantity).toBe(5); // 10 - 5 reserved
      expect(result.alternatives).toBeDefined();
    });

    it('should throw ProductNotFoundError for non-existent product', async () => {
      mockDbQuery.mockResolvedValue([]);

      await expect(inventoryService.checkAvailability('nonexistent', 1)).rejects.toThrow(ProductNotFoundError);
    });
  });

  describe('reserveItems', () => {
    it('should successfully reserve available items', async () => {
      const cartItems = [
        { productId: '1', quantity: 2, unitPrice: 5.99 },
        { productId: '2', quantity: 1, unitPrice: 3.99 }
      ];

      // Mock availability checks
      mockDbQuery
        .mockResolvedValueOnce(undefined) // START TRANSACTION
        .mockResolvedValueOnce([{ stock_quantity: 100, reserved_quantity: 0 }]) // First availability check
        .mockResolvedValueOnce(undefined) // First reservation insert
        .mockResolvedValueOnce([{ stock_quantity: 50, reserved_quantity: 0 }]) // Second availability check
        .mockResolvedValueOnce(undefined) // Second reservation insert
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await inventoryService.reserveItems(cartItems);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle insufficient stock gracefully', async () => {
      const cartItems = [
        { productId: '1', quantity: 200, unitPrice: 5.99 } // More than available
      ];

      mockDbQuery
        .mockResolvedValueOnce(undefined) // START TRANSACTION
        .mockResolvedValueOnce([{ stock_quantity: 10, reserved_quantity: 0 }]) // Availability check
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await inventoryService.reserveItems(cartItems);

      expect(result.success).toBe(false);
      expect(result.failedItems).toHaveLength(1);
      expect(result.message).toContain('could not be reserved');
    });
  });

  describe('updateStock', () => {
    it('should update stock levels successfully', async () => {
      const transactions = [
        {
          productId: '1',
          quantityChange: -5,
          type: 'sale' as const,
          reference: 'order-123'
        },
        {
          productId: '2',
          quantityChange: 20,
          type: 'restock' as const,
          reference: 'restock-456'
        }
      ];

      mockDbQuery
        .mockResolvedValueOnce(undefined) // START TRANSACTION
        .mockResolvedValueOnce({ affectedRows: 1 }) // First update
        .mockResolvedValueOnce(undefined) // First log insert
        .mockResolvedValueOnce({ affectedRows: 1 }) // Second update
        .mockResolvedValueOnce(undefined) // Second log insert
        .mockResolvedValueOnce(undefined); // COMMIT

      await expect(inventoryService.updateStock(transactions)).resolves.not.toThrow();

      expect(mockDbQuery).toHaveBeenCalledWith('START TRANSACTION');
      expect(mockDbQuery).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const transactions = [
        {
          productId: '1',
          quantityChange: -5,
          type: 'sale' as const,
          reference: 'order-123'
        }
      ];

      mockDbQuery
        .mockResolvedValueOnce(undefined) // START TRANSACTION
        .mockRejectedValueOnce(new Error('Update failed')) // Update fails
        .mockResolvedValueOnce(undefined); // ROLLBACK

      await expect(inventoryService.updateStock(transactions)).rejects.toThrow(InventoryError);

      expect(mockDbQuery).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('toggleSellability', () => {
    it('should update product sellability', async () => {
      mockDbQuery.mockResolvedValue({ affectedRows: 1 });

      await expect(inventoryService.toggleSellability('1', false)).resolves.not.toThrow();

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products SET sellable = ?'),
        [false, '1']
      );
    });

    it('should throw ProductNotFoundError when product does not exist', async () => {
      mockDbQuery.mockResolvedValue({ affectedRows: 0 });

      await expect(inventoryService.toggleSellability('nonexistent', true)).rejects.toThrow(ProductNotFoundError);
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with low stock', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Low Stock Item',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 5,
          sellable: true,
          tags: '[]'
        }
      ];

      mockDbQuery.mockResolvedValue(mockProducts);

      const result = await inventoryService.getLowStockProducts(10);

      expect(result).toHaveLength(1);
      expect(result[0].stockQuantity).toBe(5);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('stock_quantity <= ?'),
        [10]
      );
    });
  });

  describe('searchProducts', () => {
    it('should search products by name and description', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Tomatoes',
          description: 'Fresh red tomatoes',
          category: 'vegetables',
          unit: 'kg',
          base_price: 5.99,
          stock_quantity: 100,
          sellable: true,
          tags: '["fresh"]'
        }
      ];

      mockDbQuery.mockResolvedValue(mockProducts);

      const result = await inventoryService.searchProducts('tomato');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tomatoes');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('name LIKE ? OR description LIKE ? OR tags LIKE ?'),
        ['%tomato%', '%tomato%', '%tomato%']
      );
    });

    it('should filter by sellable when requested', async () => {
      mockDbQuery.mockResolvedValue([]);

      await inventoryService.searchProducts('test', true);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('sellable = true'),
        expect.any(Array)
      );
    });
  });

  describe('cleanupExpiredReservations', () => {
    it('should remove expired reservations', async () => {
      mockDbQuery.mockResolvedValue({ affectedRows: 3 });

      const result = await inventoryService.cleanupExpiredReservations();

      expect(result).toBe(3);
      expect(mockDbQuery).toHaveBeenCalledWith(
        'DELETE FROM reservations WHERE expires_at < NOW() AND status = "active"'
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockDbQuery.mockRejectedValue(new Error('Cleanup failed'));

      const result = await inventoryService.cleanupExpiredReservations();

      expect(result).toBe(0);
    });
  });
});