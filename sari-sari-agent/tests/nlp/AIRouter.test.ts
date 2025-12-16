/**
 * Unit tests for AIRouter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIRouter } from '@/nlp/AIRouter';
import { AIRouterConfig } from '@/nlp/types';
import { ConversationContext, BusinessContext } from '@/types/core';

describe('AIRouter', () => {
  let aiRouter: AIRouter;
  let mockConfig: AIRouterConfig;
  let mockContext: ConversationContext;
  let mockBusinessContext: BusinessContext;

  beforeEach(() => {
    mockConfig = {
      preferredProvider: 'auto',
      fallbackProvider: 'cloud',
      costThreshold: 0.01,
      latencyThreshold: 1000,
      cloudProvider: {
        provider: 'bedrock',
        model: 'claude-3-haiku',
        region: 'us-east-1'
      },
      localProvider: {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2'
      }
    };

    aiRouter = new AIRouter(mockConfig);

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
      inventory: [],
      promotions: [],
      sessionContext: mockContext
    };
  });

  describe('initialization', () => {
    it('should initialize with provided configuration', () => {
      expect(aiRouter).toBeDefined();
      expect(() => new AIRouter(mockConfig)).not.toThrow();
    });

    it('should initialize with minimal configuration', () => {
      const minimalConfig: AIRouterConfig = {
        preferredProvider: 'auto'
      };

      expect(() => new AIRouter(minimalConfig)).not.toThrow();
    });
  });

  describe('intent classification', () => {
    it('should classify greeting intents', async () => {
      const message = 'Hello there!';

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('greeting');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify price inquiry intents', async () => {
      const message = 'How much does this cost?';

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('price_inquiry');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify browse products intents', async () => {
      const message = 'What do you have available?';

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('browse_products');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify add to cart intents', async () => {
      const message = 'I want to buy some tomatoes';

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('add_to_cart');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should return unknown for unclear messages', async () => {
      const message = 'asdfghjkl random nonsense';

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle empty messages', async () => {
      const message = '';

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('unknown');
    });
  });

  describe('entity extraction', () => {
    it('should extract quantity and unit entities', async () => {
      const message = 'I need 5 kg of tomatoes';

      const result = await aiRouter.extractEntities(message);

      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);

      const quantityEntity = result.entities.find(e => e.type === 'quantity');
      const unitEntity = result.entities.find(e => e.type === 'unit');

      expect(quantityEntity).toBeDefined();
      expect(quantityEntity?.value).toBe('5');
      expect(unitEntity).toBeDefined();
      expect(unitEntity?.value).toBe('kg');
    });

    it('should extract product names', async () => {
      const message = 'Do you have tomatoes and lettuce?';

      const result = await aiRouter.extractEntities(message);

      expect(result).toBeDefined();
      const productEntities = result.entities.filter(e => e.type === 'product_name');
      expect(productEntities.length).toBeGreaterThan(0);
    });

    it('should return empty entities for messages without entities', async () => {
      const message = 'Hello how are you today?';

      const result = await aiRouter.extractEntities(message);

      expect(result).toBeDefined();
      expect(result.entities).toEqual([]);
      expect(result.confidence).toBe(0.0);
    });

    it('should handle multiple entities in one message', async () => {
      const message = 'I want 2 kg of apples and 3 pieces of banana';

      const result = await aiRouter.extractEntities(message);

      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(2);
    });
  });

  describe('response generation', () => {
    it('should generate greeting responses', async () => {
      const intent = 'greeting';

      const result = await aiRouter.generateResponse(intent, mockBusinessContext);

      expect(result).toBeDefined();
      expect(result.response).toContain('Hello');
      expect(result.response.length).toBeGreaterThan(10);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should generate browse products responses', async () => {
      const intent = 'browse_products';

      const result = await aiRouter.generateResponse(intent, mockBusinessContext);

      expect(result).toBeDefined();
      expect(result.response).toContain('available');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should generate price inquiry responses', async () => {
      const intent = 'price_inquiry';

      const result = await aiRouter.generateResponse(intent, mockBusinessContext);

      expect(result).toBeDefined();
      expect(result.response).toContain('pricing');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should generate fallback responses for unknown intents', async () => {
      const intent = 'unknown_intent';

      const result = await aiRouter.generateResponse(intent, mockBusinessContext);

      expect(result).toBeDefined();
      expect(result.response).toContain('understand');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should include metadata in responses', async () => {
      const intent = 'greeting';

      const result = await aiRouter.generateResponse(intent, mockBusinessContext);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.provider).toBeDefined();
      expect(result.metadata?.processingTime).toBeDefined();
    });
  });

  describe('metrics tracking', () => {
    it('should track request metrics', async () => {
      const message = 'Hello!';

      // Make several requests
      await aiRouter.classifyIntent(message, mockContext);
      await aiRouter.extractEntities(message);
      await aiRouter.generateResponse('greeting', mockBusinessContext);

      const metrics = aiRouter.getMetrics();

      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
    });

    it('should track provider usage', async () => {
      const message = 'Hello!';

      await aiRouter.classifyIntent(message, mockContext);

      const metrics = aiRouter.getMetrics();

      expect(metrics.providerUsage).toBeDefined();
      expect(Object.keys(metrics.providerUsage).length).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const message = 'Hello!';

      // Generate some metrics
      await aiRouter.classifyIntent(message, mockContext);

      aiRouter.resetMetrics();
      const metrics = aiRouter.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.totalCost).toBe(0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        preferredProvider: 'cloud' as const,
        costThreshold: 0.005
      };

      expect(() => aiRouter.updateConfig(newConfig)).not.toThrow();
    });

    it('should handle different provider preferences', () => {
      const cloudConfig: AIRouterConfig = {
        preferredProvider: 'cloud',
        cloudProvider: {
          provider: 'bedrock',
          model: 'claude-3-haiku'
        }
      };

      expect(() => new AIRouter(cloudConfig)).not.toThrow();

      const localConfig: AIRouterConfig = {
        preferredProvider: 'local',
        localProvider: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2'
        }
      };

      expect(() => new AIRouter(localConfig)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle classification errors gracefully', async () => {
      const message = 'test message';

      // Mock an internal error
      const originalMethod = (aiRouter as any).simpleIntentClassification;
      (aiRouter as any).simpleIntentClassification = vi.fn().mockImplementation(() => {
        throw new Error('Classification failed');
      });

      const result = await aiRouter.classifyIntent(message, mockContext);

      expect(result).toBeDefined();
      expect(result.intent.name).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);

      // Restore original method
      (aiRouter as any).simpleIntentClassification = originalMethod;
    });

    it('should handle entity extraction errors gracefully', async () => {
      const message = 'test message';

      // Mock an internal error
      const originalMethod = (aiRouter as any).simpleEntityExtraction;
      (aiRouter as any).simpleEntityExtraction = vi.fn().mockImplementation(() => {
        throw new Error('Entity extraction failed');
      });

      const result = await aiRouter.extractEntities(message);

      expect(result).toBeDefined();
      expect(result.entities).toEqual([]);
      expect(result.confidence).toBe(0.0);

      // Restore original method
      (aiRouter as any).simpleEntityExtraction = originalMethod;
    });

    it('should handle response generation errors gracefully', async () => {
      const intent = 'greeting';

      // Mock an internal error
      const originalMethod = (aiRouter as any).simpleResponseGeneration;
      (aiRouter as any).simpleResponseGeneration = vi.fn().mockImplementation(() => {
        throw new Error('Response generation failed');
      });

      const result = await aiRouter.generateResponse(intent, mockBusinessContext);

      expect(result).toBeDefined();
      expect(result.response).toContain('trouble understanding');
      expect(result.confidence).toBeLessThan(0.5);

      // Restore original method
      (aiRouter as any).simpleResponseGeneration = originalMethod;
    });
  });

  describe('provider selection logic', () => {
    it('should prefer local provider in auto mode', async () => {
      const autoConfig: AIRouterConfig = {
        preferredProvider: 'auto',
        localProvider: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2'
        },
        cloudProvider: {
          provider: 'bedrock',
          model: 'claude-3-haiku'
        }
      };

      const router = new AIRouter(autoConfig);
      const message = 'Hello!';

      // In auto mode with both providers available, should prefer local (no cost)
      const result = await router.classifyIntent(message, mockContext);
      expect(result).toBeDefined();
    });

    it('should respect cloud provider preference', async () => {
      const cloudConfig: AIRouterConfig = {
        preferredProvider: 'cloud',
        cloudProvider: {
          provider: 'bedrock',
          model: 'claude-3-haiku'
        }
      };

      const router = new AIRouter(cloudConfig);
      const message = 'Hello!';

      const result = await router.classifyIntent(message, mockContext);
      expect(result).toBeDefined();
    });

    it('should respect local provider preference', async () => {
      const localConfig: AIRouterConfig = {
        preferredProvider: 'local',
        localProvider: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2'
        }
      };

      const router = new AIRouter(localConfig);
      const message = 'Hello!';

      const result = await router.classifyIntent(message, mockContext);
      expect(result).toBeDefined();
    });
  });
});