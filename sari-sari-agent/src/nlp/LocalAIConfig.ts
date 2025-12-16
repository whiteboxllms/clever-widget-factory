/**
 * Local AI Configuration Helper
 * Provides configuration templates and setup guidance for local AI providers
 */

import { LocalProviderConfig } from './types';
import { logger } from '../utils/logger';

export interface LocalAISetup {
  provider: 'ollama' | 'lmstudio';
  name: string;
  description: string;
  requirements: {
    gpu: string[];
    ram: string;
    storage: string;
  };
  installation: string[];
  models: {
    recommended: string[];
    lightweight: string[];
    performance: string[];
  };
  defaultConfig: LocalProviderConfig;
}

/**
 * Pre-configured setups for different local AI providers
 */
export const LOCAL_AI_SETUPS: Record<string, LocalAISetup> = {
  ollama_rtx4060: {
    provider: 'ollama',
    name: 'Ollama with RTX 4060',
    description: 'Optimized setup for RTX 4060 8GB VRAM',
    requirements: {
      gpu: ['RTX 4060', 'RTX 4060 Ti', 'RTX 3060', 'RTX 3070'],
      ram: '16GB+ system RAM',
      storage: '10GB+ free space'
    },
    installation: [
      'Download Ollama from https://ollama.ai',
      'Install Ollama on your system',
      'Run: ollama pull llama3.1:8b',
      'Verify: ollama list',
      'Test: ollama run llama3.1:8b "Hello"'
    ],
    models: {
      recommended: ['llama3.1:8b', 'mistral:7b', 'phi3:mini'],
      lightweight: ['phi3:mini', 'gemma:2b', 'qwen2:1.5b'],
      performance: ['llama3.1:8b', 'mistral:7b', 'codellama:7b']
    },
    defaultConfig: {
      provider: 'ollama',
      endpoint: 'http://localhost:11434',
      model: 'llama3.1:8b',
      maxTokens: 500,
      temperature: 0.7
    }
  },

  lmstudio_rtx4060: {
    provider: 'lmstudio',
    name: 'LM Studio with RTX 4060',
    description: 'GUI-based local AI with RTX 4060 optimization',
    requirements: {
      gpu: ['RTX 4060', 'RTX 4060 Ti', 'RTX 3060', 'RTX 3070'],
      ram: '16GB+ system RAM',
      storage: '15GB+ free space'
    },
    installation: [
      'Download LM Studio from https://lmstudio.ai',
      'Install and launch LM Studio',
      'Search and download: "microsoft/Phi-3-mini-4k-instruct-gguf"',
      'Start local server on port 1234',
      'Test connection in LM Studio chat'
    ],
    models: {
      recommended: [
        'microsoft/Phi-3-mini-4k-instruct-gguf',
        'microsoft/Phi-3-small-8k-instruct-gguf',
        'meta-llama/Llama-3.2-3B-Instruct-gguf'
      ],
      lightweight: [
        'microsoft/Phi-3-mini-4k-instruct-gguf',
        'google/gemma-2-2b-it-gguf'
      ],
      performance: [
        'meta-llama/Llama-3.1-8B-Instruct-gguf',
        'mistralai/Mistral-7B-Instruct-v0.3-gguf'
      ]
    },
    defaultConfig: {
      provider: 'lmstudio',
      endpoint: 'http://localhost:1234',
      model: 'microsoft/Phi-3-mini-4k-instruct-gguf',
      maxTokens: 500,
      temperature: 0.7
    }
  }
};

/**
 * Local AI Configuration Manager
 */
export class LocalAIConfigManager {
  private static instance: LocalAIConfigManager;
  private currentSetup?: LocalAISetup;

  private constructor() {}

  static getInstance(): LocalAIConfigManager {
    if (!LocalAIConfigManager.instance) {
      LocalAIConfigManager.instance = new LocalAIConfigManager();
    }
    return LocalAIConfigManager.instance;
  }

  /**
   * Get recommended setup based on hardware
   */
  getRecommendedSetup(gpu?: string): LocalAISetup {
    // Default to RTX 4060 setup if no GPU specified
    if (!gpu || gpu.toLowerCase().includes('rtx 4060') || gpu.toLowerCase().includes('rtx 3060')) {
      return LOCAL_AI_SETUPS.ollama_rtx4060;
    }

    // For higher-end GPUs, still use the same setup but with performance models
    return LOCAL_AI_SETUPS.ollama_rtx4060;
  }

  /**
   * Get configuration for specific provider
   */
  getProviderConfig(provider: 'ollama' | 'lmstudio'): LocalProviderConfig {
    const setupKey = provider === 'ollama' ? 'ollama_rtx4060' : 'lmstudio_rtx4060';
    return LOCAL_AI_SETUPS[setupKey].defaultConfig;
  }

  /**
   * Validate local AI configuration
   */
  async validateConfig(config: LocalProviderConfig): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check endpoint format
    try {
      new URL(config.endpoint);
    } catch {
      issues.push('Invalid endpoint URL format');
    }

    // Check if endpoint is reachable
    try {
      const response = await fetch(`${config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        issues.push(`Endpoint not reachable: ${response.status}`);
        suggestions.push('Ensure your local AI service is running');
      }
    } catch (error) {
      issues.push('Cannot connect to local AI service');
      suggestions.push('Check if the service is running and the endpoint is correct');
    }

    // Check model configuration
    if (!config.model) {
      issues.push('No model specified');
      suggestions.push('Specify a model name in the configuration');
    }

    // Check token limits for RTX 4060
    if (config.maxTokens && config.maxTokens > 1000) {
      suggestions.push('Consider reducing maxTokens to 500-800 for better performance on RTX 4060');
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Generate setup instructions for user
   */
  generateSetupInstructions(provider: 'ollama' | 'lmstudio' = 'ollama'): string {
    const setupKey = provider === 'ollama' ? 'ollama_rtx4060' : 'lmstudio_rtx4060';
    const setup = LOCAL_AI_SETUPS[setupKey];

    return `
# ${setup.name} Setup Guide

## Description
${setup.description}

## Requirements
- GPU: ${setup.requirements.gpu.join(' or ')}
- RAM: ${setup.requirements.ram}
- Storage: ${setup.requirements.storage}

## Installation Steps
${setup.installation.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Recommended Models
### For RTX 4060 (8GB VRAM):
${setup.models.recommended.map(model => `- ${model}`).join('\n')}

### Lightweight Options:
${setup.models.lightweight.map(model => `- ${model}`).join('\n')}

## Configuration
Add this to your environment configuration:

\`\`\`json
{
  "localProvider": {
    "provider": "${setup.defaultConfig.provider}",
    "endpoint": "${setup.defaultConfig.endpoint}",
    "model": "${setup.defaultConfig.model}",
    "maxTokens": ${setup.defaultConfig.maxTokens},
    "temperature": ${setup.defaultConfig.temperature}
  }
}
\`\`\`

## Testing
After setup, test the connection:
1. Ensure the service is running
2. Check model availability
3. Test with a simple prompt
4. Monitor GPU usage and performance
`;
  }

  /**
   * Auto-detect available local AI services
   */
  async detectAvailableServices(): Promise<{
    ollama: boolean;
    lmstudio: boolean;
    endpoints: string[];
  }> {
    const results = {
      ollama: false,
      lmstudio: false,
      endpoints: [] as string[]
    };

    // Common endpoints to check
    const endpoints = [
      'http://localhost:11434', // Ollama default
      'http://localhost:1234',  // LM Studio default
      'http://127.0.0.1:11434',
      'http://127.0.0.1:1234'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        });

        if (response.ok) {
          results.endpoints.push(endpoint);
          
          // Detect service type based on endpoint
          if (endpoint.includes('11434')) {
            results.ollama = true;
          } else if (endpoint.includes('1234')) {
            results.lmstudio = true;
          }
        }
      } catch {
        // Service not available on this endpoint
      }
    }

    logger.info('Local AI service detection completed', results);
    return results;
  }

  /**
   * Get current setup
   */
  getCurrentSetup(): LocalAISetup | undefined {
    return this.currentSetup;
  }

  /**
   * Set current setup
   */
  setCurrentSetup(setup: LocalAISetup): void {
    this.currentSetup = setup;
    logger.info('Local AI setup configured', { 
      provider: setup.provider, 
      name: setup.name 
    });
  }
}

/**
 * Convenience function to get the config manager instance
 */
export function getLocalAIConfig(): LocalAIConfigManager {
  return LocalAIConfigManager.getInstance();
}

/**
 * Quick setup function for development
 */
export function createQuickLocalConfig(provider: 'ollama' | 'lmstudio' = 'ollama'): LocalProviderConfig {
  const manager = getLocalAIConfig();
  return manager.getProviderConfig(provider);
}