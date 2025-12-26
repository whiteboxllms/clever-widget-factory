#!/bin/bash

# Deploy Bedrock conversational search Lambda
# This script packages and deploys the Bedrock Agent tool

set -e

echo "🚀 Deploying Bedrock Conversational Search Lambda"
echo "================================================="

# Check if we're in the right directory
if [ ! -f "lambda/bedrock-tools/pgvector-search/index.js" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured"
    echo "   Run: aws configure"
    exit 1
fi

# Navigate to bedrock tools directory
cd lambda/bedrock-tools/pgvector-search

echo "📦 Installing dependencies..."
npm install

echo "📋 Checking if Lambda function exists..."
FUNCTION_NAME="bedrock-pgvector-search"
if aws lambda get-function --function-name $FUNCTION_NAME > /dev/null 2>&1; then
    echo "✅ Lambda function '$FUNCTION_NAME' exists - updating code"
    UPDATE_MODE="update"
else
    echo "🆕 Lambda function '$FUNCTION_NAME' not found - will create new function"
    UPDATE_MODE="create"
fi

echo "📦 Creating deployment package..."
# Create a clean deployment directory
rm -rf deploy
mkdir deploy

# Copy main handler
cp index.js deploy/
cp package.json deploy/

# Copy shared utilities (reuse existing shared folder)
mkdir -p deploy/shared
cp ../../shared/*.js deploy/shared/

# Install production dependencies
cd deploy
npm install --production

echo "🗜️  Creating ZIP package..."
zip -r ../bedrock-search.zip . > /dev/null

cd ..

if [ "$UPDATE_MODE" = "create" ]; then
    echo "🆕 Creating new Lambda function..."
    
    # Create IAM role first
    ROLE_NAME="bedrock-search-lambda-role"
    
    # Check if role exists
    if ! aws iam get-role --role-name $ROLE_NAME > /dev/null 2>&1; then
        echo "🔐 Creating IAM role..."
        
        # Create trust policy
        cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
        
        # Create role
        aws iam create-role \
            --role-name $ROLE_NAME \
            --assume-role-policy-document file://trust-policy.json
        
        # Attach basic execution policy
        aws iam attach-role-policy \
            --role-name $ROLE_NAME \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        
        # Create and attach Bedrock policy
        cat > bedrock-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1"
      ]
    }
  ]
}
EOF
        
        aws iam put-role-policy \
            --role-name $ROLE_NAME \
            --policy-name BedrockAccess \
            --policy-document file://bedrock-policy.json
        
        # Clean up policy files
        rm trust-policy.json bedrock-policy.json
        
        echo "⏳ Waiting for role to be ready..."
        sleep 10
    fi
    
    # Get role ARN
    ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
    
    # Create Lambda function
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://bedrock-search.zip \
        --timeout 30 \
        --memory-size 512 \
        --description "Conversational pgvector search tool for Bedrock Agent" \
        --environment Variables='{
            "NODE_ENV":"production",
            "AWS_REGION":"us-west-2"
        }'
    
    echo "✅ Lambda function created successfully!"
    
else
    echo "🚀 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://bedrock-search.zip
    
    echo "⚙️  Updating function configuration..."
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 30 \
        --memory-size 512 \
        --environment Variables='{
            "NODE_ENV":"production",
            "AWS_REGION":"us-west-2"
        }'
fi

echo "🧹 Cleaning up..."
rm -rf deploy
rm bedrock-search.zip

# Get function ARN for Bedrock Agent configuration
FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.FunctionArn' --output text)

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Function Details:"
echo "   Name: $FUNCTION_NAME"
echo "   ARN:  $FUNCTION_ARN"
echo ""
echo "🎯 Next Steps for Bedrock Agent:"
echo "   1. Go to AWS Bedrock Console → Agents"
echo "   2. Create new agent with Claude 3 Haiku model"
echo "   3. Add Action Group with this Lambda ARN:"
echo "      $FUNCTION_ARN"
echo "   4. Configure agent personality (see README for instructions)"
echo ""
echo "🧪 Test the Lambda function directly:"
echo "   cd lambda/bedrock-tools/pgvector-search"
echo "   node test-local.js"
echo ""
echo "🌐 Once Bedrock Agent is configured, test with queries like:"
echo "   - 'Hello! I'm looking for noodles under 30 pesos'"
echo "   - 'Something hot for cooking'"
echo "   - 'Fresh vegetables for tonight'"

cd ../../..