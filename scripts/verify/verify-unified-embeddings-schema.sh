#!/bin/bash
# Verify unified embeddings table schema

set -e

echo "Verifying unified_embeddings table schema..."

# Read SQL file and escape for JSON
SQL_CONTENT=$(cat scripts/verify-unified-embeddings-schema.sql | jq -Rs .)

# Invoke Lambda to run verification
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload "{\"sql\": $SQL_CONTENT}" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json

echo ""
echo "Verification results:"
cat response.json | jq -r '.body' | jq .

echo ""
echo "Verification complete!"
