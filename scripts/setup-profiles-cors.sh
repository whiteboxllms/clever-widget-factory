#!/bin/bash
# Setup CORS for /api/profiles endpoint

set -e

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTHORIZER_ID="pjg8xs"

echo "🔧 Setting up CORS for /api/profiles endpoint"
echo ""

# Get /api resource ID
echo "🔍 Finding /api resource..."
API_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query 'items[?path==`/api`].id' \
  --output text)

if [ -z "$API_RESOURCE_ID" ]; then
  echo "❌ Error: Could not find /api resource"
  exit 1
fi

echo "✅ Found /api resource: $API_RESOURCE_ID"
echo ""

# Check if /api/profiles resource exists
echo "🔍 Checking for /api/profiles resource..."
PROFILES_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query "items[?path=='/api/profiles'].id" \
  --output text)

if [ -z "$PROFILES_RESOURCE_ID" ]; then
  echo "📝 Creating /api/profiles resource..."
  PROFILES_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --region $REGION \
    --parent-id $API_RESOURCE_ID \
    --path-part profiles \
    --output json)
  
  PROFILES_RESOURCE_ID=$(echo $PROFILES_RESOURCE | jq -r '.id')
  echo "✅ Created resource: $PROFILES_RESOURCE_ID"
else
  echo "✅ Resource already exists: $PROFILES_RESOURCE_ID"
fi

echo ""

# Check if OPTIONS method exists
echo "🔍 Checking for OPTIONS method..."
OPTIONS_EXISTS=$(aws apigateway get-method \
  --rest-api-id $API_ID \
  --resource-id $PROFILES_RESOURCE_ID \
  --http-method OPTIONS \
  --region $REGION \
  2>/dev/null || echo "NOT_FOUND")

if [ "$OPTIONS_EXISTS" = "NOT_FOUND" ]; then
  echo "📝 Adding OPTIONS method (no authorization required)..."
  
  # Add OPTIONS method with NO authorization
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $PROFILES_RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE
  
  echo "✅ OPTIONS method added"
  
  # Add integration to Lambda
  echo "📝 Setting up Lambda integration for OPTIONS..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $PROFILES_RESOURCE_ID \
    --http-method OPTIONS \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"
  
  echo "✅ Integration configured"
  
  # Add method response
  echo "📝 Configuring method response..."
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --region $REGION \
    --resource-id $PROFILES_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Origin=true,method.response.header.Access-Control-Allow-Headers=true,method.response.header.Access-Control-Allow-Methods=true"
  
  echo "✅ Method response configured"
else
  echo "✅ OPTIONS method already exists"
  
  # Check if it has authorization
  AUTH_TYPE=$(aws apigateway get-method \
    --rest-api-id $API_ID \
    --resource-id $PROFILES_RESOURCE_ID \
    --http-method OPTIONS \
    --region $REGION \
    --query 'authorizationType' \
    --output text)
  
  if [ "$AUTH_TYPE" != "NONE" ]; then
    echo "⚠️  OPTIONS method has authorization type: $AUTH_TYPE"
    echo "📝 Updating to NONE (no authorization required for CORS preflight)..."
    
    aws apigateway update-method \
      --rest-api-id $API_ID \
      --region $REGION \
      --resource-id $PROFILES_RESOURCE_ID \
      --http-method OPTIONS \
      --patch-ops op=replace,path=/authorizationType,value=NONE
    
    echo "✅ Authorization removed from OPTIONS method"
  fi
fi

echo ""
echo "🚀 Deploying to prod stage..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --region $REGION \
  --stage-name prod

echo ""
echo "✅ Done! CORS is now configured for /api/profiles"
echo ""
echo "The OPTIONS preflight request should now work correctly."




