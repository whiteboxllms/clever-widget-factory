/**
 * Centralized Embedding Service
 * 
 * This is the single source of truth for all embedding operations across the application.
 * Supports both V1 and V2 Titan models with caching and error handling.
 * 
 * Usage patterns:
 * 1. Simple API (backward compatible): generateEmbedding(text)
 * 2. Advanced API with caching: new EmbeddingService(options)
 * 3. Batch processing: generateEmbeddings([text1, text2, ...])
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Shared Bedrock client instance
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

// Model configurations
const MODELS = {
  'titan-v1': {
    id: 'amazon.titan-embed-text-v1',
    dimensions: 1536,
    payloadFormat: (text) => ({ inputText: text })
  },
  'titan-v2': {
    id: 'amazon.titan-embed-text-v2:0',
    dimensions: 1024,
    payloadFormat: (text) => ({ 
      inputText: text,
      dimensions: 1024,
      normalize: true
    })
  }
};

// Default configuration
const DEFAULT_MODEL = 'titan-v1';
const DEFAULT_CACHE_SIZE = 1000;
const DEFAULT_CACHE_TTL = 3600000; // 1 hour

/**
 * Enhanced Embedding Service with caching and multi-model support
 */
class EmbeddingService {
  constructor(options = {}) {
    this.model = MODELS[options.model || DEFAULT_MODEL];
    if (!this.model) {
      throw new Error(`Unsupported model: ${options.model}`);
    }
    
    this.maxCacheSize = options.maxCacheSize || DEFAULT_CACHE_SIZE;
    this.cacheTTL = options.cacheTTL || DEFAULT_CACHE_TTL;
    this.enableCache = options.enableCache !== false;
    
    // In-memory cache
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // Statistics
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      errors: 0
    };
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to generate embedding for
   * @param {Object} options - Optional parameters
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateEmbedding(text, options = {}) {
    this.stats.totalRequests++;

    // Input validation with graceful error handling
    if (!text || typeof text !== 'string' || text.trim() === '') {
      this.stats.errors++;
      if (options.throwOnError !== false) {
        throw new Error('Text must be a non-empty string');
      }
      return null;
    }

    const normalizedText = this._normalizeText(text);

    // Check cache if enabled
    if (this.enableCache) {
      const cachedEmbedding = this._getCachedEmbedding(normalizedText);
      if (cachedEmbedding) {
        this.stats.cacheHits++;
        return cachedEmbedding;
      }
    }

    this.stats.cacheMisses++;

    try {
      const embedding = await this._callBedrockAPI(normalizedText);
      
      // Cache the result if caching is enabled
      if (this.enableCache) {
        this._cacheEmbedding(normalizedText, embedding);
      }
      
      return embedding;
    } catch (error) {
      this.stats.errors++;
      
      if (options.throwOnError !== false) {
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param {string[]} texts - Array of texts
   * @param {Object} options - Optional parameters
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateEmbeddings(texts, options = {}) {
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }

    const embeddings = [];
    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text, options);
        embeddings.push(embedding);
      } catch (error) {
        if (options.throwOnError !== false) {
          throw error;
        }
        embeddings.push(null);
      }
    }

    return embeddings;
  }

  /**
   * Call Bedrock API
   * @private
   */
  async _callBedrockAPI(text) {
    const command = new InvokeModelCommand({
      modelId: this.model.id,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(this.model.payloadFormat(text))
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
      throw new Error('Invalid response format from Bedrock API');
    }

    const embedding = responseBody.embedding;
    
    // Validate dimensions
    if (embedding.length !== this.model.dimensions) {
      console.warn(`Warning: Embedding has ${embedding.length} dimensions, expected ${this.model.dimensions}`);
    }

    return embedding;
  }

  /**
   * Normalize text for consistent caching
   * @private
   */
  _normalizeText(text) {
    return text.trim().toLowerCase();
  }

  /**
   * Get cached embedding if available and not expired
   * @private
   */
  _getCachedEmbedding(normalizedText) {
    if (!this.cache.has(normalizedText)) {
      return null;
    }

    const timestamp = this.cacheTimestamps.get(normalizedText);
    const now = Date.now();

    if (now - timestamp > this.cacheTTL) {
      this.cache.delete(normalizedText);
      this.cacheTimestamps.delete(normalizedText);
      return null;
    }

    return this.cache.get(normalizedText);
  }

  /**
   * Cache embedding with LRU eviction
   * @private
   */
  _cacheEmbedding(normalizedText, embedding) {
    if (this.cache.size >= this.maxCacheSize) {
      this._evictOldestCacheEntries();
    }

    this.cache.set(normalizedText, embedding);
    this.cacheTimestamps.set(normalizedText, Date.now());
  }

  /**
   * Evict oldest cache entries
   * @private
   */
  _evictOldestCacheEntries() {
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.1);
    const sortedEntries = Array.from(this.cacheTimestamps.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, entriesToRemove);

    for (const [key] of sortedEntries) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      model: this.model.id,
      dimensions: this.model.dimensions
    };
  }
}

// Singleton instance for backward compatibility
let defaultInstance = null;

/**
 * Generate embedding using default configuration (backward compatible)
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
async function generateEmbedding(text) {
  if (!defaultInstance) {
    defaultInstance = new EmbeddingService();
  }
  return defaultInstance.generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts using default configuration
 * @param {string[]} texts - Array of texts
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateEmbeddings(texts) {
  if (!defaultInstance) {
    defaultInstance = new EmbeddingService();
  }
  return defaultInstance.generateEmbeddings(texts);
}

/**
 * Generate embedding using V1 model (for embeddings-processor compatibility)
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
async function generateEmbeddingV1(text) {
  const service = new EmbeddingService({ model: 'titan-v1', enableCache: false });
  return service.generateEmbedding(text);
}

/**
 * Generate embedding using V2 model (for embeddings-processor compatibility)
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - 1024-dimensional embedding vector
 */
async function generateEmbeddingV2(text) {
  const service = new EmbeddingService({ model: 'titan-v2', enableCache: false });
  return service.generateEmbedding(text);
}

/**
 * Get default embedding service instance
 * @returns {EmbeddingService} - Default service instance
 */
function getDefaultEmbeddingService() {
  if (!defaultInstance) {
    defaultInstance = new EmbeddingService();
  }
  return defaultInstance;
}

/**
 * Create new embedding service with custom configuration
 * @param {Object} options - Configuration options
 * @returns {EmbeddingService} - New service instance
 */
function createEmbeddingService(options = {}) {
  return new EmbeddingService(options);
}

module.exports = {
  // Backward compatible API
  generateEmbedding,
  generateEmbeddings,
  
  // Multi-version API (for embeddings-processor)
  generateEmbeddingV1,
  generateEmbeddingV2,
  
  // Advanced API
  EmbeddingService,
  createEmbeddingService,
  getDefaultEmbeddingService,
  
  // Model configurations (for reference)
  MODELS,
  DEFAULT_MODEL
};
