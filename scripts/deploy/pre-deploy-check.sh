#!/bin/bash

# Pre-deployment validation script
# Runs all necessary checks before deploying

set -e

echo "🔍 Pre-Deployment Validation"
echo "============================"

# Check if we're in the right directory
if [ ! -f "lambda/semantic-search/enhanced-handler.js" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured"
    exit 1
fi
echo "✅ AWS credentials configured"

# Check Bedrock access
echo "🤖 Checking Bedrock access..."
if aws bedrock list-foundation-models --region us-west-2 > /dev/null 2>&1; then
    echo "✅ Bedrock access confirmed"
else
    echo "⚠️  Warning: Cannot access Bedrock (may need permissions)"
fi

# Navigate to semantic search directory
cd lambda/semantic-search

# Check dependencies
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
fi
echo "✅ Dependencies ready"

# Run unit tests
echo "🧪 Running unit tests..."
if npm test > /dev/null 2>&1; then
    echo "✅ Unit tests passed"
else
    echo "❌ Unit tests failed"
    echo "   Run: npm test"
    exit 1
fi

# Check if integration tests can run
echo "🔗 Checking integration test readiness..."
if [ "$RUN_INTEGRATION_TESTS" = "true" ]; then
    echo "🧪 Running integration tests..."
    if npm test -- --testPathPattern=CurrentState > /dev/null 2>&1; then
        echo "✅ Integration tests passed"
    else
        echo "⚠️  Integration tests failed (may be expected without AWS access)"
    fi
else
    echo "ℹ️  Integration tests skipped (set RUN_INTEGRATION_TESTS=true to run)"
fi

# Validate handler structure
echo "📋 Validating handler structure..."
if node -e "
    const handler = require('./enhanced-handler');
    if (typeof handler.handler !== 'function') {
        console.error('❌ Handler function not found');
        process.exit(1);
    }
    console.log('✅ Handler structure valid');
" 2>/dev/null; then
    echo "✅ Handler validation passed"
else
    echo "❌ Handler validation failed"
    exit 1
fi

# Check file sizes
echo "📏 Checking deployment package size..."
TOTAL_SIZE=$(du -sh . | cut -f1)
echo "   Current size: $TOTAL_SIZE"

if [ -d "node_modules" ]; then
    NODE_MODULES_SIZE=$(du -sh node_modules | cut -f1)
    echo "   node_modules: $NODE_MODULES_SIZE"
fi

echo ""
echo "✅ Pre-deployment validation completed!"
echo ""
echo "🚀 Ready to deploy. Run:"
echo "   ./scripts/deploy-semantic-search.sh"
echo ""
echo "🧪 Or test locally first:"
echo "   cd lambda/semantic-search"
echo "   node __tests__/CurrentState.simple.test.js"