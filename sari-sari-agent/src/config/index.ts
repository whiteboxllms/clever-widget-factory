/**
 * Configuration management for the Sari Sari Agent
 */

import { validateEnv } from '@/utils/validation';
import { ConfigurationError } from '@/utils/errors';

export interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
  connectionLimit: number;
  acquireTimeout: number;
  timeout: number;
}

export interface AWSConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface BedrockConfig {
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export interface SessionConfig {
  timeoutMinutes: number;
  maxConcurrentSessions: number;
  cleanupIntervalMinutes: number;
}

export interface CostConfig {
  monthlyBudgetUSD: number;
  alertThreshold: number; // 0.0 to 1.0
}

export interface FeatureFlags {
  enableLocalAI: boolean;
  enableVoiceInterface: boolean;
  enableMultilingual: boolean;
  enableNegotiation: boolean;
  enablePersonalities: boolean;
}

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  port: number;
  database: DatabaseConfig;
  aws: AWSConfig;
  bedrock: BedrockConfig;
  session: SessionConfig;
  cost: CostConfig;
  features: FeatureFlags;
}

function loadConfig(): AppConfig {
  try {
    // Validate environment variables
    const env = validateEnv();

    return {
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      port: parseInt(process.env.PORT || '3000', 10),

      database: {
        host: env.DB_HOST,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
        acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000', 10),
        timeout: parseInt(process.env.DB_TIMEOUT || '60000', 10)
      },

      aws: {
        region: env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      },

      bedrock: {
        modelId: env.BEDROCK_MODEL_ID,
        maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '1000', 10),
        temperature: parseFloat(process.env.BEDROCK_TEMPERATURE || '0.7')
      },

      session: {
        timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10),
        maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '100', 10),
        cleanupIntervalMinutes: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '5', 10)
      },

      cost: {
        monthlyBudgetUSD: parseFloat(process.env.MONTHLY_BUDGET_USD || '50'),
        alertThreshold: parseFloat(process.env.COST_ALERT_THRESHOLD || '0.8')
      },

      features: {
        enableLocalAI: process.env.ENABLE_LOCAL_AI === 'true',
        enableVoiceInterface: process.env.ENABLE_VOICE_INTERFACE === 'true',
        enableMultilingual: process.env.ENABLE_MULTILINGUAL === 'true',
        enableNegotiation: process.env.ENABLE_NEGOTIATION === 'true',
        enablePersonalities: process.env.ENABLE_PERSONALITIES === 'true'
      }
    };
  } catch (error) {
    throw new ConfigurationError(`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Load configuration once at startup
export const config = loadConfig();

// Helper functions
export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

export function isTest(): boolean {
  return config.nodeEnv === 'test';
}

// Validate critical configuration
export function validateConfig(): void {
  const errors: string[] = [];

  // Database validation
  if (!config.database.host) {
    errors.push('Database host is required');
  }
  if (!config.database.user) {
    errors.push('Database user is required');
  }
  if (!config.database.database) {
    errors.push('Database name is required');
  }

  // AWS validation (only in production)
  if (isProduction()) {
    if (!config.aws.region) {
      errors.push('AWS region is required in production');
    }
  }

  // Cost validation
  if (config.cost.monthlyBudgetUSD <= 0) {
    errors.push('Monthly budget must be positive');
  }
  if (config.cost.alertThreshold < 0 || config.cost.alertThreshold > 1) {
    errors.push('Cost alert threshold must be between 0 and 1');
  }

  if (errors.length > 0) {
    throw new ConfigurationError(`Configuration validation failed: ${errors.join(', ')}`);
  }
}

// Initialize configuration validation
validateConfig();