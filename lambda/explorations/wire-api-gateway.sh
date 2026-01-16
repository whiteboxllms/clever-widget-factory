#!/bin/bash
set -e

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-explorations-lambda"

echo "🔧 Updating API Gateway routes for explorations..."

# Get all exploration resource IDs
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)

# Update /api/explorations
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api/explorations") | .id')
echo "Updating /api/explorations (${RESOURCE_ID})..."

for METHOD in GET POST PUT DELETE; do
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $METHOD \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null 2>&1 && echo "  ✅ $METHOD" || echo "  ⏭️  $METHOD (not found)"
done

# Update /api/explorations/list
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api/explorations/list") | .id')
if [ -n "$RESOURCE_ID" ]; then
  echo "Updating /api/explorations/list (${RESOURCE_ID})..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null && echo "  ✅ GET"
fi

# Update /api/explorations/check-code/{code}
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api/explorations/check-code/{code}") | .id')
if [ -n "$RESOURCE_ID" ]; then
  echo "Updating /api/explorations/check-code/{code} (${RESOURCE_ID})..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null && echo "  ✅ GET"
fi

# Update /api/explorations/codes-by-prefix/{prefix}
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api/explorations/codes-by-prefix/{prefix}") | .id')
if [ -n "$RESOURCE_ID" ]; then
  echo "Updating /api/explorations/codes-by-prefix/{prefix} (${RESOURCE_ID})..."
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method GET \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION > /dev/null && echo "  ✅ GET"
fi

# Deploy changes
echo ""
echo "🚀 Deploying API Gateway..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION > /dev/null

echo "✅ API Gateway updated and deployed!"
echo ""
echo "Test with:"
echo "  curl https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/explorations"
