/**
 * Unit tests for LocalAIConfig
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  LocalAIConfigManager, 
  getLocalAIConfig, 
  createQuickLocalConfig,
  LOCAL_AI_SETUPS 
} from '@/nlp/LocalAIConfig';
import { LocalProviderConfig } from '@/nlp/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout
vi.stubGlobal('AbortSignal', {
  timeout: vi.fn(() => ({
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
});

describe('LocalAIConfigManager', () => {
  let configManager: LocalAIConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    configManager = LocalAIConfigManager.getInstance();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LocalAIConfigManager.getInstance();
      const instance2 = LocalAIConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should work with convenience function', () => {
      const instance1 = getLocalAIConfig();
      const instance2 = LocalAIConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('setup recommendations', () => {
    it('should recommend RTX 4060 setup by default', () => {
      const setup = configManager.getRecommendedSetup();
      
      expect(setup.name).toBe('Ollama with RTX 4060');
      expect(setup.provider).toBe('ollama');
      expect(setup.requirements.gpu).toContain('RTX 4060');
    });

    it('should recommend RTX 4060 setup for RTX 4060 GPU', () => {
      const setup = configManager.getRecommendedSetup('RTX 4060');
      
      expect(setup.name).toBe('Ollama with RTX 4060');
      expect(setup.provider).toBe('ollama');
    });

    it('should recommend RTX 4060 setup for RTX 3060 GPU', () => {
      const setup = configManager.getRecommendedSetup('RTX 3060');
      
      expect(setup.name).toBe('Ollama with RTX 4060');
      expect(setup.provider).toBe('ollama');
    });

    it('should fallback to RTX 4060 setup for unknown GPU', () => {
      const setup = configManager.getRecommendedSetup('Unknown GPU');
      
      expect(setup.name).toBe('Ollama with RTX 4060');
      expect(setup.provider).toBe('ollama');
    });
  });

  describe('provider configuration', () => {
    it('should get Ollama configuration', () => {
      const config = configManager.getProviderConfig('ollama');
      
      expect(config.provider).toBe('ollama');
      expect(config.endpoint).toBe('http://localhost:11434');
      expect(config.model).toBe('llama3.1:8b');
      expect(config.maxTokens).toBe(500);
      expect(config.temperature).toBe(0.7);
    });

    it('should get LM Studio configuration', () => {
      const config = configManager.getProviderConfig('lmstudio');
      
      expect(config.provider).toBe('lmstudio');
      expect(config.endpoint).toBe('http://localhost:1234');
      expect(config.model).toBe('microsoft/Phi-3-mini-4k-instruct-gguf');
      expect(config.maxTokens).toBe(500);
      expect(config.temperature).toBe(0.7);
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configuration', async () => {
      const config: LocalProviderConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama3.1:8b',
        maxTokens: 500,
        temperature: 0.7
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      });

      const result = await configManager.validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect invalid endpoint URL', async () => {
      const config: LocalProviderConfig = {
        provider: 'ollama',
        endpoint: 'invalid-url',
        model: 'llama3.1:8b'
      };

      const result = await configManager.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Invalid endpoint URL format');
    });

    it('should detect unreachable endpoint', async () => {
      const config: LocalProviderConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama3.1:8b'
      };

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await configManager.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Cannot connect to local AI service');
      expect(result.suggestions).toContain('Check if the service is running and the endpoint is correct');
    });

    it('should detect HTTP errors', async () => {
      const config: LocalProviderConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama3.1:8b'
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      const result = await configManager.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Endpoint not reachable: 404');
      expect(result.suggestions).toContain('Ensure your local AI service is running');
    });

    it('should detect missing model', async () => {
      const config: LocalProviderConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: ''
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      });

      const result = await configManager.validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('No model specified');
      expect(result.suggestions).toContain('Specify a model name in the configuration');
    });

    it('should suggest token limit optimization for RTX 4060', async () => {
      const config: LocalProviderConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama3.1:8b',
        maxTokens: 2000
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      });

      const result = await configManager.validateConfig(config);

      expect(result.suggestions).toContain('Consider reducing maxTokens to 500-800 for better performance on RTX 4060');
    });
  });

  describe('setup instructions generation', () => {
    it('should generate Ollama setup instructions', () => {
      const instructions = configManager.generateSetupInstructions('ollama');

      expect(instructions).toContain('Ollama with RTX 4060 Setup Guide');
      expect(instructions).toContain('Download Ollama from https://ollama.ai');
      expect(instructions).toContain('ollama pull llama3.1:8b');
      expect(instructions).toContain('RTX 4060 (8GB VRAM)');
      expect(instructions).toContain('"provider": "ollama"');
      expect(instructions).toContain('"endpoint": "http://localhost:11434"');
    });

    it('should generate LM Studio setup instructions', () => {
      const instructions = configManager.generateSetupInstructions('lmstudio');

      expect(instructions).toContain('LM Studio with RTX 4060 Setup Guide');
      expect(instructions).toContain('Download LM Studio from https://lmstudio.ai');
      expect(instructions).toContain('microsoft/Phi-3-mini-4k-instruct-gguf');
      expect(instructions).toContain('Start local server on port 1234');
      expect(instructions).toContain('"provider": "lmstudio"');
      expect(instructions).toContain('"endpoint": "http://localhost:1234"');
    });

    it('should default to Ollama instructions', () => {
      const instructions = configManager.generateSetupInstructions();

      expect(instructions).toContain('Ollama with RTX 4060 Setup Guide');
    });
  });

  describe('service detection', () => {
    it('should detect available Ollama service', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        })
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'));

      const result = await configManager.detectAvailableServices();

      expect(result.ollama).toBe(true);
      expect(result.lmstudio).toBe(false);
      expect(result.endpoints).toContain('http://localhost:11434');
    });

    it('should detect available LM Studio service', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        })
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'));

      const result = await configManager.detectAvailableServices();

      expect(result.ollama).toBe(false);
      expect(result.lmstudio).toBe(true);
      expect(result.endpoints).toContain('http://localhost:1234');
    });

    it('should detect both services', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        });

      const result = await configManager.detectAvailableServices();

      expect(result.ollama).toBe(true);
      expect(result.lmstudio).toBe(true);
      expect(result.endpoints).toHaveLength(4);
    });

    it('should handle no services available', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await configManager.detectAvailableServices();

      expect(result.ollama).toBe(false);
      expect(result.lmstudio).toBe(false);
      expect(result.endpoints).toHaveLength(0);
    });
  });

  describe('setup management', () => {
    it('should get and set current setup', () => {
      expect(configManager.getCurrentSetup()).toBeUndefined();

      const setup = LOCAL_AI_SETUPS.ollama_rtx4060;
      configManager.setCurrentSetup(setup);

      expect(configManager.getCurrentSetup()).toBe(setup);
    });
  });
});

describe('convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createQuickLocalConfig', () => {
    it('should create Ollama config by default', () => {
      const config = createQuickLocalConfig();

      expect(config.provider).toBe('ollama');
      expect(config.endpoint).toBe('http://localhost:11434');
      expect(config.model).toBe('llama3.1:8b');
    });

    it('should create LM Studio config when specified', () => {
      const config = createQuickLocalConfig('lmstudio');

      expect(config.provider).toBe('lmstudio');
      expect(config.endpoint).toBe('http://localhost:1234');
      expect(config.model).toBe('microsoft/Phi-3-mini-4k-instruct-gguf');
    });
  });
});

describe('LOCAL_AI_SETUPS', () => {
  it('should have Ollama RTX 4060 setup', () => {
    const setup = LOCAL_AI_SETUPS.ollama_rtx4060;

    expect(setup).toBeDefined();
    expect(setup.provider).toBe('ollama');
    expect(setup.name).toBe('Ollama with RTX 4060');
    expect(setup.requirements.gpu).toContain('RTX 4060');
    expect(setup.installation).toContain('Download Ollama from https://ollama.ai');
    expect(setup.models.recommended).toContain('llama3.1:8b');
    expect(setup.defaultConfig.endpoint).toBe('http://localhost:11434');
  });

  it('should have LM Studio RTX 4060 setup', () => {
    const setup = LOCAL_AI_SETUPS.lmstudio_rtx4060;

    expect(setup).toBeDefined();
    expect(setup.provider).toBe('lmstudio');
    expect(setup.name).toBe('LM Studio with RTX 4060');
    expect(setup.requirements.gpu).toContain('RTX 4060');
    expect(setup.installation).toContain('Download LM Studio from https://lmstudio.ai');
    expect(setup.models.recommended).toContain('microsoft/Phi-3-mini-4k-instruct-gguf');
    expect(setup.defaultConfig.endpoint).toBe('http://localhost:1234');
  });

  it('should have consistent model recommendations', () => {
    const ollamaSetup = LOCAL_AI_SETUPS.ollama_rtx4060;
    const lmStudioSetup = LOCAL_AI_SETUPS.lmstudio_rtx4060;

    expect(ollamaSetup.models.recommended).toBeDefined();
    expect(ollamaSetup.models.lightweight).toBeDefined();
    expect(ollamaSetup.models.performance).toBeDefined();

    expect(lmStudioSetup.models.recommended).toBeDefined();
    expect(lmStudioSetup.models.lightweight).toBeDefined();
    expect(lmStudioSetup.models.performance).toBeDefined();
  });

  it('should have appropriate token limits for RTX 4060', () => {
    const ollamaSetup = LOCAL_AI_SETUPS.ollama_rtx4060;
    const lmStudioSetup = LOCAL_AI_SETUPS.lmstudio_rtx4060;

    expect(ollamaSetup.defaultConfig.maxTokens).toBeLessThanOrEqual(500);
    expect(lmStudioSetup.defaultConfig.maxTokens).toBeLessThanOrEqual(500);
  });
});