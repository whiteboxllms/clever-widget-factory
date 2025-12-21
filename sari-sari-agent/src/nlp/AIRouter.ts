/**
 * AI Router - Routes NLP requests to appropriate AI providers (cloud vs local)
 */

import { 
  AIProvider, 
  AIRouterConfig, 
  IntentClassificationResult, 
  EntityExtractionResult, 
  ResponseGenerationResult,
  NLPMetrics 
} from './types';
import { ConversationContext, BusinessContext } from '../types/core';
import { logger } from '../utils/logger';
import { BedrockProvider } from './providers/BedrockProvider';
import { LocalProvider } from './providers/LocalProvider';

export class AIRouter {
  private config: AIRouterConfig;
  private providers: Map<string, AIProvider>;
  private metrics: NLPMetrics;
  private bedrockProvider?: BedrockProvider;
  private localProvider?: LocalProvider;

  constructor(config: AIRouterConfig) {
    this.config = config;
    this.providers = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalCost: 0,
      providerUsage: {}
    };

    // Initialize providers asynchronously
    this.initializeProviders().catch(error => {
      logger.error('Failed to initialize AI providers', { error });
    });
  }

  /**
   * Route intent classification request to appropriate provider
   */
  async classifyIntent(
    message: string, 
    context: ConversationContext
  ): Promise<IntentClassificationResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const provider = await this.selectProvider();
      logger.debug('Routing intent classification', { 
        provider: provider.name, 
        messageLength: message.length 
      });

      const result = await this.executeIntentClassification(message, context, provider);
      
      this.updateMetrics(provider, startTime, result.metadata?.cost);
      this.metrics.successfulRequests++;

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error('Intent classification failed', { error });
      
      // Return fallback intent
      return {
        intent: {
          name: 'unknown',
          confidence: 0.1,
          entities: []
        },
        confidence: 0.1
      };
    }
  }

  /**
   * Route entity extraction request to appropriate provider
   */
  async extractEntities(message: string): Promise<EntityExtractionResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const provider = await this.selectProvider();
      logger.debug('Routing entity extraction', { 
        provider: provider.name, 
        messageLength: message.length 
      });

      const result = await this.executeEntityExtraction(message, provider);
      
      this.updateMetrics(provider, startTime, result.metadata?.cost);
      this.metrics.successfulRequests++;

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error('Entity extraction failed', { error });
      
      // Return empty entities
      return {
        entities: [],
        confidence: 0.0
      };
    }
  }

  /**
   * Route response generation request to appropriate provider
   */
  async generateResponse(
    intent: string,
    context: BusinessContext,
    message?: string
  ): Promise<ResponseGenerationResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const provider = await this.selectProvider();
      logger.debug('Routing response generation', { 
        provider: provider.name, 
        intent 
      });

      const result = await this.executeResponseGeneration(intent, context, provider, message);
      
      this.updateMetrics(provider, startTime, result.metadata?.cost);
      this.metrics.successfulRequests++;

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      logger.error('Response generation failed', { error });
      
      // Return fallback response
      return {
        response: "I'm sorry, I'm having trouble understanding right now. Could you please try again?",
        confidence: 0.1,
        metadata: {
          provider: 'fallback',
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): NLPMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      totalCost: 0,
      providerUsage: {}
    };
  }

  /**
   * Update router configuration
   */
  updateConfig(newConfig: Partial<AIRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('AI Router configuration updated', { config: this.config });
  }

  /**
   * Initialize available providers
   */
  private async initializeProviders(): Promise<void> {
    // Cloud provider (Bedrock/Claude)
    if (this.config.cloudProvider) {
      try {
        this.bedrockProvider = new BedrockProvider();
        
        // Test connection in development/test environments
        const isAvailable = process.env.NODE_ENV === 'production' || 
          await this.bedrockProvider.testConnection();
        
        this.providers.set('cloud', {
          name: 'cloud',
          type: 'cloud',
          available: isAvailable,
          costPerRequest: this.bedrockProvider.getEstimatedCostPerRequest(),
          latencyMs: 800 // Typical Bedrock latency
        });

        logger.info('Bedrock provider initialized', { available: isAvailable });
      } catch (error) {
        logger.warn('Failed to initialize Bedrock provider', { error });
        this.providers.set('cloud', {
          name: 'cloud',
          type: 'cloud',
          available: false,
          costPerRequest: 0.001,
          latencyMs: 800
        });
      }
    }

    // Local provider (Ollama/LM Studio)
    if (this.config.localProvider) {
      try {
        this.localProvider = new LocalProvider(this.config.localProvider);
        
        // Test connection asynchronously
        const isAvailable = await this.localProvider.isAvailable();
        
        this.providers.set('local', {
          name: 'local',
          type: 'local',
          available: isAvailable,
          costPerRequest: 0, // No cost for local
          latencyMs: 200 // Estimated latency for RTX 4060
        });

        logger.info('Local provider initialized', { available: isAvailable });
      } catch (error) {
        logger.warn('Failed to initialize local provider', { error });
        this.providers.set('local', {
          name: 'local',
          type: 'local',
          available: false,
          costPerRequest: 0,
          latencyMs: 200
        });
      }
    }

    logger.info('AI providers initialized', { 
      providers: Array.from(this.providers.keys()),
      cloudAvailable: this.providers.get('cloud')?.available,
      localAvailable: this.providers.get('local')?.available
    });
  }

  /**
   * Select the best provider based on configuration and availability
   */
  private async selectProvider(): Promise<AIProvider> {
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.available);

    if (availableProviders.length === 0) {
      throw new Error('No AI providers available');
    }

    // If only one provider available, use it
    if (availableProviders.length === 1) {
      return availableProviders[0];
    }

    // Apply selection logic based on configuration
    switch (this.config.preferredProvider) {
      case 'cloud':
        return this.selectCloudProvider(availableProviders);
      
      case 'local':
        return this.selectLocalProvider(availableProviders);
      
      case 'auto':
      default:
        return this.selectAutoProvider(availableProviders);
    }
  }

  /**
   * Select cloud provider if available
   */
  private selectCloudProvider(providers: AIProvider[]): AIProvider {
    const cloudProvider = providers.find(p => p.type === 'cloud');
    if (cloudProvider) {
      return cloudProvider;
    }

    // Fallback to local if cloud not available
    const localProvider = providers.find(p => p.type === 'local');
    if (localProvider) {
      logger.warn('Cloud provider not available, falling back to local');
      return localProvider;
    }

    throw new Error('No suitable provider available');
  }

  /**
   * Select local provider if available
   */
  private selectLocalProvider(providers: AIProvider[]): AIProvider {
    const localProvider = providers.find(p => p.type === 'local');
    if (localProvider) {
      return localProvider;
    }

    // Fallback to cloud if local not available
    const cloudProvider = providers.find(p => p.type === 'cloud');
    if (cloudProvider) {
      logger.warn('Local provider not available, falling back to cloud');
      return cloudProvider;
    }

    throw new Error('No suitable provider available');
  }

  /**
   * Auto-select provider based on cost and latency thresholds
   */
  private selectAutoProvider(providers: AIProvider[]): AIProvider {
    // Prefer local if available (no cost, usually faster)
    const localProvider = providers.find(p => p.type === 'local');
    if (localProvider) {
      return localProvider;
    }

    // Check cloud provider against thresholds
    const cloudProvider = providers.find(p => p.type === 'cloud');
    if (cloudProvider) {
      const costOk = !this.config.costThreshold || 
        (cloudProvider.costPerRequest || 0) <= this.config.costThreshold;
      const latencyOk = !this.config.latencyThreshold || 
        (cloudProvider.latencyMs || 0) <= this.config.latencyThreshold;

      if (costOk && latencyOk) {
        return cloudProvider;
      }
    }

    throw new Error('No provider meets the configured thresholds');
  }

  /**
   * Execute intent classification with selected provider
   */
  private async executeIntentClassification(
    message: string,
    context: ConversationContext,
    provider: AIProvider
  ): Promise<IntentClassificationResult> {
    if (provider.type === 'cloud' && this.bedrockProvider) {
      try {
        return await this.bedrockProvider.classifyIntent(message, context);
      } catch (error) {
        logger.warn('Bedrock intent classification failed, falling back to simple classification', { error });
        return this.simpleIntentClassification(message, context);
      }
    }
    
    if (provider.type === 'local' && this.localProvider) {
      try {
        return await this.localProvider.classifyIntent(message, context);
      } catch (error) {
        logger.warn('Local intent classification failed, falling back to simple classification', { error });
        return this.simpleIntentClassification(message, context);
      }
    }
    
    // Fallback to simple rule-based classification
    return this.simpleIntentClassification(message, context);
  }

  /**
   * Execute entity extraction with selected provider
   */
  private async executeEntityExtraction(
    message: string,
    provider: AIProvider
  ): Promise<EntityExtractionResult> {
    if (provider.type === 'cloud' && this.bedrockProvider) {
      try {
        return await this.bedrockProvider.extractEntities(message);
      } catch (error) {
        logger.warn('Bedrock entity extraction failed, falling back to simple extraction', { error });
        return this.simpleEntityExtraction(message);
      }
    }
    
    if (provider.type === 'local' && this.localProvider) {
      try {
        return await this.localProvider.extractEntities(message);
      } catch (error) {
        logger.warn('Local entity extraction failed, falling back to simple extraction', { error });
        return this.simpleEntityExtraction(message);
      }
    }
    
    // Fallback to simple rule-based extraction
    return this.simpleEntityExtraction(message);
  }

  /**
   * Execute response generation with selected provider
   */
  private async executeResponseGeneration(
    intent: string,
    context: BusinessContext,
    provider: AIProvider,
    message?: string
  ): Promise<ResponseGenerationResult> {
    if (provider.type === 'cloud' && this.bedrockProvider) {
      try {
        return await this.bedrockProvider.generateResponse(intent, context, message);
      } catch (error) {
        logger.warn('Bedrock response generation failed, falling back to simple generation', { error });
        return this.simpleResponseGeneration(intent, context);
      }
    }
    
    if (provider.type === 'local' && this.localProvider) {
      try {
        return await this.localProvider.generateResponse(intent, context, message);
      } catch (error) {
        logger.warn('Local response generation failed, falling back to simple generation', { error });
        return this.simpleResponseGeneration(intent, context);
      }
    }
    
    // Fallback to simple template-based response
    return this.simpleResponseGeneration(intent, context);
  }

  /**
   * Simple rule-based intent classification (fallback/stub)
   */
  private simpleIntentClassification(
    message: string, 
    _context: ConversationContext
  ): IntentClassificationResult {
    const lowerMessage = message.toLowerCase();
    
    // Check for price inquiry first (more specific)
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much') || 
        (lowerMessage.includes('much') && (lowerMessage.includes('do') || lowerMessage.includes('does')))) {
      return {
        intent: { name: 'price_inquiry', confidence: 0.8, entities: [] },
        confidence: 0.8
      };
    }
    
    // Check for greeting
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return {
        intent: { name: 'greeting', confidence: 0.9, entities: [] },
        confidence: 0.9
      };
    }
    
    // Check for add to cart
    if (lowerMessage.includes('buy') || lowerMessage.includes('purchase') || lowerMessage.includes('add') ||
        lowerMessage.includes('want') || lowerMessage.includes('need')) {
      return {
        intent: { name: 'add_to_cart', confidence: 0.8, entities: [] },
        confidence: 0.8
      };
    }
    
    // Check for browse products (including descriptive searches)
    if (lowerMessage.includes('what') || lowerMessage.includes('show') || lowerMessage.includes('available') ||
        lowerMessage.includes('have') || lowerMessage.includes('spiced') || lowerMessage.includes('fresh') ||
        lowerMessage.includes('organic')) {
      return {
        intent: { name: 'browse_products', confidence: 0.7, entities: [] },
        confidence: 0.7
      };
    }
    
    return {
      intent: { name: 'unknown', confidence: 0.3, entities: [] },
      confidence: 0.3
    };
  }

  /**
   * Simple entity extraction (fallback/stub)
   */
  private simpleEntityExtraction(message: string): EntityExtractionResult {
    const entities = [];
    const lowerMessage = message.toLowerCase();
    
    // Extract all quantity and unit patterns
    const quantityMatches = message.matchAll(/(\d+)\s*(kg|piece|pieces|liter|gram|g)/gi);
    for (const match of quantityMatches) {
      entities.push({
        type: 'quantity',
        value: match[1],
        confidence: 0.9
      });
      entities.push({
        type: 'unit',
        value: match[2].toLowerCase(),
        confidence: 0.9
      });
    }
    
    // Common product names and descriptive terms
    const products = ['tomato', 'lettuce', 'carrot', 'apple', 'banana', 'rice', 'milk', 'vinegar'];
    for (const product of products) {
      if (lowerMessage.includes(product)) {
        entities.push({
          type: 'product_name',
          value: product,
          confidence: 0.8
        });
      }
    }
    
    // Product descriptors and attributes
    const descriptors = ['spiced', 'fresh', 'organic', 'pure', 'cheap', 'long neck', 'lipid'];
    for (const descriptor of descriptors) {
      if (lowerMessage.includes(descriptor)) {
        entities.push({
          type: 'product_name',
          value: descriptor,
          confidence: 0.7
        });
      }
    }
    
    // Product categories
    const categories = ['vegetables', 'fruits', 'grains', 'dairy', 'spices', 'condiments'];
    for (const category of categories) {
      if (lowerMessage.includes(category)) {
        entities.push({
          type: 'product_category',
          value: category,
          confidence: 0.8
        });
      }
    }
    
    return {
      entities,
      confidence: entities.length > 0 ? 0.7 : 0.0
    };
  }

  /**
   * Simple response generation (fallback/stub)
   */
  private simpleResponseGeneration(
    intent: string,
    _context: BusinessContext
  ): ResponseGenerationResult {
    const responses: Record<string, string> = {
      greeting: "Hello! Welcome to our farm store! How can I help you find the freshest produce today?",
      browse_products: "We have fresh vegetables, fruits, grains, and dairy products available. What are you looking for?",
      price_inquiry: "I'd be happy to help you with pricing information. Which product are you interested in?",
      add_to_cart: "Great choice! I can help you add that to your cart. Could you tell me which product and how much you'd like?",
      unknown: "I'm not sure I understand. Could you tell me what you're looking for or how I can help you today?"
    };
    
    const response = responses[intent] || responses.unknown;
    
    return {
      response,
      confidence: 0.8,
      metadata: {
        provider: 'simple_template',
        processingTime: 10
      }
    };
  }

  /**
   * Update metrics after a request
   */
  private updateMetrics(provider: AIProvider, startTime: number, cost?: number): void {
    const processingTime = Date.now() - startTime;
    
    // Update average latency
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + processingTime) / 
      this.metrics.totalRequests;
    
    // Update cost
    if (cost) {
      this.metrics.totalCost += cost;
    }
    
    // Update provider usage
    this.metrics.providerUsage[provider.name] = 
      (this.metrics.providerUsage[provider.name] || 0) + 1;
  }
}