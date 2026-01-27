#!/bin/bash
set -e

FUNCTION_NAME="sari-sari-chat"
REGION="us-west-2"

echo "📦 Installing dependencies..."
npm install

echo "🗜️  Creating deployment package..."
cd ..
zip -r sari-sari-chat/function.zip \
  sari-sari-chat/index.js \
  sari-sari-chat/PipelineComponents.js \
  sari-sari-chat/ResultFormatter.js \
  sari-sari-chat/SearchPipeline.js \
  sari-sari-chat/package.json \
  sari-sari-chat/node_modules/ \
  shared/

cd sari-sari-chat

echo "🚀 Deploying to Lambda..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

echo "✅ Deployment complete!"
echo ""
echo "💡 To enable unified embeddings:"
echo "   aws lambda update-function-configuration \\"
echo "     --function-name $FUNCTION_NAME \\"
echo "     --environment Variables=\"{USE_UNIFIED_EMBEDDINGS=true,...}\" \\"
echo "     --region $REGION"

rm function.zip
