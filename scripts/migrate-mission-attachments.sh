#!/bin/bash

# Migrate all images in mission-attachments/ folder to organization-scoped structure
# This will:
# 1. Keep originals untouched in mission-attachments/
# 2. Create compressed versions (with metadata) in organizations/{orgId}/images/
# 3. Create thumbnails in organizations/{orgId}/thumbnails/

BATCH_SIZE=50
PREFIX="mission-attachments/"
START_AFTER=""
TOTAL=0

echo "🔄 Migrating mission-attachments/ folder..."
echo ""
echo "This will:"
echo "  ✓ Keep originals in mission-attachments/ (unchanged)"
echo "  ✓ Create compressed images in organizations/{orgId}/images/"
echo "  ✓ Create thumbnails in organizations/{orgId}/thumbnails/"
echo ""

# First, do a dry run to show what will happen
echo "🔍 Running dry run to preview changes..."
PAYLOAD="{\"batchSize\":5,\"prefix\":\"$PREFIX\",\"dryRun\":true}"
echo "$PAYLOAD" | aws lambda invoke \
  --function-name cwf-backfill-compress \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  --cli-read-timeout 0 \
  response.json > /dev/null 2>&1

BODY=$(cat response.json | jq -r '.body')
DETAILS=$(echo "$BODY" | jq '.details')

echo ""
echo "📋 Preview (first 5 images):"
echo "$DETAILS" | jq -r '.[] | "  \(.key)\n    → \(.finalKey)\n    → \(.thumbnailKey)\n"'

echo ""
read -p "Continue with full migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "🚀 Starting migration..."
echo ""

while true; do
  if [ -z "$START_AFTER" ]; then
    PAYLOAD="{\"batchSize\":$BATCH_SIZE,\"prefix\":\"$PREFIX\",\"dryRun\":false}"
  else
    PAYLOAD="{\"batchSize\":$BATCH_SIZE,\"prefix\":\"$PREFIX\",\"startAfter\":\"$START_AFTER\",\"dryRun\":false}"
  fi

  echo "$PAYLOAD" | aws lambda invoke \
    --function-name cwf-backfill-compress \
    --payload file:///dev/stdin \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    --cli-read-timeout 0 \
    response.json > /dev/null 2>&1

  BODY=$(cat response.json | jq -r '.body')
  SUMMARY=$(echo "$BODY" | jq '.summary')
  SUCCESS=$(echo "$SUMMARY" | jq -r '.success')
  FAILED=$(echo "$SUMMARY" | jq -r '.failed')
  SKIPPED=$(echo "$SUMMARY" | jq -r '.skipped')
  HAS_MORE=$(echo "$SUMMARY" | jq -r '.hasMore')
  NEXT_START=$(echo "$SUMMARY" | jq -r '.nextStartAfter')
  TOTAL_ORIG=$(echo "$SUMMARY" | jq -r '.totalOriginalMB')
  TOTAL_COMP=$(echo "$SUMMARY" | jq -r '.totalCompressedMB')
  TOTAL_THUMB=$(echo "$SUMMARY" | jq -r '.totalThumbnailKB')
  AVG_REDUCTION=$(echo "$SUMMARY" | jq -r '.averageReduction')

  TOTAL=$((TOTAL + SUCCESS))

  echo "Batch complete: $SUCCESS success, $FAILED failed, $SKIPPED skipped"
  echo "  Original: ${TOTAL_ORIG}MB → Compressed: ${TOTAL_COMP}MB (${AVG_REDUCTION} reduction)"
  echo "  Thumbnails: ${TOTAL_THUMB}KB"
  echo "  Total processed: $TOTAL images"
  echo ""

  if [ "$HAS_MORE" != "true" ]; then
    break
  fi

  START_AFTER="$NEXT_START"
  sleep 1
done

echo ""
echo "✅ Migration complete!"
echo "   Total images processed: $TOTAL"
echo ""
echo "📝 Next steps:"
echo "   1. Verify images in S3:"
echo "      aws s3 ls s3://cwf-dev-assets/organizations/ --recursive --region us-west-2"
echo ""
echo "   2. Update database to point to new paths (if needed)"
echo ""
echo "   3. Update frontend to use new organization-scoped paths"
