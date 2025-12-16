/**
 * ConversationSession model with context and state management
 * Handles session lifecycle, conversation history, and customer interactions
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { 
  ConversationSession, 
  ConversationContext, 
  Message, 
  CartItem, 
  SessionStatus,
  CustomerPreferences,
  NegotiationAttempt,
  UpsellAttempt
} from '@/types/core';
import { ValidationError, SessionExpiredError } from '@/utils/errors';
import { logger } from '@/utils/logger';

// Validation schemas
const MessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'agent']),
  content: z.string().min(1),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

const CustomerPreferencesSchema = z.object({
  language: z.string().default('en'),
  communicationStyle: z.enum(['formal', 'casual']).default('casual'),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  favoriteCategories: z.array(z.string()).default([]),
  dietaryRestrictions: z.array(z.string()).optional()
});

const NegotiationAttemptSchema = z.object({
  productId: z.string().min(1),
  originalPrice: z.number().positive(),
  customerOffer: z.number().positive().optional(),
  agentCounterOffer: z.number().positive().optional(),
  outcome: z.enum(['accepted', 'rejected', 'ongoing']),
  timestamp: z.date()
});

const UpsellAttemptSchema = z.object({
  suggestedProductId: z.string().min(1),
  context: z.string().min(1),
  customerResponse: z.enum(['interested', 'declined', 'ignored']),
  timestamp: z.date()
});

const ConversationContextSchema = z.object({
  currentIntent: z.string().optional(),
  entities: z.record(z.any()).default({}),
  conversationHistory: z.array(MessageSchema).default([]),
  preferences: CustomerPreferencesSchema,
  negotiationHistory: z.array(NegotiationAttemptSchema).default([]),
  upsellAttempts: z.array(UpsellAttemptSchema).default([])
});

const CartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  reservationId: z.string().optional()
});

const ConversationSessionSchema = z.object({
  sessionId: z.string().min(1),
  customerId: z.string().optional(),
  startTime: z.date(),
  lastActivity: z.date(),
  context: ConversationContextSchema,
  cart: z.array(CartItemSchema).default([]),
  status: z.enum(['active', 'idle', 'completed', 'abandoned']).default('active')
});

export class ConversationSessionModel {
  private data: ConversationSession;
  private readonly sessionTimeoutMs: number;

  constructor(sessionData: Partial<ConversationSession>, timeoutMinutes: number = 30) {
    this.sessionTimeoutMs = timeoutMinutes * 60 * 1000;
    this.data = this.validateAndInitialize(sessionData);
  }

  /**
   * Validate and initialize session data
   */
  private validateAndInitialize(sessionData: Partial<ConversationSession>): ConversationSession {
    try {
      // Set defaults for required fields
      const normalized = {
        sessionId: sessionData.sessionId || uuidv4(),
        startTime: sessionData.startTime || new Date(),
        lastActivity: sessionData.lastActivity || new Date(),
        context: {
          currentIntent: undefined,
          entities: {},
          conversationHistory: [],
          preferences: {
            language: 'en',
            communicationStyle: 'casual' as const,
            favoriteCategories: []
          },
          negotiationHistory: [],
          upsellAttempts: [],
          ...sessionData.context
        },
        cart: [],
        status: 'active' as const,
        ...sessionData
      };

      const validated = ConversationSessionSchema.parse(normalized);
      
      logger.debug('Conversation session validated', { 
        sessionId: validated.sessionId,
        customerId: validated.customerId 
      });
      
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(`Session validation failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Get session data
   */
  get session(): ConversationSession {
    return { ...this.data };
  }

  /**
   * Get session ID
   */
  get sessionId(): string {
    return this.data.sessionId;
  }

  /**
   * Get customer ID if available
   */
  get customerId(): string | undefined {
    return this.data.customerId;
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    const now = Date.now();
    const lastActivity = this.data.lastActivity.getTime();
    return (now - lastActivity) > this.sessionTimeoutMs;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.data.status === 'active' && !this.isExpired();
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.data.lastActivity = new Date();
    
    // Reactivate session if it was idle
    if (this.data.status === 'idle') {
      this.data.status = 'active';
    }
  }

  /**
   * Add message to conversation history
   */
  addMessage(role: 'user' | 'agent', content: string, metadata?: Record<string, any>): Message {
    if (this.isExpired()) {
      throw new SessionExpiredError(this.data.sessionId);
    }

    const message: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    // Validate message
    MessageSchema.parse(message);

    this.data.context.conversationHistory.push(message);
    this.updateActivity();

    // Limit conversation history to prevent memory issues
    const maxHistoryLength = 100;
    if (this.data.context.conversationHistory.length > maxHistoryLength) {
      this.data.context.conversationHistory = this.data.context.conversationHistory.slice(-maxHistoryLength);
    }

    logger.debug('Message added to conversation', {
      sessionId: this.data.sessionId,
      role,
      messageLength: content.length,
      historyLength: this.data.context.conversationHistory.length
    });

    return message;
  }

  /**
   * Get recent conversation history
   */
  getRecentMessages(count: number = 10): Message[] {
    return this.data.context.conversationHistory.slice(-count);
  }

  /**
   * Set current intent
   */
  setCurrentIntent(intent: string): void {
    this.data.context.currentIntent = intent;
    this.updateActivity();
    
    logger.debug('Intent updated', {
      sessionId: this.data.sessionId,
      intent
    });
  }

  /**
   * Add or update entity
   */
  setEntity(key: string, value: any): void {
    this.data.context.entities[key] = value;
    this.updateActivity();
  }

  /**
   * Get entity value
   */
  getEntity(key: string): any {
    return this.data.context.entities[key];
  }

  /**
   * Update customer preferences
   */
  updatePreferences(preferences: Partial<CustomerPreferences>): void {
    this.data.context.preferences = {
      ...this.data.context.preferences,
      ...preferences
    };
    
    // Validate updated preferences
    CustomerPreferencesSchema.parse(this.data.context.preferences);
    this.updateActivity();
    
    logger.debug('Customer preferences updated', {
      sessionId: this.data.sessionId,
      preferences: Object.keys(preferences)
    });
  }

  /**
   * Add item to cart
   */
  addToCart(productId: string, quantity: number, unitPrice: number, reservationId?: string): void {
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }
    if (unitPrice <= 0) {
      throw new ValidationError('Unit price must be positive');
    }

    // Check if item already exists in cart
    const existingItemIndex = this.data.cart.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      this.data.cart[existingItemIndex].quantity += quantity;
      this.data.cart[existingItemIndex].unitPrice = unitPrice; // Update to latest price
    } else {
      // Add new item
      const cartItem: CartItem = {
        productId,
        quantity,
        unitPrice,
        reservationId
      };
      
      CartItemSchema.parse(cartItem);
      this.data.cart.push(cartItem);
    }

    this.updateActivity();
    
    logger.info('Item added to cart', {
      sessionId: this.data.sessionId,
      productId,
      quantity,
      cartSize: this.data.cart.length
    });
  }

  /**
   * Remove item from cart
   */
  removeFromCart(productId: string): boolean {
    const initialLength = this.data.cart.length;
    this.data.cart = this.data.cart.filter(item => item.productId !== productId);
    
    const removed = this.data.cart.length < initialLength;
    if (removed) {
      this.updateActivity();
      logger.info('Item removed from cart', {
        sessionId: this.data.sessionId,
        productId,
        cartSize: this.data.cart.length
      });
    }
    
    return removed;
  }

  /**
   * Clear cart
   */
  clearCart(): void {
    const itemCount = this.data.cart.length;
    this.data.cart = [];
    this.updateActivity();
    
    logger.info('Cart cleared', {
      sessionId: this.data.sessionId,
      itemsRemoved: itemCount
    });
  }

  /**
   * Get cart total
   */
  getCartTotal(): number {
    return this.data.cart.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
  }

  /**
   * Add negotiation attempt
   */
  addNegotiationAttempt(
    productId: string, 
    originalPrice: number, 
    customerOffer?: number, 
    agentCounterOffer?: number,
    outcome: 'accepted' | 'rejected' | 'ongoing' = 'ongoing'
  ): void {
    const attempt: NegotiationAttempt = {
      productId,
      originalPrice,
      customerOffer,
      agentCounterOffer,
      outcome,
      timestamp: new Date()
    };

    NegotiationAttemptSchema.parse(attempt);
    this.data.context.negotiationHistory.push(attempt);
    this.updateActivity();

    logger.info('Negotiation attempt recorded', {
      sessionId: this.data.sessionId,
      productId,
      outcome
    });
  }

  /**
   * Get negotiation history for a product
   */
  getProductNegotiationHistory(productId: string): NegotiationAttempt[] {
    return this.data.context.negotiationHistory.filter(attempt => attempt.productId === productId);
  }

  /**
   * Add upsell attempt
   */
  addUpsellAttempt(
    suggestedProductId: string, 
    context: string, 
    customerResponse: 'interested' | 'declined' | 'ignored' = 'ignored'
  ): void {
    const attempt: UpsellAttempt = {
      suggestedProductId,
      context,
      customerResponse,
      timestamp: new Date()
    };

    UpsellAttemptSchema.parse(attempt);
    this.data.context.upsellAttempts.push(attempt);
    this.updateActivity();

    logger.info('Upsell attempt recorded', {
      sessionId: this.data.sessionId,
      suggestedProductId,
      customerResponse
    });
  }

  /**
   * Set session status
   */
  setStatus(status: SessionStatus): void {
    this.data.status = status;
    this.updateActivity();
    
    logger.info('Session status updated', {
      sessionId: this.data.sessionId,
      status
    });
  }

  /**
   * Mark session as completed
   */
  complete(): void {
    this.setStatus('completed');
  }

  /**
   * Mark session as abandoned
   */
  abandon(): void {
    this.setStatus('abandoned');
  }

  /**
   * Get session summary for analytics
   */
  getSummary(): {
    sessionId: string;
    customerId?: string;
    duration: number;
    messageCount: number;
    cartItems: number;
    cartTotal: number;
    negotiationAttempts: number;
    upsellAttempts: number;
    status: SessionStatus;
  } {
    const duration = this.data.lastActivity.getTime() - this.data.startTime.getTime();
    
    return {
      sessionId: this.data.sessionId,
      customerId: this.data.customerId,
      duration,
      messageCount: this.data.context.conversationHistory.length,
      cartItems: this.data.cart.length,
      cartTotal: this.getCartTotal(),
      negotiationAttempts: this.data.context.negotiationHistory.length,
      upsellAttempts: this.data.context.upsellAttempts.length,
      status: this.data.status
    };
  }

  /**
   * Create new session
   */
  static create(customerId?: string, timeoutMinutes?: number): ConversationSessionModel {
    return new ConversationSessionModel({ customerId }, timeoutMinutes);
  }

  /**
   * Restore session from stored data
   */
  static restore(sessionData: ConversationSession, timeoutMinutes?: number): ConversationSessionModel {
    return new ConversationSessionModel(sessionData, timeoutMinutes);
  }

  /**
   * Validate session data
   */
  static validate(sessionData: unknown): ConversationSession {
    return ConversationSessionSchema.parse(sessionData);
  }
}

// Export validation functions
export function validateConversationSession(data: unknown): ConversationSession {
  return ConversationSessionModel.validate(data);
}

export function isValidConversationSession(data: unknown): data is ConversationSession {
  try {
    ConversationSessionModel.validate(data);
    return true;
  } catch {
    return false;
  }
}