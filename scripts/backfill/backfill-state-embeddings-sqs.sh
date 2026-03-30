#!/bin/bash
# Backfill state embeddings via SQS queue
# Composes embedding_source locally and sends SQS messages for the processor to handle.
#
# Usage: ./scripts/backfill/backfill-state-embeddings-sqs.sh [limit]
# Default limit: 5

set -e

LIMIT="${1:-5}"
ORG_ID="00000000-0000-0000-0000-000000000001"
REGION="us-west-2"
QUEUE_URL="https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue"

run_sql() {
  local sql="$1"
  local tmpfile=$(mktemp)
  echo "{\"sql\": $(echo "$sql" | jq -Rs .)}" | \
    aws lambda invoke \
      --function-name cwf-db-migration \
      --payload file:///dev/stdin \
      --region "$REGION" \
      --cli-binary-format raw-in-base64-out \
      "$tmpfile" > /dev/null 2>&1
  cat "$tmpfile" | jq -r '.body'
  rm -f "$tmpfile"
}

echo "=== Backfilling STATE embeddings via SQS (limit: $LIMIT) ==="

# Count missing
missing=$(run_sql "SELECT COUNT(*) as cnt FROM states s LEFT JOIN unified_embeddings ue ON ue.entity_type = 'state' AND ue.entity_id = s.id WHERE s.organization_id = '$ORG_ID' AND ue.id IS NULL" | jq -r '.rows[0].cnt // 0')
echo "Total missing: $missing states"
echo "Processing: $LIMIT states"
echo ""

# Fetch states with resolved composition data
rows=$(run_sql "
SELECT
  s.id::text,
  s.organization_id::text,
  s.state_text,
  COALESCE(
    array_agg(DISTINCT
      CASE sl.entity_type
        WHEN 'part' THEN p.name
        WHEN 'tool' THEN t.name
        WHEN 'action' THEN a.description
      END
    ) FILTER (WHERE sl.id IS NOT NULL),
    ARRAY[]::text[]
  ) AS entity_names,
  COALESCE(
    array_agg(DISTINCT sp.photo_description)
    FILTER (WHERE sp.photo_description IS NOT NULL AND sp.photo_description != ''),
    ARRAY[]::text[]
  ) AS photo_descriptions,
  COALESCE(
    json_agg(
      json_build_object('display_name', m.name, 'value', ms.value, 'unit', m.unit)
    ) FILTER (WHERE ms.snapshot_id IS NOT NULL),
    '[]'::json
  ) AS metrics
FROM states s
LEFT JOIN unified_embeddings ue ON ue.entity_type = 'state' AND ue.entity_id = s.id
LEFT JOIN state_links sl ON sl.state_id = s.id
LEFT JOIN parts p ON sl.entity_type = 'part' AND sl.entity_id = p.id
LEFT JOIN tools t ON sl.entity_type = 'tool' AND sl.entity_id = t.id
LEFT JOIN actions a ON sl.entity_type = 'action' AND sl.entity_id = a.id
LEFT JOIN state_photos sp ON sp.state_id = s.id
LEFT JOIN metric_snapshots ms ON ms.state_id = s.id
LEFT JOIN metrics m ON ms.metric_id = m.metric_id
WHERE s.organization_id = '$ORG_ID' AND ue.id IS NULL
GROUP BY s.id
ORDER BY s.created_at DESC
LIMIT $LIMIT
" | jq -c '.rows // []')

count=$(echo "$rows" | jq 'length')
echo "Fetched $count states to process"
echo ""

sent=0
skipped=0

for i in $(seq 0 $((count - 1))); do
  row=$(echo "$rows" | jq -c ".[$i]")
  id=$(echo "$row" | jq -r '.id')
  org_id=$(echo "$row" | jq -r '.organization_id')

  # Build embedding_source using jq (mirrors composeStateEmbeddingSource logic)
  source=$(echo "$row" | jq -r '
    [
      (.entity_names // [] | .[] | select(. != null and . != "")),
      (.state_text // empty),
      (.photo_descriptions // [] | .[] | select(. != null and . != "")),
      (.metrics // [] | .[] | 
        if .unit != null and .unit != "" then
          "\(.display_name): \(.value) \(.unit)"
        else
          "\(.display_name): \(.value)"
        end
      )
    ] | map(select(. != null and . != "")) | join(". ")
  ')

  num=$((i + 1))

  if [ -z "$source" ] || [ "$source" = "" ]; then
    echo "[$num/$count] $id — SKIPPED (empty source)"
    skipped=$((skipped + 1))
    continue
  fi

  display=$(echo "$source" | head -c 80)
  echo -n "[$num/$count] $display... "

  # Send SQS message
  msg=$(jq -n \
    --arg et "state" \
    --arg eid "$id" \
    --arg es "$source" \
    --arg oid "$org_id" \
    '{entity_type: $et, entity_id: $eid, embedding_source: $es, organization_id: $oid}')

  aws sqs send-message \
    --queue-url "$QUEUE_URL" \
    --message-body "$msg" \
    --region "$REGION" > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo "QUEUED"
    sent=$((sent + 1))
  else
    echo "FAILED"
  fi
done

echo ""
echo "Backfill complete: $sent queued, $skipped skipped"
echo "Embeddings will be generated asynchronously by the processor."
