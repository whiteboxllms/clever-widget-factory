#!/bin/bash
set -e

FUNCTION_NAME="cwf-embeddings-processor"
REGION="us-west-2"

echo "🚀 Deploying $FUNCTION_NAME..."

# Copy shared files into Lambda directory
echo "📋 Copying shared files..."
cp ../shared/ai-summarizer.js .
cp ../shared/embedding-composition.js .

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create deployment package
echo "🗜️  Creating deployment package..."
zip -q -r ${FUNCTION_NAME}.zip . -x "*.git*" "*.zip" "node_modules/@aws-sdk/*" "deploy.sh" "*.test.js" "test-*.js"

SIZE=$(du -h ${FUNCTION_NAME}.zip | cut -f1)
echo "📊 Package size: $SIZE"

# Deploy to AWS
echo "🚀 Deploying to AWS Lambda ($FUNCTION_NAME)..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://${FUNCTION_NAME}.zip \
  --region $REGION \
  --no-cli-pager

# Cleanup
echo "🧹 Cleaning up..."
rm ${FUNCTION_NAME}.zip
rm ai-summarizer.js
rm embedding-composition.js

echo "✅ Deployment complete!"
echo ""
echo "💡 The Lambda is triggered automatically by SQS queue: cwf-embeddings-queue"
