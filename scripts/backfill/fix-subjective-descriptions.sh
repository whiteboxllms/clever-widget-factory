#!/bin/bash
# Re-generate descriptions that contain subjective/marketing language.
# Uses the updated neutral prompt.

set -e

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

generate_description() {
  local name="$1"
  local table="$2"

  local entity_label="inventory item"
  if [ "$table" = "tools" ]; then
    entity_label="asset"
  fi

  local prompt="Write a plain, factual description (1-2 sentences, max 200 characters) for an ${entity_label} named \"${name}\" in a farm/workshop inventory system. State what it physically is and what it does. Focus on physical characteristics and function so the description is useful for search. Be objective and neutral. Do not use value words like 'ideal', 'perfect', 'excellent', 'essential', 'versatile', 'superior', 'premium', 'high-performance', 'precision-engineered'. Do not imply quality judgments. Do not assume specific use cases — items may be used for farm work, sales, or general purposes. Do not include the item name in the description. Return ONLY the description text, nothing else."

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

fix_table() {
  local table="$1"
  echo "=== Fixing subjective descriptions in ${table} ==="

  local rows=$(run_sql "SELECT id::text, name FROM ${table} WHERE organization_id = '${ORG_ID}' AND description IS NOT NULL AND description != '' AND (description ILIKE '%ideal%' OR description ILIKE '%excellent%' OR description ILIKE '%perfect%' OR description ILIKE '%essential%' OR description ILIKE '%versatile%' OR description ILIKE '%superior%' OR description ILIKE '%premium%' OR description ILIKE '%high-performance%' OR description ILIKE '%precision-engineered%' OR description ILIKE '%ensuring%') ORDER BY name")

  local total=$(echo "$rows" | jq 'length')
  echo "Found: $total records with subjective language"

  if [ "$total" -eq 0 ]; then
    echo "Nothing to fix."
    return
  fi

  local fixed=0
  local failed=0

  for i in $(seq 0 $((total - 1))); do
    local row=$(echo "$rows" | jq -c ".[$i]")
    local id=$(echo "$row" | jq -r '.id')
    local name=$(echo "$row" | jq -r '.name')

    echo -n "[$((i+1))/$total] \"$name\"... "

    local desc=$(generate_description "$name" "$table")
    if [ -z "$desc" ]; then
      echo "FAILED (no description)"
      failed=$((failed + 1))
      continue
    fi

    desc=$(echo "$desc" | head -c 500)
    local escaped_desc=$(echo "$desc" | sed "s/'/''/g")

    local tmpfile=$(mktemp)
    echo "{\"sql\": $(echo "UPDATE ${table} SET description = '${escaped_desc}' WHERE id = '${id}'" | jq -Rs .)}" | \
      aws lambda invoke \
        --function-name cwf-db-migration \
        --payload file:///dev/stdin \
        --region "$REGION" \
        --cli-binary-format raw-in-base64-out \
        "$tmpfile" > /dev/null 2>&1
    local result=$(cat "$tmpfile" | jq -r '.body' | jq -c '.rowCount // 0')
    rm -f "$tmpfile"

    if [ "$result" -ge 1 ] 2>/dev/null; then
      echo "OK: $desc"
      fixed=$((fixed + 1))
    else
      echo "FAILED (db write)"
      failed=$((failed + 1))
    fi

    sleep 0.5
  done

  echo "${table}: $fixed fixed, $failed failed"
}

fix_table "parts"
echo ""
fix_table "tools"
echo ""
echo "Done."
