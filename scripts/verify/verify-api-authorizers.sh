#!/bin/bash
# Verify all API endpoints have authorizers (except OPTIONS and /health)

API_ID="0720au267k"
REGION="us-west-2"
EXPECTED_AUTHORIZER_ID="pjg8xs"

echo "Checking API Gateway endpoints for missing authorizers..."
echo ""

MISSING_AUTH=0

# Get all resources and methods
aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json | \
jq -r '.items[] | select(.resourceMethods != null) | .path as $path | .id as $id | .resourceMethods | to_entries[] | "\($path)|\(.key)|\($id)"' | \
while IFS='|' read -r path method resource_id; do
  # Skip OPTIONS and public endpoints
  if [ "$method" = "OPTIONS" ] || [ "$path" = "/health" ] || [ "$path" = "/api/health" ] || [ "$path" = "/api/schema" ]; then
    continue
  fi
  
  # Get method details
  AUTH_TYPE=$(aws apigateway get-method --rest-api-id $API_ID --resource-id $resource_id --http-method $method --region $REGION --query 'authorizationType' --output text 2>/dev/null)
  AUTH_ID=$(aws apigateway get-method --rest-api-id $API_ID --resource-id $resource_id --http-method $method --region $REGION --query 'authorizerId' --output text 2>/dev/null)
  
  if [ "$AUTH_TYPE" != "CUSTOM" ] || [ "$AUTH_ID" != "$EXPECTED_AUTHORIZER_ID" ]; then
    echo "❌ $method $path - authType: $AUTH_TYPE, authId: $AUTH_ID"
    MISSING_AUTH=$((MISSING_AUTH + 1))
  else
    echo "✅ $method $path"
  fi
done

echo ""
if [ $MISSING_AUTH -gt 0 ]; then
  echo "⚠️  Found $MISSING_AUTH endpoint(s) without proper authorizer"
  exit 1
else
  echo "✅ All endpoints have proper authorizers"
  exit 0
fi
