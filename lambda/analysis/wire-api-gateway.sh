#!/bin/bash

# Wire Analysis Lambda to API Gateway
# Creates endpoints for AI-powered analysis
# Usage: ./wire-api-gateway.sh

set -e

FUNCTION_NAME="cwf-analysis"
API_ID="0720au267k"
REGION="us-west-2"
AUTHORIZER_ID="pjg8xs"

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

# Create /api/analysis resource if it doesn't exist
ANALYSIS_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/api/analysis`].id' \
  --output text)

if [ -z "$ANALYSIS_ID" ]; then
  echo "🆕 Creating /api/analysis resource..."
  ANALYSIS_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $API_RESOURCE_ID \
    --path-part "analysis" \
    --region $REGION \
    --query 'id' \
    --output text)
fi

echo "📍 /api/analysis resource ID: $ANALYSIS_ID"

# Create sub-resources: generate, analyses, prompts
for RESOURCE in "generate" "analyses" "prompts"; do
  echo "🆕 Creating /api/analysis/$RESOURCE resource..."
  RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path==\`/api/analysis/$RESOURCE\`].id" \
    --output text)
  
  if [ -z "$RESOURCE_ID" ]; then
    RESOURCE_ID=$(aws apigateway create-resource \
      --rest-api-id $API_ID \
      --parent-id $ANALYSIS_ID \
      --path-part "$RESOURCE" \
      --region $REGION \
      --query 'id' \
      --output text)
  fi
  
  echo "📍 /api/analysis/$RESOURCE resource ID: $RESOURCE_ID"

  # Determine methods for this resource
  if [ "$RESOURCE" = "generate" ] || [ "$RESOURCE" = "analyses" ]; then
    METHODS=("GET" "POST" "OPTIONS")
  else
    METHODS=("GET" "OPTIONS")
  fi
  
  # Add methods
  for METHOD in "${METHODS[@]}"; do
    if [ "$METHOD" = "OPTIONS" ]; then
      echo "  🔧 Adding OPTIONS (no auth)..."
      aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --region $REGION 2>/dev/null || echo "  Method exists"
      
      aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
        --region $REGION 2>/dev/null || echo "  Integration exists"
      
      aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Origin":false}' \
        --region $REGION 2>/dev/null || echo "  Method response exists"
      
      aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,PUT,DELETE,OPTIONS'\''","method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
        --region $REGION 2>/dev/null || echo "  Integration response exists"
    else
      echo "  🔧 Adding $METHOD with authorizer..."
      aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --authorization-type CUSTOM \
        --authorizer-id $AUTHORIZER_ID \
        --region $REGION 2>/dev/null || echo "  Method exists"
      
      aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $RESOURCE_ID \
        --http-method $METHOD \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
        --region $REGION 2>/dev/null || echo "  Integration exists"
    fi
  done
done

# Grant API Gateway permission to invoke Lambda
echo "🔐 Granting API Gateway permission to invoke Lambda..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id apigateway-analysis \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:131745734428:$API_ID/*/*/api/analysis/*" \
  --region $REGION 2>/dev/null || echo "Permission exists"

# Deploy API
echo "🚀 Deploying API to prod stage..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION

echo "✅ API Gateway wiring complete!"
echo ""
echo "Endpoints:"
echo "  POST https://$API_ID.execute-api.$REGION.amazonaws.com/prod/api/analysis/generate"
echo "  GET  https://$API_ID.execute-api.$REGION.amazonaws.com/prod/api/analysis/analyses"
echo "  POST https://$API_ID.execute-api.$REGION.amazonaws.com/prod/api/analysis/analyses"
echo "  GET  https://$API_ID.execute-api.$REGION.amazonaws.com/prod/api/analysis/prompts"
