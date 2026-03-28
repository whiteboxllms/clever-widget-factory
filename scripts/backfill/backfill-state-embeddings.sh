#!/bin/bash
# Backfill missing embeddings for states (observations)
# Uses the resolution query to compose embedding_source from linked entities,
# photo descriptions, and metric snapshots, then generates embeddings via SQS.
#
# Usage: ./scripts/backfill/backfill-state-embeddings.sh [limit]
# Default limit: 5

set -e

LIMIT="${1:-5}"
ORG_ID="00000000-0000-0000-0000-000000000001"
REGION="us-west-2"

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

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

generate_embedding() {
  local text="$1"
  local tmpfile=$(mktemp)
  jq -n --arg t "$text" '{text: $t}' | \
    aws lambda invoke \
      --function-name cwf-embeddings-lambda \
      --payload file:///dev/stdin \
      --region "$REGION" \
      --cli-binary-format raw-in-base64-out \
      "$tmpfile" > /dev/null 2>&1
  local embedding=$(cat "$tmpfile" | jq -r '.body' | jq -c '.embedding')
  rm -f "$tmpfile"
  echo "$embedding"
}

echo "=== Backfilling STATE embeddings (limit: $LIMIT) ==="

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

processed=0
failed=0

for i in $(seq 0 $((count - 1))); do
  row=$(echo "$rows" | jq -c ".[$i]")
  id=$(echo "$row" | jq -r '.id')
  org_id=$(echo "$row" | jq -r '.organization_id')
  state_text=$(echo "$row" | jq -r '.state_text // empty')
  
  # Build embedding source using the same logic as composeStateEmbeddingSource
  parts=()
  
  # Entity names
  entity_names=$(echo "$row" | jq -r '.entity_names[]? // empty' 2>/dev/null)
  while IFS= read -r name; do
    [ -n "$name" ] && parts+=("$name")
  done <<< "$entity_names"
  
  # State text
  [ -n "$state_text" ] && parts+=("$state_text")
  
  # Photo descriptions
  photo_descs=$(echo "$row" | jq -r '.photo_descriptions[]? // empty' 2>/dev/null)
  while IFS= read -r desc; do
    [ -n "$desc" ] && parts+=("$desc")
  done <<< "$photo_descs"
  
  # Metrics
  metrics_count=$(echo "$row" | jq '.metrics | length')
  for j in $(seq 0 $((metrics_count - 1))); do
    display_name=$(echo "$row" | jq -r ".metrics[$j].display_name")
    value=$(echo "$row" | jq -r ".metrics[$j].value")
    unit=$(echo "$row" | jq -r ".metrics[$j].unit // empty")
    if [ -n "$unit" ]; then
      parts+=("$display_name: $value $unit")
    else
      parts+=("$display_name: $value")
    fi
  done
  
  # Join with ". "
  source=""
  for part in "${parts[@]}"; do
    if [ -z "$source" ]; then
      source="$part"
    else
      source="$source. $part"
    fi
  done
  
  processed=$((processed + 1))
  
  if [ -z "$source" ]; then
    echo "[$processed/$count] $id — SKIPPED (empty source)"
    continue
  fi
  
  # Truncate display
  display=$(echo "$source" | head -c 80)
  echo -n "[$processed/$count] $display... "
  
  # Generate embedding
  embedding=$(generate_embedding "$source")
  if [ "$embedding" = "null" ] || [ -z "$embedding" ]; then
    echo "FAILED (embedding generation)"
    failed=$((failed + 1))
    continue
  fi
  
  # Write to unified_embeddings
  escaped_source=$(echo "$source" | sed "s/'/''/g")
  vec=$(echo "$embedding" | jq -c '.')
  
  result=$(run_sql "INSERT INTO unified_embeddings (entity_type, entity_id, embedding_source, model_version, embedding, organization_id) VALUES ('state', '$id', '$escaped_source', 'titan-v1', '$vec'::vector, '$org_id') ON CONFLICT (entity_type, entity_id, model_version) DO UPDATE SET embedding_source = EXCLUDED.embedding_source, embedding = EXCLUDED.embedding, updated_at = NOW()" | jq -r '.success // false')
  
  if [ "$result" = "true" ]; then
    echo "OK"
  else
    echo "FAILED (db write)"
    failed=$((failed + 1))
  fi
done

echo ""
echo "Backfill complete: $processed processed, $failed failed"
