#!/bin/bash
# Monitor progress of action embeddings generation

echo "📊 Action Embeddings Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get total actions count
TOTAL_ACTIONS=$(echo '{"sql": "SELECT COUNT(*) as total FROM actions;"}' | \
  aws lambda invoke \
    --function-name cwf-db-migration \
    --payload file:///dev/stdin \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    response.json 2>/dev/null && cat response.json | jq -r '.body' | jq -r '.rows[0].total')

# Get actions with descriptions count
ACTIONS_WITH_DESC=$(echo '{"sql": "SELECT COUNT(*) as total FROM actions WHERE description IS NOT NULL AND description != '\'''\'';"}' | \
  aws lambda invoke \
    --function-name cwf-db-migration \
    --payload file:///dev/stdin \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    response.json 2>/dev/null && cat response.json | jq -r '.body' | jq -r '.rows[0].total')

# Get embedding counts
EMBEDDINGS=$(echo '{"sql": "SELECT entity_type, COUNT(*) as total FROM unified_embeddings WHERE entity_type LIKE '\''action%'\'' GROUP BY entity_type ORDER BY entity_type;"}' | \
  aws lambda invoke \
    --function-name cwf-db-migration \
    --payload file:///dev/stdin \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    response.json 2>/dev/null && cat response.json | jq -r '.body' | jq)

ACTION_COUNT=$(echo "$EMBEDDINGS" | jq -r '.rows[] | select(.entity_type == "action") | .total')
STATE_COUNT=$(echo "$EMBEDDINGS" | jq -r '.rows[] | select(.entity_type == "action_existing_state") | .total')

echo "Total actions: $TOTAL_ACTIONS"
echo "Actions with descriptions: $ACTIONS_WITH_DESC"
echo ""
echo "Full-context embeddings (action): $ACTION_COUNT / $TOTAL_ACTIONS"
echo "State embeddings (action_existing_state): $STATE_COUNT / $ACTIONS_WITH_DESC"
echo ""

# Calculate percentages
ACTION_PCT=$(echo "scale=1; $ACTION_COUNT * 100 / $TOTAL_ACTIONS" | bc)
STATE_PCT=$(echo "scale=1; $STATE_COUNT * 100 / $ACTIONS_WITH_DESC" | bc)

echo "Progress:"
echo "  Full-context: ${ACTION_PCT}%"
echo "  State: ${STATE_PCT}%"
echo ""

if [ "$ACTION_COUNT" -eq "$TOTAL_ACTIONS" ] && [ "$STATE_COUNT" -eq "$ACTIONS_WITH_DESC" ]; then
  echo "✅ All embeddings generated!"
else
  echo "⏳ Embeddings still being processed..."
  echo ""
  echo "Run this script again to check progress."
fi
