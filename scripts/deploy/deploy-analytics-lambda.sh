#!/bin/bash

# Deploy analytics Lambda and configure API Gateway endpoint

REGION="us-west-2"
FUNCTION_NAME="cwf-analytics-lambda"
API_ID="0720au267k"
LAMBDA_ZIP="lambda/analytics/analytics-lambda.zip"

echo "Creating Lambda function..."
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime nodejs18.x \
  --role arn:aws:iam::381491869627:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://$LAMBDA_ZIP \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables="{DB_HOST=$DB_HOST,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD}" \
  --region $REGION \
  2>/dev/null || echo "Function exists, updating..."

echo "Updating Lambda function code..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://$LAMBDA_ZIP \
  --region $REGION

echo "Getting API resources..."
API_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api'].id" --output text)

echo "Creating /api/analytics resource..."
ANALYTICS_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $API_RESOURCE_ID \
  --path-part "analytics" \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/analytics'].id" --output text)

echo "Creating /api/analytics/action_updates resource..."
ACTION_UPDATES_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ANALYTICS_RESOURCE_ID \
  --path-part "action_updates" \
  --region $REGION \
  --query 'id' \
  --output text 2>/dev/null || aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/analytics/action_updates'].id" --output text)

echo "Getting authorizer ID..."
AUTHORIZER_ID=$(aws apigateway get-authorizers --rest-api-id $API_ID --region $REGION --query 'items[0].id' --output text)

echo "Adding GET method..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $ACTION_UPDATES_RESOURCE_ID \
  --http-method GET \
  --authorization-type COGNITO_USER_POOLS \
  --authorizer-id $AUTHORIZER_ID \
  --region $REGION 2>/dev/null || echo "Method exists"

echo "Setting up Lambda integration..."
LAMBDA_ARN="arn:aws:lambda:$REGION:381491869627:function:$FUNCTION_NAME"
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $ACTION_UPDATES_RESOURCE_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
  --region $REGION

echo "Adding Lambda permission..."
aws lambda add-permission \
  --function-name $FUNCTION_NAME \
  --statement-id apigateway-analytics-action-updates \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:381491869627:$API_ID/*/GET/api/analytics/action_updates" \
  --region $REGION 2>/dev/null || echo "Permission exists"

echo "Deploying API..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION

echo "✅ Analytics Lambda deployed and endpoint configured!"
echo "Endpoint: https://$API_ID.execute-api.$REGION.amazonaws.com/prod/api/analytics/action_updates"
