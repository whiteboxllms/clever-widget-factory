#!/bin/bash

# Deploy Actions Lambda Function
echo "Deploying Actions Lambda Function..."

cd lambda/actions

# Install dependencies
echo "Installing dependencies..."
npm install

# Create temporary directory structure
echo "Creating deployment package structure..."
TEMP_DIR=$(mktemp -d)
cp -r . "$TEMP_DIR/"
cp -r ../shared "$TEMP_DIR/shared"

# Create deployment package
echo "Creating deployment package..."
cd "$TEMP_DIR"
zip -r actions-lambda-deployment.zip . -x "*.zip"
mv actions-lambda-deployment.zip "$OLDPWD/"

# Clean up
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

# Deploy to AWS Lambda
echo "Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name cwf-actions-lambda \
  --zip-file fileb://actions-lambda-deployment.zip \
  --region us-west-2

echo "Deployment complete!"
