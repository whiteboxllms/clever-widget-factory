/**
 * Unit tests for LocalProvider
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { LocalProvider } from '@/nlp/providers/LocalProvider';
import { ConversationContext, BusinessContext } from '@/types/core';
import { LocalProviderConfig, StoreIntent } from '@/nlp/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout
vi.stubGlobal('AbortSignal', {
  timeout: vi.fn(() => ({
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
});

describe('LocalProvider', () => {
  let localProvider: LocalProvider;
  let mockConfig: LocalProviderConfig;
  let mockContext: ConversationContext;
  let mockBusinessContext: BusinessContext;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    mockConfig = {
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3.1:8b',
      maxTokens: 500,
      temperature: 0.7
    };

    localProvider = new LocalProvider(mockConfig);

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
      expect(localProvider).toBeDefined();
    });

    it('should return zero cost for local inference', () => {
      const cost = localProvider.getEstimatedCostPerRequest();
      expect(cost).toBe(0);
    });
  });

  describe('connection testing', () => {
    it('should test connection successfully when service is available', async () => {
      // Mock successful response with models
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { name: 'llama3.1:8b' },
            { name: 'mistral:7b' }
          ]
        })
      });

      const result = await localProvider.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should return false when service is not available', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await localProvider.testConnection();

      expect(result).toBe(false);
    });

    it('should return false when model is not available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { name: 'different-model:7b' }
          ]
        })
      });

      const result = await localProvider.testConnection();

      expect(result).toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await localProvider.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('availability checking', () => {
    it('should check availability and cache result', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [{ name: 'llama3.1:8b' }]
        })
      });

      const result1 = await localProvider.isAvailable();
      const result2 = await localProvider.isAvailable();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // Should only call once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('intent classification', () => {

    it('should classify intent successfully', async () => {
      // Mock service availability
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              intent: 'greeting',
              confidence: 0.9,
              reasoning: 'Customer is greeting'
            })
          })
        });

      const result = await localProvider.classifyIntent('Hello there!', mockContext);

      expect(result.intent.name).toBe('greeting');
      expect(result.confidence).toBe(0.9);
      expect(result.metadata?.provider).toBe('local');
      expect(result.metadata?.cost).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2); // availability check + generation
    });

    it('should handle malformed JSON response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'invalid json response'
          })
        });

      const result = await localProvider.classifyIntent('Hello', mockContext);

      expect(result.intent.name).toBe(StoreIntent.UNKNOWN);
      expect(result.confidence).toBe(0.3);
    });

    it('should throw error when service is unavailable', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503
      });

      await expect(localProvider.classifyIntent('Hello', mockContext))
        .rejects.toThrow('Local AI service not available');
    });

    it('should handle generation API errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        });

      await expect(localProvider.classifyIntent('Hello', mockContext))
        .rejects.toThrow('Local AI request failed: 500 Internal Server Error');
    });
  });

  describe('entity extraction', () => {

    it('should extract entities successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              entities: [
                {
                  type: 'quantity',
                  value: '2',
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
          })
        });

      const result = await localProvider.extractEntities('I need 2 kg of tomatoes');

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].type).toBe('quantity');
      expect(result.entities[0].value).toBe('2');
      expect(result.confidence).toBe(0.85);
      expect(result.metadata?.provider).toBe('local');
      expect(result.metadata?.cost).toBe(0);
    });

    it('should handle empty entity response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              entities: [],
              confidence: 0.0
            })
          })
        });

      const result = await localProvider.extractEntities('Hello how are you?');

      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
    });

    it('should handle malformed entity response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'malformed response'
          })
        });

      const result = await localProvider.extractEntities('Test message');

      expect(result.entities).toHaveLength(0);
      expect(result.confidence).toBe(0.0);
    });
  });

  describe('response generation', () => {

    it('should generate appropriate response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: "Hello! Welcome to our sari-sari store! How can I help you today?"
          })
        });

      const result = await localProvider.generateResponse(
        'greeting', 
        mockBusinessContext, 
        'Hello there!'
      );

      expect(result.response).toContain('Hello');
      expect(result.confidence).toBe(0.8);
      expect(result.metadata?.provider).toBe('local');
      expect(result.metadata?.cost).toBe(0);
      expect(result.metadata?.modelId).toBe('llama3.1:8b');
    });

    it('should include product information in generation request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: "We have fresh tomatoes available for ₱5.99/kg. Would you like to know more about them?"
          })
        });

      await localProvider.generateResponse('browse_products', mockBusinessContext);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Check the generation request
      const generationCall = mockFetch.mock.calls[1];
      expect(generationCall[0]).toBe('http://localhost:11434/api/generate');
      expect(generationCall[1].method).toBe('POST');
      
      const requestBody = JSON.parse(generationCall[1].body);
      expect(requestBody.prompt).toContain('Tomatoes');
      expect(requestBody.prompt).toContain('₱5.99');
    });

    it('should handle empty response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: ""
          })
        });

      const result = await localProvider.generateResponse('greeting', mockBusinessContext);

      expect(result.response).toBe("");
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('endpoint management', () => {
    it('should add additional endpoints', () => {
      const newEndpoint = {
        baseUrl: 'http://localhost:1234',
        model: 'phi3:mini',
        available: true,
        lastChecked: Date.now(),
        capabilities: {
          chat: true,
          completion: true,
          embedding: false
        }
      };

      localProvider.addEndpoint('secondary', newEndpoint);
      
      const status = localProvider.getEndpointStatus();
      expect(status.secondary).toEqual(newEndpoint);
    });

    it('should remove endpoints (except primary)', () => {
      const newEndpoint = {
        baseUrl: 'http://localhost:1234',
        model: 'phi3:mini',
        available: true,
        lastChecked: Date.now(),
        capabilities: {
          chat: true,
          completion: true,
          embedding: false
        }
      };

      localProvider.addEndpoint('secondary', newEndpoint);
      localProvider.removeEndpoint('secondary');
      
      const status = localProvider.getEndpointStatus();
      expect(status.secondary).toBeUndefined();
      expect(status.primary).toBeDefined(); // Primary should remain
    });

    it('should not remove primary endpoint', () => {
      localProvider.removeEndpoint('primary');
      
      const status = localProvider.getEndpointStatus();
      expect(status.primary).toBeDefined();
    });

    it('should get endpoint status', () => {
      const status = localProvider.getEndpointStatus();
      
      expect(status.primary).toBeDefined();
      expect(status.primary.baseUrl).toBe('http://localhost:11434');
      expect(status.primary.model).toBe('llama3.1:8b');
    });
  });

  describe('prompt building', () => {
    it('should build appropriate intent classification prompt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              intent: 'greeting',
              confidence: 0.9,
              reasoning: 'test'
            })
          })
        });

      await localProvider.classifyIntent('Hello', mockContext);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const generationCall = mockFetch.mock.calls[1];
      const requestBody = JSON.parse(generationCall[1].body);

      expect(requestBody.prompt).toContain('Available intents:');
      expect(requestBody.prompt).toContain('Customer message:');
      expect(requestBody.prompt).toContain('Context:');
      expect(requestBody.prompt).toContain('JSON object');
      expect(requestBody.options.stop).toContain('</response>');
    });

    it('should build appropriate entity extraction prompt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: JSON.stringify({
              entities: [],
              confidence: 0.0
            })
          })
        });

      await localProvider.extractEntities('Test message');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const generationCall = mockFetch.mock.calls[1];
      const requestBody = JSON.parse(generationCall[1].body);

      expect(requestBody.prompt).toContain('Available entity types:');
      expect(requestBody.prompt).toContain('Customer message:');
      expect(requestBody.prompt).toContain('JSON object');
    });

    it('should build appropriate response generation prompt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            models: [{ name: 'llama3.1:8b' }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: "Test response"
          })
        });

      await localProvider.generateResponse('greeting', mockBusinessContext, 'Hello');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const generationCall = mockFetch.mock.calls[1];
      const requestBody = JSON.parse(generationCall[1].body);

      expect(requestBody.prompt).toContain('Intent: greeting');
      expect(requestBody.prompt).toContain('Original message: "Hello"');
      expect(requestBody.prompt).toContain('Available products:');
      expect(requestBody.prompt).toContain('Aling Maria');
      expect(requestBody.prompt).toContain('Guidelines:');
    });
  });
});