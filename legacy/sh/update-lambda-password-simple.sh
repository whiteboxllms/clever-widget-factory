#!/bin/bash

# Simple script to update Lambda functions with new database password
# Usage: NEW_DB_PASSWORD=xxxx ./update-lambda-password-simple.sh

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

# Helper to update one Lambda while preserving other env vars
update_lambda () {
  local function_name="$1"
  echo "Updating $function_name..."
  local current_env
  current_env=$(aws lambda get-function-configuration \
    --function-name "$function_name" \
    --region "$REGION" \
    --query 'Environment.Variables' \
    --output json 2>/dev/null || echo "{}")
  local updated_env
  updated_env=$(echo "$current_env" | jq --arg DB_PASSWORD "$NEW_PASSWORD" '. + {DB_PASSWORD: $DB_PASSWORD}')

  aws lambda update-function-configuration \
    --function-name "$function_name" \
    --region "$REGION" \
    --environment "Variables=$updated_env" \
    --output json > /dev/null && echo "✅ $function_name updated" || echo "❌ Failed to update $function_name"
}

# Update each Lambda function individually
update_lambda "cwf-core-lambda"
update_lambda "cwf-actions-lambda"
update_lambda "cwf-api-authorizer"
update_lambda "cwf-organization-lambda"
update_lambda "cwf-db-migration"

echo ""
echo "Done! Remember to rotate the database password in your secret manager or RDS first."


