#!/bin/bash
set -e

# Deploy Lambda with layer support
# Usage: ./deploy-lambda-with-layer.sh <lambda-dir> <function-name> [layer-arn]

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <lambda-dir> <function-name> [layer-arn]"
  echo "Example: $0 action-scoring cwf-action-scoring"
  exit 1
fi

LAMBDA_DIR="$1"
FUNCTION_NAME="$2"
LAYER_ARN="${3:-arn:aws:lambda:us-west-2:131745734428:layer:cwf-common-nodejs:9}"
REGION="us-west-2"
ROLE_ARN="arn:aws:iam::131745734428:role/lambda-execution-role"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../../lambda/$LAMBDA_DIR"

# Load environment variables from .env.local
if [ -f "$SCRIPT_DIR/../../.env.local" ]; then
  echo "📋 Loading environment variables from .env.local..."
  export $(grep -v '^#' "$SCRIPT_DIR/../../.env.local" | grep -E '^(DB_PASSWORD|DB_HOST|DB_USER|DB_NAME|DB_PORT)=' | xargs)
fi

echo "📦 Installing dependencies..."
npm install --production

echo "📦 Packaging Lambda (index.js + local files + node_modules/)..."
zip -r function.zip index.js node_modules/ package.json *.js -x "*.test.js" "deploy.sh" "wire-api-gateway.sh"

echo "🚀 Deploying to AWS Lambda ($FUNCTION_NAME)..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
  echo "♻️  Updating function code..."
  DEPLOY_OUTPUT=$(aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION" 2>&1)
  
  if [ $? -ne 0 ]; then
    echo "❌ Deployment failed!"
    echo "$DEPLOY_OUTPUT"
    exit 1
  fi
  
  echo "⚙️  Updating configuration with layer and environment variables..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --layers "$LAYER_ARN" \
    --timeout 30 \
    --memory-size 512 \
    --environment "Variables={DB_PASSWORD=$DB_PASSWORD}" \
    --region "$REGION" >/dev/null
else
  echo "🆕 Creating new function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs18.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --layers "$LAYER_ARN" \
    --timeout 30 \
    --memory-size 512 \
    --environment "Variables={DB_PASSWORD=$DB_PASSWORD}" \
    --region "$REGION" >/dev/null
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
echo "Function: $FUNCTION_NAME"
echo "Layer: $LAYER_ARN"
