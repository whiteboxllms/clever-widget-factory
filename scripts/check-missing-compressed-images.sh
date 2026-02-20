#!/bin/bash
# Check which images in the database don't have compressed versions in S3

echo "Fetching image URLs from database..."
URLS=$(echo '{"sql": "SELECT DISTINCT photo_url FROM state_photos WHERE photo_url LIKE '\''%mission-attachments%'\'' ORDER BY photo_url;"}' | \
  aws lambda invoke \
    --function-name cwf-db-migration \
    --payload file:///dev/stdin \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    response.json > /dev/null 2>&1 && \
  cat response.json | jq -r '.body' | jq -r '.rows[].photo_url')

TOTAL=0
MISSING=0
EXISTS=0

echo "Checking S3 for compressed versions..."
echo ""

while IFS= read -r url; do
  if [ -z "$url" ]; then
    continue
  fi
  
  TOTAL=$((TOTAL + 1))
  
  # Extract S3 key from URL
  KEY=$(echo "$url" | sed 's|https://cwf-dev-assets.s3.us-west-2.amazonaws.com/||')
  
  # Check if file exists in S3
  if aws s3 ls "s3://cwf-dev-assets/$KEY" > /dev/null 2>&1; then
    EXISTS=$((EXISTS + 1))
  else
    MISSING=$((MISSING + 1))
    echo "MISSING: $KEY"
  fi
done <<< "$URLS"

echo ""
echo "Summary:"
echo "  Total unique images: $TOTAL"
echo "  Compressed versions exist: $EXISTS"
echo "  Missing compressed versions: $MISSING"
