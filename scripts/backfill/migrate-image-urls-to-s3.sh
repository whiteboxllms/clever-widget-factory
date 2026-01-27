#!/bin/bash

# Migrate image URLs from Supabase to S3
# This updates all image_url fields in tools and parts tables

BUCKET_URL="https://cwf-dev-assets.s3.us-west-2.amazonaws.com"

echo "Migrating image URLs from Supabase to S3..."

# Update tools table
SQL_TOOLS="UPDATE tools SET image_url = REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/tool-images/', '${BUCKET_URL}/tool-images/') WHERE image_url LIKE '%supabase%';"

echo "Updating tools table..."
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload "{\"sql\":\"${SQL_TOOLS}\"}" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/migrate-tools.json

echo "Tools result:"
cat /tmp/migrate-tools.json | jq -r '.body' | jq

# Update parts table
SQL_PARTS="UPDATE parts SET image_url = REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/tool-images/', '${BUCKET_URL}/tool-images/') WHERE image_url LIKE '%supabase%';"

echo "Updating parts table..."
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload "{\"sql\":\"${SQL_PARTS}\"}" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/migrate-parts.json

echo "Parts result:"
cat /tmp/migrate-parts.json | jq -r '.body' | jq

echo "Migration complete!"
