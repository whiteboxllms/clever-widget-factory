#!/bin/bash

# Script to update database password in all Lambda functions
# Usage: NEW_DB_PASSWORD=xxxx ./update-lambda-passwords.sh

set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
NEW_PASSWORD="${NEW_DB_PASSWORD:-${DB_PASSWORD:-}}"

if [[ -z "$NEW_PASSWORD" ]]; then
  read -s -p "Enter new DB password: " NEW_PASSWORD
  echo
fi

if [[ -z "$NEW_PASSWORD" ]]; then
  echo "❌ ERROR: Provide the password via NEW_DB_PASSWORD / DB_PASSWORD env var or interactive input."
  exit 1
fi

echo "Updating Lambda functions with new database password..."
echo ""

# List of Lambda functions to update
LAMBDA_FUNCTIONS=(
  "cwf-core-lambda"
  "cwf-actions-lambda"
  "cwf-api-authorizer"
  "cwf-organization-lambda"
  "cwf-db-migration"
)

# Update each Lambda function
for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
  echo "Updating $FUNCTION_NAME..."
  
  # Get current environment variables
  CURRENT_ENV=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Environment.Variables' \
    --output json 2>/dev/null || echo "{}")

  UPDATED_ENV=$(echo "$CURRENT_ENV" | jq --arg DB_PASSWORD "$NEW_PASSWORD" '. + {DB_PASSWORD: $DB_PASSWORD}')
  
  # Update with new password, preserving other variables
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --environment "Variables=$UPDATED_ENV" \
    --output json > /dev/null
  
  if [ $? -eq 0 ]; then
    echo "✅ $FUNCTION_NAME updated successfully"
  else
    echo "❌ Failed to update $FUNCTION_NAME"
  fi
done

echo ""
echo "All Lambda functions updated!"
echo ""
echo "⚠️  IMPORTANT: Make sure the corresponding RDS secret/parameter has been rotated as well."
echo "   (DB_PASSWORD is expected to be stored in AWS Secrets Manager or SSM Parameter Store.)"


