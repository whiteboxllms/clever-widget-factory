#!/bin/bash
set -e

# Usage: ./attach-layer-to-lambda.sh <function-name> [layer-version]
# Example: ./attach-layer-to-lambda.sh cwf-core-lambda 1

if [ -z "$1" ]; then
  echo "Usage: $0 <function-name> [layer-version]"
  echo "Example: $0 cwf-core-lambda 1"
  exit 1
fi

FUNCTION_NAME="$1"
LAYER_VERSION="${2:-1}"
REGION="us-west-2"
LAYER_ARN="arn:aws:lambda:us-west-2:131745734428:layer:cwf-common-nodejs:${LAYER_VERSION}"

echo "🔗 Attaching layer to $FUNCTION_NAME..."
echo "   Layer: cwf-common-nodejs:${LAYER_VERSION}"

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --layers "$LAYER_ARN" \
  --region "$REGION" \
  --output json \
  --query '{FunctionName: FunctionName, Layers: Layers[*].Arn}' \
  || { echo "❌ Failed to attach layer"; exit 1; }

echo "✅ Layer attached successfully"
echo ""
echo "Update your Lambda code to use:"
echo "const { composePartEmbeddingSource } = require('/opt/nodejs/lib/embedding-composition');"
