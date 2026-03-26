#!/bin/bash
# Backfill missing embeddings for parts and tools
# Uses cwf-embeddings-standalone to generate vectors and cwf-db-migration to write them.
# Bypasses the broken SQS pipeline entirely.
#
# Usage: ./scripts/backfill/backfill-missing-embeddings.sh [parts|tools|all] [batch_size]

set -e

ENTITY_TYPE="${1:-all}"
BATCH_SIZE="${2:-10}"
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
  cat "$tmpfile" | jq -r '.body' | jq -c '.rows // []'
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

write_embedding() {
  local entity_type="$1"
  local entity_id="$2"
  local embedding_source="$3"
  local embedding_json="$4"
  local org_id="$5"

  # Escape single quotes in embedding_source
  local escaped_source=$(echo "$embedding_source" | sed "s/'/''/g")

  local sql="INSERT INTO unified_embeddings (entity_type, entity_id, embedding_source, model_version, embedding, organization_id) VALUES ('${entity_type}', '${entity_id}', '${escaped_source}', 'titan-v1', '${embedding_json}'::vector, '${org_id}') ON CONFLICT (entity_type, entity_id, model_version) DO UPDATE SET embedding_source = EXCLUDED.embedding_source, embedding = EXCLUDED.embedding, updated_at = NOW()"

  local tmpfile=$(mktemp)
  echo "{\"sql\": $(echo "$sql" | jq -Rs .)}" | \
    aws lambda invoke \
      --function-name cwf-db-migration \
      --payload file:///dev/stdin \
      --region "$REGION" \
      --cli-binary-format raw-in-base64-out \
      "$tmpfile" > /dev/null 2>&1
  local result=$(cat "$tmpfile" | jq -r '.body' | jq -c '.success // false')
  rm -f "$tmpfile"
  echo "$result"
}

process_entity() {
  local entity_type="$1"
  local id="$2"
  local source="$3"
  local num="$4"
  local total="$5"

  echo -n "[$num/$total] $source... "

  # Generate embedding
  local embedding=$(generate_embedding "$source")
  if [ "$embedding" = "null" ] || [ -z "$embedding" ]; then
    echo "FAILED (embedding generation)"
    return 1
  fi

  # Convert JSON array to PostgreSQL vector format: [1,2,3]
  local vec=$(echo "$embedding" | jq -c '.')

  # Write to unified_embeddings
  local ok=$(write_embedding "$entity_type" "$id" "$source" "$vec" "$ORG_ID")
  if [ "$ok" = "true" ]; then
    echo "OK"
  else
    echo "FAILED (db write)"
    return 1
  fi
}

backfill_parts() {
  echo "=== Backfilling PARTS embeddings ==="

  local count_json=$(run_sql "SELECT COUNT(*) as cnt FROM parts p LEFT JOIN unified_embeddings ue ON ue.entity_type = 'part' AND ue.entity_id = p.id WHERE p.organization_id = '$ORG_ID' AND ue.id IS NULL")
  local total=$(echo "$count_json" | jq -r '.[0].cnt // 0')
  echo "Missing: $total parts"

  local offset=0
  local processed=0
  local failed=0

  while [ "$offset" -lt "$total" ]; do
    local rows=$(run_sql "SELECT p.id::text, p.name, COALESCE(p.description, '') as description, COALESCE(p.policy, '') as policy FROM parts p LEFT JOIN unified_embeddings ue ON ue.entity_type = 'part' AND ue.entity_id = p.id WHERE p.organization_id = '$ORG_ID' AND ue.id IS NULL ORDER BY p.name LIMIT $BATCH_SIZE OFFSET $offset")

    local batch_count=$(echo "$rows" | jq 'length')
    if [ "$batch_count" -eq 0 ]; then break; fi

    for i in $(seq 0 $((batch_count - 1))); do
      local row=$(echo "$rows" | jq -c ".[$i]")
      local id=$(echo "$row" | jq -r '.id')
      local name=$(echo "$row" | jq -r '.name')
      local desc=$(echo "$row" | jq -r '.description')
      local policy=$(echo "$row" | jq -r '.policy')

      local source="$name"
      [ -n "$desc" ] && source="$source. $desc"
      [ -n "$policy" ] && source="$source. $policy"

      processed=$((processed + 1))
      process_entity "part" "$id" "$source" "$processed" "$total" || failed=$((failed + 1))
    done

    offset=$((offset + BATCH_SIZE))
  done

  echo "Parts: $processed processed, $failed failed"
}

backfill_tools() {
  echo "=== Backfilling TOOLS embeddings ==="

  local count_json=$(run_sql "SELECT COUNT(*) as cnt FROM tools t LEFT JOIN unified_embeddings ue ON ue.entity_type = 'tool' AND ue.entity_id = t.id WHERE t.organization_id = '$ORG_ID' AND ue.id IS NULL")
  local total=$(echo "$count_json" | jq -r '.[0].cnt // 0')
  echo "Missing: $total tools"

  local offset=0
  local processed=0
  local failed=0

  while [ "$offset" -lt "$total" ]; do
    local rows=$(run_sql "SELECT t.id::text, t.name, COALESCE(t.description, '') as description FROM tools t LEFT JOIN unified_embeddings ue ON ue.entity_type = 'tool' AND ue.entity_id = t.id WHERE t.organization_id = '$ORG_ID' AND ue.id IS NULL ORDER BY t.name LIMIT $BATCH_SIZE OFFSET $offset")

    local batch_count=$(echo "$rows" | jq 'length')
    if [ "$batch_count" -eq 0 ]; then break; fi

    for i in $(seq 0 $((batch_count - 1))); do
      local row=$(echo "$rows" | jq -c ".[$i]")
      local id=$(echo "$row" | jq -r '.id')
      local name=$(echo "$row" | jq -r '.name')
      local desc=$(echo "$row" | jq -r '.description')

      local source="$name"
      [ -n "$desc" ] && source="$source. $desc"

      processed=$((processed + 1))
      process_entity "tool" "$id" "$source" "$processed" "$total" || failed=$((failed + 1))
    done

    offset=$((offset + BATCH_SIZE))
  done

  echo "Tools: $processed processed, $failed failed"
}

case "$ENTITY_TYPE" in
  parts) backfill_parts ;;
  tools) backfill_tools ;;
  all)
    backfill_parts
    echo ""
    backfill_tools
    ;;
  *) echo "Usage: $0 [parts|tools|all] [batch_size]"; exit 1 ;;
esac

echo ""
echo "Backfill complete!"
