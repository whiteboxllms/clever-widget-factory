/**
 * Enhanced Product model with sellability controls
 * Integrates with existing farm inventory while adding customer-facing controls
 */

import { z } from 'zod';
import { Product, NutritionalData } from '@/types/core';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

// Enhanced validation schema for Product with sellability and semantic search
export const EnhancedProductSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
  name: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
  description: z.string().max(1000, 'Description too long'),
  category: z.string().min(1, 'Category is required').max(100, 'Category name too long'),
  unit: z.string().min(1, 'Unit is required').max(20, 'Unit name too long'),
  basePrice: z.number().positive('Price must be positive').max(10000, 'Price too high'),
  stockQuantity: z.number().min(0, 'Stock quantity cannot be negative').max(100000, 'Stock quantity too high'),
  harvestDate: z.date().optional(),
  expiryDate: z.date().optional(),
  nutritionalInfo: z.record(z.number()).optional(),
  tags: z.array(z.string().max(50, 'Tag too long')).max(20, 'Too many tags'),
  // Enhanced sellability field with validation
  sellable: z.boolean().default(true),
  // Semantic search fields
  embeddingText: z.string().max(2000, 'Embedding text too long').optional(),
  embeddingVector: z.array(z.number()).max(1536, 'Embedding vector too large').optional()
}).refine(
  (data) => !data.expiryDate || !data.harvestDate || data.expiryDate > data.harvestDate,
  {
    message: 'Expiry date must be after harvest date',
    path: ['expiryDate']
  }
).refine(
  (data) => !data.expiryDate || data.expiryDate > new Date(),
  {
    message: 'Expiry date must be in the future',
    path: ['expiryDate']
  }
);

export class ProductModel {
  private data: Product;

  constructor(productData: Partial<Product>) {
    this.data = this.validateAndNormalize(productData);
  }

  /**
   * Validates and normalizes product data
   */
  private validateAndNormalize(productData: Partial<Product>): Product {
    try {
      // Validate using Zod schema
      const validated = EnhancedProductSchema.parse(productData);
      
      // Additional business logic validation
      this.validateBusinessRules(validated);
      
      logger.debug('Product validated successfully', { productId: validated.id });
      
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(`Product validation failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Additional business rule validation
   */
  private validateBusinessRules(product: Product): void {
    // Check for valid category
    const validCategories = ['vegetables', 'fruits', 'herbs', 'grains', 'dairy', 'meat', 'other'];
    if (!validCategories.includes(product.category.toLowerCase())) {
      logger.warn('Product has non-standard category', { 
        productId: product.id, 
        category: product.category 
      });
    }

    // Check for reasonable price ranges by category
    const priceRanges: Record<string, [number, number]> = {
      vegetables: [0.5, 50],
      fruits: [0.5, 100],
      herbs: [1, 200],
      grains: [1, 20],
      dairy: [2, 50],
      meat: [5, 200]
    };

    const range = priceRanges[product.category.toLowerCase()];
    if (range && (product.basePrice < range[0] || product.basePrice > range[1])) {
      logger.warn('Product price outside expected range for category', {
        productId: product.id,
        category: product.category,
        price: product.basePrice,
        expectedRange: range
      });
    }

    // Validate expiry date for perishables
    if (['vegetables', 'fruits', 'dairy', 'meat'].includes(product.category.toLowerCase())) {
      if (!product.expiryDate) {
        logger.warn('Perishable product missing expiry date', { 
          productId: product.id, 
          category: product.category 
        });
      }
    }
  }

  /**
   * Get the product data
   */
  get product(): Product {
    return { ...this.data };
  }

  /**
   * Check if product is sellable to customers
   */
  isSellable(): boolean {
    return this.data.sellable && this.isInStock() && !this.isExpired();
  }

  /**
   * Check if product is in stock
   */
  isInStock(): boolean {
    return this.data.stockQuantity > 0;
  }

  /**
   * Check if product is expired
   */
  isExpired(): boolean {
    if (!this.data.expiryDate) return false;
    return this.data.expiryDate <= new Date();
  }

  /**
   * Check if product has low stock
   */
  isLowStock(threshold: number = 10): boolean {
    return this.data.stockQuantity <= threshold && this.data.stockQuantity > 0;
  }

  /**
   * Get stock status for customer display
   */
  getStockStatus(): 'in-stock' | 'low-stock' | 'out-of-stock' {
    if (this.data.stockQuantity === 0) return 'out-of-stock';
    if (this.isLowStock()) return 'low-stock';
    return 'in-stock';
  }

  /**
   * Toggle sellability status
   */
  setSellable(sellable: boolean): void {
    this.data.sellable = sellable;
    logger.info('Product sellability updated', { 
      productId: this.data.id, 
      sellable 
    });
  }

  /**
   * Update stock quantity
   */
  updateStock(newQuantity: number): void {
    if (newQuantity < 0) {
      throw new ValidationError('Stock quantity cannot be negative');
    }
    
    const oldQuantity = this.data.stockQuantity;
    this.data.stockQuantity = newQuantity;
    
    logger.info('Product stock updated', {
      productId: this.data.id,
      oldQuantity,
      newQuantity,
      change: newQuantity - oldQuantity
    });
  }

  /**
   * Reserve stock for a purchase
   */
  reserveStock(quantity: number): boolean {
    if (quantity <= 0) {
      throw new ValidationError('Reserve quantity must be positive');
    }
    
    if (this.data.stockQuantity < quantity) {
      logger.warn('Insufficient stock for reservation', {
        productId: this.data.id,
        requested: quantity,
        available: this.data.stockQuantity
      });
      return false;
    }
    
    this.data.stockQuantity -= quantity;
    logger.info('Stock reserved', {
      productId: this.data.id,
      reserved: quantity,
      remaining: this.data.stockQuantity
    });
    
    return true;
  }

  /**
   * Get customer-facing product information
   */
  getCustomerInfo(): {
    id: string;
    name: string;
    description: string;
    category: string;
    unit: string;
    price: number;
    availability: 'in-stock' | 'low-stock' | 'out-of-stock';
    tags: string[];
    freshness?: string;
  } {
    return {
      id: this.data.id,
      name: this.data.name,
      description: this.data.description,
      category: this.data.category,
      unit: this.data.unit,
      price: this.data.basePrice,
      availability: this.getStockStatus(),
      tags: this.data.tags,
      freshness: this.getFreshnessIndicator()
    };
  }

  /**
   * Generate enhanced text for semantic search embeddings
   */
  generateEmbeddingText(): string {
    const parts = [
      this.data.name,
      this.data.description,
      this.data.category,
      ...this.data.tags
    ];

    // Add freshness information if available
    const freshness = this.getFreshnessIndicator();
    if (freshness) {
      parts.push(`freshness: ${freshness}`);
    }

    // Add nutritional highlights if available
    if (this.data.nutritionalInfo) {
      const nutritionHighlights = Object.entries(this.data.nutritionalInfo)
        .filter(([_, value]) => value > 0)
        .map(([key, _]) => key)
        .slice(0, 3); // Limit to top 3 nutritional aspects
      
      if (nutritionHighlights.length > 0) {
        parts.push(`nutrition: ${nutritionHighlights.join(', ')}`);
      }
    }

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Set embedding text for semantic search
   */
  setEmbeddingText(embeddingText: string): void {
    if (embeddingText.length > 2000) {
      throw new ValidationError('Embedding text too long');
    }
    
    this.data.embeddingText = embeddingText;
    logger.debug('Product embedding text updated', { 
      productId: this.data.id,
      textLength: embeddingText.length
    });
  }

  /**
   * Set embedding vector for semantic search
   */
  setEmbeddingVector(vector: number[]): void {
    if (vector.length > 1536) {
      throw new ValidationError('Embedding vector too large');
    }
    
    this.data.embeddingVector = vector;
    logger.debug('Product embedding vector updated', { 
      productId: this.data.id,
      vectorDimensions: vector.length
    });
  }

  /**
   * Check if product has embedding data for semantic search
   */
  hasEmbedding(): boolean {
    return !!(this.data.embeddingText && this.data.embeddingVector);
  }

  /**
   * Get embedding text, generating if not set
   */
  getEmbeddingText(): string {
    if (!this.data.embeddingText) {
      this.data.embeddingText = this.generateEmbeddingText();
      logger.debug('Generated embedding text for product', { 
        productId: this.data.id,
        embeddingText: this.data.embeddingText
      });
    }
    return this.data.embeddingText;
  }

  /**
   * Get embedding vector if available
   */
  getEmbeddingVector(): number[] | undefined {
    return this.data.embeddingVector;
  }

  /**
   * Get freshness indicator for customer display
   */
  private getFreshnessIndicator(): string | undefined {
    if (!this.data.harvestDate) return undefined;
    
    const daysSinceHarvest = Math.floor(
      (Date.now() - this.data.harvestDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceHarvest <= 1) return 'excellent';
    if (daysSinceHarvest <= 3) return 'good';
    if (daysSinceHarvest <= 7) return 'fair';
    return 'aging';
  }

  /**
   * Create a new product instance from raw data
   */
  static create(productData: Partial<Product>): ProductModel {
    return new ProductModel(productData);
  }

  /**
   * Validate product data without creating instance
   */
  static validate(productData: unknown): Product {
    return EnhancedProductSchema.parse(productData);
  }

  /**
   * Check if data represents a valid product
   */
  static isValid(productData: unknown): boolean {
    try {
      EnhancedProductSchema.parse(productData);
      return true;
    } catch {
      return false;
    }
  }
}

// Export validation function for external use
export function validateProductData(data: unknown): Product {
  return ProductModel.validate(data);
}

// Export type guards
export function isProduct(data: unknown): data is Product {
  return ProductModel.isValid(data);
}