#!/bin/bash

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTHORIZER_ID="pjg8xs"

# Get root resource
ROOT_ID=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?ApiId=='$API_ID'].ApiId" --output text)
echo "API ID: $API_ID"

# Get /api resource
API_RESOURCE_ID=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='ANY /api/{proxy+}'].RouteId" --output text)
echo "Found route: $API_RESOURCE_ID"

# Create /api/organizations route
echo "Creating GET /api/organizations route..."
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "GET /api/organizations" \
  --target "integrations/$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query 'Items[0].IntegrationId' --output text)" \
  --authorizer-id $AUTHORIZER_ID \
  --authorization-type JWT \
  --region $REGION

echo "Creating OPTIONS /api/organizations route..."
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "OPTIONS /api/organizations" \
  --target "integrations/$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query 'Items[0].IntegrationId' --output text)" \
  --region $REGION

echo "Creating PUT /api/organizations/{id} route..."
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "PUT /api/organizations/{id}" \
  --target "integrations/$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query 'Items[0].IntegrationId' --output text)" \
  --authorizer-id $AUTHORIZER_ID \
  --authorization-type JWT \
  --region $REGION

echo "Creating OPTIONS /api/organizations/{id} route..."
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "OPTIONS /api/organizations/{id}" \
  --target "integrations/$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query 'Items[0].IntegrationId' --output text)" \
  --region $REGION

echo "Done! Organizations endpoints added."
