#!/bin/bash

# Deploy Core Lambda Function
echo "Deploying Core Lambda Function..."

cd lambda/core

# Install dependencies
echo "Installing dependencies..."
npm install

# Create temporary directory structure that matches Lambda's /var/task/
echo "Creating deployment package structure..."
TEMP_DIR=$(mktemp -d)
cp -r . "$TEMP_DIR/"
cp -r ../shared "$TEMP_DIR/shared"
# Note: index.js now uses ./shared/authorizerContext, so no sed replacement needed

# Create deployment package
echo "Creating deployment package..."
cd "$TEMP_DIR"
zip -r core-lambda-deployment.zip . -x "*.zip" -x "core-lambda-deployment.zip"
mv core-lambda-deployment.zip "$OLDPWD/"

# Clean up
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

# Deploy to AWS Lambda
echo "Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://core-lambda-deployment.zip \
  --region us-west-2

echo "Deployment complete!"