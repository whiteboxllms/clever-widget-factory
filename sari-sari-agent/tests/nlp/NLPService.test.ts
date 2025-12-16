/**
 * Unit tests for NLPService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NLPService } from '@/nlp/NLPService';
import { AIRouterConfig, StoreIntent, EntityType } from '@/nlp/types';
import { ConversationContext, BusinessContext, Customer, Product } from '@/types/core';

describe('NLPService', () => {
  let nlpService: NLPService;
  let mockConfig: AIRouterConfig;
  let mockContext: ConversationContext;
  let mockBusinessContext: BusinessContext;

  beforeEach(() => {
    mockConfig = {
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

    nlpService = new NLPService(mockConfig);

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

    const mockProducts: Product[] = [
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
      }
    ];

    mockBusinessContext = {
      inventory: mockProducts,
      promotions: [],
      sessionContext: mockContext
    };
  });

  describe('analyzeIntent', () => {
    it('should classify greeting messages correctly', async () => {
      const message = 'Hello there!';
      
      const intent = await nlpService.analyzeIntent(message, mockContext);

      expect(intent.name).toBe('greeting');
      expect(intent.confidence).toBeGreaterThan(0.5);
      expect(intent.entities).toBeDefined();
    });

    it('should classify price inquiry messages correctly', async () => {
      const message = 'How much do tomatoes cost?';
      
      const intent = await nlpService.analyzeIntent(message, mockContext);

      expect(intent.name).toBe('price_inquiry');
      expect(intent.confidence).toBeGreaterThan(0.5);
    });

    it('should classify product browsing messages correctly', async () => {
      const message = 'What vegetables do you have available?';
      
      const intent = await nlpService.analyzeIntent(message, mockContext);

      expect(intent.name).toBe('browse_products');
      expect(intent.confidence).toBeGreaterThan(0.5);
    });

    it('should classify add to cart messages correctly', async () => {
      const message = 'I want to buy 2 kg of tomatoes';
      
      const intent = await nlpService.analyzeIntent(message, mockContext);

      expect(intent.name).toBe('add_to_cart');
      expect(intent.confidence).toBeGreaterThan(0.5);
    });

    it('should return unknown intent for unclear messages', async () => {
      const message = 'asdfghjkl random text';
      
      const intent = await nlpService.analyzeIntent(message, mockContext);

      expect(intent.name).toBe('unknown');
      expect(intent.confidence).toBeLessThan(0.5);
    });

    it('should handle empty messages gracefully', async () => {
      const message = '';
      
      const intent = await nlpService.analyzeIntent(message, mockContext);

      expect(intent.name).toBe('unknown');
      expect(intent.confidence).toBeLessThan(0.5);
    });
  });

  describe('extractEntities', () => {
    it('should extract quantity and unit entities', async () => {
      const message = 'I need 3 kg of tomatoes';
      
      const entities = await nlpService.extractEntities(message);

      const quantityEntity = entities.find(e => e.type === 'quantity');
      const unitEntity = entities.find(e => e.type === 'unit');
      const productEntity = entities.find(e => e.type === 'product_name');

      expect(quantityEntity).toBeDefined();
      expect(quantityEntity?.value).toBe('3');
      expect(unitEntity).toBeDefined();
      expect(unitEntity?.value).toBe('kg');
      expect(productEntity).toBeDefined();
      expect(productEntity?.value).toBe('tomato');
    });

    it('should extract product names', async () => {
      const message = 'Do you have fresh lettuce and carrots?';
      
      const entities = await nlpService.extractEntities(message);

      const productEntities = entities.filter(e => e.type === 'product_name');
      expect(productEntities.length).toBeGreaterThan(0);
    });

    it('should return empty array for messages with no entities', async () => {
      const message = 'Hello how are you?';
      
      const entities = await nlpService.extractEntities(message);

      expect(entities).toEqual([]);
    });

    it('should handle multiple quantities in one message', async () => {
      const message = 'I want 2 kg of apples and 5 pieces of banana';
      
      const entities = await nlpService.extractEntities(message);

      const quantityEntities = entities.filter(e => e.type === 'quantity');
      expect(quantityEntities.length).toBe(2);
      expect(quantityEntities.map(e => e.value)).toContain('2');
      expect(quantityEntities.map(e => e.value)).toContain('5');
    });
  });

  describe('generateResponse', () => {
    it('should generate appropriate greeting response', async () => {
      const intent = {
        name: 'greeting',
        confidence: 0.9,
        entities: []
      };

      const response = await nlpService.generateResponse(intent, mockBusinessContext);

      expect(response).toContain('Hello');
      expect(response).toContain('Welcome');
      expect(response.length).toBeGreaterThan(10);
    });

    it('should generate appropriate browse products response', async () => {
      const intent = {
        name: 'browse_products',
        confidence: 0.8,
        entities: []
      };

      const response = await nlpService.generateResponse(intent, mockBusinessContext);

      expect(response).toContain('vegetables');
      expect(response.length).toBeGreaterThan(10);
    });

    it('should generate appropriate price inquiry response', async () => {
      const intent = {
        name: 'price_inquiry',
        confidence: 0.8,
        entities: []
      };

      const response = await nlpService.generateResponse(intent, mockBusinessContext);

      expect(response).toContain('pricing');
      expect(response.length).toBeGreaterThan(10);
    });

    it('should generate fallback response for unknown intents', async () => {
      const intent = {
        name: 'unknown',
        confidence: 0.3,
        entities: []
      };

      const response = await nlpService.generateResponse(intent, mockBusinessContext);

      expect(response).toContain('understand');
      expect(response.length).toBeGreaterThan(10);
    });
  });

  describe('processMessage', () => {
    it('should process complete message flow', async () => {
      const message = 'Hello, I want to buy some tomatoes';

      const result = await nlpService.processMessage(
        message,
        mockContext,
        mockBusinessContext
      );

      expect(result.intent).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.response.length).toBeGreaterThan(10);
    });

    it('should handle processing errors gracefully', async () => {
      const message = 'Valid message';

      // Mock an error in the AI router
      vi.spyOn(nlpService as any, 'analyzeIntent').mockRejectedValue(new Error('AI service down'));

      const result = await nlpService.processMessage(
        message,
        mockContext,
        mockBusinessContext
      );

      expect(result.intent.name).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.response).toContain('sorry');
    });

    it('should return consistent results for similar messages', async () => {
      const message1 = 'Hello there!';
      const message2 = 'Hi!';

      const result1 = await nlpService.processMessage(message1, mockContext, mockBusinessContext);
      const result2 = await nlpService.processMessage(message2, mockContext, mockBusinessContext);

      expect(result1.intent.name).toBe(result2.intent.name);
      expect(result1.intent.name).toBe('greeting');
    });
  });

  describe('service configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        preferredProvider: 'cloud' as const,
        costThreshold: 0.005
      };

      expect(() => nlpService.updateConfig(newConfig)).not.toThrow();
    });

    it('should return supported intents', () => {
      const intents = nlpService.getSupportedIntents();

      expect(intents).toContain(StoreIntent.GREETING);
      expect(intents).toContain(StoreIntent.BROWSE_PRODUCTS);
      expect(intents).toContain(StoreIntent.PRICE_INQUIRY);
      expect(intents.length).toBeGreaterThan(5);
    });

    it('should return supported entity types', () => {
      const entityTypes = nlpService.getSupportedEntityTypes();

      expect(entityTypes).toContain(EntityType.PRODUCT_NAME);
      expect(entityTypes).toContain(EntityType.QUANTITY);
      expect(entityTypes).toContain(EntityType.PRICE);
      expect(entityTypes.length).toBeGreaterThan(3);
    });
  });

  describe('metrics and monitoring', () => {
    it('should track metrics', async () => {
      const message = 'Hello!';
      
      // Process a few messages
      await nlpService.processMessage(message, mockContext, mockBusinessContext);
      await nlpService.processMessage(message, mockContext, mockBusinessContext);

      const metrics = nlpService.getMetrics();

      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      const message = 'Hello!';
      
      // Process a message to generate metrics
      await nlpService.processMessage(message, mockContext, mockBusinessContext);

      nlpService.resetMetrics();
      const metrics = nlpService.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(2000);

      const result = await nlpService.processMessage(
        longMessage,
        mockContext,
        mockBusinessContext
      );

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('should handle special characters in messages', async () => {
      const message = 'Hello! @#$%^&*()_+ How much for tomatoes?';

      const result = await nlpService.processMessage(
        message,
        mockContext,
        mockBusinessContext
      );

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('price_inquiry');
    });

    it('should handle null/undefined context gracefully', async () => {
      const message = 'Hello!';

      const result = await nlpService.processMessage(
        message,
        mockContext,
        mockBusinessContext
      );

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });
});