/**
 * Session Manager - Handles conversation session lifecycle
 */

import { SessionManager as ISessionManager } from '../types/services';
import { 
  SessionInfo, 
  ConversationSession, 
  ConversationContext,
  CustomerPreferences,
  SessionStatus
} from '../types/core';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager implements ISessionManager {
  private sessions: Map<string, ConversationSession> = new Map();
  private readonly sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.info('Session Manager initialized', {
      sessionTimeout: this.sessionTimeoutMs,
      cleanupInterval: this.cleanupIntervalMs
    });
  }

  /**
   * Create a new conversation session
   */
  async createSession(customerId?: string): Promise<SessionInfo> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeoutMs);

    // Create default conversation context
    const context: ConversationContext = {
      entities: {},
      conversationHistory: [],
      preferences: this.createDefaultPreferences(),
      negotiationHistory: [],
      upsellAttempts: []
    };

    // Create session
    const session: ConversationSession = {
      sessionId,
      customerId,
      startTime: now,
      lastActivity: now,
      context,
      cart: [],
      status: 'active'
    };

    // Store session
    this.sessions.set(sessionId, session);

    logger.info('Session created', {
      sessionId,
      customerId,
      expiresAt
    });

    return {
      sessionId,
      customerId,
      startTime: now,
      expiresAt
    };
  }

  /**
   * Get existing session
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.debug('Session not found', { sessionId });
      return null;
    }

    // Check if session has expired
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
    
    if (timeSinceLastActivity > this.sessionTimeoutMs) {
      logger.info('Session expired', { 
        sessionId, 
        timeSinceLastActivity,
        timeout: this.sessionTimeoutMs 
      });
      
      // Mark as abandoned and remove
      session.status = 'abandoned';
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = now;
    
    logger.debug('Session retrieved', { 
      sessionId, 
      status: session.status,
      cartItems: session.cart.length 
    });

    return session;
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<ConversationSession>): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Apply updates
    Object.assign(session, updates);
    
    // Always update last activity
    session.lastActivity = new Date();

    logger.debug('Session updated', { 
      sessionId,
      updateKeys: Object.keys(updates)
    });
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn('Attempted to end non-existent session', { sessionId });
      return;
    }

    // Mark as completed
    session.status = 'completed';
    session.lastActivity = new Date();

    // Remove from active sessions
    this.sessions.delete(sessionId);

    logger.info('Session ended', { 
      sessionId,
      duration: session.lastActivity.getTime() - session.startTime.getTime(),
      cartItems: session.cart.length
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceLastActivity > this.sessionTimeoutMs) {
        // Mark as abandoned
        session.status = 'abandoned';
        this.sessions.delete(sessionId);
        cleanedCount++;
        
        logger.debug('Expired session cleaned up', { 
          sessionId,
          timeSinceLastActivity 
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired sessions cleaned up', { 
        cleanedCount,
        remainingSessions: this.sessions.size 
      });
    }

    return cleanedCount;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
  } {
    const activeSessions = this.sessions.size;
    const now = new Date();
    
    let totalDuration = 0;
    let sessionCount = 0;

    for (const session of this.sessions.values()) {
      const duration = now.getTime() - session.startTime.getTime();
      totalDuration += duration;
      sessionCount++;
    }

    const averageSessionDuration = sessionCount > 0 ? totalDuration / sessionCount : 0;

    return {
      activeSessions,
      totalSessions: sessionCount,
      averageSessionDuration
    };
  }

  /**
   * Get all active sessions (for admin/debugging)
   */
  getActiveSessions(): ConversationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Force expire a session
   */
  async expireSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.status = 'abandoned';
      this.sessions.delete(sessionId);
      
      logger.info('Session force expired', { sessionId });
    }
  }

  /**
   * Update session timeout
   */
  updateSessionTimeout(timeoutMs: number): void {
    // Note: This doesn't affect existing sessions, only new ones
    logger.info('Session timeout updated', { 
      oldTimeout: this.sessionTimeoutMs,
      newTimeout: timeoutMs 
    });
  }

  /**
   * Create default customer preferences
   */
  private createDefaultPreferences(): CustomerPreferences {
    return {
      language: 'en',
      communicationStyle: 'casual',
      favoriteCategories: [],
      dietaryRestrictions: []
    };
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Error during session cleanup', { error });
      }
    }, this.cleanupIntervalMs);

    logger.debug('Session cleanup timer started', {
      intervalMs: this.cleanupIntervalMs
    });
  }

  /**
   * Stop cleanup timer (for shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      
      logger.debug('Session cleanup timer stopped');
    }
  }

  /**
   * Shutdown session manager
   */
  async shutdown(): Promise<void> {
    this.stopCleanupTimer();
    
    // Mark all active sessions as abandoned
    for (const [sessionId, session] of this.sessions.entries()) {
      session.status = 'abandoned';
    }
    
    this.sessions.clear();
    
    logger.info('Session Manager shutdown complete');
  }
}