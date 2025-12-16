/**
 * Agent Core Tests
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AgentCore, AgentCoreConfig } from '../../src/core/AgentCore';
import { SessionManager } from '../../src/core/SessionManager';
import { NLPService } from '../../src/nlp/NLPService';
import { InventoryService } from '../../src/inventory/InventoryService';
import { PersonalityService } from '../../src/personality/PersonalityService';
import { 
  ConversationSession, 
  BusinessContext, 
  Intent, 
  Product,
  ConversationContext,
  CustomerPreferences
} from '../../src/types/core';
import { StoreIntent } from '../../src/nlp/types';

// Mock dependencies
vi.mock('../../src/nlp/NLPService');
vi.mock('../../src/inventory/InventoryService');
vi.mock('../../src/personality/PersonalityService');
vi.mock('../../src/core/SessionManager');

describe('AgentCore', () => {
  let agentCore: AgentCore;
  let mockNLPService: vi.Mocked<NLPService>;
  let mockInventoryService: vi.Mocked<InventoryService>;
  let mockSessionManager: vi.Mocked<SessionManager>;
  let mockPersonalityService: vi.Mocked<PersonalityService>;

  const mockSession: ConversationSession = {
    sessionId: 'test-session-123',
    customerId: 'customer-456',
    startTime: new Date('2024-01-01T10:00:00Z'),
    lastActivity: new Date('2024-01-01T10:05:00Z'),
    context: {
      entities: {},
      conversationHistory: [],
      preferences: {
        language: 'en',
        communicationStyle: 'casual',
        favoriteCategories: [],
        dietaryRestrictions: []
      } as CustomerPreferences,
      negotiationHistory: [],
      upsellAttempts: []
    } as ConversationContext,
    cart: [],
    status: 'active'
  };

  const mockProducts: Product[] = [
    {
      id: 'tomato-1',
      name: 'Fresh Tomatoes',
      description: 'Locally grown red tomatoes',
      category: 'vegetables',
      unit: 'lb',
      basePrice: 3.50,
      stockQuantity: 25,
      tags: ['fresh', 'local'],
      sellable: true
    },
    {
      id: 'lettuce-1',
      name: 'Green Lettuce',
      description: 'Crisp green lettuce heads',
      category: 'vegetables',
      unit: 'head',
      basePrice: 2.25,
      stockQuantity: 15,
      tags: ['fresh', 'organic'],
      sellable: true
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockNLPService = vi.mocked(new NLPService({} as any));
    mockInventoryService = vi.mocked(new InventoryService());
    mockSessionManager = vi.mocked(new SessionManager());
    mockPersonalityService = vi.mocked(new PersonalityService());

    // Setup default mock implementations
    mockSessionManager.getSession.mockResolvedValue(mockSession);
    mockSessionManager.updateSession.mockResolvedValue();
    mockInventoryService.getSellableProducts.mockResolvedValue(mockProducts);
    mockInventoryService.getProductsByCategory.mockResolvedValue(mockProducts);
    mockInventoryService.checkAvailability.mockResolvedValue({
      available: true,
      quantity: 25,
      reservedQuantity: 0
    });
    mockPersonalityService.getGreeting.mockReturnValue('Hello! Welcome to our farm store!');
    mockPersonalityService.getFarewell.mockReturnValue('Thank you for visiting!');

    const config: AgentCoreConfig = {
      nlpService: mockNLPService,
      inventoryService: mockInventoryService,
      sessionManager: mockSessionManager,
      personalityService: mockPersonalityService
    };

    agentCore = new AgentCore(config);
  });

  describe('initialization', () => {
    it('should initialize with all required services', () => {
      expect(agentCore).toBeDefined();
    });

    it('should create default personality service if not provided', () => {
      const configWithoutPersonality: AgentCoreConfig = {
        nlpService: mockNLPService,
        inventoryService: mockInventoryService,
        sessionManager: mockSessionManager
      };

      const coreWithoutPersonality = new AgentCore(configWithoutPersonality);
      expect(coreWithoutPersonality).toBeDefined();
    });
  });

  describe('session management', () => {
    it('should initialize a new session', async () => {
      const sessionInfo = {
        sessionId: 'new-session-123',
        customerId: 'customer-456',
        startTime: new Date(),
        expiresAt: new Date()
      };

      mockSessionManager.createSession.mockResolvedValue(sessionInfo);

      const result = await agentCore.initializeSession('customer-456');

      expect(mockSessionManager.createSession).toHaveBeenCalledWith('customer-456');
      expect(result).toEqual(sessionInfo);
    });

    it('should end a session', async () => {
      await agentCore.endSession('test-session-123');

      expect(mockSessionManager.endSession).toHaveBeenCalledWith('test-session-123');
    });

    it('should generate welcome message with featured products', async () => {
      const result = await agentCore.getWelcomeMessage('test-session-123');

      expect(result.text).toBe('Hello! Welcome to our farm store!');
      expect(result.suggestions).toContain('What products are available?');
      expect(result.products).toHaveLength(2);
      expect(result.products![0].name).toBe('Fresh Tomatoes');
    });
  });

  describe('message processing', () => {
    beforeEach(() => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.BROWSE_PRODUCTS,
          confidence: 0.9,
          entities: []
        },
        response: 'Here are our available products',
        confidence: 0.9
      });
    });

    it('should process a message successfully', async () => {
      const result = await agentCore.processMessage('test-session-123', 'Show me your products');

      expect(mockSessionManager.getSession).toHaveBeenCalledWith('test-session-123');
      expect(mockNLPService.processMessage).toHaveBeenCalled();
      expect(result.text).toContain('Here are our');
      expect(result.metadata.intent).toBe(StoreIntent.BROWSE_PRODUCTS);
    });

    it('should handle session not found error', async () => {
      mockSessionManager.getSession.mockResolvedValue(null);

      const result = await agentCore.processMessage('invalid-session', 'Hello');

      expect(result.text).toContain('trouble processing');
      expect(result.metadata.intent).toBe('error');
    });

    it('should add messages to conversation history', async () => {
      await agentCore.processMessage('test-session-123', 'Show me products');

      expect(mockSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          context: expect.objectContaining({
            conversationHistory: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Show me products'
              }),
              expect.objectContaining({
                role: 'agent'
              })
            ])
          })
        })
      );
    });
  });

  describe('intent handling', () => {
    it('should handle browse products intent', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.BROWSE_PRODUCTS,
          confidence: 0.9,
          entities: [{ type: 'product_category', value: 'vegetables', confidence: 0.8 }]
        },
        response: 'Here are our vegetables',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Show me vegetables');

      expect(mockInventoryService.getProductsByCategory).toHaveBeenCalledWith('vegetables', true);
      expect(result.text).toContain('vegetables');
      expect(result.products).toHaveLength(2);
    });

    it('should handle product inquiry intent', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.PRODUCT_INQUIRY,
          confidence: 0.9,
          entities: [{ type: 'product_name', value: 'tomatoes', confidence: 0.8 }]
        },
        response: 'Here is information about tomatoes',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Tell me about tomatoes');

      expect(result.text).toContain('Fresh Tomatoes');
      expect(result.text).toContain('$3.50');
      expect(result.products).toHaveLength(1);
      expect(result.actions).toContainEqual({
        type: 'add-to-cart',
        productId: 'tomato-1'
      });
    });

    it('should handle price check intent', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.PRICE_CHECK,
          confidence: 0.9,
          entities: [{ type: 'product_name', value: 'lettuce', confidence: 0.8 }]
        },
        response: 'Here is the price for lettuce',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'How much is lettuce?');

      expect(result.text).toContain('Green Lettuce');
      expect(result.text).toContain('$2.25');
      expect(result.suggestions).toContain('Add to cart');
    });

    it('should handle add to cart intent', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.ADD_TO_CART,
          confidence: 0.9,
          entities: [
            { type: 'product_name', value: 'tomatoes', confidence: 0.8 },
            { type: 'quantity', value: '2', confidence: 0.9 }
          ]
        },
        response: 'Adding tomatoes to cart',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Add 2 tomatoes to cart');

      expect(result.text).toContain('Added 2');
      expect(result.text).toContain('Fresh Tomatoes');
      expect(result.text).toContain('$7.00'); // 2 * $3.50
      expect(result.suggestions).toContain('Checkout');
    });

    it('should handle insufficient stock for add to cart', async () => {
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: false,
        quantity: 1,
        reservedQuantity: 0,
        alternatives: [mockProducts[1]]
      });

      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.ADD_TO_CART,
          confidence: 0.9,
          entities: [
            { type: 'product_name', value: 'tomatoes', confidence: 0.8 },
            { type: 'quantity', value: '10', confidence: 0.9 }
          ]
        },
        response: 'Adding tomatoes to cart',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Add 10 tomatoes to cart');

      expect(result.text).toContain('only have 1');
      expect(result.suggestions).toContain('Add 1 to cart');
      expect(result.products).toHaveLength(1); // Alternative product
    });

    it('should handle negotiation intent', async () => {
      mockPersonalityService.getNegotiationResponse.mockReturnValue({
        response: 'I can do $3.00 for Fresh Tomatoes',
        counterOffer: 3.00,
        accepted: false
      });

      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.NEGOTIATE_PRICE,
          confidence: 0.9,
          entities: [
            { type: 'product_name', value: 'tomatoes', confidence: 0.8 },
            { type: 'price', value: '2.50', confidence: 0.9 }
          ]
        },
        response: 'Negotiating price for tomatoes',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Can you do $2.50 for tomatoes?');

      expect(mockPersonalityService.getNegotiationResponse).toHaveBeenCalledWith(3.50, 2.50, 'Fresh Tomatoes');
      expect(result.text).toContain('I can do $3.00');
      expect(result.products![0].price).toBe(3.00);
    });

    it('should handle greeting intent', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.GREETING,
          confidence: 0.9,
          entities: []
        },
        response: 'Hello there!',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Hello');

      expect(result.text).toBe('Hello! Welcome to our farm store!');
      expect(result.suggestions).toContain('What products do you have?');
    });

    it('should handle farewell intent', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.FAREWELL,
          confidence: 0.9,
          entities: []
        },
        response: 'Goodbye!',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Goodbye');

      expect(result.text).toBe('Thank you for visiting!');
    });

    it('should handle unknown intent with NLP fallback', async () => {
      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.UNKNOWN,
          confidence: 0.3,
          entities: []
        },
        response: 'I can help you find products',
        confidence: 0.3
      });

      mockNLPService.generateResponse.mockResolvedValue('I can help you find what you need');

      const result = await agentCore.processMessage('test-session-123', 'Something unclear');

      expect(mockNLPService.generateResponse).toHaveBeenCalled();
      expect(result.text).toContain('I can help you find what you need');
      expect(result.suggestions).toContain('Show me products');
    });
  });

  describe('error handling', () => {
    it('should handle NLP service errors gracefully', async () => {
      mockNLPService.processMessage.mockRejectedValue(new Error('NLP service error'));

      const result = await agentCore.processMessage('test-session-123', 'Hello');

      expect(result.text).toContain('trouble processing');
      expect(result.metadata.intent).toBe('error');
    });

    it('should handle inventory service errors gracefully', async () => {
      mockInventoryService.getSellableProducts.mockRejectedValue(new Error('Inventory error'));

      mockNLPService.processMessage.mockResolvedValue({
        intent: {
          name: StoreIntent.BROWSE_PRODUCTS,
          confidence: 0.9,
          entities: []
        },
        response: 'Here are our products',
        confidence: 0.9
      });

      const result = await agentCore.processMessage('test-session-123', 'Show products');

      // Should still return a response, even if inventory fails
      expect(result.text).toBeDefined();
    });
  });

  describe('business context building', () => {
    it('should build complete business context', async () => {
      // This is tested indirectly through message processing
      await agentCore.processMessage('test-session-123', 'Show products');

      expect(mockInventoryService.getSellableProducts).toHaveBeenCalled();
      expect(mockNLPService.processMessage).toHaveBeenCalledWith(
        'Show products',
        mockSession.context,
        expect.objectContaining({
          inventory: mockProducts,
          promotions: [],
          sessionContext: mockSession.context
        })
      );
    });
  });
});