#!/bin/bash

# Script to add PUT route for /api/organization_members
# This fixes the authorization error when deactivating organization members
# Uses REST API v1 (not HTTP API v2)

API_ID="0720au267k"
REGION="us-west-2"
LAMBDA_ARN="arn:aws:lambda:us-west-2:131745734428:function:cwf-core-lambda"
AUTHORIZER_ID="pjg8xs"

echo "🔧 Adding PUT method for /api/organization_members..."
echo ""

# Get /api resource ID
API_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api`].id' --output text 2>/dev/null)

if [ -z "$API_RESOURCE_ID" ]; then
  echo "❌ Error: Could not find /api resource"
  exit 1
fi

echo "✅ Found /api resource ID: $API_RESOURCE_ID"

# Get or create organization_members resource
ORG_MEMBERS_RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query 'items[?path==`/api/organization_members`].id' --output text 2>/dev/null)

if [ -z "$ORG_MEMBERS_RESOURCE_ID" ]; then
  echo "Creating /api/organization_members resource..."
  ORG_MEMBERS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --region $REGION \
    --parent-id $API_RESOURCE_ID \
    --path-part organization_members \
    --query 'id' --output text 2>/dev/null)
  
  if [ -z "$ORG_MEMBERS_RESOURCE_ID" ]; then
    echo "❌ Error: Could not create organization_members resource"
    exit 1
  fi
  echo "✅ Created resource ID: $ORG_MEMBERS_RESOURCE_ID"
else
  echo "✅ Found existing resource ID: $ORG_MEMBERS_RESOURCE_ID"
fi

echo ""

# Add PUT method with authorizer
echo "Adding PUT method with authorizer..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $ORG_MEMBERS_RESOURCE_ID \
  --http-method PUT \
  --authorization-type CUSTOM \
  --authorizer-id $AUTHORIZER_ID \
  2>&1 | grep -v "already exists" || echo "✅ PUT method already exists or created"

echo ""

# Add Lambda integration for PUT
echo "Adding Lambda integration for PUT..."
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $ORG_MEMBERS_RESOURCE_ID \
  --http-method PUT \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
  2>&1 | grep -v "already exists" || echo "✅ Integration already exists or created"

echo ""

# Add OPTIONS method for CORS (if not exists)
echo "Adding OPTIONS method for CORS..."
aws apigateway put-method \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $ORG_MEMBERS_RESOURCE_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  2>&1 | grep -v "already exists" || echo "✅ OPTIONS method already exists or created"

echo ""

# Add integration for OPTIONS
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --region $REGION \
  --resource-id $ORG_MEMBERS_RESOURCE_ID \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
  2>&1 | grep -v "already exists" || echo "✅ OPTIONS integration already exists or created"

echo ""
echo "✅ Done! PUT method configured for /api/organization_members"
echo ""
echo "📝 Deploying changes to API Gateway..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --region $REGION \
  --stage-name prod \
  2>&1 | grep -v "already exists" || echo "✅ Deployment created or already exists"

echo ""
echo "🎉 Complete! Try deactivating Malone again - it should work now!"
