/**
 * Local AI Provider - Interface for local AI services (Ollama, LM Studio)
 * Designed for RTX 4060 GPU support with cost-free inference
 */

import { 
  IntentClassificationResult, 
  EntityExtractionResult, 
  ResponseGenerationResult,
  LocalProviderConfig,
  StoreIntent,
  EntityType
} from '../types';
import { ConversationContext, BusinessContext, Intent, Entity } from '../../types/core';
import { logger } from '../../utils/logger';

export interface LocalAIEndpoint {
  baseUrl: string;
  model: string;
  available: boolean;
  lastChecked: number;
  capabilities: {
    chat: boolean;
    completion: boolean;
    embedding: boolean;
  };
}

export class LocalProvider {
  private config: LocalProviderConfig;
  private endpoints: Map<string, LocalAIEndpoint>;
  private healthCheckInterval: number = 30000; // 30 seconds
  private lastHealthCheck: number = 0;

  constructor(config: LocalProviderConfig) {
    this.config = config;
    this.endpoints = new Map();
    
    // Initialize with configured endpoint
    this.endpoints.set('primary', {
      baseUrl: config.endpoint,
      model: config.model,
      available: false,
      lastChecked: 0,
      capabilities: {
        chat: true,
        completion: true,
        embedding: false // Not needed for MVP
      }
    });

    logger.info('LocalProvider initialized', { 
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model
    });
  }

  /**
   * Test connection to local AI service
   */
  async testConnection(): Promise<boolean> {
    try {
      const endpoint = this.endpoints.get('primary');
      if (!endpoint) {
        return false;
      }

      const response = await this.makeRequest('/api/tags', 'GET');
      
      if (response.ok) {
        const data = await response.json();
        const modelExists = data.models?.some((m: any) => 
          m.name === endpoint.model || m.name.startsWith(endpoint.model)
        );
        
        endpoint.available = modelExists;
        endpoint.lastChecked = Date.now();
        
        logger.info('Local AI connection test', { 
          available: modelExists,
          modelsFound: data.models?.length || 0
        });
        
        return modelExists;
      }
      
      return false;
    } catch (error) {
      logger.warn('Local AI connection test failed', { error });
      return false;
    }
  }

  /**
   * Check if local AI service is available
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    
    // Check if we need to refresh health status
    if (now - this.lastHealthCheck > this.healthCheckInterval) {
      await this.testConnection();
      this.lastHealthCheck = now;
    }
    
    const endpoint = this.endpoints.get('primary');
    return endpoint?.available || false;
  }

  /**
   * Classify intent using local AI
   */
  async classifyIntent(
    message: string, 
    context: ConversationContext
  ): Promise<IntentClassificationResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.isAvailable()) {
        throw new Error('Local AI service not available');
      }

      const prompt = this.buildIntentClassificationPrompt(message, context);
      const response = await this.generateCompletion(prompt);
      
      const result = this.parseIntentResponse(response);
      
      return {
        ...result,
        metadata: {
          provider: 'local',
          processingTime: Date.now() - startTime,
          cost: 0 // Local inference is free
        }
      };
    } catch (error) {
      logger.error('Local intent classification failed', { error });
      throw error;
    }
  }

  /**
   * Extract entities using local AI
   */
  async extractEntities(message: string): Promise<EntityExtractionResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.isAvailable()) {
        throw new Error('Local AI service not available');
      }

      const prompt = this.buildEntityExtractionPrompt(message);
      const response = await this.generateCompletion(prompt);
      
      const result = this.parseEntityResponse(response);
      
      return {
        ...result,
        metadata: {
          provider: 'local',
          processingTime: Date.now() - startTime,
          cost: 0 // Local inference is free
        }
      };
    } catch (error) {
      logger.error('Local entity extraction failed', { error });
      throw error;
    }
  }

  /**
   * Generate response using local AI
   */
  async generateResponse(
    intent: string,
    context: BusinessContext,
    message?: string
  ): Promise<ResponseGenerationResult> {
    const startTime = Date.now();
    
    try {
      if (!await this.isAvailable()) {
        throw new Error('Local AI service not available');
      }

      const prompt = this.buildResponseGenerationPrompt(intent, context, message);
      const response = await this.generateCompletion(prompt);
      
      return {
        response: response.trim(),
        confidence: 0.8, // Local models generally reliable but lower confidence than cloud
        metadata: {
          provider: 'local',
          processingTime: Date.now() - startTime,
          cost: 0,
          modelId: this.config.model
        }
      };
    } catch (error) {
      logger.error('Local response generation failed', { error });
      throw error;
    }
  }

  /**
   * Get estimated cost per request (always 0 for local)
   */
  getEstimatedCostPerRequest(): number {
    return 0;
  }

  /**
   * Add additional endpoint for load balancing or fallback
   */
  addEndpoint(name: string, endpoint: LocalAIEndpoint): void {
    this.endpoints.set(name, endpoint);
    logger.info('Added local AI endpoint', { name, baseUrl: endpoint.baseUrl });
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(name: string): void {
    if (name !== 'primary') {
      this.endpoints.delete(name);
      logger.info('Removed local AI endpoint', { name });
    }
  }

  /**
   * Get endpoint status
   */
  getEndpointStatus(): Record<string, LocalAIEndpoint> {
    const status: Record<string, LocalAIEndpoint> = {};
    for (const [name, endpoint] of this.endpoints) {
      status[name] = { ...endpoint };
    }
    return status;
  }

  /**
   * Make HTTP request to local AI service
   */
  private async makeRequest(
    path: string, 
    method: 'GET' | 'POST' = 'POST', 
    body?: any
  ): Promise<Response> {
    const endpoint = this.endpoints.get('primary');
    if (!endpoint) {
      throw new Error('No primary endpoint configured');
    }

    const url = `${endpoint.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout for local requests
      signal: AbortSignal.timeout(30000) // 30 second timeout
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  /**
   * Generate completion using local AI service
   */
  private async generateCompletion(prompt: string): Promise<string> {
    const requestBody = {
      model: this.config.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: this.config.temperature || 0.7,
        num_predict: this.config.maxTokens || 500,
        stop: ['</response>', '\n\n---', 'Human:', 'Assistant:']
      }
    };

    const response = await this.makeRequest('/api/generate', 'POST', requestBody);
    
    if (!response.ok) {
      throw new Error(`Local AI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Build intent classification prompt for local AI
   */
  private buildIntentClassificationPrompt(
    message: string, 
    context: ConversationContext
  ): string {
    const availableIntents = Object.values(StoreIntent).join(', ');
    
    return `You are an AI assistant for a sari-sari store (Filipino convenience store). Classify the customer's intent from their message.

Available intents: ${availableIntents}

Customer message: "${message}"

Context:
- Current conversation: ${context.conversationHistory.length} messages
- Previous intent: ${context.currentIntent || 'none'}
- Customer preferences: ${JSON.stringify(context.preferences)}

Respond with ONLY a JSON object in this format:
{
  "intent": "intent_name",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

<response>`;
  }

  /**
   * Build entity extraction prompt for local AI
   */
  private buildEntityExtractionPrompt(message: string): string {
    const availableEntityTypes = Object.values(EntityType).join(', ');
    
    return `Extract entities from the customer message for a sari-sari store.

Available entity types: ${availableEntityTypes}

Customer message: "${message}"

Respond with ONLY a JSON object in this format:
{
  "entities": [
    {
      "type": "entity_type",
      "value": "extracted_value",
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0
}

<response>`;
  }

  /**
   * Build response generation prompt for local AI
   */
  private buildResponseGenerationPrompt(
    intent: string,
    context: BusinessContext,
    message?: string
  ): string {
    const products = context.inventory
      .filter(p => p.sellable)
      .slice(0, 5) // Limit to avoid token overflow
      .map(p => `- ${p.name}: ${p.description} (₱${p.basePrice}/${p.unit})`)
      .join('\n');

    return `You are Aling Maria, a friendly sari-sari store owner in the Philippines. Respond to the customer naturally and helpfully.

Intent: ${intent}
${message ? `Original message: "${message}"` : ''}

Available products:
${products}

Guidelines:
- Be warm, friendly, and conversational
- Use simple Filipino-English (Taglish) occasionally for authenticity
- Suggest products when appropriate
- Be helpful with pricing and product information
- Keep responses concise but friendly

Respond naturally as Aling Maria:

<response>`;
  }

  /**
   * Parse intent classification response from local AI
   */
  private parseIntentResponse(response: string): IntentClassificationResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        intent: {
          name: parsed.intent || StoreIntent.UNKNOWN,
          confidence: parsed.confidence || 0.3,
          entities: []
        },
        confidence: parsed.confidence || 0.3
      };
    } catch (error) {
      logger.warn('Failed to parse intent response from local AI', { error, response });
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
   * Parse entity extraction response from local AI
   */
  private parseEntityResponse(response: string): EntityExtractionResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        entities: parsed.entities || [],
        confidence: parsed.confidence || 0.0
      };
    } catch (error) {
      logger.warn('Failed to parse entity response from local AI', { error, response });
      return {
        entities: [],
        confidence: 0.0
      };
    }
  }
}