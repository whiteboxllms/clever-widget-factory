#!/bin/bash
set -e

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-unified-search"

echo "🔧 Wiring API Gateway to cwf-unified-search Lambda..."

# Get resource ID for /api/semantic-search/unified
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api/semantic-search/unified") | .id')

if [ -z "$RESOURCE_ID" ]; then
  echo "❌ Resource /api/semantic-search/unified not found!"
  echo "Run: ./scripts/add-api-endpoint.sh /api/semantic-search/unified POST"
  exit 1
fi

echo "Found resource ID: $RESOURCE_ID"

# Update POST method integration
echo "Updating POST integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region $REGION > /dev/null

echo "✅ Integration updated!"

# Grant API Gateway permission to invoke Lambda
echo "Granting API Gateway invoke permission..."
aws lambda add-permission \
  --function-name cwf-unified-search \
  --statement-id apigateway-unified-search-post \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:131745734428:${API_ID}/*/POST/api/semantic-search/unified" \
  --region $REGION 2>/dev/null || echo "  (permission already exists)"

echo ""
echo "✅ API Gateway wired to cwf-unified-search!"
echo ""
echo "Next step: Deploy API Gateway"
echo "  aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION"
