#!/bin/bash
set -e

FUNCTION_NAME="cwf-explorations-lambda"
REGION="us-west-2"
LAYER_VERSION=$(cat ../../lambda-layer/.layer-version 2>/dev/null || echo "1")
LAYER_ARN="arn:aws:lambda:us-west-2:131745734428:layer:cwf-shared:${LAYER_VERSION}"

echo "🚀 Deploying $FUNCTION_NAME..."
echo "   Using layer version: $LAYER_VERSION"

# Create deployment package (just index.js, no dependencies)
zip -q function.zip index.js
SIZE=$(du -h function.zip | cut -f1)
echo "📊 Package size: $SIZE"

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
  echo "📝 Updating existing function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION > /dev/null
  
  # Wait for update to complete
  aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION
  
  # Update layer configuration
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --layers $LAYER_ARN \
    --region $REGION > /dev/null
  
  echo "✅ Function updated!"
else
  echo "📝 Creating new function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role arn:aws:iam::131745734428:role/lambda-execution-role \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --timeout 30 \
    --memory-size 512 \
    --layers $LAYER_ARN \
    --environment Variables="{DB_HOST=cwf-db.c9tp4kmmxgpd.us-west-2.rds.amazonaws.com,DB_PORT=5432,DB_NAME=cwf_db,DB_USER=cwf_admin,DB_PASSWORD=your-password}" \
    --region $REGION > /dev/null
  
  echo "✅ Function created!"
fi

# Cleanup
rm function.zip

echo ""
echo "Next steps:"
echo "  1. Update API Gateway to route /api/explorations/* to this Lambda"
echo "  2. Test: curl https://api.stargazer-farm.com/api/explorations"
