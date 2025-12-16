/**
 * Unit tests for BedrockProvider
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BedrockProvider } from '@/nlp/providers/BedrockProvider';
import { ConversationContext, BusinessContext } from '@/types/core';
import { StoreIntent, EntityType } from '@/nlp/types';

// Mock the AWS SDK
const mockSend = vi.fn();
const mockBedrockClient = {
  send: mockSend
};

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(() => mockBedrockClient),
  InvokeModelCommand: vi.fn()
}));

// Mock the config
vi.mock('@/config', () => ({
  config: {
    aws: {
      region: 'us-east-1',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret'
    },
    bedrock: {
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      maxTokens: 1000,
      temperature: 0.7
    }
  }
}));

describe('BedrockProvider', () => {
  let bedrockProvider: BedrockProvider;
  let mockContext: ConversationContext;
  let mockBusinessContext: BusinessContext;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    bedrockProvider = new BedrockProvider();

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
        }
      ],
      promotions: [],
      sessionContext: mockContext
    };
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bedrockProvider).toBeDefined();
    });

    it('should calculate estimated cost per request', () => {
      const cost = bedrockProvider.getEstimatedCostPerRequest();
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01); // Should be very small
    });
  });

  describe('intent classification', () => {
    it('should classify intent successfully', async () => {
      // Mock successful Bedrock response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              intent: 'greeting',
              confidence: 0.95,
              reasoning: 'Customer is greeting the assistant'
            })
          }]
        }))
      });

      const result = await bedrockProvider.classifyIntent('Hello there!', mockContext);

      expect(result.intent.name).toBe('greeting');
      expect(result.confidence).toBe(0.95);
      expect(result.metadata?.provider).toBe('bedrock');
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should handle malformed JSON response gracefully', async () => {
      // Mock malformed response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'invalid json response'
          }]
        }))
      });

      const result = await bedrockProvider.classifyIntent('Hello', mockContext);

      expect(result.intent.name).toBe(StoreIntent.UNKNOWN);
      expect(result.confidence).toBe(0.3);
    });

    it('should handle Bedrock API errors', async () => {
      mockSend.mockRejectedValue(new Error('Bedrock API error'));

      await expect(bedrockProvider.classifyIntent('Hello', mockContext))
        .rejects.toThrow('Bedrock API error');
    });
  });

  describe('entity extraction', () => {
    it('should extract entities successfully', async () => {
      // Mock successful entity extraction response
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              entities: [
                {
                  type: 'quantity',
                  value: '2',
                  confidence: 0.9
                },
                {
                  type: 'unit',
                  value: 'kg',
                  confidence: 0.9
                },
                {
                  type: 'product_name',
                  value: 'tomatoes',
                  confidence: 0.8
                }
              ],
              confidence: 0.85
            })
          }]
        }))
      });

      const result = await bedrockProvider.extractEntities('I need 2 kg of tomatoes');

      expect(result.entities).toHaveLength(3);
      expect(result.entities[0].type).toBe('quantity');
      expect(result.entities[0].value).toBe('2');
      expect(result.confidence).toBe(0.85);
      expect(result.metadata?.provider).toBe('bedrock');
    });

    it('should handle empty entity response', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              entities: [],
              confidence: 0.0
            })
          }]
        }))
      });

      const result = await bedrockProvider.extractEntities('Hello how are you?');

      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
    });

    it('should handle malformed entity response', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: 'malformed response'
          }]
        }))
      });

      const result = await bedrockProvider.extractEntities('Test message');

      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
    });
  });

  describe('response generation', () => {
    it('should generate appropriate response', async () => {
      const expectedResponse = "Hello! Welcome to our farm store! How can I help you find the freshest produce today?";
      
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: expectedResponse
          }]
        }))
      });

      const result = await bedrockProvider.generateResponse(
        'greeting', 
        mockBusinessContext, 
        'Hello there!'
      );

      expect(result.response).toBe(expectedResponse);
      expect(result.confidence).toBe(0.9);
      expect(result.metadata?.provider).toBe('bedrock');
      expect(result.metadata?.modelId).toBeDefined();
    });

    it('should include product information in context', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: "We have fresh tomatoes available for $5.99/kg. Would you like to know more about them?"
          }]
        }))
      });

      const result = await bedrockProvider.generateResponse(
        'browse_products',
        mockBusinessContext
      );

      expect(result.response).toContain('tomatoes');
      expect(mockSend).toHaveBeenCalledOnce();
      
      // Verify the prompt includes product information
      expect(mockSend).toHaveBeenCalledOnce();
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.body).toBeDefined();
      if (callArgs.body) {
        const body = JSON.parse(callArgs.body);
        expect(body.messages[0].content).toContain('Tomatoes');
        expect(body.messages[0].content).toContain('$5.99');
      }
    });

    it('should handle empty response', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: ""
          }]
        }))
      });

      const result = await bedrockProvider.generateResponse('greeting', mockBusinessContext);

      expect(result.response).toBe("");
      expect(result.confidence).toBe(0.9);
    });
  });

  describe('connection testing', () => {
    it('should test connection successfully', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: "OK"
          }]
        }))
      });

      const result = await bedrockProvider.testConnection();

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should handle connection test failure', async () => {
      mockSend.mockRejectedValue(new Error('Connection failed'));

      const result = await bedrockProvider.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invalid response format', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          // Missing content field
          error: 'Invalid request'
        }))
      });

      await expect(bedrockProvider.classifyIntent('test', mockContext))
        .rejects.toThrow('Invalid response format from Bedrock');
    });

    it('should handle network errors', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      await expect(bedrockProvider.extractEntities('test'))
        .rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      mockSend.mockRejectedValue(new Error('Request timeout'));

      await expect(bedrockProvider.generateResponse('greeting', mockBusinessContext))
        .rejects.toThrow('Request timeout');
    });
  });

  describe('prompt building', () => {
    it('should build appropriate intent classification prompt', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              intent: 'greeting',
              confidence: 0.9,
              reasoning: 'test'
            })
          }]
        }))
      });

      await bedrockProvider.classifyIntent('Hello', mockContext);

      expect(mockSend).toHaveBeenCalledOnce();
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.body).toBeDefined();
      if (callArgs.body) {
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Available intents:');
        expect(prompt).toContain('Customer message:');
        expect(prompt).toContain('Context:');
        expect(prompt).toContain('JSON object');
      }
    });

    it('should build appropriate entity extraction prompt', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: JSON.stringify({
              entities: [],
              confidence: 0.0
            })
          }]
        }))
      });

      await bedrockProvider.extractEntities('Test message');

      expect(mockSend).toHaveBeenCalledOnce();
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.body).toBeDefined();
      if (callArgs.body) {
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Available entity types:');
        expect(prompt).toContain('Customer message:');
        expect(prompt).toContain('JSON object');
      }
    });

    it('should build appropriate response generation prompt', async () => {
      mockSend.mockResolvedValue({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{
            text: "Test response"
          }]
        }))
      });

      await bedrockProvider.generateResponse('greeting', mockBusinessContext, 'Hello');

      expect(mockSend).toHaveBeenCalledOnce();
      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.body).toBeDefined();
      if (callArgs.body) {
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Intent: greeting');
        expect(prompt).toContain('Original message: "Hello"');
        expect(prompt).toContain('Available products:');
        expect(prompt).toContain('Guidelines:');
      }
    });
  });
});