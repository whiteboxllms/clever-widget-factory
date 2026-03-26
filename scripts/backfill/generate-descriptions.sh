#!/bin/bash
# Generate descriptions for parts and tools that are missing them.
# Uses Bedrock Claude Haiku to generate descriptions from item names.
#
# Items with short/ambiguous names (codes like PG9, AD13) are written to a
# review file instead of being auto-applied.
#
# Usage:
#   ./scripts/backfill/generate-descriptions.sh [parts|tools|all] [batch_size]
#
# Output:
#   - Auto-applies clear descriptions directly to the database
#   - Writes ambiguous items to scripts/backfill/review-descriptions.jsonl

set -e

ENTITY_TYPE="${1:-all}"
BATCH_SIZE="${2:-10}"
ORG_ID="00000000-0000-0000-0000-000000000001"
REGION="us-west-2"
REVIEW_FILE="scripts/backfill/review-descriptions.jsonl"

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

# Clear review file
> "$REVIEW_FILE"

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

generate_description() {
  local name="$1"
  local entity_type="$2"
  local parent_name="$3"

  local context=""
  if [ -n "$parent_name" ] && [ "$parent_name" != "null" ]; then
    context=" It is stored in/part of: ${parent_name}."
  fi

  local prompt="Write a plain, factual description (1-2 sentences, max 200 characters) for a farm/workshop ${entity_type} named \"${name}\".${context} State what it is and what it does. Be objective and neutral. Do not use value words like 'ideal', 'perfect', 'excellent', 'essential', 'versatile'. Do not imply how the user should feel about it. Do not assume specific use cases — this is a general-purpose farm/workshop where items serve many purposes. Do not include the item name in the description. Return ONLY the description text, nothing else."

  local tmpfile=$(mktemp)
  jq -n --arg p "$prompt" '{
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 150,
    "temperature": 0.3,
    "messages": [{"role": "user", "content": $p}]
  }' | aws bedrock-runtime invoke-model \
    --model-id "anthropic.claude-3-5-haiku-20241022-v1:0" \
    --content-type "application/json" \
    --accept "application/json" \
    --body file:///dev/stdin \
    --region "$REGION" \
    --cli-binary-format raw-in-base64-out \
    "$tmpfile" > /dev/null 2>&1

  local desc=$(cat "$tmpfile" | jq -r '.content[0].text // empty')
  rm -f "$tmpfile"
  echo "$desc"
}

is_ambiguous() {
  local name="$1"
  local len=${#name}

  # Short names with digits are likely codes (PG9, AD13, etc.)
  if [ "$len" -le 4 ] && echo "$name" | grep -qE '[0-9]'; then
    return 0  # ambiguous
  fi

  # Very short names (2-3 chars) are ambiguous regardless
  if [ "$len" -le 3 ]; then
    return 0  # ambiguous
  fi

  return 1  # clear enough
}

write_description() {
  local table="$1"
  local id="$2"
  local description="$3"

  local escaped_desc=$(echo "$description" | sed "s/'/''/g")
  local sql="UPDATE ${table} SET description = '${escaped_desc}' WHERE id = '${id}'"

  local tmpfile=$(mktemp)
  echo "{\"sql\": $(echo "$sql" | jq -Rs .)}" | \
    aws lambda invoke \
      --function-name cwf-db-migration \
      --payload file:///dev/stdin \
      --region "$REGION" \
      --cli-binary-format raw-in-base64-out \
      "$tmpfile" > /dev/null 2>&1
  local result=$(cat "$tmpfile" | jq -r '.body' | jq -c '.rowCount // 0')
  rm -f "$tmpfile"
  echo "$result"
}

process_batch() {
  local table="$1"
  local entity_type="$2"

  echo "=== Generating descriptions for ${table} ==="

  local count_json=$(run_sql "SELECT COUNT(*) as cnt FROM ${table} WHERE organization_id = '${ORG_ID}' AND (description IS NULL OR description = '')")
  local total=$(echo "$count_json" | jq -r '.[0].cnt // 0')
  echo "Missing descriptions: $total ${table}"

  if [ "$total" -eq 0 ]; then
    echo "Nothing to do."
    return
  fi

  local offset=0
  local auto_applied=0
  local flagged=0
  local failed=0
  local flagged_in_batch=0

  while true; do
    local rows=$(run_sql "SELECT t.id::text, t.name, COALESCE(pt.name, '') as parent_name FROM ${table} t LEFT JOIN tools pt ON t.parent_structure_id = pt.id WHERE t.organization_id = '${ORG_ID}' AND (t.description IS NULL OR t.description = '') ORDER BY t.name LIMIT ${BATCH_SIZE} OFFSET ${offset}")

    local batch_count=$(echo "$rows" | jq 'length')
    if [ "$batch_count" -eq 0 ]; then break; fi

    for i in $(seq 0 $((batch_count - 1))); do
      local row=$(echo "$rows" | jq -c ".[$i]")
      local id=$(echo "$row" | jq -r '.id')
      local name=$(echo "$row" | jq -r '.name')
      local parent_name=$(echo "$row" | jq -r '.parent_name')
      local current=$((auto_applied + flagged + failed + 1))

      if is_ambiguous "$name"; then
        echo "[$current/$total] FLAGGED: \"$name\" (ambiguous)"
        jq -n --arg id "$id" --arg name "$name" --arg table "$table" --arg parent "$parent_name" \
          '{id: $id, name: $name, table: $table, parent_name: $parent}' >> "$REVIEW_FILE"
        flagged=$((flagged + 1))
        flagged_in_batch=$((flagged_in_batch + 1))
        continue
      fi

      echo -n "[$current/$total] \"$name\"... "

      local desc=$(generate_description "$name" "$entity_type" "$parent_name")
      if [ -z "$desc" ]; then
        echo "FAILED (no description generated)"
        failed=$((failed + 1))
        continue
      fi

      # Truncate to 500 chars if needed
      desc=$(echo "$desc" | head -c 500)

      local ok=$(write_description "$table" "$id" "$desc")
      if [ "$ok" -ge 1 ] 2>/dev/null; then
        echo "OK: $desc"
        auto_applied=$((auto_applied + 1))
      else
        echo "FAILED (db write)"
        failed=$((failed + 1))
      fi

      # Small delay to avoid Bedrock throttling
      sleep 0.5
    done

    # Don't increment offset — processed/flagged items drop out of the
    # result set on the next query because their description is no longer NULL.
    # Only increment when items are flagged (description stays NULL).
    offset=$((offset + flagged_in_batch))
    flagged_in_batch=0
  done

  echo ""
  echo "${table} summary: $auto_applied auto-applied, $flagged flagged for review, $failed failed"
}

case "$ENTITY_TYPE" in
  parts) process_batch "parts" "part" ;;
  tools) process_batch "tools" "tool" ;;
  all)
    process_batch "parts" "part"
    echo ""
    process_batch "tools" "tool"
    ;;
  *) echo "Usage: $0 [parts|tools|all] [batch_size]"; exit 1 ;;
esac

echo ""
echo "=== Done ==="
if [ -s "$REVIEW_FILE" ]; then
  local_count=$(wc -l < "$REVIEW_FILE")
  echo "$local_count items flagged for review in: $REVIEW_FILE"
  echo "Review and apply with: scripts/backfill/apply-reviewed-descriptions.sh"
fi
