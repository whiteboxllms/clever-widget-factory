#!/bin/bash
# Setup API Gateway methods for cwf-learning-lambda endpoints
set -e

API_ID="0720au267k"
REGION="us-west-2"
AUTHORIZER_ID="pjg8xs"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-learning-lambda"
INTEGRATION_URI="arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

setup_method() {
  local RESOURCE_ID=$1
  local METHOD=$2
  local RESOURCE_PATH=$3

  echo "Setting up $METHOD on $RESOURCE_PATH (resource: $RESOURCE_ID)..."

  # Add method with authorizer
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --authorization-type CUSTOM \
    --authorizer-id $AUTHORIZER_ID \
    --region $REGION 2>/dev/null || echo "  Method $METHOD already exists"

  # Add Lambda proxy integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "$INTEGRATION_URI" \
    --region $REGION 2>/dev/null || echo "  Integration already exists"

  echo "  ✅ $METHOD configured"
}

setup_options() {
  local RESOURCE_ID=$1
  local RESOURCE_PATH=$2

  echo "Setting up OPTIONS on $RESOURCE_PATH (resource: $RESOURCE_ID)..."

  # Add OPTIONS method (no auth)
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION 2>/dev/null || echo "  OPTIONS method already exists"

  # Add MOCK integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION 2>/dev/null || echo "  MOCK integration already exists"

  # Add method response
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region $REGION 2>/dev/null || echo "  Method response already exists"

  # Add integration response with CORS headers
  aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION 2>/dev/null || echo "  Integration response already exists"

  echo "  ✅ OPTIONS configured"
}

echo "=== Setting up Learning API Gateway endpoints ==="

# 1. GET /api/learning/{actionId}/{userId}/objectives
setup_method "k2zbv0" "GET" "/api/learning/{actionId}/{userId}/objectives"
setup_options "k2zbv0" "/api/learning/{actionId}/{userId}/objectives"

# 2. POST /api/learning/{actionId}/quiz/generate
setup_method "parwjn" "POST" "/api/learning/{actionId}/quiz/generate"
setup_options "parwjn" "/api/learning/{actionId}/quiz/generate"

# 3. POST /api/learning/{actionId}/verify
setup_method "rsx8f3" "POST" "/api/learning/{actionId}/verify"
setup_options "rsx8f3" "/api/learning/{actionId}/verify"

# Also add OPTIONS to the base /api/learning resource
setup_options "g0r0bq" "/api/learning"

echo ""
echo "=== Deploying API Gateway ==="
aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION
echo "✅ Deployed to prod"
