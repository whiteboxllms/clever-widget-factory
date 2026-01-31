#!/bin/bash
set -e

# Usage: ./deploy-lambda-generic.sh <lambda-dir> <function-name>
# Example: ./deploy-lambda-generic.sh core cwf-core-lambda

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <lambda-dir> <function-name>"
  echo "Example: $0 core cwf-core-lambda"
  exit 1
fi

LAMBDA_DIR="$1"
FUNCTION_NAME="$2"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../../lambda/$LAMBDA_DIR"

echo "📦 Detecting required shared files..."
rm -rf shared

# Detect which shared files are actually imported
REQUIRED_FILES=$(grep -oE "require\(['\"]\./shared/[^'\"]+" index.js 2>/dev/null | sed "s/require(['\"]\.\/shared\///" | sed "s/['\"]//g" | sort -u)

if [ -n "$REQUIRED_FILES" ]; then
  echo "📦 Copying only required shared files:"
  mkdir -p shared
  for file in $REQUIRED_FILES; do
    if [ -f "../shared/${file}.js" ]; then
      echo "   - ${file}.js"
      cp "../shared/${file}.js" "shared/"
    fi
  done
else
  echo "   No shared files required"
fi

echo "📦 Packaging Lambda (index.js + shared/ + node_modules/)..."
zip -r function.zip index.js shared/ node_modules/

echo "🚀 Deploying to AWS Lambda ($FUNCTION_NAME)..."
DEPLOY_OUTPUT=$(aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region us-west-2 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

NEW_SHA=$(echo "$DEPLOY_OUTPUT" | grep -o '"CodeSha256": "[^"]*"' | cut -d'"' -f4)
echo "✅ Deployed with CodeSha256: $NEW_SHA"

echo "⏳ Waiting for Lambda to be ready..."
sleep 5

echo "🔍 Verifying deployment..."
CURRENT_SHA=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region us-west-2 --query 'Configuration.CodeSha256' --output text)

if [ "$NEW_SHA" = "$CURRENT_SHA" ]; then
  echo "✅ Deployment verified: $CURRENT_SHA"
else
  echo "⚠️  Warning: SHA mismatch. Deployed: $NEW_SHA, Current: $CURRENT_SHA"
fi

echo "🧹 Cleaning up..."
rm function.zip
rm -rf shared

echo "✅ Deployment complete!"
