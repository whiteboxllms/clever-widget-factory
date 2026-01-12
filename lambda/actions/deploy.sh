#!/bin/bash
set -e

echo "📦 Deploying cwf-actions-lambda..."

# Navigate to lambda directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Copy shared folder from parent lambda directory
if [ -d "../shared" ]; then
  echo "📁 Copying shared folder..."
  rm -rf shared
  cp -r ../shared .
else
  echo "⚠️  Shared folder not found at ../shared"
fi

# Create deployment package
echo "🗜️  Creating deployment package..."
zip -r function.zip index.js node_modules/ shared/ 2>/dev/null || zip -r function.zip index.js node_modules/

# Deploy to AWS
echo "🚀 Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name cwf-actions-lambda \
  --zip-file fileb://function.zip \
  --region us-west-2 \
  --output json | jq -r '.FunctionName, .LastModified, .CodeSize'

# Cleanup
rm -f function.zip
rm -rf shared

echo "💡 Tip: node_modules are now included in the deployment package"

echo "✅ Deployment complete!"
