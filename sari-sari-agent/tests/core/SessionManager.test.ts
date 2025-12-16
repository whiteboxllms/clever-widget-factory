/**
 * Session Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../src/core/SessionManager';
import { ConversationSession, SessionStatus } from '../../src/types/core';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(async () => {
    await sessionManager.shutdown();
  });

  describe('session creation', () => {
    it('should create a new session without customer ID', async () => {
      const sessionInfo = await sessionManager.createSession();

      expect(sessionInfo.sessionId).toBeDefined();
      expect(sessionInfo.customerId).toBeUndefined();
      expect(sessionInfo.startTime).toBeInstanceOf(Date);
      expect(sessionInfo.expiresAt).toBeInstanceOf(Date);
      expect(sessionInfo.expiresAt.getTime()).toBeGreaterThan(sessionInfo.startTime.getTime());
    });

    it('should create a new session with customer ID', async () => {
      const customerId = 'customer-123';
      const sessionInfo = await sessionManager.createSession(customerId);

      expect(sessionInfo.sessionId).toBeDefined();
      expect(sessionInfo.customerId).toBe(customerId);
      expect(sessionInfo.startTime).toBeInstanceOf(Date);
      expect(sessionInfo.expiresAt).toBeInstanceOf(Date);
    });

    it('should create sessions with unique IDs', async () => {
      const session1 = await sessionManager.createSession();
      const session2 = await sessionManager.createSession();

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('session retrieval', () => {
    it('should retrieve an existing session', async () => {
      const sessionInfo = await sessionManager.createSession('customer-123');
      const session = await sessionManager.getSession(sessionInfo.sessionId);

      expect(session).toBeDefined();
      expect(session!.sessionId).toBe(sessionInfo.sessionId);
      expect(session!.customerId).toBe('customer-123');
      expect(session!.status).toBe('active');
      expect(session!.cart).toEqual([]);
      expect(session!.context.conversationHistory).toEqual([]);
    });

    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent-session');

      expect(session).toBeNull();
    });

    it('should update last activity when retrieving session', async () => {
      const sessionInfo = await sessionManager.createSession();
      const originalSession = await sessionManager.getSession(sessionInfo.sessionId);
      const originalLastActivity = originalSession!.lastActivity;

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedSession = await sessionManager.getSession(sessionInfo.sessionId);
      
      expect(updatedSession!.lastActivity.getTime()).toBeGreaterThan(originalLastActivity.getTime());
    });
  });

  describe('session updates', () => {
    it('should update session data', async () => {
      const sessionInfo = await sessionManager.createSession();
      
      const updates = {
        status: 'idle' as SessionStatus,
        cart: [{
          productId: 'product-1',
          quantity: 2,
          unitPrice: 5.00
        }]
      };

      await sessionManager.updateSession(sessionInfo.sessionId, updates);
      const session = await sessionManager.getSession(sessionInfo.sessionId);

      expect(session!.status).toBe('idle');
      expect(session!.cart).toHaveLength(1);
      expect(session!.cart[0].productId).toBe('product-1');
    });

    it('should throw error when updating non-existent session', async () => {
      await expect(
        sessionManager.updateSession('non-existent', { status: 'idle' })
      ).rejects.toThrow('Session non-existent not found');
    });

    it('should update last activity when updating session', async () => {
      const sessionInfo = await sessionManager.createSession();
      const originalSession = await sessionManager.getSession(sessionInfo.sessionId);
      const originalLastActivity = originalSession!.lastActivity;

      await new Promise(resolve => setTimeout(resolve, 10));

      await sessionManager.updateSession(sessionInfo.sessionId, { status: 'idle' });
      const updatedSession = await sessionManager.getSession(sessionInfo.sessionId);

      expect(updatedSession!.lastActivity.getTime()).toBeGreaterThan(originalLastActivity.getTime());
    });
  });

  describe('session ending', () => {
    it('should end an existing session', async () => {
      const sessionInfo = await sessionManager.createSession();
      
      await sessionManager.endSession(sessionInfo.sessionId);
      
      const session = await sessionManager.getSession(sessionInfo.sessionId);
      expect(session).toBeNull();
    });

    it('should handle ending non-existent session gracefully', async () => {
      await expect(
        sessionManager.endSession('non-existent-session')
      ).resolves.not.toThrow();
    });
  });

  describe('session expiration', () => {
    it('should return null for expired session', async () => {
      // Create session manager with very short timeout for testing
      const shortTimeoutManager = new SessionManager();
      
      // Mock the timeout to be very short
      (shortTimeoutManager as any).sessionTimeoutMs = 1; // 1ms timeout
      
      const sessionInfo = await shortTimeoutManager.createSession();
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const session = await shortTimeoutManager.getSession(sessionInfo.sessionId);
      expect(session).toBeNull();
      
      await shortTimeoutManager.shutdown();
    });

    it('should clean up expired sessions', async () => {
      const shortTimeoutManager = new SessionManager();
      (shortTimeoutManager as any).sessionTimeoutMs = 1; // 1ms timeout
      
      // Create multiple sessions
      await shortTimeoutManager.createSession();
      await shortTimeoutManager.createSession();
      await shortTimeoutManager.createSession();
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const cleanedCount = await shortTimeoutManager.cleanupExpiredSessions();
      expect(cleanedCount).toBe(3);
      
      await shortTimeoutManager.shutdown();
    });
  });

  describe('session statistics', () => {
    it('should return correct session statistics', async () => {
      await sessionManager.createSession();
      await sessionManager.createSession();
      
      // Wait a bit to ensure some duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = sessionManager.getSessionStats();
      
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalSessions).toBe(2);
      expect(stats.averageSessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should return zero statistics when no sessions exist', () => {
      const stats = sessionManager.getSessionStats();
      
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.averageSessionDuration).toBe(0);
    });
  });

  describe('active sessions management', () => {
    it('should return all active sessions', async () => {
      const session1 = await sessionManager.createSession('customer-1');
      const session2 = await sessionManager.createSession('customer-2');
      
      const activeSessions = sessionManager.getActiveSessions();
      
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(s => s.sessionId)).toContain(session1.sessionId);
      expect(activeSessions.map(s => s.sessionId)).toContain(session2.sessionId);
    });

    it('should force expire a session', async () => {
      const sessionInfo = await sessionManager.createSession();
      
      await sessionManager.expireSession(sessionInfo.sessionId);
      
      const session = await sessionManager.getSession(sessionInfo.sessionId);
      expect(session).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      await sessionManager.createSession();
      await sessionManager.createSession();
      
      await sessionManager.shutdown();
      
      const stats = sessionManager.getSessionStats();
      expect(stats.activeSessions).toBe(0);
    });
  });

  describe('default preferences', () => {
    it('should create sessions with default preferences', async () => {
      const sessionInfo = await sessionManager.createSession();
      const session = await sessionManager.getSession(sessionInfo.sessionId);
      
      expect(session!.context.preferences).toEqual({
        language: 'en',
        communicationStyle: 'casual',
        favoriteCategories: [],
        dietaryRestrictions: []
      });
    });
  });
});