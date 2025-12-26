#!/bin/bash

# Deploy semantic search Lambda with enhanced pipeline
# This script packages and deploys the current implementation

set -e

echo "🚀 Deploying Enhanced Semantic Search Lambda"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "lambda/semantic-search/enhanced-handler.js" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured"
    echo "   Run: aws configure"
    exit 1
fi

# Navigate to semantic search directory
cd lambda/semantic-search

echo "📦 Installing dependencies..."
npm install

echo "🧪 Running basic tests..."
npm test

echo "📋 Checking current Lambda function..."
FUNCTION_NAME="cwf-semantic-search"
if aws lambda get-function --function-name $FUNCTION_NAME > /dev/null 2>&1; then
    echo "✅ Lambda function '$FUNCTION_NAME' exists"
else
    echo "❌ Lambda function '$FUNCTION_NAME' not found"
    echo "   Please create the Lambda function first or update FUNCTION_NAME"
    exit 1
fi

echo "📦 Creating deployment package..."
# Create a clean deployment directory
rm -rf deploy
mkdir deploy

# Copy source files
cp -r src/ deploy/
cp enhanced-handler.js deploy/
cp package.json deploy/

# Copy shared utilities (all from lambda/shared)
mkdir -p deploy/shared
cp ../shared/*.js deploy/shared/

# Install production dependencies
cd deploy
npm install --production

echo "🗜️  Creating ZIP package..."
zip -r ../semantic-search-enhanced.zip . > /dev/null

cd ..

echo "🚀 Deploying to AWS Lambda..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://semantic-search-enhanced.zip

echo "⚙️  Updating function configuration..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout 30 \
    --memory-size 512 \
    --environment Variables='{
        "NODE_ENV":"production",
        "AWS_REGION":"us-west-2"
    }'

echo "🧹 Cleaning up..."
rm -rf deploy
rm semantic-search-enhanced.zip

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🧪 Test the deployment:"
echo "   1. Run integration test:"
echo "      cd lambda/semantic-search"
echo "      RUN_INTEGRATION_TESTS=true npm test -- --testPathPattern=CurrentState"
echo ""
echo "   2. Test via API:"
echo "      node ../../sari-sari-agent/test-semantic-api.js"
echo ""
echo "   3. Test enhanced mode in GUI:"
echo "      Add 'enhanced: true' to API calls"
echo ""
echo "🌐 API Endpoint:"
echo "   https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/semantic-search"