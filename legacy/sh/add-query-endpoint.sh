#!/bin/bash
set -e

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTHORIZER_ID="pjg8xs"

# Get /api resource ID
API_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/api`].id' \
  --output text)

echo "Creating /api/query resource..."
QUERY_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --region $REGION \
  --parent-id $API_RESOURCE_ID \
  --path-part query \
  --output json)

QUERY_RESOURCE_ID=$(echo $QUERY_RESOURCE | jq -r '.id')
echo "Created resource: $QUERY_RESOURCE_ID"

# Add POST method
echo "Adding POST method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $QUERY_RESOURCE_ID \
  --http-method POST \
  --authorization-type CUSTOM \
  --authorizer-id $AUTHORIZER_ID \
  --request-parameters method.request.header.Authorization=true

# Add OPTIONS method for CORS
echo "Adding OPTIONS method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $QUERY_RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE

# Integration for POST
echo "Setting up POST integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $QUERY_RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

# Integration for OPTIONS
echo "Setting up OPTIONS integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $QUERY_RESOURCE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}'

# OPTIONS integration response
aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $QUERY_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}'

# OPTIONS method response
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $QUERY_RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}'

# Deploy to prod
echo "Deploying to prod..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --region $REGION \
  --stage-name prod

echo "✅ /api/query endpoint created and deployed!"
