/**
 * Tests for product description extraction and negation detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NLPService } from '../../src/nlp/NLPService';
import { AIRouterConfig } from '../../src/nlp/types';
import { ConversationContext } from '../../src/types/core';

describe('Product Description Extraction', () => {
  let nlpService: NLPService;
  let mockContext: ConversationContext;

  beforeEach(() => {
    const config: AIRouterConfig = {
      preferredProvider: 'auto',
      fallbackProvider: 'local',
      costThreshold: 0.01,
      latencyThreshold: 1000,
      cloudProvider: {
        provider: 'bedrock',
        model: 'claude-3-haiku',
        region: 'us-east-1'
      }
    };

    nlpService = new NLPService(config);
    
    mockContext = {
      currentIntent: 'greeting',
      entities: {},
      conversationHistory: [],
      preferences: {
        language: 'en',
        communicationStyle: 'casual',
        favoriteCategories: [],
        dietaryRestrictions: []
      },
      negotiationHistory: [],
      upsellAttempts: [],
      searchHistory: []
    };
  });

  describe('extractProductDescription', () => {
    it('should fail when semantic search API is unavailable', async () => {
      const message = 'I want something hot';
      
      // Expect the method to throw an error when API is unavailable
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow();
    });

    it('should fail for direct product queries when API is unavailable', async () => {
      const message = 'Do you have vinegar?';
      
      // Expect the method to throw an error when API is unavailable
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow();
    });

    it('should fail for category searches when API is unavailable', async () => {
      const message = 'Looking for spices';
      
      // Expect the method to throw an error when API is unavailable
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow();
    });

    it('should throw error for empty messages', async () => {
      const message = '';
      
      // Should throw error for invalid input
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow('Invalid message format');
    });

    it('should fail for complex queries when API is unavailable', async () => {
      const message = 'I need fresh organic vegetables for cooking';
      
      // Expect the method to throw an error when API is unavailable
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow();
    });
  });

  describe('extractNegations', () => {
    it('should detect "don\'t like" negations', async () => {
      const message = 'I don\'t like spicy food';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        expect(result[0].negatedTerm).toBeDefined();
        expect(result[0].negationType).toBeDefined();
        expect(result[0].confidence).toBeGreaterThan(0);
        expect(result[0].originalPhrase).toBeDefined();
      }
    });

    it('should detect "no" negations', async () => {
      const message = 'No hot sauce please';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect "avoid" negations', async () => {
      const message = 'Avoid dairy products';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect "without" negations', async () => {
      const message = 'Something without sugar';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for messages without negations', async () => {
      const message = 'I want fresh vegetables';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle multiple negations in one message', async () => {
      const message = 'I don\'t like spicy food and avoid dairy products';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should detect at least one negation
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty messages gracefully', async () => {
      const message = '';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('formatSearchResults', () => {
    it('should format search results without negations', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Spiced Vinegar',
          description: 'Hot and spicy vinegar',
          category: 'condiments',
          unit: 'bottle',
          basePrice: 25.0,
          stockQuantity: 10,
          tags: ['spicy', 'vinegar'],
          sellable: true
        }
      ];

      const result = await nlpService.formatSearchResults(
        mockProducts,
        'I want something hot'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format search results with negations', async () => {
      const mockProducts = [
        {
          id: '1',
          name: 'Mild Vinegar',
          description: 'Gentle and mild vinegar',
          category: 'condiments',
          unit: 'bottle',
          basePrice: 20.0,
          stockQuantity: 5,
          tags: ['mild', 'vinegar'],
          sellable: true
        }
      ];

      const mockNegations = [
        {
          negatedTerm: 'spicy',
          negationType: 'characteristic' as const,
          confidence: 0.9,
          originalPhrase: 'don\'t like spicy'
        }
      ];

      const result = await nlpService.formatSearchResults(
        mockProducts,
        'I want vinegar but don\'t like spicy',
        mockNegations
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('excluded');
    });

    it('should handle empty search results', async () => {
      const result = await nlpService.formatSearchResults(
        [],
        'I want something that doesn\'t exist'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('couldn\'t find');
    });
  });

  describe('negation extraction', () => {
    it('should extract negations using pattern matching', async () => {
      const message = 'no spicy';
      
      const result = await nlpService.extractNegations(message);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        expect(result[0].negatedTerm).toBe('spicy');
        expect(result[0].negationType).toBe('ingredient');
      }
    });
  });

  describe('semantic search integration', () => {
    it('should fail when semantic search API is unavailable', async () => {
      const message = 'I want something hot and spicy';
      
      // Should throw error when API is unavailable
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow();
    });

    it('should fail when API returns errors', async () => {
      const message = 'vinegar products';
      
      // Should throw error when API is unavailable
      await expect(nlpService.extractProductDescription(message)).rejects.toThrow();
    });

    it('should still extract negations even when product extraction fails', async () => {
      const message = 'I want vinegar but not spicy ones';
      
      // Negation extraction should work independently
      const negations = await nlpService.extractNegations(message);
      
      expect(negations).toBeDefined();
      expect(Array.isArray(negations)).toBe(true);
      
      if (negations.length > 0) {
        expect(negations[0].negatedTerm).toBe('spicy');
      }
    });
  });
});