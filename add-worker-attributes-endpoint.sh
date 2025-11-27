#!/bin/bash
API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTH_ID="pjg8xs"

# Get /api resource ID
API_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api`].id' --output text)

echo "Creating /api/worker_strategic_attributes endpoint..."

# Create resource
RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --region $REGION \
  --parent-id $API_RESOURCE_ID \
  --path-part worker_strategic_attributes \
  --output json)

RESOURCE_ID=$(echo $RESOURCE | jq -r '.id')
echo "Resource ID: $RESOURCE_ID"

# Add GET method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $RESOURCE_ID \
  --http-method GET \
  --authorization-type CUSTOM \
  --authorizer-id $AUTH_ID

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

# Add OPTIONS method for CORS
aws apigateway put-method \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $RESOURCE_ID \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

# Deploy
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --region $REGION \
  --stage-name prod

echo "✅ Done! Endpoint created and deployed."
