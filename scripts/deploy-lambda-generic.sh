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

cd "$(dirname "$0")/../lambda/$LAMBDA_DIR"

echo "📦 Copying shared directory..."
cp -r ../shared .

echo "📦 Packaging Lambda (index.js + shared/ + node_modules/)..."
zip -r function.zip index.js shared/ node_modules/

echo "🚀 Deploying to AWS Lambda ($FUNCTION_NAME)..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region us-west-2

echo "🧹 Cleaning up..."
rm function.zip
rm -rf shared

echo "✅ Deployment complete!"
