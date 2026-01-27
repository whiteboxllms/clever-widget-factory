#!/bin/bash

# Deploy sari-sari-chat Lambda with SearchPipeline integration
# Usage: ./deploy-sari-sari-chat.sh

set -e

LAMBDA_NAME="cwf-sari-sari-chat"
REGION="us-west-2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$SCRIPT_DIR/../lambda/sari-sari-chat"
SHARED_DIR="$SCRIPT_DIR/../lambda/shared"

echo "🚀 Deploying $LAMBDA_NAME Lambda..."

# Navigate to lambda directory
cd "$LAMBDA_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create temporary build directory
echo "📦 Creating deployment package..."
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

# Copy lambda files
cp -r * "$BUILD_DIR/" 2>/dev/null || true
cp -r node_modules "$BUILD_DIR/" 2>/dev/null || true

# Copy shared directory
mkdir -p "$BUILD_DIR/shared"
cp "$SHARED_DIR"/*.js "$BUILD_DIR/shared/"

# Create zip from build directory
cd "$BUILD_DIR"
zip -r function.zip . -x "*.git*" "*.md" "node_modules/aws-sdk/*" > /dev/null

# Update Lambda function
echo "⬆️  Updating Lambda function..."
aws lambda update-function-code \
  --function-name $LAMBDA_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

# Wait for update to complete
echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
  --function-name $LAMBDA_NAME \
  --region $REGION

echo "✅ Deployment complete!"
echo ""
echo "Test the function:"
echo "aws lambda invoke --function-name $LAMBDA_NAME --payload '{\"body\":\"{\\\"message\\\":\\\"Show me vegetables\\\",\\\"sessionId\\\":\\\"test-123\\\"}\"}' --region $REGION response.json"
