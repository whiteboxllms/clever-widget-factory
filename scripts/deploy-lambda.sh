#!/bin/bash
set -e

cd "$(dirname "$0")/../lambda/core"

echo "📦 Copying shared directory..."
cp -r ../shared .

echo "📦 Packaging Lambda (index.js + shared/ + node_modules/)..."
zip -r function.zip index.js shared/ node_modules/

echo "🚀 Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://function.zip \
  --region us-west-2

echo "🧹 Cleaning up..."
rm function.zip
rm -rf shared

echo "✅ Deployment complete!"