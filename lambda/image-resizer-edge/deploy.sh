#!/bin/bash

# Deploy Lambda@Edge Image Resizer Function
# This script creates/updates the Lambda function in us-east-1 (required for Lambda@Edge)

set -e

FUNCTION_NAME="cwf-image-resizer-edge"
REGION="us-east-1"  # Lambda@Edge requires us-east-1
RUNTIME="nodejs18.x"
HANDLER="index.handler"
TIMEOUT=5
MEMORY=512
ROLE_NAME="lambda-edge-execution-role"

echo "=========================================="
echo "Deploying Lambda@Edge Image Resizer"
echo "=========================================="
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Check if role exists, create if not
echo ""
echo "Checking IAM role..."
if ! aws iam get-role --role-name $ROLE_NAME --region $REGION 2>/dev/null; then
  echo "Creating IAM role: $ROLE_NAME"
  
  # Create trust policy
  cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "lambda.amazonaws.com",
          "edgelambda.amazonaws.com"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file:///tmp/trust-policy.json \
    --region $REGION
  
  # Attach basic execution policy
  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --region $REGION
  
  # Create and attach S3 read policy
  cat > /tmp/s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::cwf-dev-assets/*"
    }
  ]
}
EOF

  aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name S3ReadAccess \
    --policy-document file:///tmp/s3-policy.json \
    --region $REGION
  
  echo "Waiting 10 seconds for IAM role to propagate..."
  sleep 10
else
  echo "IAM role already exists: $ROLE_NAME"
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "Role ARN: $ROLE_ARN"

# Install dependencies with Linux x64 architecture (required for Lambda)
echo ""
echo "Installing dependencies for Linux x64..."
npm install --arch=x64 --platform=linux

# Create deployment package
echo ""
echo "Creating deployment package..."
rm -f cwf-image-resizer-edge.zip
zip -r cwf-image-resizer-edge.zip index.js node_modules/ > /dev/null
echo "Package size: $(du -h cwf-image-resizer-edge.zip | cut -f1)"

# Check if function exists
echo ""
echo "Checking if Lambda function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
  echo "Updating existing function..."
  
  # Update function code
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://cwf-image-resizer-edge.zip \
    --region $REGION
  
  # Wait for update to complete
  echo "Waiting for function update to complete..."
  aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION
  
  # Update function configuration
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --runtime $RUNTIME \
    --handler $HANDLER \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment Variables="{S3_BUCKET=cwf-dev-assets,S3_REGION=us-west-2}" \
    --region $REGION
  
  echo "Function updated successfully!"
else
  echo "Creating new function..."
  
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime $RUNTIME \
    --role $ROLE_ARN \
    --handler $HANDLER \
    --zip-file fileb://cwf-image-resizer-edge.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment Variables="{S3_BUCKET=cwf-dev-assets,S3_REGION=us-west-2}" \
    --region $REGION
  
  echo "Function created successfully!"
fi

# Publish a new version (Lambda@Edge requires versioned functions)
echo ""
echo "Publishing new version..."
VERSION_OUTPUT=$(aws lambda publish-version \
  --function-name $FUNCTION_NAME \
  --region $REGION)

VERSION=$(echo $VERSION_OUTPUT | jq -r '.Version')
VERSION_ARN=$(echo $VERSION_OUTPUT | jq -r '.FunctionArn')

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Function Name: $FUNCTION_NAME"
echo "Version: $VERSION"
echo "Version ARN: $VERSION_ARN"
echo ""
echo "Next Steps:"
echo "1. Attach this Lambda@Edge function to your CloudFront distribution"
echo "2. Use the Version ARN (not the function ARN) when configuring CloudFront"
echo "3. Attach to the 'origin-request' event type"
echo ""
echo "CloudFront Configuration:"
echo "  - Event Type: origin-request"
echo "  - Lambda Function ARN: $VERSION_ARN"
echo ""
echo "Note: CloudFront distribution updates take 15-20 minutes to deploy globally"
echo ""
