#!/bin/bash
set -e

# Backfill embeddings for all parts by sending SQS messages
# This script fetches all parts without embeddings and sends them to the embeddings queue

QUEUE_URL="https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue"
BATCH_SIZE=10
ORG_ID="00000000-0000-0000-0000-000000000001"

echo "🔄 Backfilling embeddings for all parts..."
echo ""

# Get count of parts without embeddings
echo "Checking coverage..."
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload '{"sql":"SELECT COUNT(*) as missing FROM parts p LEFT JOIN unified_embeddings ue ON ue.entity_type = '\''part'\'' AND ue.entity_id = p.id WHERE ue.id IS NULL"}' \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/missing-count.json > /dev/null

MISSING=$(cat /tmp/missing-count.json | jq -r '.body' | jq -r '.rows[0].missing')
echo "Parts without embeddings: $MISSING"
echo ""

if [ "$MISSING" -eq 0 ]; then
  echo "✅ All parts already have embeddings!"
  exit 0
fi

# Fetch all parts without embeddings
echo "Fetching parts without embeddings..."
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload '{"sql":"SELECT p.id, p.name, COALESCE(p.description, '\''No description'\'') as description, COALESCE(p.policy, '\'\'\'') as policy FROM parts p LEFT JOIN unified_embeddings ue ON ue.entity_type = '\''part'\'' AND ue.entity_id = p.id WHERE ue.id IS NULL ORDER BY p.name LIMIT 1000"}' \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/parts-to-process.json > /dev/null

# Extract parts array
PARTS=$(cat /tmp/parts-to-process.json | jq -r '.body' | jq -r '.rows')
PART_COUNT=$(echo "$PARTS" | jq 'length')

echo "Found $PART_COUNT parts to process"
echo ""

if [ "$PART_COUNT" -eq 0 ]; then
  echo "✅ No parts to process!"
  exit 0
fi

# Process in batches
SENT=0
FAILED=0
BATCH_NUM=0

echo "Sending to SQS queue in batches of $BATCH_SIZE..."
echo ""

for ((i=0; i<$PART_COUNT; i+=$BATCH_SIZE)); do
  ((BATCH_NUM++))
  echo "Batch $BATCH_NUM (parts $((i+1))-$((i+BATCH_SIZE)))..."
  
  # Get batch of parts
  BATCH=$(echo "$PARTS" | jq -c ".[$i:$((i+BATCH_SIZE))]")
  
  # Send each part in the batch to SQS
  echo "$BATCH" | jq -c '.[]' | while read -r PART; do
    PART_ID=$(echo "$PART" | jq -r '.id')
    PART_NAME=$(echo "$PART" | jq -r '.name')
    DESCRIPTION=$(echo "$PART" | jq -r '.description')
    POLICY=$(echo "$PART" | jq -r '.policy')
    
    # Compose embedding source
    if [ -n "$POLICY" ] && [ "$POLICY" != "null" ]; then
      EMBEDDING_SOURCE="$PART_NAME. $DESCRIPTION. $POLICY"
    else
      EMBEDDING_SOURCE="$PART_NAME. $DESCRIPTION"
    fi
    
    # Create SQS message
    MESSAGE=$(jq -n \
      --arg type "part" \
      --arg id "$PART_ID" \
      --arg source "$EMBEDDING_SOURCE" \
      --arg org "$ORG_ID" \
      '{
        entity_type: $type,
        entity_id: $id,
        embedding_source: $source,
        organization_id: $org
      }')
    
    # Send to SQS
    aws sqs send-message \
      --queue-url "$QUEUE_URL" \
      --message-body "$MESSAGE" \
      --region us-west-2 > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      ((SENT++))
    else
      ((FAILED++))
      echo "   ❌ Failed: $PART_NAME"
    fi
  done
  
  echo "   Sent: $SENT, Failed: $FAILED"
  
  # Small delay between batches to avoid rate limits
  sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Messages sent to SQS: $SENT"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All parts queued for embedding generation!"
  echo ""
  echo "The embeddings-processor Lambda will process these asynchronously."
  echo "Processing time: ~$((SENT / 10)) minutes (estimated)"
  echo ""
  echo "To check progress:"
  echo "  aws lambda invoke --function-name cwf-embeddings-coverage --payload '{}' --region us-west-2 /tmp/coverage.json && cat /tmp/coverage.json | jq '.body' | jq -r '.' | jq '.'"
else
  echo "⚠️  Some messages failed to send."
  exit 1
fi
