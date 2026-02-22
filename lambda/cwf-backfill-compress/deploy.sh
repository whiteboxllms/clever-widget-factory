#!/bin/bash
set -e

# Deploy cwf-backfill-compress Lambda for one-time image compression backfill
# This Lambda processes images in batches to compress existing uncompressed uploads

FUNCTION_NAME="cwf-backfill-compress"
REGION="us-west-2"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "📦 Installing dependencies with Sharp compiled for Lambda (Linux x64)..."
rm -rf node_modules
npm install --platform=linux --arch=x64 --libc=glibc

echo "📦 Packaging Lambda (index.mjs + node_modules/)..."
zip -r function.zip index.mjs node_modules/ package.json

echo "🚀 Deploying to AWS Lambda ($FUNCTION_NAME)..."

# Check if function exists
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" > /dev/null 2>&1; then
  echo "Updating existing function..."
  DEPLOY_OUTPUT=$(aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION" 2>&1)
else
  echo "Creating new function..."
  DEPLOY_OUTPUT=$(aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role arn:aws:iam::131745734428:role/lambda-execution-role \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --timeout 300 \
    --memory-size 1024 \
    --region "$REGION" 2>&1)
fi

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
echo "📝 Usage:"
echo "   # Dry run (test 5 images):"
echo "   aws lambda invoke --function-name $FUNCTION_NAME \\"
echo "     --payload '{\"batchSize\":5,\"dryRun\":true}' \\"
echo "     --region $REGION response.json && cat response.json | jq -r '.body' | jq"
echo ""
echo "   # Process 10 images:"
echo "   aws lambda invoke --function-name $FUNCTION_NAME \\"
echo "     --payload '{\"batchSize\":10}' \\"
echo "     --region $REGION response.json && cat response.json | jq -r '.body' | jq"
echo ""
echo "   # Continue from last batch:"
echo "   aws lambda invoke --function-name $FUNCTION_NAME \\"
echo "     --payload '{\"batchSize\":10,\"startAfter\":\"mission-attachments/uploads/LAST_KEY.jpg\"}' \\"
echo "     --region $REGION response.json && cat response.json | jq -r '.body' | jq"
