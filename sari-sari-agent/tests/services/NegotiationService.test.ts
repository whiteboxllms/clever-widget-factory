/**
 * Unit tests for NegotiationService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NegotiationService, NegotiationOffer } from '@/services/NegotiationService';
import { PersonalityService } from '@/personality/PersonalityService';
import { Product, Customer, ConversationContext } from '@/types/core';

describe('NegotiationService', () => {
  let negotiationService: NegotiationService;
  let mockPersonalityService: PersonalityService;
  let mockProduct: Product;
  let mockCustomer: Customer;
  let mockContext: ConversationContext;

  beforeEach(() => {
    mockPersonalityService = new PersonalityService();
    negotiationService = new NegotiationService(mockPersonalityService);

    mockProduct = {
      id: '1',
      name: 'Tomatoes',
      description: 'Fresh tomatoes',
      category: 'vegetables',
      unit: 'kg',
      basePrice: 10.00,
      stockQuantity: 100,
      sellable: true,
      tags: []
    };

    mockCustomer = {
      customerId: 'test-customer',
      name: 'John',
      phone: '+1234567890',
      email: 'john@example.com',
      preferredLanguage: 'en',
      visitCount: 5, // Loyal customer
      totalSpent: 250.00,
      favoriteCategories: ['vegetables'],
      createdAt: new Date('2024-01-01'),
      lastVisit: new Date('2024-12-15')
    };

    mockContext = {
      currentIntent: 'negotiate_price',
      entities: {},
      conversationHistory: [],
      preferences: {
        language: 'en',
        communicationStyle: 'casual',
        favoriteCategories: ['vegetables']
      },
      negotiationHistory: [],
      upsellAttempts: []
    };
  });

  describe('processNegotiation', () => {
    it('should accept reasonable offers', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 9.00, // 10% discount
        timestamp: new Date()
      };

      // Mock personality service response
      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'That sounds fair! $9.00 it is!',
          accepted: true
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        mockCustomer,
        mockContext
      );

      expect(result.accepted).toBe(true);
      expect(result.finalPrice).toBe(9.00);
      expect(result.response).toContain('That sounds fair');
    });

    it('should make counter offers for excessive discounts', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 6.00, // 40% discount - too high
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'I can come down to $8.50 for Tomatoes',
          counterOffer: 8.50,
          accepted: false
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        mockCustomer,
        mockContext
      );

      expect(result.accepted).toBe(false);
      expect(result.counterOffer).toBeDefined();
      expect(result.counterOffer).toBeGreaterThan(offer.customerOffer);
      expect(result.counterOffer).toBeLessThan(offer.originalPrice);
    });

    it('should reject extremely low offers', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 3.00, // 70% discount - way too low
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'Sorry, but $10.00 is really the best I can do',
          accepted: false
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        mockCustomer,
        mockContext
      );

      expect(result.accepted).toBe(false);
      expect(result.counterOffer).toBeUndefined();
    });

    it('should apply volume discounts for large quantities', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 8.00, // 20% discount
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'For 10 items, $8.00 each works!',
          accepted: true
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        10, // Large quantity
        mockCustomer,
        mockContext
      );

      // With volume discount, should be more likely to accept
      expect(result.accepted).toBe(true);
    });

    it('should apply loyal customer discounts', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 8.20, // 18% discount
        timestamp: new Date()
      };

      const loyalCustomer = { ...mockCustomer, visitCount: 10 };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'As a loyal customer, $8.20 works for me!',
          accepted: true
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        loyalCustomer,
        mockContext
      );

      expect(result.accepted).toBe(true);
    });
  });

  describe('isNegotiable', () => {
    it('should return true for negotiable products with willing personality', () => {
      const isNegotiable = negotiationService.isNegotiable(mockProduct, mockCustomer);
      expect(isNegotiable).toBe(true);
    });

    it('should consider personality willingness', () => {
      // The default Friendly Farmer personality has willingness of 7, so should be negotiable
      const personality = mockPersonalityService.getCurrentPersonality();
      expect(personality.negotiationStyle.willingness).toBeGreaterThanOrEqual(5);
      
      const isNegotiable = negotiationService.isNegotiable(mockProduct, mockCustomer);
      expect(isNegotiable).toBe(true);
    });
  });

  describe('getNegotiationHints', () => {
    it('should provide hints for willing negotiators', () => {
      const hints = negotiationService.getNegotiationHints(mockProduct, mockCustomer);
      
      expect(hints).toBeDefined();
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(hint => hint.includes('open to discussing'))).toBe(true);
    });

    it('should provide loyal customer hints', () => {
      const loyalCustomer = { ...mockCustomer, visitCount: 5 };
      const hints = negotiationService.getNegotiationHints(mockProduct, loyalCustomer);
      
      expect(hints.some(hint => hint.includes('regular customer'))).toBe(true);
    });

    it('should provide flexibility hints when significant discount is possible', () => {
      const hints = negotiationService.getNegotiationHints(mockProduct, mockCustomer);
      
      // Should mention flexibility since loyal customer gets extra discount
      expect(hints.some(hint => hint.includes('flexibility'))).toBe(true);
    });
  });

  describe('price calculation logic', () => {
    it('should calculate correct minimum price for regular customers', async () => {
      const regularCustomer = { ...mockCustomer, visitCount: 2 };
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 8.40, // 16% discount - should be rejected for regular customer
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'Sorry, best I can do is $8.50',
          accepted: false
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        regularCustomer,
        mockContext
      );

      expect(result.accepted).toBe(false);
    });

    it('should calculate correct minimum price for loyal customers', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 8.20, // 18% discount - should be accepted for loyal customer
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'As a valued customer, $8.20 works!',
          accepted: true
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        mockCustomer, // Has visitCount: 5 (loyal)
        mockContext
      );

      expect(result.accepted).toBe(true);
    });

    it('should apply volume discounts correctly', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 8.00, // 20% discount
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'For bulk purchase, $8.00 each is fine!',
          accepted: true
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        6, // Above volume threshold (5)
        mockCustomer,
        mockContext
      );

      expect(result.accepted).toBe(true);
    });

    it('should cap maximum discount at 25%', async () => {
      // Create scenario where all discounts would exceed 25%
      const superLoyalCustomer = { ...mockCustomer, visitCount: 20 };
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 7.00, // 30% discount
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'Best I can do is $7.50',
          counterOffer: 7.50,
          accepted: false
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        10, // Volume discount
        superLoyalCustomer,
        mockContext
      );

      // Even with all discounts, minimum should not go below 75% of original price
      expect(result.finalPrice).toBeGreaterThanOrEqual(7.50);
    });
  });

  describe('negotiation rules management', () => {
    it('should allow updating negotiation rules', () => {
      const newRules = {
        maxDiscountPercent: 20,
        volumeDiscountThreshold: 3
      };

      negotiationService.updateNegotiationRules(newRules);
      const currentRules = negotiationService.getNegotiationRules();

      expect(currentRules.maxDiscountPercent).toBe(20);
      expect(currentRules.volumeDiscountThreshold).toBe(3);
    });

    it('should return current negotiation rules', () => {
      const rules = negotiationService.getNegotiationRules();

      expect(rules).toBeDefined();
      expect(rules.minDiscountPercent).toBeDefined();
      expect(rules.maxDiscountPercent).toBeDefined();
      expect(rules.volumeDiscountThreshold).toBeDefined();
      expect(rules.loyalCustomerDiscountPercent).toBeDefined();
    });
  });

  describe('counter offer logic', () => {
    it('should not make counter offers for extremely low offers', async () => {
      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 2.00, // 80% discount - extremely low
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'Sorry, that\'s too low',
          accepted: false
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        mockCustomer,
        mockContext
      );

      expect(result.accepted).toBe(false);
      expect(result.counterOffer).toBeUndefined();
    });

    it('should limit counter offers per product', async () => {
      // Add previous negotiation attempts
      mockContext.negotiationHistory = [
        {
          productId: '1',
          originalPrice: 10.00,
          customerOffer: 7.00,
          agentCounterOffer: 8.50,
          outcome: 'ongoing',
          timestamp: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
        },
        {
          productId: '1',
          originalPrice: 10.00,
          customerOffer: 8.00,
          agentCounterOffer: 8.50,
          outcome: 'ongoing',
          timestamp: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
        }
      ];

      const offer: NegotiationOffer = {
        productId: '1',
        originalPrice: 10.00,
        customerOffer: 7.50,
        timestamp: new Date()
      };

      vi.spyOn(mockPersonalityService, 'getNegotiationResponse')
        .mockReturnValue({
          response: 'That\'s my final offer at $8.50',
          accepted: false
        });

      const result = await negotiationService.processNegotiation(
        offer,
        mockProduct,
        1,
        mockCustomer,
        mockContext
      );

      // Should reject without counter offer due to too many previous attempts
      expect(result.accepted).toBe(false);
      expect(result.counterOffer).toBeUndefined();
    });
  });
});