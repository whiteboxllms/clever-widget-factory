#!/bin/bash

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-metrics-lambda"
AUTHORIZER_ID="pjg8xs"

# Use existing /api/tools/{id} resource
TOOL_ID_RESOURCE="j2hw51"
echo "Using existing /api/tools/{id} resource: $TOOL_ID_RESOURCE"

# Get existing metrics resources
METRICS_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/tools/{id}/metrics'].id" --output text)
METRIC_ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/tools/{id}/metrics/{metric_id}'].id" --output text)

echo "Metrics resource: $METRICS_RESOURCE"
echo "Metric ID resource: $METRIC_ID_RESOURCE"

# Function to create method with authorizer
create_method() {
  local RESOURCE_ID=$1
  local HTTP_METHOD=$2
  local RESOURCE_PATH=$3
  
  echo "Creating $HTTP_METHOD method for $RESOURCE_PATH..."
  
  # Create method
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $HTTP_METHOD \
    --authorization-type CUSTOM \
    --authorizer-id $AUTHORIZER_ID \
    --region $REGION \
    --no-cli-pager
  
  # Create integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method $HTTP_METHOD \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $REGION \
    --no-cli-pager
}

# Create methods for /api/tools/{id}/metrics
create_method $METRICS_RESOURCE GET "/api/tools/{id}/metrics"
create_method $METRICS_RESOURCE POST "/api/tools/{id}/metrics"

# Create methods for /api/tools/{id}/metrics/{metric_id}
create_method $METRIC_ID_RESOURCE PUT "/api/tools/{id}/metrics/{metric_id}"
create_method $METRIC_ID_RESOURCE DELETE "/api/tools/{id}/metrics/{metric_id}"

echo "✅ All endpoints created!"
echo "Now deploying API Gateway..."

aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION

echo "✅ Deployment complete!"
