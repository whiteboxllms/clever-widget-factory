#!/bin/bash
set -e

FUNCTION_NAME="cwf-sari-sari-chat"
REGION="us-west-2"

echo "🔧 Enabling unified embeddings for sari-sari-chat..."

# Get current DB_PASSWORD from environment
CURRENT_PASSWORD=$(aws lambda get-function-configuration \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Environment.Variables.DB_PASSWORD' \
  --output text)

if [ "$CURRENT_PASSWORD" == "None" ]; then
  echo "❌ Error: DB_PASSWORD not found in current configuration"
  echo "Please set DB_PASSWORD environment variable and run again:"
  echo "  export DB_PASSWORD='your-password'"
  exit 1
fi

echo "   Current DB_PASSWORD: ${CURRENT_PASSWORD:0:3}***"

# Update Lambda configuration with unified embeddings enabled
# Note: AWS_REGION is reserved and set automatically by Lambda runtime
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --environment "Variables={USE_UNIFIED_EMBEDDINGS=true,DB_HOST=cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com,DB_PASSWORD=$CURRENT_PASSWORD,BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0}" \
  --region $REGION \
  --no-cli-pager

echo ""
echo "✅ Unified embeddings enabled!"
echo ""
echo "To test, use the sari-sari store chat interface with queries like:"
echo "  - 'I need something for better sleep'"
echo "  - 'What helps with heart health?'"
echo "  - 'Show me drinks with vitamins'"
