#!/bin/bash

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-sari-sari-chat"

# Get /api resource
API_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api`].id' --output text)

# Create /sari-sari under /api
SARI_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $API_RESOURCE_ID --path-part sari-sari --region $REGION --query 'id' --output text 2>&1 || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api/sari-sari`].id' --output text)

# Create /chat under /sari-sari
CHAT_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $SARI_RESOURCE_ID --path-part chat --region $REGION --query 'id' --output text 2>&1 || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api/sari-sari/chat`].id' --output text)

echo "Resource ID: $CHAT_RESOURCE_ID"

# Get authorizer ID
AUTHORIZER_ID=$(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query 'items[0].id' --output text)

# Create POST method
aws apigateway put-method --rest-api-id $API_ID --resource-id $CHAT_RESOURCE_ID --http-method POST --authorization-type CUSTOM --authorizer-id $AUTHORIZER_ID --region $REGION 2>&1 || echo "Method exists"

# Set integration
aws apigateway put-integration --rest-api-id $API_ID --resource-id $CHAT_RESOURCE_ID --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" --region $REGION 2>&1 || echo "Integration exists"

# Add Lambda permission
aws lambda add-permission --function-name cwf-sari-sari-chat --statement-id apigateway-sari-sari-chat --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:$REGION:131745734428:$API_ID/*/*" --region $REGION 2>&1 || echo "Permission exists"

# Deploy
aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION

echo "✅ Deployed POST /api/sari-sari/chat"
