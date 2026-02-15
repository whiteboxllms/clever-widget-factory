#!/bin/bash
set -e

# Generic API Gateway wiring script
# Usage: ./scripts/wire-api-gateway.sh <lambda-function-name> <base-path> [endpoints-config]
# Example: ./scripts/wire-api-gateway.sh cwf-experiences-lambda experiences "GET,POST:/ GET:/{id}"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <lambda-function-name> <base-path> [endpoints-config]"
  echo ""
  echo "Arguments:"
  echo "  lambda-function-name: Name of the Lambda function (e.g., cwf-experiences-lambda)"
  echo "  base-path: Base API path without /api prefix (e.g., experiences)"
  echo "  endpoints-config: Space-separated list of 'METHODS:PATH' (optional)"
  echo ""
  echo "Examples:"
  echo "  $0 cwf-experiences-lambda experiences 'GET,POST:/ GET:/{id}'"
  echo "  $0 cwf-states-lambda states 'GET,POST,PUT,DELETE:/ GET,PUT,DELETE:/{id}'"
  echo ""
  echo "If endpoints-config is omitted, defaults to: 'GET,POST:/ GET:/{id}'"
  exit 1
fi

FUNCTION_NAME="$1"
BASE_PATH="$2"
ENDPOINTS_CONFIG="${3:-GET,POST:/ GET:/{id}}"

API_ID="0720au267k"
REGION="us-west-2"
AUTHORIZER_ID="pjg8xs"
ACCOUNT_ID="131745734428"

echo "🔧 Wiring $FUNCTION_NAME to API Gateway..."
echo "   Base path: /api/$BASE_PATH"
echo "   Endpoints: $ENDPOINTS_CONFIG"
echo ""

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "📍 Lambda ARN: $LAMBDA_ARN"

# Get all resources
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)

# Function to create resource if it doesn't exist
create_resource_if_needed() {
  local PATH_ARG=$1
  local PARENT_PATH=$(dirname "$PATH_ARG")
  local RESOURCE_NAME=$(basename "$PATH_ARG")
  
  # Check if resource exists
  RESOURCE_ID=$(echo $RESOURCES | jq -r ".items[] | select(.path == \"$PATH_ARG\") | .id")
  
  if [ -z "$RESOURCE_ID" ]; then
    echo "  Creating resource $PATH_ARG..."
    
    # Get parent resource ID
    if [ "$PARENT_PATH" = "/api" ]; then
      PARENT_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api") | .id')
    else
      PARENT_ID=$(echo $RESOURCES | jq -r ".items[] | select(.path == \"$PARENT_PATH\") | .id")
      
      # If parent doesn't exist, create it recursively
      if [ -z "$PARENT_ID" ]; then
        create_resource_if_needed "$PARENT_PATH" > /dev/null
        PARENT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='$PARENT_PATH'].id" --output text)
      fi
    fi
    
    RESOURCE_ID=$(aws apigateway create-resource \
      --rest-api-id $API_ID \
      --parent-id $PARENT_ID \
      --path-part "$RESOURCE_NAME" \
      --region $REGION \
      --query 'id' --output text)
    
    # Refresh resources cache
    RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)
    
    echo "  ✅ Created resource: $RESOURCE_ID"
  else
    echo "  ✅ Resource exists: $RESOURCE_ID"
  fi
  
  echo $RESOURCE_ID
}

# Function to add OPTIONS method for CORS
add_options_method() {
  local RESOURCE_ID=$1
  
  echo "    Adding OPTIONS for CORS..."
  
  # Add OPTIONS method (no auth)
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION > /dev/null 2>&1 || true
  
  # Add MOCK integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION > /dev/null 2>&1 || true
  
  # Add method response
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region $REGION > /dev/null 2>&1 || true
  
  # Add integration response with CORS headers
  aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION > /dev/null 2>&1 || true
  
  echo "    ✅ OPTIONS configured"
}

# Function to add method with authorizer and Lambda integration
add_method_and_integration() {
  local RESOURCE_ID=$1
  local METHOD=$2
  local FULL_PATH=$3
  
  echo "    Adding $METHOD method..."
  
  # Add method with authorizer
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --authorization-type CUSTOM \
    --authorizer-id $AUTHORIZER_ID \
    --region $REGION > /dev/null 2>&1 || true
  
  # Add Lambda integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null 2>&1 || true
  
  # Add Lambda permission
  METHOD_LOWER=$(echo "$METHOD" | tr '[:upper:]' '[:lower:]')
  STATEMENT_ID="apigateway-$(echo $FULL_PATH | tr '/' '-' | sed 's/^-//' | sed 's/{id}/id/g')-${METHOD_LOWER}"
  aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id $STATEMENT_ID \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/$METHOD$FULL_PATH" \
    --region $REGION 2>/dev/null || true
  
  echo "    ✅ $METHOD configured"
}

# Parse and process endpoints configuration
echo ""
# Use array to properly handle spaces in endpoint specs
IFS=' ' read -ra ENDPOINT_ARRAY <<< "$ENDPOINTS_CONFIG"
for ENDPOINT_SPEC in "${ENDPOINT_ARRAY[@]}"; do
  # Split by colon: METHODS:PATH (use printf to avoid brace expansion issues)
  METHODS_STR=$(printf '%s\n' "$ENDPOINT_SPEC" | cut -d':' -f1)
  PATH_SUFFIX=$(printf '%s\n' "$ENDPOINT_SPEC" | cut -d':' -f2-)
  
  # Build full path
  if [ "$PATH_SUFFIX" = "/" ]; then
    FULL_PATH="/api/$BASE_PATH"
  else
    FULL_PATH="/api/$BASE_PATH$PATH_SUFFIX"
  fi
  
  echo "📍 Setting up $FULL_PATH..."
  RESOURCE_ID=$(create_resource_if_needed "$FULL_PATH")
  
  # Split methods by comma and process each
  IFS=',' read -ra METHODS_ARRAY <<< "$METHODS_STR"
  for METHOD in "${METHODS_ARRAY[@]}"; do
    add_method_and_integration "$RESOURCE_ID" "$METHOD" "$FULL_PATH"
  done
  
  # Add OPTIONS for CORS
  add_options_method "$RESOURCE_ID"
  
  echo ""
done

# Deploy changes
echo "🚀 Deploying API Gateway..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION > /dev/null

echo ""
echo "✅ API Gateway updated and deployed!"
echo ""
echo "Base URL: https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
echo ""
echo "Configured endpoints:"
IFS=' ' read -ra ENDPOINT_ARRAY <<< "$ENDPOINTS_CONFIG"
for ENDPOINT_SPEC in "${ENDPOINT_ARRAY[@]}"; do
  METHODS_STR=$(printf '%s\n' "$ENDPOINT_SPEC" | cut -d':' -f1)
  PATH_SUFFIX=$(printf '%s\n' "$ENDPOINT_SPEC" | cut -d':' -f2-)
  if [ "$PATH_SUFFIX" = "/" ]; then
    FULL_PATH="/api/$BASE_PATH"
  else
    FULL_PATH="/api/$BASE_PATH$PATH_SUFFIX"
  fi
  IFS=',' read -ra METHODS_ARRAY <<< "$METHODS_STR"
  for METHOD in "${METHODS_ARRAY[@]}"; do
    printf "  %-7s %s\n" "$METHOD" "$FULL_PATH"
  done
done
echo "  OPTIONS (all endpoints) - CORS preflight"
