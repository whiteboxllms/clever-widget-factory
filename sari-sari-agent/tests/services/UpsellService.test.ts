/**
 * Unit tests for UpsellService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpsellService, UpsellRecommendation } from '@/services/UpsellService';
import { PersonalityService } from '@/personality/PersonalityService';
import { Product, CartItem, ConversationContext, Customer } from '@/types/core';

describe('UpsellService', () => {
  let upsellService: UpsellService;
  let mockPersonalityService: PersonalityService;
  let mockProducts: Product[];
  let mockCart: CartItem[];
  let mockContext: ConversationContext;
  let mockCustomer: Customer;

  beforeEach(() => {
    mockPersonalityService = new PersonalityService();
    upsellService = new UpsellService(mockPersonalityService);

    mockProducts = [
      {
        id: '1',
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        category: 'vegetables',
        unit: 'kg',
        basePrice: 5.99,
        stockQuantity: 100,
        sellable: true,
        tags: []
      },
      {
        id: '2',
        name: 'Lettuce',
        description: 'Fresh lettuce',
        category: 'vegetables',
        unit: 'piece',
        basePrice: 2.99,
        stockQuantity: 50,
        sellable: true,
        tags: []
      },
      {
        id: '3',
        name: 'Apples',
        description: 'Red apples',
        category: 'fruits',
        unit: 'kg',
        basePrice: 4.99,
        stockQuantity: 75,
        sellable: true,
        tags: []
      },
      {
        id: '4',
        name: 'Premium Tomatoes',
        description: 'Organic premium tomatoes',
        category: 'vegetables',
        unit: 'kg',
        basePrice: 8.50, // Reduced to be clearly within 50% range (5.99 * 1.5 = 8.985)
        stockQuantity: 25,
        sellable: true,
        tags: []
      }
    ];

    mockCart = [
      {
        productId: '1',
        quantity: 2,
        unitPrice: 5.99
      }
    ];

    mockContext = {
      currentIntent: 'browse_products',
      entities: {},
      conversationHistory: [
        {
          id: '1',
          role: 'user',
          content: 'I want to buy tomatoes',
          timestamp: new Date()
        }
      ],
      preferences: {
        language: 'en',
        communicationStyle: 'casual',
        favoriteCategories: ['vegetables']
      },
      negotiationHistory: [],
      upsellAttempts: []
    };

    mockCustomer = {
      customerId: 'test-customer',
      name: 'John',
      phone: '+1234567890',
      email: 'john@example.com',
      preferredLanguage: 'en',
      visitCount: 3,
      totalSpent: 150.00,
      favoriteCategories: ['vegetables', 'fruits'],
      createdAt: new Date('2024-01-01'),
      lastVisit: new Date('2024-12-15')
    };
  });

  describe('generateRecommendations', () => {
    it('should generate complementary product recommendations', async () => {
      const upsellContext = {
        currentProducts: ['1'], // Tomatoes
        customerPreferences: ['vegetables', 'fruits']
      };

      const recommendations = await upsellService.generateRecommendations(
        mockCart,
        mockProducts,
        upsellContext,
        mockCustomer
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Should recommend fruits as complement to vegetables
      const fruitRecommendation = recommendations.find(rec => 
        mockProducts.find(p => p.id === rec.productId)?.category === 'fruits'
      );
      expect(fruitRecommendation).toBeDefined();
      expect(fruitRecommendation?.type).toBe('complement');
    });

    it('should generate upgrade recommendations', async () => {
      const upsellContext = {
        currentProducts: ['1'], // Regular tomatoes
        customerPreferences: ['vegetables']
      };

      const recommendations = await upsellService.generateRecommendations(
        mockCart,
        mockProducts,
        upsellContext,
        mockCustomer
      );

      // Should recommend premium tomatoes as upgrade
      const upgradeRecommendation = recommendations.find(rec => 
        rec.productId === '4' && rec.type === 'upgrade'
      );
      
      expect(upgradeRecommendation).toBeDefined();
      expect(upgradeRecommendation?.reason).toContain('Premium quality');
    });

    it('should generate seasonal recommendations', async () => {
      // Create a simpler product set to focus on seasonal recommendations
      const seasonalProducts = [
        {
          id: '1',
          name: 'Tomatoes',
          description: 'Fresh tomatoes',
          category: 'vegetables',
          unit: 'kg',
          basePrice: 5.99,
          stockQuantity: 100,
          sellable: true,
          tags: []
        },
        {
          id: '5',
          name: 'Winter Grains',
          description: 'Seasonal grains',
          category: 'grains',
          unit: 'kg',
          basePrice: 3.99,
          stockQuantity: 30,
          sellable: true,
          tags: []
        },
        {
          id: '6',
          name: 'Fresh Dairy',
          description: 'Seasonal dairy',
          category: 'dairy',
          unit: 'liter',
          basePrice: 2.99,
          stockQuantity: 20,
          sellable: true,
          tags: []
        }
      ];

      const upsellContext = {
        currentProducts: ['1'],
        seasonalItems: ['grains', 'dairy'] // Winter seasonal items
      };

      const recommendations = await upsellService.generateRecommendations(
        mockCart,
        seasonalProducts,
        upsellContext,
        mockCustomer
      );

      // Should include seasonal recommendations
      const seasonalRecommendation = recommendations.find(rec => 
        rec.type === 'seasonal'
      );
      expect(seasonalRecommendation).toBeDefined();
      expect(seasonalRecommendation?.reason).toContain('Fresh and in season');
    });

    it('should limit recommendations to top 3', async () => {
      const upsellContext = {
        currentProducts: ['1'],
        customerPreferences: ['vegetables', 'fruits']
      };

      const recommendations = await upsellService.generateRecommendations(
        mockCart,
        mockProducts,
        upsellContext,
        mockCustomer
      );

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should sort recommendations by confidence', async () => {
      const upsellContext = {
        currentProducts: ['1'],
        customerPreferences: ['vegetables', 'fruits']
      };

      const recommendations = await upsellService.generateRecommendations(
        mockCart,
        mockProducts,
        upsellContext,
        mockCustomer
      );

      // Check that recommendations are sorted by confidence (descending)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].confidence).toBeGreaterThanOrEqual(
          recommendations[i].confidence
        );
      }
    });
  });

  describe('generateUpsellMessage', () => {
    it('should generate personalized upsell message', () => {
      const recommendation: UpsellRecommendation = {
        productId: '3',
        reason: 'Goes great with tomatoes',
        confidence: 0.8,
        type: 'complement'
      };

      const suggestedProduct = mockProducts.find(p => p.id === '3')!;

      // Mock the personality service to return a message
      vi.spyOn(mockPersonalityService, 'getUpsellSuggestion')
        .mockReturnValue('Have you tried our Apples? They go great together!');

      const message = upsellService.generateUpsellMessage(
        recommendation,
        'Tomatoes',
        suggestedProduct,
        mockContext
      );

      expect(message).toBeDefined();
      expect(message).toContain('Apples');
      expect(message).toContain('They pair perfectly together!');
    });

    it('should return null when personality service returns null', () => {
      const recommendation: UpsellRecommendation = {
        productId: '3',
        reason: 'Goes great with tomatoes',
        confidence: 0.8,
        type: 'complement'
      };

      const suggestedProduct = mockProducts.find(p => p.id === '3')!;

      // Mock the personality service to return null
      vi.spyOn(mockPersonalityService, 'getUpsellSuggestion')
        .mockReturnValue(null);

      const message = upsellService.generateUpsellMessage(
        recommendation,
        'Tomatoes',
        suggestedProduct,
        mockContext
      );

      expect(message).toBeNull();
    });

    it('should enhance message with recommendation type-specific phrases', () => {
      const upgradeRecommendation: UpsellRecommendation = {
        productId: '4',
        reason: 'Premium quality',
        confidence: 0.7,
        type: 'upgrade'
      };

      const suggestedProduct = mockProducts.find(p => p.id === '4')!;

      vi.spyOn(mockPersonalityService, 'getUpsellSuggestion')
        .mockReturnValue('Try our Premium Tomatoes!');

      const message = upsellService.generateUpsellMessage(
        upgradeRecommendation,
        'Tomatoes',
        suggestedProduct,
        mockContext
      );

      expect(message).toContain('premium quality option');
    });
  });

  describe('shouldOfferUpsell', () => {
    it('should allow upsell for mid-conversation timing', () => {
      // Add some messages to simulate mid-conversation
      mockContext.conversationHistory = Array(5).fill(null).map((_, i) => ({
        id: i.toString(),
        role: i % 2 === 0 ? 'user' : 'agent',
        content: 'test message',
        timestamp: new Date()
      }));

      const shouldOffer = upsellService.shouldOfferUpsell(mockContext, mockCustomer);
      expect(shouldOffer).toBe(true);
    });

    it('should not offer upsell too early in conversation', () => {
      // Very short conversation
      mockContext.conversationHistory = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date()
        }
      ];

      const shouldOffer = upsellService.shouldOfferUpsell(mockContext, mockCustomer);
      expect(shouldOffer).toBe(false);
    });

    it('should not offer upsell if too many recent attempts', () => {
      // Add recent upsell attempts
      const now = new Date();
      mockContext.upsellAttempts = [
        {
          suggestedProductId: '2',
          context: 'test',
          customerResponse: 'declined',
          timestamp: new Date(now.getTime() - 2 * 60 * 1000) // 2 minutes ago
        },
        {
          suggestedProductId: '3',
          context: 'test',
          customerResponse: 'ignored',
          timestamp: new Date(now.getTime() - 1 * 60 * 1000) // 1 minute ago
        }
      ];

      const shouldOffer = upsellService.shouldOfferUpsell(mockContext, mockCustomer);
      expect(shouldOffer).toBe(false);
    });

    it('should allow upsell if recent attempts are old enough', () => {
      // Add old upsell attempts
      const now = new Date();
      mockContext.upsellAttempts = [
        {
          suggestedProductId: '2',
          context: 'test',
          customerResponse: 'declined',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago
        }
      ];

      // Add enough conversation history to pass the timing check
      mockContext.conversationHistory = Array(5).fill(null).map((_, i) => ({
        id: i.toString(),
        role: i % 2 === 0 ? 'user' : 'agent',
        content: 'test message',
        timestamp: new Date()
      }));

      const shouldOffer = upsellService.shouldOfferUpsell(mockContext, mockCustomer);
      expect(shouldOffer).toBe(true);
    });
  });

  describe('complementary product logic', () => {
    it('should recommend fruits for vegetables', async () => {
      const vegetableCart = [{ productId: '1', quantity: 1, unitPrice: 5.99 }]; // Tomatoes
      const upsellContext = { currentProducts: ['1'] };

      const recommendations = await upsellService.generateRecommendations(
        vegetableCart,
        mockProducts,
        upsellContext
      );

      const fruitRecommendation = recommendations.find(rec => 
        mockProducts.find(p => p.id === rec.productId)?.category === 'fruits'
      );
      expect(fruitRecommendation).toBeDefined();
    });

    it('should not recommend products already in cart', async () => {
      const upsellContext = { currentProducts: ['1', '2'] };
      const cartWithMultipleItems = [
        { productId: '1', quantity: 1, unitPrice: 5.99 },
        { productId: '2', quantity: 1, unitPrice: 2.99 }
      ];

      const recommendations = await upsellService.generateRecommendations(
        cartWithMultipleItems,
        mockProducts,
        upsellContext
      );

      // Should not recommend products already in cart
      const recommendedIds = recommendations.map(rec => rec.productId);
      expect(recommendedIds).not.toContain('1');
      expect(recommendedIds).not.toContain('2');
    });

    it('should only recommend sellable products with stock', async () => {
      // Add an out-of-stock product
      const productsWithOutOfStock = [
        ...mockProducts,
        {
          id: '5',
          name: 'Out of Stock Item',
          description: 'Not available',
          category: 'fruits',
          unit: 'kg',
          basePrice: 3.99,
          stockQuantity: 0, // Out of stock
          sellable: true,
          tags: []
        }
      ];

      const upsellContext = { currentProducts: ['1'] };

      const recommendations = await upsellService.generateRecommendations(
        mockCart,
        productsWithOutOfStock,
        upsellContext
      );

      // Should not recommend out-of-stock items
      const recommendedIds = recommendations.map(rec => rec.productId);
      expect(recommendedIds).not.toContain('5');
    });
  });
});