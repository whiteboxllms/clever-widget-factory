/**
 * Unit tests for the enhanced Product model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProductModel, validateProductData, isProduct } from '@/models/Product';
import { ValidationError } from '@/utils/errors';
import { createMockProduct } from '../utils/test-helpers';

describe('ProductModel', () => {
  let validProductData: any;

  beforeEach(() => {
    validProductData = createMockProduct();
  });

  describe('constructor and validation', () => {
    it('should create a valid product with all required fields', () => {
      const product = new ProductModel(validProductData);
      expect(product.product.id).toBe(validProductData.id);
      expect(product.product.name).toBe(validProductData.name);
      expect(product.product.sellable).toBe(true);
    });

    it('should set sellable to true by default', () => {
      const productData = { ...validProductData };
      delete productData.sellable;
      
      const product = new ProductModel(productData);
      expect(product.product.sellable).toBe(true);
    });

    it('should throw ValidationError for missing required fields', () => {
      const invalidData = { ...validProductData };
      delete invalidData.name;
      
      expect(() => new ProductModel(invalidData)).toThrow(ValidationError);
    });

    it('should throw ValidationError for negative price', () => {
      const invalidData = { ...validProductData, basePrice: -5 };
      
      expect(() => new ProductModel(invalidData)).toThrow(ValidationError);
    });

    it('should throw ValidationError for negative stock', () => {
      const invalidData = { ...validProductData, stockQuantity: -1 };
      
      expect(() => new ProductModel(invalidData)).toThrow(ValidationError);
    });

    it('should validate expiry date is after harvest date', () => {
      const harvestDate = new Date('2024-01-01');
      const expiryDate = new Date('2023-12-31'); // Before harvest
      
      const invalidData = {
        ...validProductData,
        harvestDate,
        expiryDate
      };
      
      expect(() => new ProductModel(invalidData)).toThrow(ValidationError);
    });

    it('should validate expiry date is in the future', () => {
      const pastDate = new Date('2020-01-01');
      const invalidData = {
        ...validProductData,
        expiryDate: pastDate
      };
      
      expect(() => new ProductModel(invalidData)).toThrow(ValidationError);
    });
  });

  describe('sellability methods', () => {
    it('should return true for sellable product with stock', () => {
      const product = new ProductModel({
        ...validProductData,
        sellable: true,
        stockQuantity: 10
      });
      
      expect(product.isSellable()).toBe(true);
    });

    it('should return false for non-sellable product', () => {
      const product = new ProductModel({
        ...validProductData,
        sellable: false,
        stockQuantity: 10
      });
      
      expect(product.isSellable()).toBe(false);
    });

    it('should return false for sellable product with no stock', () => {
      const product = new ProductModel({
        ...validProductData,
        sellable: true,
        stockQuantity: 0
      });
      
      expect(product.isSellable()).toBe(false);
    });

    it('should return false for expired product', () => {
      const product = new ProductModel({
        ...validProductData,
        sellable: true,
        stockQuantity: 10,
        expiryDate: new Date('2020-01-01')
      });
      
      expect(product.isSellable()).toBe(false);
    });

    it('should toggle sellability status', () => {
      const product = new ProductModel(validProductData);
      
      expect(product.product.sellable).toBe(true);
      
      product.setSellable(false);
      expect(product.product.sellable).toBe(false);
      
      product.setSellable(true);
      expect(product.product.sellable).toBe(true);
    });
  });

  describe('stock management', () => {
    it('should identify in-stock products', () => {
      const product = new ProductModel({
        ...validProductData,
        stockQuantity: 50
      });
      
      expect(product.isInStock()).toBe(true);
      expect(product.getStockStatus()).toBe('in-stock');
    });

    it('should identify low-stock products', () => {
      const product = new ProductModel({
        ...validProductData,
        stockQuantity: 5
      });
      
      expect(product.isInStock()).toBe(true);
      expect(product.isLowStock()).toBe(true);
      expect(product.getStockStatus()).toBe('low-stock');
    });

    it('should identify out-of-stock products', () => {
      const product = new ProductModel({
        ...validProductData,
        stockQuantity: 0
      });
      
      expect(product.isInStock()).toBe(false);
      expect(product.getStockStatus()).toBe('out-of-stock');
    });

    it('should update stock quantity', () => {
      const product = new ProductModel({
        ...validProductData,
        stockQuantity: 10
      });
      
      product.updateStock(20);
      expect(product.product.stockQuantity).toBe(20);
    });

    it('should not allow negative stock updates', () => {
      const product = new ProductModel(validProductData);
      
      expect(() => product.updateStock(-5)).toThrow(ValidationError);
    });

    it('should reserve stock successfully when available', () => {
      const product = new ProductModel({
        ...validProductData,
        stockQuantity: 10
      });
      
      const success = product.reserveStock(3);
      expect(success).toBe(true);
      expect(product.product.stockQuantity).toBe(7);
    });

    it('should fail to reserve stock when insufficient', () => {
      const product = new ProductModel({
        ...validProductData,
        stockQuantity: 5
      });
      
      const success = product.reserveStock(10);
      expect(success).toBe(false);
      expect(product.product.stockQuantity).toBe(5); // Unchanged
    });

    it('should not allow reserving negative or zero quantity', () => {
      const product = new ProductModel(validProductData);
      
      expect(() => product.reserveStock(0)).toThrow(ValidationError);
      expect(() => product.reserveStock(-1)).toThrow(ValidationError);
    });
  });

  describe('customer information', () => {
    it('should provide customer-facing product information', () => {
      const product = new ProductModel(validProductData);
      const customerInfo = product.getCustomerInfo();
      
      expect(customerInfo).toHaveProperty('id');
      expect(customerInfo).toHaveProperty('name');
      expect(customerInfo).toHaveProperty('price');
      expect(customerInfo).toHaveProperty('availability');
      expect(customerInfo).not.toHaveProperty('sellable'); // Internal field
    });

    it('should calculate freshness indicator based on harvest date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const product = new ProductModel({
        ...validProductData,
        harvestDate: yesterday
      });
      
      const customerInfo = product.getCustomerInfo();
      expect(customerInfo.freshness).toBe('excellent');
    });

    it('should handle products without harvest date', () => {
      const productData = { ...validProductData };
      delete productData.harvestDate;
      
      const product = new ProductModel(productData);
      const customerInfo = product.getCustomerInfo();
      
      expect(customerInfo.freshness).toBeUndefined();
    });
  });

  describe('static methods', () => {
    it('should create product using static create method', () => {
      const product = ProductModel.create(validProductData);
      expect(product).toBeInstanceOf(ProductModel);
      expect(product.product.id).toBe(validProductData.id);
    });

    it('should validate data using static validate method', () => {
      const validated = ProductModel.validate(validProductData);
      expect(validated.id).toBe(validProductData.id);
      expect(validated.sellable).toBe(true);
    });

    it('should check validity using static isValid method', () => {
      expect(ProductModel.isValid(validProductData)).toBe(true);
      expect(ProductModel.isValid({ invalid: 'data' })).toBe(false);
    });
  });

  describe('exported utility functions', () => {
    it('should validate product data', () => {
      const validated = validateProductData(validProductData);
      expect(validated.id).toBe(validProductData.id);
    });

    it('should check if data is a product', () => {
      expect(isProduct(validProductData)).toBe(true);
      expect(isProduct({ invalid: 'data' })).toBe(false);
    });
  });
});