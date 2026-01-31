#!/bin/bash
set -e

LAYER_NAME="cwf-common-nodejs"
REGION="us-west-2"

echo "📦 Installing dependencies..."
cd nodejs
npm install --production
cd ..

echo "📦 Packaging layer..."
zip -r layer.zip nodejs/

echo "🚀 Publishing layer version..."
PUBLISH_OUTPUT=$(aws lambda publish-layer-version \
  --layer-name "$LAYER_NAME" \
  --description "CWF common utilities with pg dependency" \
  --zip-file fileb://layer.zip \
  --compatible-runtimes nodejs18.x nodejs20.x \
  --region "$REGION" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ Layer publish failed!"
  echo "$PUBLISH_OUTPUT"
  exit 1
fi

VERSION=$(echo "$PUBLISH_OUTPUT" | grep -o '"Version": [0-9]*' | grep -o '[0-9]*')
LAYER_ARN=$(echo "$PUBLISH_OUTPUT" | grep -o '"LayerVersionArn": "[^"]*"' | cut -d'"' -f4)

echo "✅ Published layer version $VERSION"
echo "📋 Layer ARN: $LAYER_ARN"

echo "🧹 Cleaning up..."
rm layer.zip

echo ""
echo "To use this layer in a Lambda:"
echo "aws lambda update-function-configuration \\"
echo "  --function-name <function-name> \\"
echo "  --layers $LAYER_ARN \\"
echo "  --region $REGION"
