/**
 * Unit tests for ConversationSession model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationSessionModel, validateConversationSession, isValidConversationSession } from '@/models/ConversationSession';
import { ValidationError, SessionExpiredError } from '@/utils/errors';
import { createMockSession } from '../utils/test-helpers';

describe('ConversationSessionModel', () => {
  let mockSessionData: any;

  beforeEach(() => {
    mockSessionData = createMockSession();
    // Reset time mocks
    vi.useRealTimers();
  });

  describe('constructor and validation', () => {
    it('should create a valid session with minimal data', () => {
      const session = new ConversationSessionModel({});
      
      expect(session.sessionId).toBeDefined();
      expect(session.session.startTime).toBeInstanceOf(Date);
      expect(session.session.status).toBe('active');
      expect(session.session.cart).toEqual([]);
    });

    it('should create session with provided data', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      expect(session.sessionId).toBe(mockSessionData.sessionId);
      expect(session.customerId).toBe(mockSessionData.customerId);
    });

    it('should set default preferences', () => {
      const session = new ConversationSessionModel({});
      
      expect(session.session.context.preferences.language).toBe('en');
      expect(session.session.context.preferences.communicationStyle).toBe('casual');
      expect(session.session.context.preferences.favoriteCategories).toEqual([]);
    });

    it('should validate invalid session data', () => {
      const invalidData = {
        sessionId: '', // Invalid empty string
        status: 'invalid_status' // Invalid status
      };
      
      expect(() => new ConversationSessionModel(invalidData)).toThrow(ValidationError);
    });
  });

  describe('session lifecycle', () => {
    it('should identify active sessions', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      expect(session.isActive()).toBe(true);
      expect(session.isExpired()).toBe(false);
    });

    it('should detect expired sessions', () => {
      vi.useFakeTimers();
      
      const session = new ConversationSessionModel(mockSessionData, 0.01); // 0.01 minutes = 0.6 seconds
      
      // Advance time by 1 second
      vi.advanceTimersByTime(1000);
      
      expect(session.isExpired()).toBe(true);
      expect(session.isActive()).toBe(false);
      
      vi.useRealTimers();
    });

    it('should update activity timestamp', () => {
      const session = new ConversationSessionModel(mockSessionData);
      const originalActivity = session.session.lastActivity;
      
      // Wait a bit and update activity
      setTimeout(() => {
        session.updateActivity();
        expect(session.session.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
      }, 10);
    });

    it('should reactivate idle sessions on activity update', () => {
      const session = new ConversationSessionModel(mockSessionData);
      session.setStatus('idle');
      
      expect(session.session.status).toBe('idle');
      
      session.updateActivity();
      expect(session.session.status).toBe('active');
    });
  });

  describe('message management', () => {
    it('should add messages to conversation history', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      const message = session.addMessage('user', 'Hello, I need help');
      
      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, I need help');
      expect(message.timestamp).toBeInstanceOf(Date);
      
      expect(session.session.context.conversationHistory).toHaveLength(1);
    });

    it('should prevent adding messages to expired sessions', () => {
      vi.useFakeTimers();
      
      const session = new ConversationSessionModel(mockSessionData, 0.01);
      
      // Advance time to expire session
      vi.advanceTimersByTime(1000);
      
      expect(() => session.addMessage('user', 'Hello')).toThrow(SessionExpiredError);
      
      vi.useRealTimers();
    });

    it('should limit conversation history length', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      // Add more than 100 messages
      for (let i = 0; i < 105; i++) {
        session.addMessage('user', `Message ${i}`);
      }
      
      expect(session.session.context.conversationHistory).toHaveLength(100);
      
      // Should keep the most recent messages
      const lastMessage = session.session.context.conversationHistory[99];
      expect(lastMessage.content).toBe('Message 104');
    });

    it('should get recent messages', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      // Add several messages
      for (let i = 0; i < 15; i++) {
        session.addMessage('user', `Message ${i}`);
      }
      
      const recent = session.getRecentMessages(5);
      expect(recent).toHaveLength(5);
      expect(recent[4].content).toBe('Message 14');
    });
  });

  describe('intent and entity management', () => {
    it('should set and track current intent', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.setCurrentIntent('browse_products');
      expect(session.session.context.currentIntent).toBe('browse_products');
    });

    it('should manage entities', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.setEntity('product_category', 'vegetables');
      session.setEntity('price_range', [5, 20]);
      
      expect(session.getEntity('product_category')).toBe('vegetables');
      expect(session.getEntity('price_range')).toEqual([5, 20]);
      expect(session.getEntity('nonexistent')).toBeUndefined();
    });
  });

  describe('customer preferences', () => {
    it('should update customer preferences', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.updatePreferences({
        language: 'es',
        communicationStyle: 'formal',
        favoriteCategories: ['fruits', 'vegetables']
      });
      
      expect(session.session.context.preferences.language).toBe('es');
      expect(session.session.context.preferences.communicationStyle).toBe('formal');
      expect(session.session.context.preferences.favoriteCategories).toEqual(['fruits', 'vegetables']);
    });

    it('should validate preference updates', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      expect(() => {
        session.updatePreferences({
          communicationStyle: 'invalid_style' as any
        });
      }).toThrow(ValidationError);
    });
  });

  describe('cart management', () => {
    it('should add items to cart', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addToCart('product-1', 2, 5.99);
      
      expect(session.session.cart).toHaveLength(1);
      expect(session.session.cart[0].productId).toBe('product-1');
      expect(session.session.cart[0].quantity).toBe(2);
      expect(session.session.cart[0].unitPrice).toBe(5.99);
    });

    it('should update existing cart items', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addToCart('product-1', 2, 5.99);
      session.addToCart('product-1', 3, 6.99); // Same product, different price
      
      expect(session.session.cart).toHaveLength(1);
      expect(session.session.cart[0].quantity).toBe(5); // 2 + 3
      expect(session.session.cart[0].unitPrice).toBe(6.99); // Updated price
    });

    it('should validate cart item data', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      expect(() => session.addToCart('product-1', 0, 5.99)).toThrow(ValidationError);
      expect(() => session.addToCart('product-1', 2, -5.99)).toThrow(ValidationError);
    });

    it('should remove items from cart', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addToCart('product-1', 2, 5.99);
      session.addToCart('product-2', 1, 3.99);
      
      const removed = session.removeFromCart('product-1');
      
      expect(removed).toBe(true);
      expect(session.session.cart).toHaveLength(1);
      expect(session.session.cart[0].productId).toBe('product-2');
    });

    it('should handle removing non-existent items', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      const removed = session.removeFromCart('nonexistent-product');
      expect(removed).toBe(false);
    });

    it('should clear cart', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addToCart('product-1', 2, 5.99);
      session.addToCart('product-2', 1, 3.99);
      
      session.clearCart();
      
      expect(session.session.cart).toHaveLength(0);
    });

    it('should calculate cart total', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addToCart('product-1', 2, 5.99); // 11.98
      session.addToCart('product-2', 1, 3.99); // 3.99
      
      expect(session.getCartTotal()).toBe(15.97);
    });
  });

  describe('negotiation tracking', () => {
    it('should add negotiation attempts', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addNegotiationAttempt('product-1', 10.99, 8.00, 9.50, 'ongoing');
      
      expect(session.session.context.negotiationHistory).toHaveLength(1);
      
      const attempt = session.session.context.negotiationHistory[0];
      expect(attempt.productId).toBe('product-1');
      expect(attempt.originalPrice).toBe(10.99);
      expect(attempt.customerOffer).toBe(8.00);
      expect(attempt.agentCounterOffer).toBe(9.50);
      expect(attempt.outcome).toBe('ongoing');
    });

    it('should get negotiation history for specific product', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addNegotiationAttempt('product-1', 10.99, 8.00, 9.50, 'ongoing');
      session.addNegotiationAttempt('product-2', 5.99, 4.00, undefined, 'rejected');
      session.addNegotiationAttempt('product-1', 10.99, 9.50, undefined, 'accepted');
      
      const product1History = session.getProductNegotiationHistory('product-1');
      expect(product1History).toHaveLength(2);
      expect(product1History.every(attempt => attempt.productId === 'product-1')).toBe(true);
    });
  });

  describe('upsell tracking', () => {
    it('should add upsell attempts', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.addUpsellAttempt('product-2', 'Suggested based on cart contents', 'interested');
      
      expect(session.session.context.upsellAttempts).toHaveLength(1);
      
      const attempt = session.session.context.upsellAttempts[0];
      expect(attempt.suggestedProductId).toBe('product-2');
      expect(attempt.context).toBe('Suggested based on cart contents');
      expect(attempt.customerResponse).toBe('interested');
    });
  });

  describe('session status management', () => {
    it('should update session status', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.setStatus('idle');
      expect(session.session.status).toBe('idle');
      
      session.setStatus('completed');
      expect(session.session.status).toBe('completed');
    });

    it('should complete session', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.complete();
      expect(session.session.status).toBe('completed');
    });

    it('should abandon session', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      session.abandon();
      expect(session.session.status).toBe('abandoned');
    });
  });

  describe('session summary', () => {
    it('should generate session summary', () => {
      const session = new ConversationSessionModel(mockSessionData);
      
      // Add some activity
      session.addMessage('user', 'Hello');
      session.addMessage('agent', 'Hi there!');
      session.addToCart('product-1', 2, 5.99);
      session.addNegotiationAttempt('product-1', 5.99, 5.00);
      session.addUpsellAttempt('product-2', 'Related product');
      
      const summary = session.getSummary();
      
      expect(summary.sessionId).toBe(session.sessionId);
      expect(summary.messageCount).toBe(2);
      expect(summary.cartItems).toBe(1);
      expect(summary.cartTotal).toBe(11.98);
      expect(summary.negotiationAttempts).toBe(1);
      expect(summary.upsellAttempts).toBe(1);
      expect(summary.duration).toBeGreaterThan(0);
    });
  });

  describe('static methods', () => {
    it('should create new session', () => {
      const session = ConversationSessionModel.create('customer-123');
      
      expect(session.customerId).toBe('customer-123');
      expect(session.sessionId).toBeDefined();
      expect(session.isActive()).toBe(true);
    });

    it('should restore session from data', () => {
      const session = ConversationSessionModel.restore(mockSessionData);
      
      expect(session.sessionId).toBe(mockSessionData.sessionId);
      expect(session.customerId).toBe(mockSessionData.customerId);
    });

    it('should validate session data', () => {
      const validated = ConversationSessionModel.validate(mockSessionData);
      expect(validated.sessionId).toBe(mockSessionData.sessionId);
    });
  });

  describe('exported utility functions', () => {
    it('should validate conversation session data', () => {
      const validated = validateConversationSession(mockSessionData);
      expect(validated.sessionId).toBe(mockSessionData.sessionId);
    });

    it('should check if data is valid conversation session', () => {
      expect(isValidConversationSession(mockSessionData)).toBe(true);
      expect(isValidConversationSession({ invalid: 'data' })).toBe(false);
    });
  });
});