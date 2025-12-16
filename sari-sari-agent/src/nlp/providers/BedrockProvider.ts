/**
 * Amazon Bedrock AI Provider
 * Handles Claude API integration for intent classification, entity extraction, and response generation
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { 
  IntentClassificationResult, 
  EntityExtractionResult, 
  ResponseGenerationResult,
  StoreIntent,
  EntityType
} from '../types';
import { ConversationContext, BusinessContext } from '@/types/core';

export class BedrockProvider {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      } : undefined // Use default credential chain if not provided
    });
    
    this.modelId = config.bedrock.modelId;
    this.maxTokens = config.bedrock.maxTokens;
    this.temperature = config.bedrock.temperature;

    logger.info('Bedrock provider initialized', {
      modelId: this.modelId,
      region: config.aws.region,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    });
  }

  /**
   * Classify customer intent using Claude
   */
  async classifyIntent(
    message: string,
    context: ConversationContext
  ): Promise<IntentClassificationResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildIntentClassificationPrompt(message, context);
      const response = await this.invokeModel(prompt);
      const result = this.parseIntentResponse(response);

      logger.debug('Intent classified via Bedrock', {
        intent: result.intent.name,
        confidence: result.confidence,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Bedrock intent classification failed', { error, message });
      throw error;
    }
  }

  /**
   * Extract entities using Claude
   */
  async extractEntities(message: string): Promise<EntityExtractionResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildEntityExtractionPrompt(message);
      const response = await this.invokeModel(prompt);
      const result = this.parseEntityResponse(response);

      logger.debug('Entities extracted via Bedrock', {
        entityCount: result.entities.length,
        confidence: result.confidence,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Bedrock entity extraction failed', { error, message });
      throw error;
    }
  }

  /**
   * Generate response using Claude
   */
  async generateResponse(
    intent: string,
    context: BusinessContext,
    originalMessage?: string
  ): Promise<ResponseGenerationResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildResponseGenerationPrompt(intent, context, originalMessage);
      const response = await this.invokeModel(prompt);
      const result = this.parseResponseGeneration(response, startTime);

      logger.debug('Response generated via Bedrock', {
        intent,
        responseLength: result.response.length,
        confidence: result.confidence,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Bedrock response generation failed', { error, intent });
      throw error;
    }
  }

  /**
   * Invoke Claude model via Bedrock
   */
  private async invokeModel(prompt: string): Promise<string> {
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: body,
      contentType: "application/json",
      accept: "application/json"
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
      return responseBody.content[0].text;
    }

    throw new Error('Invalid response format from Bedrock');
  }

  /**
   * Build prompt for intent classification
   */
  private buildIntentClassificationPrompt(message: string, context: ConversationContext): string {
    const availableIntents = Object.values(StoreIntent).join(', ');
    
    return `You are an AI assistant for a farm store. Classify the customer's intent from their message.

Available intents: ${availableIntents}

Customer message: "${message}"

Context:
- Previous intent: ${context.currentIntent || 'none'}
- Conversation history: ${context.conversationHistory.length} messages
- Customer preferences: ${JSON.stringify(context.preferences)}

Respond with ONLY a JSON object in this exact format:
{
  "intent": "intent_name",
  "confidence": 0.95,
  "reasoning": "brief explanation"
}

Choose the most appropriate intent based on the message content and context.`;
  }

  /**
   * Build prompt for entity extraction
   */
  private buildEntityExtractionPrompt(message: string): string {
    const availableEntityTypes = Object.values(EntityType).join(', ');

    return `Extract entities from this customer message for a farm store.

Available entity types: ${availableEntityTypes}

Customer message: "${message}"

Extract all relevant entities and respond with ONLY a JSON object in this exact format:
{
  "entities": [
    {
      "type": "entity_type",
      "value": "extracted_value",
      "confidence": 0.95
    }
  ],
  "confidence": 0.90
}

Focus on quantities, products, units, prices, and other relevant farm store information.`;
  }

  /**
   * Build prompt for response generation
   */
  private buildResponseGenerationPrompt(
    intent: string, 
    context: BusinessContext, 
    originalMessage?: string
  ): string {
    const availableProducts = context.inventory
      .filter(p => p.sellable)
      .map(p => `${p.name} (${p.category}) - $${p.basePrice}/${p.unit}`)
      .slice(0, 10) // Limit to avoid token overflow
      .join(', ');

    const activePromotions = context.promotions
      .map(p => `${p.name}: ${p.description}`)
      .join(', ');

    return `You are a friendly farm store assistant. Generate a helpful response based on the customer's intent.

Intent: ${intent}
${originalMessage ? `Original message: "${originalMessage}"` : ''}

Available products: ${availableProducts || 'None currently available'}
Active promotions: ${activePromotions || 'None currently active'}

Customer preferences:
- Language: ${context.sessionContext.preferences.language}
- Communication style: ${context.sessionContext.preferences.communicationStyle}
- Favorite categories: ${context.sessionContext.preferences.favoriteCategories.join(', ')}

Guidelines:
- Be warm, friendly, and helpful
- Use natural, conversational language
- Mention specific products when relevant
- Keep responses concise but informative
- If asking about products, suggest alternatives if needed
- For pricing questions, provide clear pricing information
- For greetings, welcome them warmly and ask how you can help

Respond with ONLY the assistant's message text (no JSON, no formatting):`;
  }

  /**
   * Parse intent classification response
   */
  private parseIntentResponse(response: string): IntentClassificationResult {
    try {
      const parsed = JSON.parse(response.trim());
      
      return {
        intent: {
          name: parsed.intent || StoreIntent.UNKNOWN,
          confidence: parsed.confidence || 0.5,
          entities: []
        },
        confidence: parsed.confidence || 0.5,
        metadata: {
          provider: 'bedrock',
          reasoning: parsed.reasoning
        }
      };
    } catch (error) {
      logger.warn('Failed to parse Bedrock intent response', { response, error });
      
      return {
        intent: {
          name: StoreIntent.UNKNOWN,
          confidence: 0.3,
          entities: []
        },
        confidence: 0.3
      };
    }
  }

  /**
   * Parse entity extraction response
   */
  private parseEntityResponse(response: string): EntityExtractionResult {
    try {
      const parsed = JSON.parse(response.trim());
      
      return {
        entities: parsed.entities || [],
        confidence: parsed.confidence || 0.5,
        metadata: {
          provider: 'bedrock'
        }
      };
    } catch (error) {
      logger.warn('Failed to parse Bedrock entity response', { response, error });
      
      return {
        entities: [],
        confidence: 0.0
      };
    }
  }

  /**
   * Parse response generation
   */
  private parseResponseGeneration(response: string, startTime: number): ResponseGenerationResult {
    // Response generation returns plain text, not JSON
    const cleanResponse = response.trim();
    
    return {
      response: cleanResponse,
      confidence: 0.9, // High confidence for generated responses
      metadata: {
        provider: 'bedrock',
        processingTime: Date.now() - startTime,
        modelId: this.modelId
      }
    };
  }

  /**
   * Test connection to Bedrock
   */
  async testConnection(): Promise<boolean> {
    try {
      const testPrompt = "Respond with 'OK' if you can understand this message.";
      const response = await this.invokeModel(testPrompt);
      
      logger.info('Bedrock connection test successful', { response: response.substring(0, 50) });
      return true;
    } catch (error) {
      logger.error('Bedrock connection test failed', { error });
      return false;
    }
  }

  /**
   * Get estimated cost per request
   */
  getEstimatedCostPerRequest(): number {
    // Rough estimate for Claude 3 Sonnet on Bedrock
    // Input: ~100 tokens, Output: ~50 tokens = ~150 tokens total
    // Claude 3 Sonnet: $3/1M input tokens, $15/1M output tokens
    const inputTokens = 100;
    const outputTokens = 50;
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    
    return inputCost + outputCost;
  }
}