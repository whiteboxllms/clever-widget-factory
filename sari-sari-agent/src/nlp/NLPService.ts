/**
 * NLP Service - Main interface for natural language processing
 */

import { NLPService as INLPService } from '../types/services';
import { Intent, Entity, ConversationContext, BusinessContext, ProductSearchTerm, NegationFilter, Product } from '../types/core';
import { AIRouter } from './AIRouter';
import { ResponseGenerator, ResponseGenerationOptions } from './ResponseGenerator';
import { PersonalityService } from '../personality/PersonalityService';
import { UpsellService } from '../services/UpsellService';
import { NegotiationService } from '../services/NegotiationService';
import { AIRouterConfig, StoreIntent, EntityType } from './types';
import { logger } from '../utils/logger';

export class NLPService implements INLPService {
  private aiRouter: AIRouter;
  private responseGenerator: ResponseGenerator;
  private personalityService: PersonalityService;
  private upsellService: UpsellService;
  private negotiationService: NegotiationService;

  constructor(config: AIRouterConfig) {
    this.aiRouter = new AIRouter(config);
    
    // Initialize personality and business services
    this.personalityService = new PersonalityService();
    this.upsellService = new UpsellService(this.personalityService);
    this.negotiationService = new NegotiationService(this.personalityService);
    
    // Initialize response generator with all services
    this.responseGenerator = new ResponseGenerator(
      this.personalityService,
      this.upsellService,
      this.negotiationService
    );
    
    logger.info('NLP Service initialized with personality and business services', { config });
  }

  /**
   * Analyze intent from customer message
   */
  async analyzeIntent(
    message: string, 
    context: ConversationContext
  ): Promise<Intent> {
    logger.debug('Analyzing intent', { 
      messageLength: message.length,
      sessionId: context.currentIntent 
    });

    try {
      const result = await this.aiRouter.classifyIntent(message, context);
      
      // Enhance intent with extracted entities
      const entityResult = await this.aiRouter.extractEntities(message);
      result.intent.entities = entityResult.entities;

      logger.info('Intent analyzed', {
        intent: result.intent.name,
        confidence: result.confidence,
        entityCount: result.intent.entities.length
      });

      return result.intent;
    } catch (error) {
      logger.error('Intent analysis failed', { error, message });
      
      // Return fallback intent
      return {
        name: StoreIntent.UNKNOWN,
        confidence: 0.1,
        entities: []
      };
    }
  }

  /**
   * Extract entities from message
   */
  async extractEntities(message: string): Promise<Entity[]> {
    logger.debug('Extracting entities', { messageLength: message.length });

    try {
      const result = await this.aiRouter.extractEntities(message);
      
      logger.info('Entities extracted', {
        entityCount: result.entities.length,
        confidence: result.confidence
      });

      return result.entities;
    } catch (error) {
      logger.error('Entity extraction failed', { error, message });
      return [];
    }
  }

  /**
   * Generate response based on intent and business context
   */
  async generateResponse(
    intent: Intent, 
    context: BusinessContext,
    originalMessage?: string,
    options?: ResponseGenerationOptions
  ): Promise<string> {
    logger.debug('Generating response with personality integration', {
      intent: intent.name,
      confidence: intent.confidence,
      entityCount: intent.entities.length
    });

    try {
      const result = await this.responseGenerator.generateResponse(
        intent,
        context.sessionContext,
        context,
        originalMessage,
        options
      );

      logger.info('Response generated with personality', {
        intent: intent.name,
        responseLength: result.text.length,
        confidence: result.confidence,
        personalityApplied: result.metadata.personalityApplied,
        upsellIncluded: result.metadata.upsellIncluded,
        processingTime: result.metadata.processingTime
      });

      return result.text;
    } catch (error) {
      logger.error('Response generation failed', { error, intent: intent.name });
      
      // Return personalized fallback response
      const fallbackResponse = this.personalityService.personalizeResponse(
        "I apologize, but I'm having trouble processing your request right now. Could you please try again or rephrase your question?",
        context.sessionContext
      );
      
      return fallbackResponse.text;
    }
  }

  /**
   * Process a complete message (intent + entities + response)
   */
  async processMessage(
    message: string,
    context: ConversationContext,
    businessContext: BusinessContext
  ): Promise<{
    intent: Intent;
    response: string;
    confidence: number;
  }> {
    logger.debug('Processing complete message', {
      messageLength: message.length,
      sessionId: context.currentIntent
    });

    const startTime = Date.now();

    try {
      // Analyze intent and extract entities
      const intent = await this.analyzeIntent(message, context);
      
      // Generate appropriate response with original message context
      const response = await this.generateResponse(intent, businessContext, message);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Message processed successfully', {
        intent: intent.name,
        confidence: intent.confidence,
        responseLength: response.length,
        processingTime
      });

      return {
        intent,
        response,
        confidence: intent.confidence
      };
    } catch (error) {
      logger.error('Message processing failed', { error, message });
      
      // Return fallback response
      return {
        intent: {
          name: StoreIntent.UNKNOWN,
          confidence: 0.1,
          entities: []
        },
        response: "I'm sorry, I didn't understand that. Could you please try asking in a different way?",
        confidence: 0.1
      };
    }
  }

  /**
   * Extract product description from natural language query
   */
  async extractProductDescription(message: string): Promise<ProductSearchTerm> {
    logger.debug('Extracting product description', { 
      messageLength: message.length,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    });

    const startTime = Date.now();

    // Sanitize and validate input
    const sanitizedMessage = this.sanitizeMessage(message);
    if (!this.validateMessage(sanitizedMessage)) {
      throw new Error('Invalid message format');
    }

    // Extract negations first
    const negations = await this.extractNegations(sanitizedMessage);
    
    // Use semantic search API for product extraction
    const extractedData = await this.extractUsingSemanticSearch(sanitizedMessage);

    const processingTime = Date.now() - startTime;

    const productSearchTerm: ProductSearchTerm = {
      extractedTerm: extractedData.extractedTerm,
      confidence: extractedData.confidence,
      originalQuery: message,
      searchType: extractedData.searchType,
      negations: negations.length > 0 ? negations : undefined
    };

    logger.info('Product description extracted', {
      extractedTerm: productSearchTerm.extractedTerm,
      confidence: productSearchTerm.confidence,
      searchType: productSearchTerm.searchType,
      negationCount: negations.length,
      processingTime,
      method: extractedData.method
    });

    return productSearchTerm;
  }

  /**
   * Extract negation terms from natural language query
   */
  async extractNegations(message: string): Promise<NegationFilter[]> {
    logger.debug('Extracting negations', { 
      messageLength: message.length,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    });

    const startTime = Date.now();

    // Sanitize and validate input
    const sanitizedMessage = this.sanitizeMessage(message);
    if (!this.validateMessage(sanitizedMessage)) {
      return [];
    }

    // Check if message contains negation patterns
    const negationPatterns = [
      /don't\s+like/gi,
      /do\s+not\s+like/gi,
      /\bno\s+/gi,
      /\bnot\s+/gi,
      /\bavoid\s+/gi,
      /without\s+/gi,
      /don't\s+want/gi,
      /do\s+not\s+want/gi,
      /hate\s+/gi,
      /dislike\s+/gi
    ];

    const hasNegation = negationPatterns.some(pattern => pattern.test(sanitizedMessage));
    
    if (!hasNegation) {
      logger.debug('No negation patterns found', { message: sanitizedMessage });
      return [];
    }

    // Use simple pattern-based extraction for negations
    const negations = this.extractNegationPatterns(sanitizedMessage);

    const processingTime = Date.now() - startTime;

    logger.info('Negations extracted', {
      negationCount: negations.length,
      negations: negations.map(n => ({ term: n.negatedTerm, type: n.negationType, confidence: n.confidence })),
      processingTime
    });

    return negations;
  }

  /**
   * Format search results with negation support and contextual descriptions
   */
  async formatSearchResults(
    searchResults: Product[], 
    originalQuery: string, 
    negations?: NegationFilter[]
  ): Promise<string> {
    logger.debug('Formatting search results', {
      resultCount: searchResults.length,
      originalQuery: originalQuery.substring(0, 100),
      negationCount: negations?.length || 0
    });

    if (searchResults.length === 0) {
      return "I couldn't find any products matching your request. Could you try describing what you're looking for in a different way?";
    }

    // Create contextual descriptions based on the original query
    const contextualizedResults = this.contextualizeSearchResults(searchResults, originalQuery);

    logger.debug('Contextualized search results', {
      originalCount: searchResults.length,
      contextualizedCount: contextualizedResults.length,
      query: originalQuery.substring(0, 50)
    });

    // Generate contextual response with personality
    const responseOptions = {
      includeNegationExplanation: negations && negations.length > 0,
      maxProducts: Math.min(contextualizedResults.length, 5), // Limit to top 5 results
      includeAlternatives: contextualizedResults.length > 5,
      contextualDescriptions: true
    };

    const response = await this.responseGenerator.generateResponse(
      {
        name: 'browse_products',
        confidence: 0.9,
        entities: []
      },
      {} as ConversationContext,
      {
        inventory: contextualizedResults,
        promotions: [],
        sessionContext: {} as ConversationContext
      },
      originalQuery,
      responseOptions
    );

    // Add negation explanation if applicable
    let formattedResponse = response.text;
    if (negations && negations.length > 0) {
      const negatedTerms = negations.map(n => n.negatedTerm).join(', ');
      formattedResponse += `\n\nI've excluded items related to: ${negatedTerms} as requested.`;
    }

    logger.info('Search results formatted', {
      resultCount: searchResults.length,
      responseLength: formattedResponse.length,
      negationExplanationAdded: negations && negations.length > 0,
      contextualized: true
    });

    return formattedResponse;
  }

  /**
   * Contextualize search results based on the original query
   * Modifies product descriptions to reflect why they match the query
   */
  private contextualizeSearchResults(products: Product[], query: string): Product[] {
    const lowerQuery = query.toLowerCase();
    
    // Detect query intent patterns
    const isUniqueQuery = lowerQuery.includes('unique') || lowerQuery.includes('special') || lowerQuery.includes('different');
    const isComparisonQuery = lowerQuery.includes('relative to') || lowerQuery.includes('compared to') || lowerQuery.includes('versus');
    const isCharacteristicQuery = lowerQuery.includes('hot') || lowerQuery.includes('spicy') || lowerQuery.includes('sweet') || lowerQuery.includes('sour');
    
    return products.map(product => {
      let contextualDescription = product.description;
      
      // Add context based on query type
      if (isUniqueQuery && isComparisonQuery) {
        // For "what's unique to X relative to Y" queries
        contextualDescription = `${product.name} - ${product.description || 'A unique product available at our farm'}`;
        logger.debug('Contextualized for uniqueness query', {
          productName: product.name,
          originalDesc: product.description?.substring(0, 50),
          contextualDesc: contextualDescription.substring(0, 50)
        });
      } else if (isCharacteristicQuery) {
        // For characteristic-based queries
        contextualDescription = `${product.name} - ${product.description || 'Matches your search criteria'}`;
      }
      
      return {
        ...product,
        description: contextualDescription
      };
    });
  }

  /**
   * Extract product description using semantic search API
   * This tests if the query returns relevant results and uses that to determine the search term
   */
  private async extractUsingSemanticSearch(
    message: string
  ): Promise<{ extractedTerm: string; confidence: number; searchType: string; method: string }> {
    const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
    
    logger.debug('Attempting semantic search API extraction', { 
      message: message.substring(0, 50),
      apiUrl: API_BASE_URL 
    });

    try {
      // Call the semantic search API with the full message
      const response = await fetch(`${API_BASE_URL}/api/semantic-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          table: 'parts',
          limit: 3
        })
      });

      if (!response.ok) {
        // Provide specific error messages based on status code
        let errorMessage = `Semantic search API returned ${response.status}: ${response.statusText}`;
        
        if (response.status === 401) {
          errorMessage = `Semantic search API authentication failed (401 Unauthorized). This usually means the request lacks proper authentication credentials. In production, ensure the user is logged in with valid Cognito tokens.`;
        } else if (response.status === 403) {
          errorMessage = `Semantic search API access forbidden (403). The user may not have permission to access the semantic search endpoint.`;
        } else if (response.status === 404) {
          errorMessage = `Semantic search API endpoint not found (404). The API endpoint may be unavailable or the URL may be incorrect.`;
        } else if (response.status >= 500) {
          errorMessage = `Semantic search API server error (${response.status}). The search service may be temporarily unavailable.`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const results = data.results || data.data?.results || [];

      logger.debug('Semantic search API response', {
        resultCount: results.length,
        hasResults: results.length > 0
      });

      if (results.length > 0) {
        // If we got results, the message itself is a good search term
        // Use the original message as the extracted term
        const firstResult = results[0];
        const similarity = firstResult.similarity || (1 - (firstResult.distance || 0));
        
        // Determine search type based on the query structure
        let searchType: 'characteristic' | 'name' | 'category' | 'description' = 'description';
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('hot') || lowerMessage.includes('spicy') || lowerMessage.includes('sweet') || lowerMessage.includes('sour')) {
          searchType = 'characteristic';
        } else if (lowerMessage.includes('vinegar') || lowerMessage.includes('sauce') || lowerMessage.includes('oil')) {
          searchType = 'name';
        } else if (lowerMessage.includes('vegetables') || lowerMessage.includes('fruits') || lowerMessage.includes('spices')) {
          searchType = 'category';
        }

        logger.info('Semantic search extraction successful', {
          extractedTerm: message,
          confidence: similarity,
          searchType,
          topResultName: firstResult.name
        });

        return {
          extractedTerm: message,
          confidence: Math.min(similarity, 0.95), // Cap at 0.95 to indicate it's from API
          searchType,
          method: 'semantic-api'
        };
      }

      // No results, fall back to simple extraction
      throw new Error('No results from semantic search API');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide context-specific logging based on error type
      if (errorMessage.includes('401 Unauthorized')) {
        logger.warn('Semantic search API authentication failed - falling back to keyword extraction', { 
          error: errorMessage,
          message: message.substring(0, 50),
          context: 'This is expected in test environments without proper authentication. In production, users should be authenticated via Cognito.'
        });
      } else if (errorMessage.includes('403')) {
        logger.warn('Semantic search API access forbidden - falling back to keyword extraction', { 
          error: errorMessage,
          message: message.substring(0, 50),
          context: 'User may not have permission to access semantic search. Check user roles and permissions.'
        });
      } else if (errorMessage.includes('No results')) {
        logger.info('Semantic search API returned no results - falling back to keyword extraction', { 
          message: message.substring(0, 50),
          context: 'Query did not match any products in the semantic search index.'
        });
      } else {
        logger.warn('Semantic search API extraction failed - falling back to keyword extraction', { 
          error: errorMessage,
          message: message.substring(0, 50),
          context: 'Unexpected error occurred during semantic search API call.'
        });
      }
      
      throw error;
    }
  }

  /**
   * Extract negation patterns from message using regex
   */
  private extractNegationPatterns(message: string): NegationFilter[] {
    const negations: NegationFilter[] = [];

    // Pattern matching for common negations
    const patterns = [
      { regex: /don't\s+like\s+(\w+)/gi, type: 'characteristic' as const },
      { regex: /no\s+(\w+)/gi, type: 'ingredient' as const },
      { regex: /not\s+(\w+)/gi, type: 'characteristic' as const },
      { regex: /avoid\s+(\w+)/gi, type: 'category' as const },
      { regex: /without\s+(\w+)/gi, type: 'ingredient' as const }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(message)) !== null) {
        negations.push({
          negatedTerm: match[1],
          negationType: pattern.type,
          confidence: 0.8,
          originalPhrase: match[0]
        });
      }
    }

    return negations;
  }

  /**
   * Get NLP service metrics
   */
  getMetrics() {
    return this.aiRouter.getMetrics();
  }

  /**
   * Reset service metrics
   */
  resetMetrics(): void {
    this.aiRouter.resetMetrics();
  }

  /**
   * Update AI router configuration
   */
  updateConfig(config: Partial<AIRouterConfig>): void {
    this.aiRouter.updateConfig(config);
  }

  /**
   * Validate message before processing
   */
  private validateMessage(message: string): boolean {
    if (!message || typeof message !== 'string') {
      return false;
    }

    // Check message length
    if (message.trim().length === 0) {
      return false;
    }

    if (message.length > 1000) { // Reasonable limit
      logger.warn('Message too long', { length: message.length });
      return false;
    }

    return true;
  }

  /**
   * Sanitize message input
   */
  private sanitizeMessage(message: string): string {
    return message
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 1000); // Limit length
  }

  /**
   * Get supported intents
   */
  getSupportedIntents(): string[] {
    return Object.values(StoreIntent);
  }

  /**
   * Get supported entity types
   */
  getSupportedEntityTypes(): string[] {
    return Object.values(EntityType);
  }

  /**
   * Get personality service for direct access
   */
  getPersonalityService(): PersonalityService {
    return this.personalityService;
  }

  /**
   * Get upsell service for direct access
   */
  getUpsellService(): UpsellService {
    return this.upsellService;
  }

  /**
   * Get negotiation service for direct access
   */
  getNegotiationService(): NegotiationService {
    return this.negotiationService;
  }

  /**
   * Generate greeting message
   */
  generateGreeting(context: ConversationContext): string {
    return this.personalityService.getGreeting(context.customer);
  }

  /**
   * Generate farewell message
   */
  generateFarewell(context: ConversationContext): string {
    return this.personalityService.getFarewell(context.customer);
  }
}