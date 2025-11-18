#!/bin/bash

# Deploy Core Lambda Function
echo "Deploying Core Lambda Function..."

cd lambda/core

# Install dependencies
echo "Installing dependencies..."
npm install

# Create deployment package
echo "Creating deployment package..."
zip -r core-lambda-deployment.zip . -x "*.zip"

# Deploy to AWS Lambda
echo "Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://core-lambda-deployment.zip \
  --region us-west-2

echo "Deployment complete!"