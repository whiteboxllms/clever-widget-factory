/**
 * Agent Factory - Simplified setup for the Sari Sari Agent
 */

import { AgentCore, AgentCoreConfig } from './AgentCore';
import { SessionManager } from './SessionManager';
import { NLPService } from '../nlp/NLPService';
import { InventoryService } from '../inventory/InventoryService';
import { PersonalityService } from '../personality/PersonalityService';
import { AIRouterConfig } from '../nlp/types';
import { logger } from '../utils/logger';

export interface AgentFactoryConfig {
  // NLP Configuration
  nlp?: {
    preferredProvider?: 'local' | 'bedrock';
    fallbackProvider?: 'local' | 'bedrock';
    localConfig?: {
      enabled: boolean;
      baseUrl?: string;
      model?: string;
    };
    bedrockConfig?: {
      enabled: boolean;
      region?: string;
      model?: string;
    };
  };
  
  // Session Configuration
  session?: {
    timeoutMs?: number;
    cleanupIntervalMs?: number;
  };
  
  // Personality Configuration
  personality?: {
    profileId?: string;
  };
}

export class AgentFactory {
  /**
   * Create a complete agent with default configuration
   */
  static async createAgent(config: AgentFactoryConfig = {}): Promise<AgentCore> {
    logger.info('Creating Sari Sari Agent with factory', { config });

    try {
      // Create NLP service
      const nlpConfig: AIRouterConfig = {
        preferredProvider: config.nlp?.preferredProvider || 'local',
        fallbackProvider: config.nlp?.fallbackProvider || 'bedrock',
        localConfig: {
          enabled: config.nlp?.localConfig?.enabled ?? false,
          baseUrl: config.nlp?.localConfig?.baseUrl || 'http://localhost:11434',
          model: config.nlp?.localConfig?.model || 'llama2'
        },
        bedrockConfig: {
          enabled: config.nlp?.bedrockConfig?.enabled ?? false,
          region: config.nlp?.bedrockConfig?.region || 'us-east-1',
          model: config.nlp?.bedrockConfig?.model || 'anthropic.claude-3-sonnet-20240229-v1:0'
        }
      };

      const nlpService = new NLPService(nlpConfig);

      // Create inventory service
      const inventoryService = new InventoryService();

      // Create session manager
      const sessionManager = new SessionManager();
      
      // Apply session configuration if provided
      if (config.session?.timeoutMs) {
        sessionManager.updateSessionTimeout(config.session.timeoutMs);
      }

      // Create personality service
      const personalityService = new PersonalityService();

      // Create agent core
      const agentCoreConfig: AgentCoreConfig = {
        nlpService,
        inventoryService,
        sessionManager,
        personalityService
      };

      const agentCore = new AgentCore(agentCoreConfig);

      logger.info('Sari Sari Agent created successfully');
      return agentCore;

    } catch (error) {
      logger.error('Failed to create agent', { error, config });
      throw error;
    }
  }

  /**
   * Create agent with local AI configuration
   */
  static async createLocalAgent(localConfig?: {
    baseUrl?: string;
    model?: string;
  }): Promise<AgentCore> {
    return this.createAgent({
      nlp: {
        preferredProvider: 'local',
        fallbackProvider: 'bedrock',
        localConfig: {
          enabled: true,
          baseUrl: localConfig?.baseUrl,
          model: localConfig?.model
        },
        bedrockConfig: {
          enabled: false
        }
      }
    });
  }

  /**
   * Create agent with cloud AI configuration
   */
  static async createCloudAgent(bedrockConfig?: {
    region?: string;
    model?: string;
  }): Promise<AgentCore> {
    return this.createAgent({
      nlp: {
        preferredProvider: 'bedrock',
        fallbackProvider: 'local',
        localConfig: {
          enabled: false
        },
        bedrockConfig: {
          enabled: true,
          region: bedrockConfig?.region,
          model: bedrockConfig?.model
        }
      }
    });
  }

  /**
   * Create agent for development/testing (no AI providers)
   */
  static async createTestAgent(): Promise<AgentCore> {
    return this.createAgent({
      nlp: {
        preferredProvider: 'local',
        fallbackProvider: 'bedrock',
        localConfig: {
          enabled: false
        },
        bedrockConfig: {
          enabled: false
        }
      }
    });
  }
}