/**
 * Agent Core - Main orchestration service for the Sari Sari Agent
 * Coordinates NLP, inventory, personality, and session management
 */

import { AgentCore as IAgentCore } from '../types/services';
import { 
  AgentResponse, 
  SessionInfo, 
  ConversationContext, 
  BusinessContext,
  ConversationSession,
  Customer,
  Message,
  Intent,
  Product
} from '../types/core';
import { NLPService } from '../nlp/NLPService';
import { InventoryService } from '../inventory/InventoryService';
import { PersonalityService } from '../personality/PersonalityService';
import { SessionManager } from './SessionManager';
import { StoreIntent } from '../nlp/types';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AgentCoreConfig {
  nlpService: NLPService;
  inventoryService: InventoryService;
  sessionManager: SessionManager;
  personalityService?: PersonalityService;
}

export class AgentCore implements IAgentCore {
  private nlpService: NLPService;
  private inventoryService: InventoryService;
  private sessionManager: SessionManager;
  private personalityService: PersonalityService;

  constructor(config: AgentCoreConfig) {
    this.nlpService = config.nlpService;
    this.inventoryService = config.inventoryService;
    this.sessionManager = config.sessionManager;
    this.personalityService = config.personalityService || new PersonalityService();
    
    logger.info('Agent Core initialized', {
      hasNLP: !!this.nlpService,
      hasInventory: !!this.inventoryService,
      hasSessionManager: !!this.sessionManager,
      hasPersonality: !!this.personalityService
    });
  }

  /**
   * Process incoming customer message and generate response
   */
  async processMessage(sessionId: string, message: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    logger.debug('Processing message', { 
      sessionId, 
      messageLength: message.length 
    });

    try {
      // Get or validate session
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Add user message to conversation history
      const userMessage: Message = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      session.context.conversationHistory.push(userMessage);

      // Build business context
      const businessContext = await this.buildBusinessContext(session);

      // Process message through NLP service
      const nlpResult = await this.nlpService.processMessage(
        message,
        session.context,
        businessContext
      );

      // Generate agent response based on intent
      const agentResponse = await this.generateAgentResponse(
        nlpResult.intent,
        session,
        businessContext,
        message
      );

      // Add agent message to conversation history
      const agentMessage: Message = {
        id: uuidv4(),
        role: 'agent',
        content: agentResponse.text,
        timestamp: new Date(),
        metadata: {
          intent: nlpResult.intent.name,
          confidence: nlpResult.confidence
        }
      };
      session.context.conversationHistory.push(agentMessage);

      // Update session with new context
      await this.sessionManager.updateSession(sessionId, {
        lastActivity: new Date(),
        context: session.context
      });

      const processingTime = Date.now() - startTime;
      
      logger.info('Message processed successfully', {
        sessionId,
        intent: nlpResult.intent.name,
        confidence: nlpResult.confidence,
        processingTime
      });

      return {
        ...agentResponse,
        metadata: {
          ...agentResponse.metadata,
          processingTime,
          confidence: nlpResult.confidence,
          intent: nlpResult.intent.name
        }
      };

    } catch (error) {
      logger.error('Failed to process message', { sessionId, message, error });
      
      // Return fallback response
      return this.createFallbackResponse(sessionId, error);
    }
  }

  /**
   * Initialize a new conversation session
   */
  async initializeSession(customerId?: string): Promise<SessionInfo> {
    logger.debug('Initializing new session', { customerId });

    try {
      const sessionInfo = await this.sessionManager.createSession(customerId);
      
      logger.info('Session initialized', {
        sessionId: sessionInfo.sessionId,
        customerId: sessionInfo.customerId
      });

      return sessionInfo;
    } catch (error) {
      logger.error('Failed to initialize session', { customerId, error });
      throw error;
    }
  }

  /**
   * End conversation session
   */
  async endSession(sessionId: string): Promise<void> {
    logger.debug('Ending session', { sessionId });

    try {
      await this.sessionManager.endSession(sessionId);
      
      logger.info('Session ended', { sessionId });
    } catch (error) {
      logger.error('Failed to end session', { sessionId, error });
      throw error;
    }
  }

  /**
   * Get welcome message for new sessions
   */
  async getWelcomeMessage(sessionId: string): Promise<AgentResponse> {
    logger.debug('Generating welcome message', { sessionId });

    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const greeting = this.personalityService.getGreeting();
      
      // Get featured products for suggestions
      const featuredProducts = await this.inventoryService.getSellableProducts({ 
        inStock: true 
      });
      const topProducts = featuredProducts.slice(0, 3);

      const suggestions = [
        "What products are available?",
        "Show me fresh vegetables",
        "What's on sale today?"
      ];

      return {
        text: greeting,
        suggestions,
        products: topProducts.map(product => ({
          id: product.id,
          name: product.name,
          price: product.basePrice,
          availability: product.stockQuantity > 0 ? 'in-stock' : 'out-of-stock',
          description: product.description
        })),
        actions: [],
        metadata: {
          sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: 'welcome'
        }
      };

    } catch (error) {
      logger.error('Failed to generate welcome message', { sessionId, error });
      return this.createFallbackResponse(sessionId, error);
    }
  }

  /**
   * Build business context for NLP processing
   */
  private async buildBusinessContext(session: ConversationSession): Promise<BusinessContext> {
    try {
      // Get current inventory
      const inventory = await this.inventoryService.getSellableProducts();
      
      // Get any active promotions (placeholder for now)
      const promotions: any[] = [];

      // Get customer profile if available
      let customerProfile: Customer | undefined;
      if (session.customerId) {
        // This would fetch from customer service when implemented
        customerProfile = undefined;
      }

      return {
        inventory,
        promotions,
        customerProfile,
        sessionContext: session.context
      };
    } catch (error) {
      logger.error('Failed to build business context', { sessionId: session.sessionId, error });
      
      // Return minimal context
      return {
        inventory: [],
        promotions: [],
        sessionContext: session.context
      };
    }
  }

  /**
   * Generate agent response based on intent and context
   */
  private async generateAgentResponse(
    intent: Intent,
    session: ConversationSession,
    businessContext: BusinessContext,
    originalMessage: string
  ): Promise<AgentResponse> {
    
    logger.debug('Generating agent response', {
      intent: intent.name,
      sessionId: session.sessionId
    });

    try {
      switch (intent.name) {
        case StoreIntent.BROWSE_PRODUCTS:
          return await this.handleBrowseProducts(intent, businessContext);
          
        case StoreIntent.PRODUCT_INQUIRY:
          return await this.handleProductInquiry(intent, businessContext);
          
        case StoreIntent.PRICE_INQUIRY:
          return await this.handlePriceInquiry(intent, businessContext);
          
        case StoreIntent.ADD_TO_CART:
          return await this.handleAddToCart(intent, session, businessContext);
          
        case StoreIntent.NEGOTIATE_PRICE:
          return await this.handleNegotiation(intent, session, businessContext);
          
        case StoreIntent.GREETING:
          return await this.handleGreeting(session);
          
        case StoreIntent.FAREWELL:
          return await this.handleFarewell(session);
          
        default:
          return await this.handleUnknownIntent(intent, businessContext, originalMessage);
      }
    } catch (error) {
      logger.error('Failed to generate response for intent', { 
        intent: intent.name, 
        sessionId: session.sessionId, 
        error 
      });
      
      return this.createErrorResponse(session.sessionId, error);
    }
  }

  /**
   * Handle product browsing requests
   */
  private async handleBrowseProducts(intent: Intent, context: BusinessContext): Promise<AgentResponse> {
    const categoryEntity = intent.entities.find(e => e.type === 'product_category');
    const productEntity = intent.entities.find(e => e.type === 'product_name');
    const category = categoryEntity?.value;
    const searchTerm = productEntity?.value;

    let products: Product[];
    let responseText: string;

    if (searchTerm) {
      // Handle descriptive searches like "spiced", "fresh", etc.
      try {
        products = await this.inventoryService.searchProducts(searchTerm, true);
        responseText = products.length > 0 
          ? `Here are our ${searchTerm} products:`
          : `I couldn't find any ${searchTerm} products. Here are our available products:`;
        
        // If no results from search, fall back to all products
        if (products.length === 0) {
          products = await this.inventoryService.getSellableProducts({ inStock: true });
        }
      } catch (error) {
        logger.warn('Search failed during browse, falling back to all products', { error });
        products = await this.inventoryService.getSellableProducts({ inStock: true });
        responseText = "Here are our available products:";
      }
    } else if (category) {
      products = await this.inventoryService.getProductsByCategory(category, true);
      responseText = `Here are our fresh ${category} products:`;
    } else {
      products = await this.inventoryService.getSellableProducts({ inStock: true });
      responseText = "Here are our available products:";
    }

    return {
      text: responseText,
      suggestions: [
        "Tell me more about this product",
        "What's the price?",
        "Add to cart"
      ],
      products: products.slice(0, 6).map(product => ({
        id: product.id,
        name: product.name,
        price: product.basePrice,
        availability: this.getAvailabilityStatus(product),
        description: product.description
      })),
      actions: products.slice(0, 6).map(product => ({
        type: 'view-product' as const,
        productId: product.id
      })),
      metadata: {
        sessionId: context.sessionContext.currentIntent || '',
        timestamp: new Date(),
        processingTime: 0,
        intent: intent.name
      }
    };
  }

  /**
   * Handle specific product inquiries
   */
  private async handleProductInquiry(intent: Intent, context: BusinessContext): Promise<AgentResponse> {
    const productEntity = intent.entities.find(e => e.type === 'product_name');
    
    if (!productEntity) {
      return {
        text: "Which product would you like to know more about?",
        suggestions: context.inventory.slice(0, 3).map(p => p.name),
        products: [],
        actions: [],
        metadata: {
          sessionId: context.sessionContext.currentIntent || '',
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    // First try to find exact matches in current inventory
    let matchingProducts = context.inventory.filter(product =>
      product.name.toLowerCase().includes(productEntity.value.toLowerCase())
    );

    // If no exact matches, use search functionality for broader matching
    if (matchingProducts.length === 0) {
      try {
        matchingProducts = await this.inventoryService.searchProducts(productEntity.value, true);
      } catch (error) {
        logger.warn('Search failed, falling back to inventory filter', { error });
        matchingProducts = [];
      }
    }

    if (matchingProducts.length === 0) {
      return {
        text: `I don't have information about "${productEntity.value}" right now. Here are some products we do have:`,
        suggestions: ["Show me all products", "What's fresh today?"],
        products: context.inventory.slice(0, 3).map(product => ({
          id: product.id,
          name: product.name,
          price: product.basePrice,
          availability: this.getAvailabilityStatus(product),
          description: product.description
        })),
        actions: [],
        metadata: {
          sessionId: context.sessionContext.currentIntent || '',
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const product = matchingProducts[0];
    const responseText = `${product.name} - ${product.description}. We have ${product.stockQuantity} ${product.unit} available at $${product.basePrice.toFixed(2)} per ${product.unit}.`;

    return {
      text: responseText,
      suggestions: [
        "Add to cart",
        "What's the price?",
        "Show me similar products"
      ],
      products: [{
        id: product.id,
        name: product.name,
        price: product.basePrice,
        availability: this.getAvailabilityStatus(product),
        description: product.description
      }],
      actions: [{
        type: 'add-to-cart' as const,
        productId: product.id
      }],
      metadata: {
        sessionId: context.sessionContext.currentIntent || '',
        timestamp: new Date(),
        processingTime: 0,
        intent: intent.name
      }
    };
  }

  /**
   * Handle price inquiry requests
   */
  private async handlePriceInquiry(intent: Intent, context: BusinessContext): Promise<AgentResponse> {
    const productEntity = intent.entities.find(e => e.type === 'product_name');
    
    if (!productEntity) {
      return {
        text: "Which product's price would you like to check?",
        suggestions: context.inventory.slice(0, 3).map(p => p.name),
        products: [],
        actions: [],
        metadata: {
          sessionId: context.sessionContext.currentIntent || '',
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const matchingProducts = context.inventory.filter(product =>
      product.name.toLowerCase().includes(productEntity.value.toLowerCase())
    );

    if (matchingProducts.length === 0) {
      return {
        text: `I don't have pricing for "${productEntity.value}". Here are our current products:`,
        suggestions: ["Show me all products"],
        products: context.inventory.slice(0, 3).map(product => ({
          id: product.id,
          name: product.name,
          price: product.basePrice,
          availability: this.getAvailabilityStatus(product),
          description: product.description
        })),
        actions: [],
        metadata: {
          sessionId: context.sessionContext.currentIntent || '',
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const product = matchingProducts[0];
    const responseText = `${product.name} is $${product.basePrice.toFixed(2)} per ${product.unit}.`;

    return {
      text: responseText,
      suggestions: [
        "Add to cart",
        "Can you negotiate the price?",
        "Show me similar products"
      ],
      products: [{
        id: product.id,
        name: product.name,
        price: product.basePrice,
        availability: this.getAvailabilityStatus(product),
        description: product.description
      }],
      actions: [{
        type: 'add-to-cart' as const,
        productId: product.id
      }],
      metadata: {
        sessionId: context.sessionContext.currentIntent || '',
        timestamp: new Date(),
        processingTime: 0,
        intent: intent.name
      }
    };
  }

  /**
   * Handle add to cart requests
   */
  private async handleAddToCart(
    intent: Intent, 
    session: ConversationSession, 
    context: BusinessContext
  ): Promise<AgentResponse> {
    const productEntity = intent.entities.find(e => e.type === 'product_name');
    const quantityEntity = intent.entities.find(e => e.type === 'quantity');
    
    if (!productEntity) {
      return {
        text: "Which product would you like to add to your cart?",
        suggestions: context.inventory.slice(0, 3).map(p => p.name),
        products: [],
        actions: [],
        metadata: {
          sessionId: session.sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const matchingProducts = context.inventory.filter(product =>
      product.name.toLowerCase().includes(productEntity.value.toLowerCase())
    );

    if (matchingProducts.length === 0) {
      return {
        text: `I couldn't find "${productEntity.value}" in our inventory.`,
        suggestions: ["Show me all products"],
        products: [],
        actions: [],
        metadata: {
          sessionId: session.sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const product = matchingProducts[0];
    const quantity = quantityEntity ? parseInt(quantityEntity.value) : 1;

    // Check availability
    const availability = await this.inventoryService.checkAvailability(product.id, quantity);
    
    if (!availability.available) {
      return {
        text: `Sorry, we only have ${availability.quantity} ${product.unit} of ${product.name} available.`,
        suggestions: [
          `Add ${availability.quantity} to cart`,
          "Show me alternatives"
        ],
        products: availability.alternatives?.map(alt => ({
          id: alt.id,
          name: alt.name,
          price: alt.basePrice,
          availability: this.getAvailabilityStatus(alt),
          description: alt.description
        })) || [],
        actions: [],
        metadata: {
          sessionId: session.sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    // Add to cart (simplified - just update session)
    session.cart.push({
      productId: product.id,
      quantity,
      unitPrice: product.basePrice
    });

    const total = session.cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    return {
      text: `Added ${quantity} ${product.unit} of ${product.name} to your cart! Your cart total is now $${total.toFixed(2)}.`,
      suggestions: [
        "Continue shopping",
        "View cart",
        "Checkout"
      ],
      products: [],
      actions: [{
        type: 'checkout' as const
      }],
      metadata: {
        sessionId: session.sessionId,
        timestamp: new Date(),
        processingTime: 0,
        intent: intent.name
      }
    };
  }

  /**
   * Handle price negotiation
   */
  private async handleNegotiation(
    intent: Intent,
    session: ConversationSession,
    context: BusinessContext
  ): Promise<AgentResponse> {
    const productEntity = intent.entities.find(e => e.type === 'product_name');
    const priceEntity = intent.entities.find(e => e.type === 'price' || e.type === 'number');
    
    if (!productEntity) {
      return {
        text: "Which product would you like to negotiate the price for?",
        suggestions: context.inventory.slice(0, 3).map(p => p.name),
        products: [],
        actions: [],
        metadata: {
          sessionId: session.sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const matchingProducts = context.inventory.filter(product =>
      product.name.toLowerCase().includes(productEntity.value.toLowerCase())
    );

    if (matchingProducts.length === 0) {
      return {
        text: `I couldn't find "${productEntity.value}" to negotiate on.`,
        suggestions: ["Show me all products"],
        products: [],
        actions: [],
        metadata: {
          sessionId: session.sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    const product = matchingProducts[0];
    const customerOffer = priceEntity ? parseFloat(priceEntity.value) : undefined;

    if (!customerOffer) {
      return {
        text: `${product.name} is currently $${product.basePrice.toFixed(2)} per ${product.unit}. What price did you have in mind?`,
        suggestions: [
          `$${(product.basePrice * 0.9).toFixed(2)}`,
          `$${(product.basePrice * 0.85).toFixed(2)}`,
          "Never mind"
        ],
        products: [{
          id: product.id,
          name: product.name,
          price: product.basePrice,
          availability: this.getAvailabilityStatus(product),
          description: product.description
        }],
        actions: [],
        metadata: {
          sessionId: session.sessionId,
          timestamp: new Date(),
          processingTime: 0,
          intent: intent.name
        }
      };
    }

    // Use personality service for negotiation
    const negotiationResult = this.personalityService.getNegotiationResponse(
      product.basePrice,
      customerOffer,
      product.name
    );

    return {
      text: negotiationResult.response,
      suggestions: negotiationResult.accepted 
        ? ["Add to cart", "Continue shopping"]
        : ["Accept counter offer", "Try different price", "No thanks"],
      products: [{
        id: product.id,
        name: product.name,
        price: negotiationResult.counterOffer || product.basePrice,
        availability: this.getAvailabilityStatus(product),
        description: product.description
      }],
      actions: negotiationResult.accepted ? [{
        type: 'add-to-cart' as const,
        productId: product.id,
        data: { negotiatedPrice: customerOffer }
      }] : [],
      metadata: {
        sessionId: session.sessionId,
        timestamp: new Date(),
        processingTime: 0,
        intent: intent.name
      }
    };
  }

  /**
   * Handle greeting
   */
  private async handleGreeting(session: ConversationSession): Promise<AgentResponse> {
    const greeting = this.personalityService.getGreeting();
    
    return {
      text: greeting,
      suggestions: [
        "What products do you have?",
        "Show me fresh vegetables",
        "What's on sale?"
      ],
      products: [],
      actions: [],
      metadata: {
        sessionId: session.sessionId,
        timestamp: new Date(),
        processingTime: 0,
        intent: 'greeting'
      }
    };
  }

  /**
   * Handle farewell
   */
  private async handleFarewell(session: ConversationSession): Promise<AgentResponse> {
    const farewell = this.personalityService.getFarewell();
    
    return {
      text: farewell,
      suggestions: [],
      products: [],
      actions: [],
      metadata: {
        sessionId: session.sessionId,
        timestamp: new Date(),
        processingTime: 0,
        intent: 'farewell'
      }
    };
  }

  /**
   * Handle unknown intents
   */
  private async handleUnknownIntent(
    intent: Intent,
    context: BusinessContext,
    originalMessage: string
  ): Promise<AgentResponse> {
    // Try to generate a helpful response using NLP service
    const response = await this.nlpService.generateResponse(intent, context, originalMessage);
    
    return {
      text: response,
      suggestions: [
        "Show me products",
        "What do you have available?",
        "Help me find something"
      ],
      products: [],
      actions: [],
      metadata: {
        sessionId: context.sessionContext.currentIntent || '',
        timestamp: new Date(),
        processingTime: 0,
        intent: intent.name
      }
    };
  }

  /**
   * Create fallback response for errors
   */
  private createFallbackResponse(sessionId: string, error: any): AgentResponse {
    const fallbackText = "I'm sorry, I'm having trouble processing your request right now. Could you please try again?";
    
    return {
      text: fallbackText,
      suggestions: [
        "Show me products",
        "What's available?",
        "Help"
      ],
      products: [],
      actions: [],
      metadata: {
        sessionId,
        timestamp: new Date(),
        processingTime: 0,
        intent: 'error'
      }
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(sessionId: string, error: any): AgentResponse {
    logger.error('Creating error response', { sessionId, error });
    
    return this.createFallbackResponse(sessionId, error);
  }

  /**
   * Get availability status for display
   */
  private getAvailabilityStatus(product: Product): 'in-stock' | 'low-stock' | 'out-of-stock' {
    if (product.stockQuantity === 0) return 'out-of-stock';
    if (product.stockQuantity <= 5) return 'low-stock';
    return 'in-stock';
  }
}