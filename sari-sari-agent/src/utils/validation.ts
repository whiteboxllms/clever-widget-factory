/**
 * Validation utilities using Zod for type-safe validation
 */

import { z } from 'zod';

// Product validation schemas
export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  unit: z.string().min(1),
  basePrice: z.number().positive(),
  stockQuantity: z.number().min(0),
  harvestDate: z.date().optional(),
  expiryDate: z.date().optional(),
  nutritionalInfo: z.record(z.number()).optional(),
  tags: z.array(z.string()),
  sellable: z.boolean()
});

export const ProductFilterSchema = z.object({
  category: z.string().optional(),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  inStock: z.boolean().optional(),
  sellableOnly: z.boolean().optional()
});

// Customer validation schemas
export const CustomerSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  preferredLanguage: z.string().default('en'),
  visitCount: z.number().min(0).default(1),
  totalSpent: z.number().min(0).default(0),
  favoriteCategories: z.array(z.string()).default([]),
  createdAt: z.date(),
  lastVisit: z.date()
});

// Session validation schemas
export const ConversationSessionSchema = z.object({
  sessionId: z.string().min(1),
  customerId: z.string().optional(),
  startTime: z.date(),
  lastActivity: z.date(),
  context: z.object({
    currentIntent: z.string().optional(),
    entities: z.record(z.any()),
    conversationHistory: z.array(z.object({
      id: z.string(),
      role: z.enum(['user', 'agent']),
      content: z.string(),
      timestamp: z.date(),
      metadata: z.record(z.any()).optional()
    })),
    preferences: z.object({
      language: z.string(),
      communicationStyle: z.enum(['formal', 'casual']),
      priceRange: z.tuple([z.number(), z.number()]).optional(),
      favoriteCategories: z.array(z.string()),
      dietaryRestrictions: z.array(z.string()).optional()
    }),
    negotiationHistory: z.array(z.object({
      productId: z.string(),
      originalPrice: z.number(),
      customerOffer: z.number().optional(),
      agentCounterOffer: z.number().optional(),
      outcome: z.enum(['accepted', 'rejected', 'ongoing']),
      timestamp: z.date()
    })),
    upsellAttempts: z.array(z.object({
      suggestedProductId: z.string(),
      context: z.string(),
      customerResponse: z.enum(['interested', 'declined', 'ignored']),
      timestamp: z.date()
    }))
  }),
  cart: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    reservationId: z.string().optional()
  })),
  status: z.enum(['active', 'idle', 'completed', 'abandoned'])
});

// Message validation
export const MessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'agent']),
  content: z.string().min(1),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

// Agent response validation
export const AgentResponseSchema = z.object({
  text: z.string().min(1),
  suggestions: z.array(z.string()).optional(),
  products: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    availability: z.enum(['in-stock', 'low-stock', 'out-of-stock']),
    description: z.string().optional()
  })).optional(),
  actions: z.array(z.object({
    type: z.enum(['add-to-cart', 'view-product', 'negotiate-price', 'checkout']),
    productId: z.string().optional(),
    data: z.record(z.any()).optional()
  })).optional(),
  metadata: z.object({
    sessionId: z.string(),
    timestamp: z.date(),
    processingTime: z.number(),
    confidence: z.number().optional(),
    intent: z.string().optional()
  })
});

// Validation helper functions
export function validateProduct(data: unknown) {
  return ProductSchema.parse(data);
}

export function validateCustomer(data: unknown) {
  return CustomerSchema.parse(data);
}

export function validateSession(data: unknown) {
  return ConversationSessionSchema.parse(data);
}

export function validateMessage(data: unknown) {
  return MessageSchema.parse(data);
}

export function validateAgentResponse(data: unknown) {
  return AgentResponseSchema.parse(data);
}

// Safe validation that returns result with error info
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// Environment variable validation
export const EnvSchema = z.object({
  DB_HOST: z.string().default('localhost'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('farm_db'),
  AWS_REGION: z.string().default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().default('anthropic.claude-3-sonnet-20240229-v1:0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export function validateEnv() {
  return EnvSchema.parse(process.env);
}