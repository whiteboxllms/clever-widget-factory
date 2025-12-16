/**
 * Unit tests for PersonalityService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalityService } from '@/personality/PersonalityService';
import { ConversationContext, Customer } from '@/types/core';
import { PersonalityContext } from '@/personality/types';

describe('PersonalityService', () => {
  let personalityService: PersonalityService;
  let mockContext: ConversationContext;
  let mockCustomer: Customer;

  beforeEach(() => {
    personalityService = new PersonalityService();
    
    mockContext = {
      currentIntent: 'browse_products',
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

  describe('getCurrentPersonality', () => {
    it('should return the default Friendly Farmer personality', () => {
      const personality = personalityService.getCurrentPersonality();

      expect(personality.id).toBe('friendly-farmer');
      expect(personality.name).toBe('Friendly Farmer');
      expect(personality.traits.friendliness).toBe(9);
      expect(personality.traits.formality).toBe(3);
      expect(personality.responseStyle.tone).toBe('warm');
    });
  });

  describe('personalizeResponse', () => {
    it('should personalize a basic response with friendly tone', () => {
      const baseResponse = 'Here are the available products.';
      
      const result = personalityService.personalizeResponse(baseResponse, mockContext);

      expect(result.text).toContain('Here are the available products');
      expect(result.tone).toBe('warm');
      expect(result.emotionalContext).toBe('helpful');
    });

    it('should add enthusiasm to responses', () => {
      const baseResponse = 'Great choice.';
      
      const result = personalityService.personalizeResponse(baseResponse, mockContext);

      expect(result.text).toBe('Great choice!');
    });

    it('should make responses more casual', () => {
      const baseResponse = 'You are looking for vegetables. I will help you.';
      
      const result = personalityService.personalizeResponse(baseResponse, mockContext);

      expect(result.text).toContain("You're looking");
      expect(result.text).toContain("I'll help");
    });

    it('should sometimes add acknowledgment phrases', () => {
      // Test multiple times to account for randomness
      let foundAcknowledgment = false;
      
      for (let i = 0; i < 20; i++) {
        const result = personalityService.personalizeResponse('Here are your options.', mockContext);
        if (result.text.includes('Absolutely!') || result.text.includes('You bet!') || 
            result.text.includes('Of course!') || result.text.includes('Great choice!')) {
          foundAcknowledgment = true;
          break;
        }
      }

      // Should find at least one acknowledgment in 20 tries (probability is about 30%)
      expect(foundAcknowledgment).toBe(true);
    });
  });

  describe('getGreeting', () => {
    it('should return a greeting for new customers', () => {
      const greeting = personalityService.getGreeting();

      expect(greeting).toContain('Welcome');
      expect(greeting).toContain('there');
      expect(greeting.length).toBeGreaterThan(10);
    });

    it('should personalize greeting for returning customers', () => {
      const personalityContext: PersonalityContext = {
        customerRelationship: 'returning'
      };

      const greeting = personalityService.getGreeting(mockCustomer, personalityContext);

      expect(greeting).toContain('John');
    });

    it('should use different greeting templates', () => {
      const greetings = new Set();
      
      // Generate multiple greetings to test variety
      for (let i = 0; i < 20; i++) {
        const greeting = personalityService.getGreeting();
        greetings.add(greeting);
      }

      // Should have some variety in greetings
      expect(greetings.size).toBeGreaterThan(1);
    });
  });

  describe('getFarewell', () => {
    it('should return a farewell message', () => {
      const farewell = personalityService.getFarewell();

      expect(farewell).toContain('friend');
      expect(farewell.length).toBeGreaterThan(10);
    });

    it('should personalize farewell for known customers', () => {
      const farewell = personalityService.getFarewell(mockCustomer);

      expect(farewell).toContain('John');
    });
  });

  describe('getNegotiationResponse', () => {
    it('should accept reasonable offers', () => {
      const originalPrice = 10.00;
      const customerOffer = 9.00; // 10% discount, within acceptable range

      const result = personalityService.getNegotiationResponse(
        originalPrice,
        customerOffer,
        'Tomatoes'
      );

      expect(result.accepted).toBe(true);
      expect(result.response).toContain('Tomatoes');
      expect(result.response).toContain('9.00');
    });

    it('should make counter offers for excessive discounts', () => {
      const originalPrice = 10.00;
      const customerOffer = 7.00; // 30% discount, too high

      const result = personalityService.getNegotiationResponse(
        originalPrice,
        customerOffer,
        'Tomatoes'
      );

      expect(result.accepted).toBe(false);
      expect(result.counterOffer).toBeDefined();
      expect(result.counterOffer).toBeGreaterThan(customerOffer);
      expect(result.counterOffer).toBeLessThan(originalPrice);
      expect(result.response).toContain('Tomatoes');
    });

    it('should calculate counter offers within max discount range', () => {
      const originalPrice = 10.00;
      const customerOffer = 5.00; // 50% discount, way too high

      const result = personalityService.getNegotiationResponse(
        originalPrice,
        customerOffer,
        'Tomatoes'
      );

      expect(result.accepted).toBe(false);
      expect(result.counterOffer).toBeDefined();
      
      // Counter offer should be at max 15% discount (85% of original)
      const expectedMaxCounterOffer = originalPrice * 0.85;
      expect(result.counterOffer).toBeCloseTo(expectedMaxCounterOffer, 2);
    });
  });

  describe('getUpsellSuggestion', () => {
    it('should sometimes return upsell suggestions', () => {
      let foundUpsell = false;
      
      // Test multiple times due to randomness
      for (let i = 0; i < 50; i++) {
        const suggestion = personalityService.getUpsellSuggestion(
          'Tomatoes',
          'Lettuce',
          mockContext
        );
        
        if (suggestion) {
          foundUpsell = true;
          expect(suggestion).toContain('Tomatoes');
          expect(suggestion).toContain('Lettuce');
          break;
        }
      }

      // Should find at least one upsell in 50 tries
      expect(foundUpsell).toBe(true);
    });

    it('should sometimes return null (no upsell)', () => {
      let foundNull = false;
      
      // Test multiple times due to randomness
      for (let i = 0; i < 50; i++) {
        const suggestion = personalityService.getUpsellSuggestion(
          'Tomatoes',
          'Lettuce',
          mockContext
        );
        
        if (suggestion === null) {
          foundNull = true;
          break;
        }
      }

      // Should find at least one null in 50 tries
      expect(foundNull).toBe(true);
    });
  });

  describe('personality traits consistency', () => {
    it('should maintain consistent personality traits across methods', () => {
      const personality = personalityService.getCurrentPersonality();

      // Friendly Farmer should be consistently warm and helpful
      expect(personality.traits.friendliness).toBeGreaterThanOrEqual(8);
      expect(personality.traits.helpfulness).toBeGreaterThanOrEqual(8);
      expect(personality.traits.formality).toBeLessThanOrEqual(4); // Casual
      expect(personality.responseStyle.tone).toBe('warm');
    });

    it('should reflect personality in negotiation willingness', () => {
      const personality = personalityService.getCurrentPersonality();

      // Friendly Farmer should be moderately willing to negotiate
      expect(personality.negotiationStyle.willingness).toBeGreaterThanOrEqual(6);
      expect(personality.negotiationStyle.flexibility).toBeGreaterThanOrEqual(5);
    });

    it('should reflect personality in upsell approach', () => {
      const personality = personalityService.getCurrentPersonality();

      // Friendly Farmer should use educational approach
      expect(personality.upsellStyle.approach).toBe('educational');
      expect(personality.upsellStyle.frequency).toBeGreaterThanOrEqual(4);
      expect(personality.upsellStyle.frequency).toBeLessThanOrEqual(6); // Moderate
    });
  });
});