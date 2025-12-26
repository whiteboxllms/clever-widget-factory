# Centralized Embedding Service

This is the single source of truth for all embedding operations across the CWF application.

## Features

- **Backward Compatible**: Drop-in replacement for existing `generateEmbedding()` calls
- **Multi-Model Support**: Supports both Titan V1 (1536 dims) and Titan V2 (1024 dims)
- **Caching**: In-memory caching with TTL and LRU eviction
- **Error Handling**: Graceful degradation and detailed error reporting
- **Statistics**: Performance tracking and cache hit rates
- **Batch Processing**: Generate embeddings for multiple texts efficiently

## Usage

### Simple API (Backward Compatible)

```javascript
const { generateEmbedding } = require('../shared/embeddings');

// Generate single embedding
const embedding = await generateEmbedding('search query text');

// Generate multiple embeddings
const embeddings = await generateEmbeddings(['text1', 'text2', 'text3']);
```

### Advanced API with Caching

```javascript
const { EmbeddingService } = require('../shared/embeddings');

// Create service with caching
const embeddingService = new EmbeddingService({
  model: 'titan-v1',        // or 'titan-v2'
  enableCache: true,
  maxCacheSize: 1000,
  cacheTTL: 3600000        // 1 hour
});

const embedding = await embeddingService.generateEmbedding('query text');
const stats = embeddingService.getStats();
console.log(`Cache hit rate: ${stats.hitRate}`);
```

### Multi-Version API (for embeddings-processor)

```javascript
const { generateEmbeddingV1, generateEmbeddingV2 } = require('../shared/embeddings');

// Generate V1 embedding (1536 dimensions)
const embeddingV1 = await generateEmbeddingV1('text');

// Generate V2 embedding (1024 dimensions)  
const embeddingV2 = await generateEmbeddingV2('text');
```

## Model Configuration

The service supports centralized model configuration:

```javascript
const { MODELS } = require('../shared/embeddings');

console.log(MODELS['titan-v1'].id);         // 'amazon.titan-embed-text-v1'
console.log(MODELS['titan-v1'].dimensions); // 1536

console.log(MODELS['titan-v2'].id);         // 'amazon.titan-embed-text-v2:0'
console.log(MODELS['titan-v2'].dimensions); // 1024
```

## Migration Guide

### From Existing Code

**Before:**
```javascript
const { generateEmbedding } = require('./shared/embeddings');
```

**After:**
```javascript
const { generateEmbedding } = require('../shared/embeddings');
```

No other changes needed - the API is fully backward compatible.

### From embeddings-processor

The embeddings-processor has been updated to use the centralized service:

**Before:**
```javascript
// Duplicate Bedrock API calls in embeddings-processor/index.js
```

**After:**
```javascript
const { generateEmbeddingV1, generateEmbeddingV2 } = require('../shared/embeddings');
```

## Benefits

1. **Single Source of Truth**: All embedding logic in one place
2. **Easy Model Switching**: Change from V1 to V2 in one configuration
3. **Performance**: Built-in caching reduces API calls
4. **Consistency**: Same embedding generation across all services
5. **Maintainability**: Updates and fixes apply everywhere
6. **Monitoring**: Centralized statistics and error tracking

## Architecture

```
lambda/shared/embeddings.js
├── EmbeddingService (class)
│   ├── generateEmbedding()
│   ├── generateEmbeddings()
│   ├── caching logic
│   └── statistics tracking
├── generateEmbedding() (backward compatible)
├── generateEmbeddingV1() (for processor)
├── generateEmbeddingV2() (for processor)
└── MODELS configuration

Used by:
├── lambda/semantic-search/enhanced-handler.js
├── lambda/embeddings-processor/index.js
└── Any future Lambda functions
```

This centralized approach ensures that when we need to switch to Titan V2 or any other model, we only need to change the configuration in one place.