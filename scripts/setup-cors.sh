#!/bin/bash

# Generic script to automatically configure CORS for any API Gateway endpoint
# Usage: ./scripts/setup-cors.sh <endpoint_path>
# Example: ./scripts/setup-cors.sh /api/mission_attachments
# Example: ./scripts/setup-cors.sh /api/mission_attachments/{id}

API_ID="0720au267k"
REGION="us-west-2"
STAGE="prod"
LAMBDA_FUNCTION_NAME="cwf-core-lambda"

# Check if endpoint path is provided
if [ -z "$1" ]; then
  echo "❌ Error: Endpoint path is required"
  echo ""
  echo "Usage: $0 <endpoint_path>"
  echo ""
  echo "Examples:"
  echo "  $0 /api/mission_attachments"
  echo "  $0 /api/mission_attachments/{id}"
  echo "  $0 /api/actions"
  echo "  $0 /api/actions/{id}"
  exit 1
fi

ENDPOINT_PATH="$1"
echo "🔧 Setting up CORS for: $ENDPOINT_PATH"
echo ""

# Get Lambda ARN
echo "🔍 Finding Lambda function..."
LAMBDA_ARN=$(aws lambda get-function \
  --function-name $LAMBDA_FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null)

if [ -z "$LAMBDA_ARN" ]; then
  echo "❌ Error: Could not find Lambda function: $LAMBDA_FUNCTION_NAME"
  exit 1
fi

echo "✅ Found Lambda function: $LAMBDA_ARN"
echo ""

# Find or create the resource
echo "🔍 Finding resource for: $ENDPOINT_PATH"
RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --region $REGION \
  --query "items[?path=='$ENDPOINT_PATH'].id" \
  --output text)

if [ -z "$RESOURCE_ID" ]; then
  echo "⚠️  Resource not found. Attempting to create it..."
  
  # Parse the path to find parent
  PARENT_PATH=$(dirname "$ENDPOINT_PATH")
  if [ "$PARENT_PATH" = "." ] || [ "$PARENT_PATH" = "/" ]; then
    PARENT_PATH="/api"
  fi
  
  # Get parent resource ID
  PARENT_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --region $REGION \
    --query "items[?path=='$PARENT_PATH'].id" \
    --output text)
  
  if [ -z "$PARENT_ID" ]; then
    echo "❌ Error: Could not find parent resource: $PARENT_PATH"
    echo "   Please create the parent resource first or check the path."
    exit 1
  fi
  
  # Extract the path part (last segment)
  PATH_PART=$(basename "$ENDPOINT_PATH")
  
  # Create the resource
  RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $PARENT_ID \
    --path-part "$PATH_PART" \
    --region $REGION \
    --query 'id' \
    --output text)
  
  if [ -z "$RESOURCE_ID" ]; then
    echo "❌ Error: Failed to create resource"
    exit 1
  fi
  
  echo "✅ Created resource: $ENDPOINT_PATH (ID: $RESOURCE_ID)"
else
  echo "✅ Found resource: $ENDPOINT_PATH (ID: $RESOURCE_ID)"
fi
echo ""

# Check if OPTIONS method exists
echo "🔍 Checking OPTIONS method..."
OPTIONS_EXISTS=$(aws apigateway get-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --region $REGION \
  2>&1)

if [ $? -ne 0 ]; then
  echo "📝 Creating OPTIONS method..."
  
  # Create OPTIONS method
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION
  
  if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to create OPTIONS method"
    exit 1
  fi
  
  echo "✅ Created OPTIONS method"
  
  # Create mock integration
  echo "📝 Creating mock integration for OPTIONS..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region $REGION
  
  if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to create mock integration"
    exit 1
  fi
  
  echo "✅ Created mock integration"
  
  # Set method response
  echo "📝 Setting method response..."
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region $REGION
  
  if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to set method response"
    exit 1
  fi
  
  echo "✅ Set method response"
else
  echo "✅ OPTIONS method already exists, updating CORS configuration..."
fi

# Set integration response with CORS headers
echo "📝 Setting integration response with CORS headers..."
aws apigateway put-integration-response \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,PUT,DELETE,OPTIONS'\''","method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' \
  --region $REGION

if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to set integration response"
  exit 1
fi

echo "✅ Set integration response with CORS headers"
echo ""

# Deploy to prod
echo "🚀 Deploying API Gateway changes to $STAGE..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name $STAGE \
  --region $REGION \
  --query 'id' \
  --output text)

if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to deploy API Gateway"
  exit 1
fi

echo "✅ Deployed successfully (Deployment ID: $DEPLOYMENT_ID)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Success! CORS is now configured for: $ENDPOINT_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Note: It may take 1-2 minutes for changes to propagate."
echo "   If you still see CORS errors, try:"
echo "   1. Wait 1-2 minutes"
echo "   2. Clear your browser cache (Cmd+Shift+R or Ctrl+Shift+R)"
echo "   3. Try the request again"
echo ""
echo "Test endpoint:"
echo "  curl -X OPTIONS 'https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE$ENDPOINT_PATH' \\"
echo "    -H 'Origin: http://localhost:8080' \\"
echo "    -H 'Access-Control-Request-Method: GET' \\"
echo "    -v"
echo ""


