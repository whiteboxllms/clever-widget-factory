#!/bin/bash
# Update Lambda environment variables securely
# Usage: ./update-lambda-env.sh

set -e

REGION="us-west-2"

# Prompt for password (won't be stored in bash history)
read -sp "Enter new DB password: " NEW_PASSWORD
echo ""

LAMBDA_FUNCTIONS=(
  "cwf-core-lambda"
  "cwf-actions-lambda"
  "cwf-organization-lambda"
  "cwf-db-migration"
)

for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
  echo "Updating $FUNCTION_NAME..."
  
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --environment "Variables={DB_PASSWORD=$NEW_PASSWORD}" \
    --output text > /dev/null
  
  echo "✅ $FUNCTION_NAME updated"
done

echo ""
echo "✅ All Lambda functions updated!"
echo "⚠️  Don't forget to update the RDS password itself if needed"
