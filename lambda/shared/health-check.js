/**
 * Health check utilities for embedding service
 * 
 * Provides runtime validation and monitoring capabilities
 */

const { EmbeddingService, generateEmbedding } = require('./embeddings');

/**
 * Comprehensive health check for embedding service
 * @param {Object} options - Health check options
 * @returns {Promise<Object>} - Health check results
 */
async function performHealthCheck(options = {}) {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'unknown',
    checks: {},
    errors: [],
    performance: {}
  };

  try {
    // 1. Basic connectivity test
    const connectivityStart = Date.now();
    try {
      const testEmbedding = await generateEmbedding('health check test');
      results.checks.connectivity = {
        status: 'pass',
        dimensions: testEmbedding.length,
        duration: Date.now() - connectivityStart
      };
      results.performance.basicCall = Date.now() - connectivityStart;
    } catch (error) {
      results.checks.connectivity = {
        status: 'fail',
        error: error.message,
        duration: Date.now() - connectivityStart
      };
      results.errors.push(`Connectivity: ${error.message}`);
    }

    // 2. Model validation test
    try {
      const service = new EmbeddingService({ model: 'titan-v1' });
      const v1Embedding = await service.generateEmbedding('model validation v1');
      
      const serviceV2 = new EmbeddingService({ model: 'titan-v2' });
      const v2Embedding = await serviceV2.generateEmbedding('model validation v2');

      results.checks.models = {
        status: 'pass',
        titanV1: { dimensions: v1Embedding.length, expected: 1536 },
        titanV2: { dimensions: v2Embedding.length, expected: 1024 }
      };

      if (v1Embedding.length !== 1536 || v2Embedding.length !== 1024) {
        results.errors.push('Model dimensions mismatch');
      }
    } catch (error) {
      results.checks.models = {
        status: 'fail',
        error: error.message
      };
      results.errors.push(`Models: ${error.message}`);
    }

    // 3. Caching test
    try {
      const cachedService = new EmbeddingService({ enableCache: true });
      const testText = 'cache validation test';

      const start1 = Date.now();
      await cachedService.generateEmbedding(testText);
      const firstCallTime = Date.now() - start1;

      const start2 = Date.now();
      await cachedService.generateEmbedding(testText);
      const secondCallTime = Date.now() - start2;

      const stats = cachedService.getStats();
      
      results.checks.caching = {
        status: 'pass',
        firstCallTime,
        secondCallTime,
        cacheHitRate: stats.hitRate,
        cacheWorking: secondCallTime < firstCallTime / 2
      };

      results.performance.cacheImprovement = firstCallTime / Math.max(secondCallTime, 1);
    } catch (error) {
      results.checks.caching = {
        status: 'fail',
        error: error.message
      };
      results.errors.push(`Caching: ${error.message}`);
    }

    // 4. Error handling test
    try {
      const service = new EmbeddingService();
      
      // Test graceful error handling
      const result = await service.generateEmbedding('', { throwOnError: false });
      
      results.checks.errorHandling = {
        status: result === null ? 'pass' : 'fail',
        gracefulDegradation: result === null
      };

      if (result !== null) {
        results.errors.push('Error handling: Should return null for invalid input');
      }
    } catch (error) {
      results.checks.errorHandling = {
        status: 'fail',
        error: error.message
      };
      results.errors.push(`Error handling: ${error.message}`);
    }

    // 5. Semantic search pipeline test
    try {
      const QueryRewriter = require('../semantic-search/src/pipeline/QueryRewriter');
      
      // Mock LLM client that fails to force regex fallback
      class MockLLMClient {
        async generate() {
          throw new Error('Mock LLM client - forcing regex fallback');
        }
      }
      
      const queryRewriter = new QueryRewriter(new MockLLMClient(), { fallbackToRegex: true });
      
      const testQuery = 'instant noodles under 20 pesos';
      const pipelineStart = Date.now();
      
      const queryComponents = await queryRewriter.rewrite(testQuery);
      const queryEmbedding = await generateEmbedding(queryComponents.semantic_query);
      
      const pipelineTime = Date.now() - pipelineStart;
      
      results.checks.semanticPipeline = {
        status: 'pass',
        processingTime: pipelineTime,
        semanticQuery: queryComponents.semantic_query,
        hasConstraints: queryComponents.price_min !== null || queryComponents.price_max !== null,
        embeddingDimensions: queryEmbedding.length
      };

      results.performance.semanticPipeline = pipelineTime;
      
      if (pipelineTime > 10000) { // 10 second warning threshold
        results.errors.push(`Semantic pipeline slow: ${pipelineTime}ms`);
      }
    } catch (error) {
      results.checks.semanticPipeline = {
        status: 'fail',
        error: error.message
      };
      results.errors.push(`Semantic pipeline: ${error.message}`);
    }

    // 6. Performance benchmark
    if (options.includeBenchmark) {
      try {
        const benchmarkTexts = [
          'short text',
          'This is a medium length text that should represent typical usage patterns for embedding generation.',
          'This is a much longer text that might be used for document embedding or other scenarios where we need to process larger amounts of text content. It should help us understand how the service performs with varying input sizes and whether there are any performance degradations with longer inputs.'
        ];

        const benchmarkStart = Date.now();
        const benchmarkResults = await Promise.all(
          benchmarkTexts.map(async (text, index) => {
            const start = Date.now();
            const embedding = await generateEmbedding(text);
            return {
              textLength: text.length,
              duration: Date.now() - start,
              embeddingLength: embedding.length
            };
          })
        );
        
        results.checks.performance = {
          status: 'pass',
          totalDuration: Date.now() - benchmarkStart,
          results: benchmarkResults,
          averageDuration: benchmarkResults.reduce((sum, r) => sum + r.duration, 0) / benchmarkResults.length
        };

        results.performance.benchmark = benchmarkResults;
      } catch (error) {
        results.checks.performance = {
          status: 'fail',
          error: error.message
        };
        results.errors.push(`Performance: ${error.message}`);
      }
    }

    // Determine overall status
    const failedChecks = Object.values(results.checks).filter(check => check.status === 'fail');
    results.status = failedChecks.length === 0 ? 'healthy' : 'unhealthy';
    results.summary = {
      totalChecks: Object.keys(results.checks).length,
      passedChecks: Object.values(results.checks).filter(check => check.status === 'pass').length,
      failedChecks: failedChecks.length,
      errors: results.errors.length
    };

  } catch (error) {
    results.status = 'error';
    results.errors.push(`Health check failed: ${error.message}`);
  }

  return results;
}

/**
 * Quick health check for monitoring systems
 * @returns {Promise<boolean>} - True if healthy
 */
async function isHealthy() {
  try {
    const embedding = await generateEmbedding('quick health check');
    return Array.isArray(embedding) && embedding.length > 0;
  } catch (error) {
    console.error('Health check failed:', error.message);
    return false;
  }
}

/**
 * Validate embedding service configuration
 * @returns {Object} - Configuration validation results
 */
function validateConfiguration() {
  const config = {
    region: process.env.AWS_REGION || 'us-west-2',
    hasCredentials: !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE),
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };

  const issues = [];
  
  if (config.region !== 'us-west-2') {
    issues.push(`Unexpected region: ${config.region}. Expected: us-west-2`);
  }

  if (!config.hasCredentials) {
    issues.push('No AWS credentials detected');
  }

  return {
    config,
    issues,
    isValid: issues.length === 0
  };
}

module.exports = {
  performHealthCheck,
  isHealthy,
  validateConfiguration
};