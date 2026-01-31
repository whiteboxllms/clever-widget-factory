#!/bin/bash
set -e

echo "🔄 Regenerating embeddings for sellable parts..."

# Get all sellable part IDs
PART_IDS=$(aws lambda invoke \
  --function-name cwf-db-migration \
  --payload '{"sql":"SELECT id FROM parts WHERE sellable = true"}' \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/sellable-parts.json > /dev/null && \
  cat /tmp/sellable-parts.json | jq -r '.body' | jq -r '.rows[].id')

COUNT=0
for PART_ID in $PART_IDS; do
  echo "Regenerating embedding for part: $PART_ID"
  
  aws lambda invoke \
    --function-name cwf-embeddings-regenerate \
    --payload "{\"entity_type\":\"part\",\"entity_id\":\"$PART_ID\"}" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/regen-result.json > /dev/null
  
  RESULT=$(cat /tmp/regen-result.json | jq -r '.body' | jq -r '.success')
  
  if [ "$RESULT" = "true" ]; then
    echo "  ✅ Queued for regeneration"
    COUNT=$((COUNT + 1))
  else
    echo "  ❌ Failed"
  fi
  
  # Small delay to avoid overwhelming the queue
  sleep 0.5
done

echo ""
echo "✅ Queued $COUNT parts for embedding regeneration"
echo ""
echo "The embeddings-processor Lambda will process these asynchronously."
echo "Check CloudWatch logs for cwf-embeddings-processor to monitor progress."
