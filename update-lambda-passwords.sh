#!/bin/bash

# Script to update database password in all Lambda functions
# New password: 8T!$T5#N4q0%5j

set -e

NEW_PASSWORD="8T!\$T5#N4q0%5j"
REGION="us-west-2"

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
  
  # Update with new password, preserving other variables
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --environment "Variables={DB_PASSWORD=$NEW_PASSWORD,$(echo $CURRENT_ENV | jq -r 'to_entries | map("\(.key)=\(.value)") | join(",")' | grep -v "DB_PASSWORD")}" \
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
echo "⚠️  IMPORTANT: Don't forget to update the database password itself:"
echo "   ALTER USER postgres WITH PASSWORD '8T!\$T5#N4q0%5j';"
echo ""
echo "Or via AWS RDS Console: Modify → Master password"

