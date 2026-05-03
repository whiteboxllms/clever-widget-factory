#!/bin/bash
set -e

# Deploy a Python Lambda function, optionally building a pip layer.
#
# Usage:
#   ./scripts/deploy/deploy-python-lambda.sh <lambda-dir> <function-name> [runtime] [memory] [timeout]
#
# Arguments:
#   lambda-dir    — subdirectory under lambda/ (e.g. energeia-ml)
#   function-name — AWS Lambda function name (e.g. cwf-energeia-ml-lambda)
#   runtime       — Python runtime (default: python3.12)
#   memory        — Memory in MB (default: 512)
#   timeout       — Timeout in seconds (default: 30)
#
# Layer behaviour:
#   If lambda-dir/requirements.txt exists, this script builds a Lambda layer
#   from it using a Docker container that matches the Lambda runtime environment,
#   publishes the layer, and attaches it to the function.
#   If no requirements.txt exists, no layer is built.
#
# Examples:
#   ./scripts/deploy/deploy-python-lambda.sh energeia-ml cwf-energeia-ml-lambda python3.12 1024 300
#   ./scripts/deploy/deploy-python-lambda.sh my-py-lambda cwf-my-lambda

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <lambda-dir> <function-name> [runtime] [memory] [timeout]"
  echo "Example: $0 energeia-ml cwf-energeia-ml-lambda python3.12 1024 300"
  exit 1
fi

LAMBDA_DIR="$1"
FUNCTION_NAME="$2"
RUNTIME="${3:-python3.12}"
MEMORY="${4:-512}"
TIMEOUT="${5:-30}"

REGION="us-west-2"
ACCOUNT_ID="131745734428"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/lambda-execution-role"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAMBDA_PATH="$SCRIPT_DIR/../../lambda/$LAMBDA_DIR"

if [ ! -d "$LAMBDA_PATH" ]; then
  echo "❌ Lambda directory not found: $LAMBDA_PATH"
  exit 1
fi

echo "🐍 Deploying Python Lambda: $FUNCTION_NAME"
echo "   Directory : lambda/$LAMBDA_DIR"
echo "   Runtime   : $RUNTIME"
echo "   Memory    : ${MEMORY} MB"
echo "   Timeout   : ${TIMEOUT}s"
echo ""

# ── Step 1: Build pip layer if requirements.txt exists ───────────────────────
LAYER_ARN=""
REQUIREMENTS="$LAMBDA_PATH/requirements.txt"

if [ -f "$REQUIREMENTS" ]; then
  echo "📦 Building pip layer from requirements.txt..."

  LAYER_BUILD_DIR=$(mktemp -d)
  mkdir -p "$LAYER_BUILD_DIR/python"

  # Use the public Lambda base image to ensure binary compatibility.
  # Falls back to local pip if Docker is unavailable.
  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    echo "  Using Docker for binary-compatible build..."
    # Extract Python minor version for the image tag (e.g. python3.12 → 3.12)
    PY_VERSION="${RUNTIME#python}"
    docker run --rm \
      -v "$REQUIREMENTS:/requirements.txt:ro" \
      -v "$LAYER_BUILD_DIR/python:/python" \
      "public.ecr.aws/lambda/python:${PY_VERSION}" \
      pip install -r /requirements.txt -t /python --no-cache-dir -q
  else
    echo "  Docker not available — using manylinux wheels for Lambda compatibility..."
    # manylinux2014_x86_64 wheels are binary-compatible with Lambda (Amazon Linux 2/2023)
    PY_VERSION_SHORT=$(python3 -c "import sys; print(f'{sys.version_info.major}{sys.version_info.minor}')")
    pip3 install \
      -r "$REQUIREMENTS" \
      -t "$LAYER_BUILD_DIR/python" \
      --platform manylinux2014_x86_64 \
      --python-version "$PY_VERSION_SHORT" \
      --only-binary=:all: \
      --no-cache-dir -q
  fi

  echo "  Zipping layer..."
  LAYER_ZIP=$(mktemp /tmp/layer-XXXXXX.zip)
  (cd "$LAYER_BUILD_DIR" && zip -r "$LAYER_ZIP" python/ -x "*.pyc" "__pycache__/*" "*.dist-info/*" > /dev/null)
  rm -rf "$LAYER_BUILD_DIR"

  LAYER_NAME="${FUNCTION_NAME}-deps"
  echo "  Publishing layer: $LAYER_NAME..."
  LAYER_ARN=$(aws lambda publish-layer-version \
    --layer-name "$LAYER_NAME" \
    --description "pip dependencies for $FUNCTION_NAME" \
    --zip-file "fileb://$LAYER_ZIP" \
    --compatible-runtimes "$RUNTIME" \
    --region "$REGION" \
    --query 'LayerVersionArn' --output text)

  rm -f "$LAYER_ZIP"
  echo "  ✅ Layer published: $LAYER_ARN"
  echo ""
fi

# ── Step 2: Package the Lambda code ──────────────────────────────────────────
echo "📦 Packaging Lambda code..."
CODE_ZIP=$(mktemp /tmp/function-XXXXXX.zip)

# Zip everything except requirements.txt, tests, __pycache__, and .pyc files
(cd "$LAMBDA_PATH" && zip -r "$CODE_ZIP" . \
  --exclude "requirements.txt" \
  --exclude "*.pyc" \
  --exclude "__pycache__/*" \
  --exclude "tests/*" \
  --exclude ".pytest_cache/*" \
  --exclude "function.zip" \
  > /dev/null)

echo "  ✅ Code packaged"
echo ""

# ── Step 3: Deploy or create the Lambda ──────────────────────────────────────
echo "🚀 Deploying $FUNCTION_NAME..."

# Build layers array
LAYERS_ARG=""
if [ -n "$LAYER_ARN" ]; then
  LAYERS_ARG="--layers $LAYER_ARN"
fi

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
  echo "  ♻️  Updating existing function..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$CODE_ZIP" \
    --region "$REGION" > /dev/null

  echo "  ⏳ Waiting for code update..."
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"

  CONFIG_CMD="aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region $REGION"
  if [ -n "$LAYER_ARN" ]; then
    CONFIG_CMD="$CONFIG_CMD --layers $LAYER_ARN"
  fi
  eval "$CONFIG_CMD" > /dev/null

else
  echo "  🆕 Creating new function..."
  CREATE_CMD="aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime $RUNTIME \
    --role $ROLE_ARN \
    --handler handler.handler \
    --zip-file fileb://$CODE_ZIP \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region $REGION"
  if [ -n "$LAYER_ARN" ]; then
    CREATE_CMD="$CREATE_CMD --layers $LAYER_ARN"
  fi
  eval "$CREATE_CMD" > /dev/null
fi

rm -f "$CODE_ZIP"

echo "  ⏳ Waiting for Lambda to be ready..."
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || sleep 3

# ── Step 4: Verify ───────────────────────────────────────────────────────────
STATE=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'State' --output text)

echo ""
echo "✅ Deployment complete!"
echo "   Function : $FUNCTION_NAME"
echo "   Runtime  : $RUNTIME"
echo "   Memory   : ${MEMORY} MB"
echo "   Timeout  : ${TIMEOUT}s"
echo "   State    : $STATE"
[ -n "$LAYER_ARN" ] && echo "   Layer    : $LAYER_ARN"
