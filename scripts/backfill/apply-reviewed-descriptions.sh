#!/bin/bash
# Apply manually reviewed descriptions from the review file.
#
# Workflow:
#   1. Run generate-descriptions.sh (creates review-descriptions.jsonl)
#   2. Edit review-descriptions.jsonl — add a "description" field to each line
#   3. Run this script to apply them
#
# Each line in the review file should look like:
#   {"id":"uuid","name":"PG9","table":"parts","parent_name":"Storage Shed","description":"Your description here"}
#
# Lines without a "description" field are skipped.

set -e

REVIEW_FILE="${1:-scripts/backfill/review-descriptions.jsonl}"
REGION="us-west-2"

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

if [ ! -f "$REVIEW_FILE" ]; then
  echo "Review file not found: $REVIEW_FILE"
  exit 1
fi

applied=0
skipped=0

while IFS= read -r line; do
  [ -z "$line" ] && continue

  desc=$(echo "$line" | jq -r '.description // empty')
  if [ -z "$desc" ]; then
    name=$(echo "$line" | jq -r '.name')
    echo "SKIP: \"$name\" (no description provided)"
    skipped=$((skipped + 1))
    continue
  fi

  id=$(echo "$line" | jq -r '.id')
  name=$(echo "$line" | jq -r '.name')
  table=$(echo "$line" | jq -r '.table')
  escaped_desc=$(echo "$desc" | sed "s/'/''/g")

  sql="UPDATE ${table} SET description = '${escaped_desc}' WHERE id = '${id}'"

  tmpfile=$(mktemp)
  echo "{\"sql\": $(echo "$sql" | jq -Rs .)}" | \
    aws lambda invoke \
      --function-name cwf-db-migration \
      --payload file:///dev/stdin \
      --region "$REGION" \
      --cli-binary-format raw-in-base64-out \
      "$tmpfile" > /dev/null 2>&1

  result=$(cat "$tmpfile" | jq -r '.body' | jq -c '.rowCount // 0')
  rm -f "$tmpfile"

  if [ "$result" -ge 1 ] 2>/dev/null; then
    echo "OK: \"$name\" -> $desc"
    applied=$((applied + 1))
  else
    echo "FAILED: \"$name\""
  fi
done < "$REVIEW_FILE"

echo ""
echo "Applied: $applied, Skipped: $skipped"
