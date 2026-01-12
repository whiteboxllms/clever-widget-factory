#!/bin/bash
# Add API Gateway endpoint with authorizer
# Usage: ./add-api-endpoint.sh <path> <method>
# Example: ./add-api-endpoint.sh /api/organizations GET

set -e

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTHORIZER_ID="pjg8xs"

PATH_ARG="${1:-/api/organizations}"
METHOD="${2:-GET}"

# Get parent resource ID
PARENT_PATH=$(dirname "$PATH_ARG")
RESOURCE_NAME=$(basename "$PATH_ARG")

if [ "$PARENT_PATH" = "/api" ]; then
  PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api'].id" --output text)
else
  PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='$PARENT_PATH'].id" --output text)
fi

# Check if resource exists
RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='$PATH_ARG'].id" --output text)

if [ -z "$RESOURCE_ID" ]; then
  echo "Creating resource $PATH_ARG..."
  RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $PARENT_ID \
    --path-part "$RESOURCE_NAME" \
    --region $REGION \
    --query 'id' --output text)
fi

echo "Resource ID: $RESOURCE_ID"

# Add method with authorizer (skip OPTIONS)
if [ "$METHOD" != "OPTIONS" ]; then
  echo "Adding $METHOD method with authorizer..."
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --authorization-type CUSTOM \
    --authorizer-id $AUTHORIZER_ID \
    --region $REGION || echo "Method already exists"
else
  echo "Adding OPTIONS method (no auth)..."
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION || echo "Method already exists"
fi

# Add integration
if [ "$METHOD" != "OPTIONS" ]; then
  echo "Adding Lambda integration..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $REGION || echo "Integration already exists"
else
  echo "Adding MOCK integration for OPTIONS..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION || echo "Integration already exists"
  
  # Add method response for CORS
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region $REGION || echo "Method response already exists"
  
  # Add integration response for CORS
  aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters method.response.header.Access-Control-Allow-Headers="'Content-Type,Authorization'",method.response.header.Access-Control-Allow-Methods="'GET,POST,PUT,DELETE,OPTIONS'",method.response.header.Access-Control-Allow-Origin="'*'" \
    --region $REGION || echo "Integration response already exists"
fi

echo "✅ Done! Deploy with: aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION"
