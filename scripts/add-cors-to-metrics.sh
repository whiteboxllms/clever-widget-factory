#!/bin/bash

API_ID="0720au267k"
REGION="us-west-2"

# Get the metrics resource IDs
METRICS_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/tools/{id}/metrics'].id" --output text)
METRIC_ID_RESOURCE=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/api/tools/{id}/metrics/{metric_id}'].id" --output text)

echo "Metrics resource: $METRICS_RESOURCE"
echo "Metric ID resource: $METRIC_ID_RESOURCE"

# Function to add OPTIONS method for CORS
add_cors_options() {
  local RESOURCE_ID=$1
  local RESOURCE_PATH=$2
  
  echo "Adding OPTIONS method for $RESOURCE_PATH..."
  
  # Create OPTIONS method
  aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION \
    --no-cli-pager
  
  # Create mock integration
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION \
    --no-cli-pager
  
  # Create method response
  aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": false, "method.response.header.Access-Control-Allow-Methods": false, "method.response.header.Access-Control-Allow-Origin": false}' \
    --region $REGION \
    --no-cli-pager
  
  # Create integration response
  aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''", "method.response.header.Access-Control-Allow-Methods": "'\''GET,POST,PUT,DELETE,OPTIONS'\''", "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"}' \
    --region $REGION \
    --no-cli-pager
}

# Add CORS to both resources
add_cors_options $METRICS_RESOURCE "/api/tools/{id}/metrics"
add_cors_options $METRIC_ID_RESOURCE "/api/tools/{id}/metrics/{metric_id}"

echo "✅ CORS configured!"
echo "Now deploying API Gateway..."

aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION

echo "✅ Deployment complete!"
