/**
 * Unit tests for ResponseGenerator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponseGenerator } from '@/nlp/ResponseGenerator';
import { PersonalityService } from '@/personality/PersonalityService';
import { UpsellService } from '@/services/UpsellService';
import { NegotiationService } from '@/services/NegotiationService';
import { Intent, ConversationContext, BusinessContext } from '@/types/core';
import { StoreIntent, EntityType } from '@/nlp/types';

describe('ResponseGenerator', () => {
  let responseGenerator: ResponseGenerator;
  let personalityService: PersonalityService;
  let upsellService: UpsellService;
  let negotiationService: NegotiationService;
  let mockContext: ConversationContext;
  let mockBusinessContext: BusinessContext;

  beforeEach(() => {
    personalityService = new PersonalityService();
    upsellService = new UpsellService(personalityService);
    negotiationService = new NegotiationService(personalityService);
    
    responseGenerator = new ResponseGenerator(
      personalityService,
      upsellService,
      negotiationService
    );

    mockContext = {
      currentIntent: 'greeting',
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

    mockBusinessContext = {
      inventory: [
        {
          id: '1',
          name: 'Tomatoes',
          description: 'Fresh red tomatoes',
          category: 'vegetables',
          unit: 'kg',
          basePrice: 5.99,
          stockQuantity: 100,
          sellable: true,
          tags: ['fresh', 'organic']
        },
        {
          id: '2',
          name: 'Bananas',
          description: 'Sweet yellow bananas',
          category: 'fruits',
          unit: 'kg',
          basePrice: 3.50,
          stockQuantity: 50,
          sellable: true,
          tags: ['sweet', 'tropical']
        }
      ],
      promotions: [],
      sessionContext: mockContext
    };
  });

  describe('greeting responses', () => {
    it('should generate friendly greeting response', async () => {
      const intent: Intent = {
        name: StoreIntent.GREETING,
        confidence: 0.9,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text.length).toBeGreaterThan(20); // Should be a meaningful greeting
      expect(result.confidence).toBe(0.9);
      expect(result.metadata.personalityApplied).toBe(true);
      expect(result.metadata.intent).toBe(StoreIntent.GREETING);
    });

    it('should personalize greeting for returning customer', async () => {
      const customerContext = {
        ...mockContext,
        customer: { id: '1', name: 'John', email: 'john@example.com' }
      };

      const businessContextWithCustomer = {
        ...mockBusinessContext,
        sessionContext: customerContext
      };

      const intent: Intent = {
        name: StoreIntent.GREETING,
        confidence: 0.9,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        customerContext,
        businessContextWithCustomer
      );

      expect(result.text).toContain('John');
      expect(result.metadata.personalityApplied).toBe(true);
    });
  });

  describe('product browsing responses', () => {
    it('should generate browse response with available categories', async () => {
      const intent: Intent = {
        name: StoreIntent.BROWSE_PRODUCTS,
        confidence: 0.8,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('vegetables');
      expect(result.text).toContain('fruits');
      expect(result.confidence).toBe(0.8);
      expect(result.metadata.intent).toBe(StoreIntent.BROWSE_PRODUCTS);
    });

    it('should handle empty inventory gracefully', async () => {
      const emptyBusinessContext = {
        ...mockBusinessContext,
        inventory: []
      };

      const intent: Intent = {
        name: StoreIntent.BROWSE_PRODUCTS,
        confidence: 0.8,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        emptyBusinessContext
      );

      expect(result.text).toContain('don\'t have any products');
      expect(result.text).toContain('check back later');
    });
  });

  describe('product inquiry responses', () => {
    it('should provide detailed product information', async () => {
      const intent: Intent = {
        name: StoreIntent.PRODUCT_INQUIRY,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'tomatoes',
            confidence: 0.9
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('Tomatoes');
      expect(result.text).toContain('Fresh red tomatoes');
      expect(result.text).toContain('₱5.99');
      expect(result.text).toContain('100 kg');
    });

    it('should handle product not found', async () => {
      const intent: Intent = {
        name: StoreIntent.PRODUCT_INQUIRY,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'mangoes',
            confidence: 0.9
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('don\'t see mangoes');
      expect(result.text).toContain('similar products');
    });

    it('should ask for clarification when no product specified', async () => {
      const intent: Intent = {
        name: StoreIntent.PRODUCT_INQUIRY,
        confidence: 0.7,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('What specific product');
      expect(result.text).toContain('more about');
    });
  });

  describe('price inquiry responses', () => {
    it('should provide price information with quantity calculation', async () => {
      const intent: Intent = {
        name: StoreIntent.PRICE_INQUIRY,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'tomatoes',
            confidence: 0.9
          },
          {
            type: EntityType.QUANTITY,
            value: '2',
            confidence: 0.8
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('₱5.99 per kg');
      expect(result.text).toContain('2 kg');
      expect(result.text).toContain('₱11.98'); // 2 * 5.99
    });

    it('should handle price inquiry without product', async () => {
      const intent: Intent = {
        name: StoreIntent.PRICE_INQUIRY,
        confidence: 0.7,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('Which product');
      expect(result.text).toContain('price for');
    });
  });

  describe('add to cart responses', () => {
    it('should confirm adding item to cart', async () => {
      const intent: Intent = {
        name: StoreIntent.ADD_TO_CART,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'bananas',
            confidence: 0.9
          },
          {
            type: EntityType.QUANTITY,
            value: '1',
            confidence: 0.8
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('add');
      expect(result.text).toContain('1 kg');
      expect(result.text).toContain('Bananas');
      expect(result.text).toContain('₱3.50');
    });

    it('should handle insufficient stock', async () => {
      const intent: Intent = {
        name: StoreIntent.ADD_TO_CART,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'bananas',
            confidence: 0.9
          },
          {
            type: EntityType.QUANTITY,
            value: '100',
            confidence: 0.8
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('only have 50');
      expect(result.text).toContain('available');
    });

    it('should ask for quantity when missing', async () => {
      const intent: Intent = {
        name: StoreIntent.ADD_TO_CART,
        confidence: 0.8,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'tomatoes',
            confidence: 0.9
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('How much');
      expect(result.text).toContain('quantity');
    });
  });

  describe('negotiation responses', () => {
    it('should handle price negotiation', async () => {
      const intent: Intent = {
        name: StoreIntent.NEGOTIATE_PRICE,
        confidence: 0.8,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'tomatoes',
            confidence: 0.9
          },
          {
            type: EntityType.PRICE,
            value: '5.00',
            confidence: 0.8
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext,
        undefined,
        { includeNegotiation: true }
      );

      expect(result.text).toContain('negotiating');
      expect(result.text).toContain('tomatoes');
      expect(result.metadata.negotiationIncluded).toBe(true);
    });
  });

  describe('upsell integration', () => {
    it('should include upsell suggestions when appropriate', async () => {
      const intent: Intent = {
        name: StoreIntent.PRODUCT_INQUIRY,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'tomatoes',
            confidence: 0.9
          }
        ]
      };

      // Mock upsell service to return a suggestion
      vi.spyOn(upsellService, 'shouldOfferUpsell').mockReturnValue(true);
      vi.spyOn(personalityService, 'getUpsellSuggestion').mockReturnValue(
        'You might also like our fresh bananas - they go great with tomatoes!'
      );

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext,
        undefined,
        { includeUpsell: true }
      );

      expect(result.text).toContain('bananas');
      expect(result.metadata.upsellIncluded).toBe(true);
    });

    it('should not include upsell when disabled', async () => {
      const intent: Intent = {
        name: StoreIntent.PRODUCT_INQUIRY,
        confidence: 0.9,
        entities: [
          {
            type: EntityType.PRODUCT_NAME,
            value: 'tomatoes',
            confidence: 0.9
          }
        ]
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext,
        undefined,
        { includeUpsell: false }
      );

      expect(result.metadata.upsellIncluded).toBe(false);
    });
  });

  describe('help and unknown responses', () => {
    it('should provide helpful guidance for help requests', async () => {
      const intent: Intent = {
        name: StoreIntent.HELP,
        confidence: 0.9,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text).toContain('help');
      expect(result.text).toContain('products');
      expect(result.text).toContain('prices');
    });

    it('should handle unknown intents gracefully', async () => {
      const intent: Intent = {
        name: StoreIntent.UNKNOWN,
        confidence: 0.3,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext,
        'some unclear message'
      );

      expect(result.text).toContain('help');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('response length constraints', () => {
    it('should truncate long responses when maxLength is specified', async () => {
      const intent: Intent = {
        name: StoreIntent.BROWSE_PRODUCTS,
        confidence: 0.8,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext,
        undefined,
        { maxResponseLength: 50 }
      );

      expect(result.text.length).toBeLessThanOrEqual(50);
    });
  });

  describe('error handling', () => {
    it('should return fallback response on error', async () => {
      // Mock an error in personality service
      vi.spyOn(personalityService, 'personalizeResponse').mockImplementation(() => {
        throw new Error('Personality service error');
      });

      const intent: Intent = {
        name: StoreIntent.GREETING,
        confidence: 0.9,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text.length).toBeGreaterThan(20); // Should be a meaningful response
      expect(result.confidence).toBe(0.9); // Error was handled gracefully
      expect(result.metadata.personalityApplied).toBe(true);
    });
  });

  describe('farewell responses', () => {
    it('should generate personalized farewell', async () => {
      const intent: Intent = {
        name: StoreIntent.FAREWELL,
        confidence: 0.9,
        entities: []
      };

      const result = await responseGenerator.generateResponse(
        intent,
        mockContext,
        mockBusinessContext
      );

      expect(result.text.length).toBeGreaterThan(20); // Should be a meaningful farewell
      expect(result.metadata.personalityApplied).toBe(true);
    });
  });
});