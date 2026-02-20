#!/bin/bash
set -e

# Deploy cwf-image-compressor Lambda with Sharp compiled for Lambda environment
# Sharp requires native bindings for Linux x64 (Lambda runtime)

FUNCTION_NAME="cwf-image-compressor"
REGION="us-west-2"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Installing dependencies with Sharp compiled for Lambda (Linux x64)..."
rm -rf node_modules
npm install --platform=linux --arch=x64 --libc=glibc

echo "📦 Packaging Lambda (index.mjs + node_modules/)..."
zip -r function.zip index.mjs node_modules/ package.json

echo "🚀 Deploying to AWS Lambda ($FUNCTION_NAME)..."
DEPLOY_OUTPUT=$(aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "$REGION" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

NEW_SHA=$(echo "$DEPLOY_OUTPUT" | grep -o '"CodeSha256": "[^"]*"' | cut -d'"' -f4)
echo "✅ Deployed with CodeSha256: $NEW_SHA"

echo "⏳ Waiting for Lambda to be ready..."
sleep 3

echo "🔍 Verifying deployment..."
CURRENT_SHA=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query 'Configuration.CodeSha256' --output text)

if [ "$NEW_SHA" = "$CURRENT_SHA" ]; then
  echo "✅ Deployment verified: $CURRENT_SHA"
else
  echo "⚠️  Warning: SHA mismatch. Deployed: $NEW_SHA, Current: $CURRENT_SHA"
fi

echo "🧹 Cleaning up..."
rm function.zip

echo "✅ Deployment complete!"
echo ""
echo "📝 Note: Sharp was compiled for Linux x64 (Lambda runtime)"
echo "   If you see Sharp errors, ensure Lambda is using Node.js 18.x or 20.x runtime"
