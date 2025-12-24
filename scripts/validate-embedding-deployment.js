#!/usr/bin/env node

/**
 * Pre-deployment validation script for embedding service
 * 
 * This script should be run before deploying to catch issues early:
 * - API connectivity
 * - Permission validation
 * - Format compatibility
 * - Performance benchmarks
 * 
 * Usage: node scripts/validate-embedding-deployment.js [--environment=staging]
 */

const { performHealthCheck, validateConfiguration } = require('../lambda/shared/health-check');

async function main() {
  const args = process.argv.slice(2);
  const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'development';
  
  console.log('🔍 Embedding Service Deployment Validation');
  console.log(`Environment: ${environment}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=' .repeat(50));

  let exitCode = 0;

  try {
    // 1. Configuration validation
    console.log('\n📋 Validating Configuration...');
    const configValidation = validateConfiguration();
    
    console.log(`Region: ${configValidation.config.region}`);
    console.log(`Node Version: ${configValidation.config.nodeVersion}`);
    console.log(`AWS Credentials: ${configValidation.config.hasCredentials ? '✅' : '❌'}`);
    
    if (configValidation.issues.length > 0) {
      console.log('\n⚠️  Configuration Issues:');
      configValidation.issues.forEach(issue => console.log(`  - ${issue}`));
      exitCode = 1;
    }

    // 2. Health check (including semantic pipeline)
    console.log('\n🏥 Running Health Check...');
    const healthCheck = await performHealthCheck({ includeBenchmark: true });
    
    console.log(`Overall Status: ${healthCheck.status === 'healthy' ? '✅' : '❌'} ${healthCheck.status}`);
    console.log(`Checks: ${healthCheck.summary.passedChecks}/${healthCheck.summary.totalChecks} passed`);
    
    if (healthCheck.errors.length > 0) {
      console.log('\n❌ Errors:');
      healthCheck.errors.forEach(error => console.log(`  - ${error}`));
      exitCode = 1;
    }

    // 3. Detailed check results
    console.log('\n📊 Detailed Results:');
    Object.entries(healthCheck.checks).forEach(([checkName, result]) => {
      const status = result.status === 'pass' ? '✅' : '❌';
      console.log(`  ${status} ${checkName}: ${result.status}`);
      
      if (result.duration) {
        console.log(`    Duration: ${result.duration}ms`);
      }
      
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });

    // 4. Performance metrics
    if (healthCheck.performance.benchmark) {
      console.log('\n⚡ Performance Benchmark:');
      healthCheck.performance.benchmark.forEach((result, index) => {
        console.log(`  Text ${index + 1} (${result.textLength} chars): ${result.duration}ms`);
      });
      console.log(`  Average: ${healthCheck.checks.performance.averageDuration.toFixed(2)}ms`);
    }

    // 5. Environment-specific validations
    if (environment === 'production') {
      console.log('\n🚀 Production-Specific Validations:');
      
      // Check performance thresholds
      const avgDuration = healthCheck.checks.performance?.averageDuration || 0;
      if (avgDuration > 5000) { // 5 second threshold
        console.log(`  ❌ Performance: Average duration ${avgDuration}ms exceeds 5000ms threshold`);
        exitCode = 1;
      } else {
        console.log(`  ✅ Performance: Average duration ${avgDuration}ms within threshold`);
      }

      // Check caching is working
      const cacheWorking = healthCheck.checks.caching?.cacheWorking;
      if (!cacheWorking) {
        console.log('  ❌ Caching: Cache performance improvement not detected');
        exitCode = 1;
      } else {
        console.log('  ✅ Caching: Cache performance improvement confirmed');
      }
    }

    // 6. Summary
    console.log('\n' + '='.repeat(50));
    if (exitCode === 0) {
      console.log('✅ All validations passed! Safe to deploy.');
    } else {
      console.log('❌ Validation failed! Do not deploy until issues are resolved.');
    }

  } catch (error) {
    console.error('\n💥 Validation script failed:', error.message);
    console.error(error.stack);
    exitCode = 1;
  }

  process.exit(exitCode);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}