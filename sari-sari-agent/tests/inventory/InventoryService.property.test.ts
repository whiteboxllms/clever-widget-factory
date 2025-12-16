/**
 * Property-based tests for InventoryService
 * Tests invariants and properties that should hold for all valid inputs
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import fc from 'fast-check';
import { InventoryService } from '@/inventory/InventoryService';
import { db } from '@/database/connection';
import { Product, ProductFilter } from '@/types/core';

// Mock the database connection
vi.mock('@/database/connection', () => ({
  db: {
    query: vi.fn(),
  }
}));

describe('InventoryService Property Tests', () => {
  let inventoryService: InventoryService;
  let mockDbQuery: Mock;

  beforeEach(() => {
    inventoryService = new InventoryService();
    mockDbQuery = db.query as Mock;
    mockDbQuery.mockClear();
  });

  // Generators for property testing
  const productGenerator = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ maxLength: 500 }),
    category: fc.oneof(
      fc.constant('vegetables'),
      fc.constant('fruits'),
      fc.constant('grains'),
      fc.constant('dairy'),
      fc.constant('meat')
    ),
    unit: fc.oneof(
      fc.constant('kg'),
      fc.constant('piece'),
      fc.constant('liter'),
      fc.constant('gram')
    ),
    base_price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
    stock_quantity: fc.integer({ min: 0, max: 10000 }),
    sellable: fc.boolean(),
    harvest_date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
    expiry_date: fc.option(fc.date({ min: new Date(), max: new Date('2030-12-31') })),
    tags: fc.constant('[]'),
    nutritional_info: fc.constant(null)
  });

  const productFilterGenerator = fc.record({
    category: fc.option(fc.oneof(
      fc.constant('vegetables'),
      fc.constant('fruits'),
      fc.constant('grains'),
      fc.constant('dairy'),
      fc.constant('meat')
    )),
    priceRange: fc.option(fc.tuple(
      fc.float({ min: Math.fround(0), max: Math.fround(500) }),
      fc.float({ min: Math.fround(500), max: Math.fround(1000) })
    )),
    inStock: fc.option(fc.boolean()),
    sellableOnly: fc.option(fc.boolean())
  }, { requiredKeys: [] });

  describe('Property 11: Real-time inventory synchronization', () => {
    it('should maintain consistency between getAvailableProducts and getSellableProducts', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(productGenerator, { minLength: 0, maxLength: 50 }),
        productFilterGenerator,
        async (mockProducts, filters) => {
          // Setup mock to return the generated products
          mockDbQuery.mockResolvedValue(mockProducts);

          // Get all available products
          const availableProducts = await inventoryService.getAvailableProducts(filters);
          
          // Reset mock for sellable products call
          const sellableProducts = mockProducts.filter(p => p.sellable === true);
          mockDbQuery.mockResolvedValue(sellableProducts);
          
          const sellableResult = await inventoryService.getSellableProducts(filters);

          // Property: All sellable products should be a subset of available products
          const availableIds = new Set(availableProducts.map(p => p.id));
          const sellableIds = sellableResult.map(p => p.id);
          
          // Every sellable product should exist in available products
          const allSellableInAvailable = sellableIds.every(id => availableIds.has(id));
          
          expect(allSellableInAvailable).toBe(true);

          // Property: All sellable products should have sellable = true
          const allMarkedSellable = sellableResult.every(p => p.sellable === true);
          expect(allMarkedSellable).toBe(true);

          // Property: No sellable product should have expired date in the past
          const now = new Date();
          const noExpiredProducts = sellableResult.every(p => 
            !p.expiryDate || p.expiryDate > now
          );
          expect(noExpiredProducts).toBe(true);
        }
      ), { numRuns: 20 });
    });

    it('should maintain stock quantity consistency across operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(productGenerator, { minLength: 1, maxLength: 10 }),
        fc.array(fc.record({
          productId: fc.string({ minLength: 1 }),
          quantity: fc.integer({ min: 1, max: 100 })
        }), { minLength: 1, maxLength: 5 }),
        async (mockProducts, cartItems) => {
          // Ensure cart items reference existing products
          const validCartItems = cartItems.map(item => ({
            ...item,
            productId: mockProducts[0].id, // Use first product for simplicity
            unitPrice: mockProducts[0].base_price
          }));

          // Mock availability check
          mockDbQuery.mockResolvedValue([{
            stock_quantity: 1000,
            reserved_quantity: 0
          }]);

          const availability = await inventoryService.checkAvailability(
            validCartItems[0].productId, 
            validCartItems[0].quantity
          );

          // Property: Available quantity should never be negative
          expect(availability.quantity).toBeGreaterThanOrEqual(0);

          // Property: Reserved quantity should never exceed stock quantity
          expect(availability.reservedQuantity).toBeLessThanOrEqual(
            availability.quantity + availability.reservedQuantity
          );

          // Property: If available is true, quantity should be >= requested
          if (availability.available) {
            expect(availability.quantity).toBeGreaterThanOrEqual(validCartItems[0].quantity);
          }
        }
      ), { numRuns: 15 });
    });

    it('should maintain referential integrity in stock transactions', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          productId: fc.string({ minLength: 1, maxLength: 50 }),
          quantityChange: fc.integer({ min: -1000, max: 1000 }),
          type: fc.oneof(
            fc.constant('sale'),
            fc.constant('restock'),
            fc.constant('adjustment'),
            fc.constant('reservation')
          ),
          reference: fc.option(fc.string({ maxLength: 100 }))
        }), { minLength: 1, maxLength: 10 }),
        async (transactions) => {
          // Reset mock before each property test run
          mockDbQuery.mockClear();
          
          // Mock successful transaction
          mockDbQuery
            .mockResolvedValueOnce(undefined) // START TRANSACTION
            .mockResolvedValue({ affectedRows: 1 }) // Updates and inserts
            .mockResolvedValueOnce(undefined); // COMMIT

          await inventoryService.updateStock(transactions);

          // Property: Transaction should be atomic (start and commit called)
          expect(mockDbQuery).toHaveBeenCalledWith('START TRANSACTION');
          expect(mockDbQuery).toHaveBeenCalledWith('COMMIT');

          // Property: Each transaction should result in stock updates and log entries
          const updateCalls = mockDbQuery.mock.calls.filter(call => 
            call[0] && call[0].replace(/\s+/g, ' ').includes('UPDATE products SET stock_quantity')
          );
          const logCalls = mockDbQuery.mock.calls.filter(call => 
            call[0] && call[0].includes('INSERT INTO stock_transactions')
          );
          
          // Should have updates and logs for each transaction (unless empty transaction list)
          if (transactions.length > 0) {
            // Each transaction should result in exactly one update and one log
            expect(updateCalls.length).toBe(transactions.length);
            expect(logCalls.length).toBe(transactions.length);
          } else {
            // Empty transaction list should still have transaction boundaries
            expect(updateCalls.length).toBe(0);
            expect(logCalls.length).toBe(0);
          }

          // Property: Transaction and commit should be called
          expect(mockDbQuery).toHaveBeenCalledWith('START TRANSACTION');
          expect(mockDbQuery).toHaveBeenCalledWith('COMMIT');
        }
      ), { numRuns: 10 });
    });
  });

  describe('Property 24: Sellability filtering', () => {
    it('should correctly filter products by sellability status', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(productGenerator, { minLength: 0, maxLength: 100 }),
        async (mockProducts) => {
          // Test getSellableProducts filtering
          const sellableProducts = mockProducts.filter(p => p.sellable === true);
          mockDbQuery.mockResolvedValue(sellableProducts);

          const result = await inventoryService.getSellableProducts();

          // Property: All returned products must have sellable = true
          const allSellable = result.every(product => product.sellable === true);
          expect(allSellable).toBe(true);

          // Property: No product with sellable = false should be returned
          const noUnsellable = result.every(product => product.sellable !== false);
          expect(noUnsellable).toBe(true);

          // Property: Result should not contain more products than sellable ones in input
          expect(result.length).toBeLessThanOrEqual(sellableProducts.length);
        }
      ), { numRuns: 25 });
    });

    it('should maintain sellability toggle consistency', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.boolean(),
        async (productId, sellableValue) => {
          // Mock successful update
          mockDbQuery.mockResolvedValue({ affectedRows: 1 });

          await inventoryService.toggleSellability(productId, sellableValue);

          // Property: Update query should be called with correct parameters
          expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE products SET sellable = ?'),
            [sellableValue, productId]
          );

          // Property: Only one update should occur per toggle (check most recent call)
          const updateCalls = mockDbQuery.mock.calls.filter(call => 
            call[0] && call[0].includes('UPDATE products SET sellable')
          );
          expect(updateCalls.length).toBeGreaterThanOrEqual(1);
        }
      ), { numRuns: 20 });
    });

    it('should respect sellability in product search', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.boolean(),
        fc.array(productGenerator, { minLength: 0, maxLength: 50 }),
        async (searchQuery, sellableOnly, mockProducts) => {
          // Filter products based on sellableOnly flag
          const expectedProducts = sellableOnly 
            ? mockProducts.filter(p => p.sellable === true && p.stock_quantity > 0)
            : mockProducts;

          mockDbQuery.mockResolvedValue(expectedProducts);

          const result = await inventoryService.searchProducts(searchQuery, sellableOnly);

          if (sellableOnly) {
            // Property: When sellableOnly is true, all results must be sellable and in stock
            const allSellableAndInStock = result.every(product => 
              product.sellable === true && product.stockQuantity > 0
            );
            expect(allSellableAndInStock).toBe(true);

            // Property: Search query should include sellable filter
            expect(mockDbQuery).toHaveBeenCalledWith(
              expect.stringContaining('sellable = true'),
              expect.any(Array)
            );
          }

          // Property: Search should always include the search terms
          expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringContaining('name LIKE ? OR description LIKE ? OR tags LIKE ?'),
            expect.arrayContaining([
              `%${searchQuery}%`,
              `%${searchQuery}%`, 
              `%${searchQuery}%`
            ])
          );
        }
      ), { numRuns: 15 });
    });

    it('should maintain sellability constraints in category filtering', async () => {
      await fc.assert(fc.asyncProperty(
        fc.oneof(
          fc.constant('vegetables'),
          fc.constant('fruits'),
          fc.constant('grains'),
          fc.constant('dairy'),
          fc.constant('meat')
        ),
        fc.boolean(),
        fc.array(productGenerator, { minLength: 0, maxLength: 30 }),
        async (category, sellableOnly, mockProducts) => {
          // Filter products by category and sellability
          let expectedProducts = mockProducts.filter(p => p.category === category);
          if (sellableOnly) {
            expectedProducts = expectedProducts.filter(p => p.sellable === true && p.stock_quantity > 0);
          }

          mockDbQuery.mockResolvedValue(expectedProducts);

          const result = await inventoryService.getProductsByCategory(category, sellableOnly);

          // Property: All results should match the requested category
          const allMatchCategory = result.every(product => product.category === category);
          expect(allMatchCategory).toBe(true);

          if (sellableOnly) {
            // Property: All results should be sellable and in stock
            const allSellableAndInStock = result.every(product => 
              product.sellable === true && product.stockQuantity > 0
            );
            expect(allSellableAndInStock).toBe(true);
          }

          // Property: Category filter should be applied in query
          expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringContaining('category = ?'),
            expect.arrayContaining([category])
          );
        }
      ), { numRuns: 20 });
    });

    it('should handle edge cases in sellability filtering', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          ...productGenerator.constraints,
          sellable: fc.constant(true),
          stock_quantity: fc.oneof(
            fc.constant(0),           // Out of stock
            fc.integer({ min: 1, max: 5 }),  // Low stock
            fc.integer({ min: 100, max: 1000 }) // High stock
          ),
          expiry_date: fc.oneof(
            fc.constant(null),        // No expiry
            fc.date({ min: new Date('2020-01-01'), max: new Date() }), // Expired
            fc.date({ min: new Date(), max: new Date('2030-12-31') })  // Future expiry
          )
        }), { minLength: 0, maxLength: 20 }),
        async (mockProducts) => {
          // Filter to only non-expired, in-stock, sellable products
          const validProducts = mockProducts.filter(p => 
            p.sellable === true && 
            p.stock_quantity > 0 && 
            (!p.expiry_date || p.expiry_date > new Date())
          );

          mockDbQuery.mockResolvedValue(validProducts);

          const result = await inventoryService.getSellableProducts();

          // Property: No expired products should be returned
          const now = new Date();
          const noExpiredProducts = result.every(product => 
            !product.expiryDate || product.expiryDate > now
          );
          expect(noExpiredProducts).toBe(true);

          // Property: No out-of-stock products should be returned (default behavior)
          const noOutOfStock = result.every(product => product.stockQuantity > 0);
          expect(noOutOfStock).toBe(true);

          // Property: All products should be sellable
          const allSellable = result.every(product => product.sellable === true);
          expect(allSellable).toBe(true);
        }
      ), { numRuns: 15 });
    });
  });

  describe('Cross-property invariants', () => {
    it('should maintain data consistency across all filtering operations', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(productGenerator, { minLength: 5, maxLength: 50 }),
        productFilterGenerator,
        async (mockProducts, filters) => {
          // Test multiple operations with the same dataset
          mockDbQuery.mockResolvedValue(mockProducts);
          const allProducts = await inventoryService.getAvailableProducts(filters);

          const sellableProducts = mockProducts.filter(p => p.sellable === true);
          mockDbQuery.mockResolvedValue(sellableProducts);
          const sellableResult = await inventoryService.getSellableProducts(filters);

          // Property: Sellable products should be subset of all products
          const sellableIds = new Set(sellableResult.map(p => p.id));
          const allIds = new Set(allProducts.map(p => p.id));
          
          const isSubset = [...sellableIds].every(id => allIds.has(id));
          expect(isSubset).toBe(true);

          // Property: Product data should be consistent across calls
          for (const sellableProduct of sellableResult) {
            const correspondingProduct = allProducts.find(p => p.id === sellableProduct.id);
            if (correspondingProduct) {
              expect(sellableProduct.name).toBe(correspondingProduct.name);
              expect(sellableProduct.basePrice).toBe(correspondingProduct.basePrice);
              expect(sellableProduct.category).toBe(correspondingProduct.category);
            }
          }
        }
      ), { numRuns: 10 });
    });
  });
});