/**
 * NLP Service - Main interface for natural language processing
 */

import { NLPService as INLPService } from '../types/services';
import { Intent, Entity, ConversationContext, BusinessContext } from '../types/core';
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