#!/bin/bash

# Deploy script for cwf-image-auth Lambda function
# Usage: ./deploy.sh [environment]
# Environment: dev (default) | prod

set -e

ENVIRONMENT=${1:-dev}
FUNCTION_NAME="cwf-image-auth"
REGION="us-west-2"
RUNTIME="nodejs18.x"
HANDLER="index.handler"
TIMEOUT=10
MEMORY=256

echo "========================================="
echo "Deploying $FUNCTION_NAME to $ENVIRONMENT"
echo "========================================="

# Check if .env.local exists for environment variables
if [ ! -f "../../.env.local" ]; then
  echo "Error: .env.local not found in project root"
  echo "Please create .env.local with required environment variables"
  exit 1
fi

# Load environment variables
source ../../.env.local

# Validate required environment variables
if [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo "Error: CLOUDFRONT_DOMAIN not set in .env.local"
  exit 1
fi

if [ -z "$CLOUDFRONT_KEY_PAIR_ID" ]; then
  echo "Error: CLOUDFRONT_KEY_PAIR_ID not set in .env.local"
  exit 1
fi

echo "Environment variables loaded:"
echo "  CLOUDFRONT_DOMAIN: $CLOUDFRONT_DOMAIN"
echo "  CLOUDFRONT_KEY_PAIR_ID: $CLOUDFRONT_KEY_PAIR_ID"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create deployment package
echo "Creating deployment package..."
rm -f ${FUNCTION_NAME}.zip
zip -r ${FUNCTION_NAME}.zip index.js node_modules package.json -q

echo "Package size: $(du -h ${FUNCTION_NAME}.zip | cut -f1)"
echo ""

# Check if Lambda function exists
echo "Checking if Lambda function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION > /dev/null 2>&1; then
  echo "Function exists. Updating code..."
  
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://${FUNCTION_NAME}.zip \
    --region $REGION
  
  echo "Waiting for update to complete..."
  aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION
  
  echo "Updating environment variables..."
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --environment Variables="{
      CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN,
      CLOUDFRONT_KEY_PAIR_ID=$CLOUDFRONT_KEY_PAIR_ID,
      CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME=${CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME:-/cloudfront/private-key},
      COOKIE_EXPIRATION_SECONDS=${COOKIE_EXPIRATION_SECONDS:-3600}
    }" \
    --region $REGION
  
  echo "Lambda function updated successfully!"
else
  echo "Function does not exist. Creating new function..."
  
  # Get Lambda execution role ARN
  ROLE_ARN=$(aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text 2>/dev/null || echo "")
  
  if [ -z "$ROLE_ARN" ]; then
    echo "Error: Lambda execution role 'lambda-execution-role' not found"
    echo "Please create the role with appropriate permissions"
    exit 1
  fi
  
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime $RUNTIME \
    --role $ROLE_ARN \
    --handler $HANDLER \
    --zip-file fileb://${FUNCTION_NAME}.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment Variables="{
      CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN,
      CLOUDFRONT_KEY_PAIR_ID=$CLOUDFRONT_KEY_PAIR_ID,
      CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME=${CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME:-/cloudfront/private-key},
      COOKIE_EXPIRATION_SECONDS=${COOKIE_EXPIRATION_SECONDS:-3600}
    }" \
    --region $REGION
  
  echo "Lambda function created successfully!"
fi

echo ""
echo "========================================="
echo "Deployment Summary"
echo "========================================="
echo "Function Name: $FUNCTION_NAME"
echo "Region: $REGION"
echo "Runtime: $RUNTIME"
echo "Memory: ${MEMORY}MB"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Get function details
echo "Function ARN:"
aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text

echo ""
echo "Next steps:"
echo "1. Verify Lambda execution role has SSM Parameter Store permissions"
echo "2. Configure API Gateway endpoint: POST /api/images/auth"
echo "3. Test with: curl -X POST <api-gateway-url>/api/images/auth -H 'Authorization: Bearer <token>'"
echo ""
echo "Deployment complete!"
