#!/bin/bash

# Add /api/action_implementation_updates/all endpoint to API Gateway
# This endpoint returns all action implementation updates (for analytics)

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:381491869627:function:cwf-core-lambda"

# Get the /api resource ID
API_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api'].id" --output text)

# Get the /api/action_implementation_updates resource ID (or create it)
UPDATES_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/action_implementation_updates'].id" --output text)

if [ -z "$UPDATES_RESOURCE_ID" ]; then
  echo "Creating /api/action_implementation_updates resource..."
  UPDATES_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $API_RESOURCE_ID \
    --path-part "action_implementation_updates" \
    --region $REGION \
    --query 'id' \
    --output text)
fi

# Create /api/action_implementation_updates/all resource
echo "Creating /api/action_implementation_updates/all resource..."
ALL_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $UPDATES_RESOURCE_ID \
  --path-part "all" \
  --region $REGION \
  --query 'id' \
  --output text)

# Add GET method
echo "Adding GET method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $ALL_RESOURCE_ID \
  --http-method GET \
  --authorization-type COGNITO_USER_POOLS \
  --authorizer-id $(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query 'items[0].id' --output text) \
  --region $REGION

# Set up Lambda integration
echo "Setting up Lambda integration..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $ALL_RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
  --region $REGION

# Add Lambda permission
echo "Adding Lambda permission..."
aws lambda add-permission \
  --function-name cwf-core-lambda \
  --statement-id apigateway-action-updates-all-get \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:381491869627:$API_ID/*/GET/api/action_implementation_updates/all" \
  --region $REGION

echo "Endpoint created! Deploy with:"
echo "aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION"
