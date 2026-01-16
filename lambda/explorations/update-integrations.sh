#!/bin/bash
API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-explorations-lambda"

# Update integrations for /api/explorations (k4jgjp)
for method in GET POST PUT DELETE; do
  aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id k4jgjp \
    --http-method $method \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region $REGION 2>&1 | grep -q "integrationResponses" && echo "✅ $method /api/explorations"
done

# Update /api/explorations/list (4dlbo4)
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id 4dlbo4 \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region $REGION 2>&1 | grep -q "integrationResponses" && echo "✅ GET /api/explorations/list"

# Update /api/explorations/check-code/{code} (jbcvax)
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id jbcvax \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region $REGION 2>&1 | grep -q "integrationResponses" && echo "✅ GET /api/explorations/check-code/{code}"

# Update /api/explorations/codes-by-prefix/{prefix} (ndxntm)
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id ndxntm \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region $REGION 2>&1 | grep -q "integrationResponses" && echo "✅ GET /api/explorations/codes-by-prefix/{prefix}"

# Deploy
aws apigateway create-deployment --rest-api-id $API_ID --stage-name prod --region $REGION > /dev/null
echo "✅ Deployed to prod"
