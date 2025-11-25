#!/bin/bash
API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTH_ID="pjg8xs"

API_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api`].id' --output text)

# Create /api/action_scores
RESOURCE=$(aws apigateway create-resource --rest-api-id $API_ID --region $REGION --parent-id $API_RESOURCE_ID --path-part action_scores --output json)
RESOURCE_ID=$(echo $RESOURCE | jq -r '.id')

# Add methods
for METHOD in GET POST OPTIONS; do
  if [ "$METHOD" = "OPTIONS" ]; then
    aws apigateway put-method --rest-api-id $API_ID --region $REGION --resource-id $RESOURCE_ID --http-method $METHOD --authorization-type NONE
    aws apigateway put-integration --rest-api-id $API_ID --region $REGION --resource-id $RESOURCE_ID --http-method $METHOD --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}'
  else
    aws apigateway put-method --rest-api-id $API_ID --region $REGION --resource-id $RESOURCE_ID --http-method $METHOD --authorization-type CUSTOM --authorizer-id $AUTH_ID
    aws apigateway put-integration --rest-api-id $API_ID --region $REGION --resource-id $RESOURCE_ID --http-method $METHOD --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"
  fi
done

# Create /api/action_scores/{id}
ID_RESOURCE=$(aws apigateway create-resource --rest-api-id $API_ID --region $REGION --parent-id $RESOURCE_ID --path-part '{id}' --output json)
ID_RESOURCE_ID=$(echo $ID_RESOURCE | jq -r '.id')

for METHOD in PUT OPTIONS; do
  if [ "$METHOD" = "OPTIONS" ]; then
    aws apigateway put-method --rest-api-id $API_ID --region $REGION --resource-id $ID_RESOURCE_ID --http-method $METHOD --authorization-type NONE
    aws apigateway put-integration --rest-api-id $API_ID --region $REGION --resource-id $ID_RESOURCE_ID --http-method $METHOD --type MOCK --request-templates '{"application/json":"{\"statusCode\": 200}"}'
  else
    aws apigateway put-method --rest-api-id $API_ID --region $REGION --resource-id $ID_RESOURCE_ID --http-method $METHOD --authorization-type CUSTOM --authorizer-id $AUTH_ID
    aws apigateway put-integration --rest-api-id $API_ID --region $REGION --resource-id $ID_RESOURCE_ID --http-method $METHOD --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"
  fi
done

aws apigateway create-deployment --rest-api-id $API_ID --region $REGION --stage-name prod
echo "✅ Done"
