#!/bin/bash

# Simple script to update Lambda functions with new database password
# Password: 8T!$T5#N4q0%5j

NEW_PASSWORD='8T!$T5#N4q0%5j'
REGION='us-west-2'

echo "Updating Lambda functions with new database password..."
echo ""

# Update each Lambda function individually
echo "Updating cwf-core-lambda..."
aws lambda update-function-configuration \
  --function-name cwf-core-lambda \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD}" \
  --output json > /dev/null && echo "✅ cwf-core-lambda updated" || echo "❌ Failed"

echo "Updating cwf-actions-lambda..."
aws lambda update-function-configuration \
  --function-name cwf-actions-lambda \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD}" \
  --output json > /dev/null && echo "✅ cwf-actions-lambda updated" || echo "❌ Failed"

echo "Updating cwf-api-authorizer..."
aws lambda update-function-configuration \
  --function-name cwf-api-authorizer \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD}" \
  --output json > /dev/null && echo "✅ cwf-api-authorizer updated" || echo "❌ Failed"

echo "Updating cwf-organization-lambda..."
aws lambda update-function-configuration \
  --function-name cwf-organization-lambda \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD}" \
  --output json > /dev/null && echo "✅ cwf-organization-lambda updated" || echo "❌ Failed"

echo "Updating cwf-db-migration..."
aws lambda update-function-configuration \
  --function-name cwf-db-migration \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD}" \
  --output json > /dev/null && echo "✅ cwf-db-migration updated" || echo "❌ Failed"

echo ""
echo "Done! Remember to update the database password in RDS first."
echo "See ROTATE_DB_PASSWORD.md for instructions."

