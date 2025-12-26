#!/bin/bash

# Deployment script for Bedrock Agent Tools
# This script deploys the conversational pgvector search tool

set -e

echo "🚀 Deploying Bedrock Agent Tools..."

# Check if required environment variables are set
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: DB_PASSWORD environment variable is required"
    echo "Please set it with: export DB_PASSWORD=your_password"
    exit 1
fi

# Install dependencies for Lambda function
echo "📦 Installing Lambda dependencies..."
cd pgvector-search
npm install
cd ..

# Install CDK dependencies
echo "📦 Installing CDK dependencies..."
cd cdk
npm install

# Bootstrap CDK if needed (only run once per account/region)
echo "🔧 Checking CDK bootstrap..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured"
    echo "Please run: aws configure"
    exit 1
fi

# Deploy the stack
echo "🚀 Deploying CDK stack..."
npm run deploy

# Get the outputs
echo "📋 Getting deployment outputs..."
STACK_OUTPUTS=$(aws cloudformation describe-stacks --stack-name BedrockToolsStack --query 'Stacks[0].Outputs' --output json)

echo "✅ Deployment completed!"
echo ""
echo "📋 Important ARNs for Bedrock Agent configuration:"
echo "$STACK_OUTPUTS" | jq -r '.[] | select(.OutputKey | contains("Arn")) | "- \(.OutputKey): \(.OutputValue)"'

echo ""
echo "🎯 Next steps:"
echo "1. Copy the Lambda function ARN above"
echo "2. Go to AWS Bedrock console"
echo "3. Create a new agent with Claude 3 Haiku model"
echo "4. Add an action group that uses the Lambda function ARN"
echo "5. Configure the agent personality (see README for instructions)"

cd ..