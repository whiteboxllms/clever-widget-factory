/**
 * NLP service type definitions
 */

import { Intent, Entity } from '../types/core';

export interface AIProvider {
  name: string;
  type: 'cloud' | 'local';
  available: boolean;
  costPerRequest?: number;
  latencyMs?: number;
}

export interface AIRouterConfig {
  preferredProvider: 'cloud' | 'local' | 'auto';
  fallbackProvider?: 'cloud' | 'local';
  costThreshold?: number; // Max cost per request
  latencyThreshold?: number; // Max acceptable latency in ms
  cloudProvider?: CloudProviderConfig;
  localProvider?: LocalProviderConfig;
}

export interface CloudProviderConfig {
  provider: 'bedrock' | 'openai' | 'anthropic';
  region?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LocalProviderConfig {
  provider: 'ollama' | 'lmstudio';
  endpoint: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface IntentClassificationResult {
  intent: Intent;
  confidence: number;
  alternativeIntents?: Intent[];
  metadata?: {
    provider: string;
    reasoning?: string;
    processingTime?: number;
    cost?: number;
  };
}

export interface EntityExtractionResult {
  entities: Entity[];
  confidence: number;
  metadata?: {
    provider: string;
    processingTime?: number;
    cost?: number;
  };
}

export interface ResponseGenerationResult {
  response: string;
  confidence: number;
  metadata?: {
    provider: string;
    processingTime: number;
    tokensUsed?: number;
    cost?: number;
    modelId?: string;
  };
}

export interface NLPMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  totalCost: number;
  providerUsage: Record<string, number>;
}

// Predefined intents for the sari-sari store
export enum StoreIntent {
  GREETING = 'greeting',
  BROWSE_PRODUCTS = 'browse_products',
  PRODUCT_INQUIRY = 'product_inquiry',
  PRICE_INQUIRY = 'price_inquiry',
  ADD_TO_CART = 'add_to_cart',
  REMOVE_FROM_CART = 'remove_from_cart',
  VIEW_CART = 'view_cart',
  CHECKOUT = 'checkout',
  NEGOTIATE_PRICE = 'negotiate_price',
  REQUEST_ALTERNATIVES = 'request_alternatives',
  ASK_RECOMMENDATIONS = 'ask_recommendations',
  COMPLAINT = 'complaint',
  FAREWELL = 'farewell',
  HELP = 'help',
  UNKNOWN = 'unknown'
}

// Predefined entity types
export enum EntityType {
  PRODUCT_NAME = 'product_name',
  PRODUCT_CATEGORY = 'product_category',
  QUANTITY = 'quantity',
  PRICE = 'price',
  UNIT = 'unit',
  QUALITY_DESCRIPTOR = 'quality_descriptor',
  TIME_REFERENCE = 'time_reference',
  PERSON_NAME = 'person_name',
  LOCATION = 'location'
}