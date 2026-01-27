#!/bin/bash
set -e

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-embeddings-regenerate"

echo "🔧 Wiring API Gateway to cwf-embeddings-regenerate Lambda..."

# Get resource ID for /api/embeddings/regenerate
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)
RESOURCE_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path == "/api/embeddings/regenerate") | .id')

if [ -z "$RESOURCE_ID" ]; then
  echo "❌ Resource /api/embeddings/regenerate not found!"
  echo "Run: ./scripts/add-api-endpoint.sh /api/embeddings/regenerate POST"
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
  --function-name cwf-embeddings-regenerate \
  --statement-id apigateway-embeddings-regenerate-post \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:131745734428:${API_ID}/*/POST/api/embeddings/regenerate" \
  --region $REGION 2>/dev/null || echo "  (permission already exists)"

echo ""
echo "✅ API Gateway wired to cwf-embeddings-regenerate!"
echo ""
echo "Next step: Deploy API Gateway"
echo "  aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION"
