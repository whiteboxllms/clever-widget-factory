#!/bin/bash
set -e

echo "📦 Deploying cwf-actions-lambda..."

# Navigate to lambda directory
cd "$(dirname "$0")"

# Copy shared folder if it exists
if [ -d "../core/shared" ]; then
  echo "📁 Copying shared folder..."
  rm -rf shared
  cp -r ../core/shared .
fi

# Create deployment package
echo "🗜️  Creating deployment package..."
zip -r function.zip index.js shared/ 2>/dev/null || zip -r function.zip index.js

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

echo "✅ Deployment complete!"
