#!/bin/bash

# Wire Action Scoring Lambda to API Gateway
# Usage: ./wire-api-gateway.sh

set -e

FUNCTION_NAME="cwf-action-scoring"
API_ID="0720au267k"  # Your API Gateway ID
REGION="us-west-2"
RESOURCE_PATH="/action-scoring/generate"

echo "🔌 Wiring $FUNCTION_NAME to API Gateway..."

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "📍 Lambda ARN: $LAMBDA_ARN"

# Get root resource ID
API_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/api`].id' \
  --output text)

echo "📍 /api resource ID: $API_RESOURCE_ID"

# Create /api/action-scoring resource if it doesn't exist
ACTION_SCORING_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/api/action-scoring`].id' \
  --output text)

if [ -z "$ACTION_SCORING_ID" ]; then
  echo "🆕 Creating /api/action-scoring resource..."
  ACTION_SCORING_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $API_RESOURCE_ID \
    --path-part "action-scoring" \
    --region $REGION \
    --query 'id' \
    --output text)
fi

echo "📍 /api/action-scoring resource ID: $ACTION_SCORING_ID"

# Create /api/action-scoring/generate resource if it doesn't exist
GENERATE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/api/action-scoring/generate`].id' \
  --output text)

if [ -z "$GENERATE_ID" ]; then
  echo "🆕 Creating /api/action-scoring/generate resource..."
  GENERATE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ACTION_SCORING_ID \
    --path-part "generate" \
    --region $REGION \
    --query 'id' \
    --output text)
fi

echo "📍 /api/action-scoring/generate resource ID: $GENERATE_ID"

# Create POST method
echo "🔧 Creating POST method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $GENERATE_ID \
  --http-method POST \
  --authorization-type CUSTOM \
  --authorizer-id pjg8xs \
  --region $REGION || echo "Method already exists"

# Create OPTIONS method for CORS
echo "🔧 Creating OPTIONS method for CORS..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $GENERATE_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region $REGION || echo "Method already exists"

# Set up Lambda integration for POST
echo "🔗 Setting up Lambda integration for POST..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $GENERATE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
  --region $REGION

# Set up mock integration for OPTIONS
echo "🔗 Setting up mock integration for OPTIONS..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $GENERATE_ID \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
  --region $REGION

# Set up integration response for OPTIONS
aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $GENERATE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,Authorization'\''",
    "method.response.header.Access-Control-Allow-Methods": "'\''POST,OPTIONS'\''",
    "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"
  }' \
  --region $REGION || echo "Integration response already exists"

# Set up method response for OPTIONS
aws apigateway put-method-response \
  --rest-api-id $API_ID \
  --resource-id $GENERATE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": true,
    "method.response.header.Access-Control-Allow-Methods": true,
    "method.response.header.Access-Control-Allow-Origin": true
  }' \
  --region $REGION || echo "Method response already exists"

# Grant API Gateway permission to invoke Lambda
echo "🔐 Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id apigateway-invoke-action-scoring \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:*:$API_ID/*/*" \
  --region $REGION || echo "Permission already exists"

# Deploy API
echo "🚀 Deploying API to prod stage..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION

echo "✅ API Gateway wiring complete!"
echo ""
echo "Endpoint: https://$API_ID.execute-api.$REGION.amazonaws.com/prod/action-scoring/generate"
echo ""
echo "Test with:"
echo "curl -X POST https://$API_ID.execute-api.$REGION.amazonaws.com/prod/action-scoring/generate \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -d '{\"action_id\": \"YOUR_ACTION_ID\", \"auto_save\": false}'"
