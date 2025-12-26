#!/bin/bash

LIMIT="${1:-10}"

echo "🔄 Regenerating full-context embeddings for $LIMIT parts..."
echo ""

SQL_BATCH="SELECT 
  p.id::text,
  p.name,
  COALESCE(p.description, '') as description,
  p.category,
  COALESCE(p.unit, '') as unit,
  COALESCE(p.storage_location, '') as storage_location,
  COALESCE(p.current_quantity, 0) as current_quantity,
  COALESCE(p.minimum_quantity, 0) as minimum_quantity,
  COALESCE(parent.name, '') as parent_structure_name,
  COALESCE(om.full_name, '') as accountable_person_name
FROM parts p
LEFT JOIN tools parent ON p.parent_structure_id::text = parent.id::text
LEFT JOIN organization_members om ON p.accountable_person_id::text = om.cognito_user_id::text
WHERE p.organization_id = '00000000-0000-0000-0000-000000000001'
ORDER BY p.name
LIMIT $LIMIT"

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL_BATCH" '{
    httpMethod: "POST",
    path: "/api/query",
    headers: {"Authorization": "Bearer test"},
    requestContext: {
      authorizer: {
        claims: {
          sub: "08617390-b001-708d-f61e-07a1698282ec",
          "custom:organization_id": "00000000-0000-0000-0000-000000000001"
        }
      }
    },
    body: ({sql: $sql} | @json)
  }')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/parts-batch.json > /dev/null 2>&1

BATCH_COUNT=$(cat /tmp/parts-batch.json | jq -r '.body' | jq -r '.data | length')

echo "Processing $BATCH_COUNT parts..."
echo ""

for i in $(seq 0 $((BATCH_COUNT - 1))); do
  part=$(cat /tmp/parts-batch.json | jq -r ".body" | jq -r ".data[$i]" | jq -c '.')
  ID=$(echo "$part" | jq -r '.id')
  NAME=$(echo "$part" | jq -r '.name')
  DESC=$(echo "$part" | jq -r '.description')
  CATEGORY=$(echo "$part" | jq -r '.category')
  UNIT=$(echo "$part" | jq -r '.unit')
  LOCATION=$(echo "$part" | jq -r '.storage_location')
  CURRENT_QTY=$(echo "$part" | jq -r '.current_quantity')
  MIN_QTY=$(echo "$part" | jq -r '.minimum_quantity')
  PARENT=$(echo "$part" | jq -r '.parent_structure_name')
  ACCOUNTABLE=$(echo "$part" | jq -r '.accountable_person_name')
  
  echo "[$((i + 1))/$BATCH_COUNT] $NAME"
  
  # Get issues for this part
  SQL_ISSUES="SELECT 
    i.description, 
    i.reported_at::text, 
    i.resolved_at::text,
    COALESCE(om.full_name, 'Unknown') as reported_by_name
  FROM issues i 
  LEFT JOIN organization_members om ON i.reported_by::text = om.cognito_user_id::text 
  WHERE i.context_type = 'part' AND i.context_id::text = '$ID' 
  ORDER BY i.reported_at DESC LIMIT 10"
  
  aws lambda invoke \
    --function-name cwf-core-lambda \
    --payload "$(jq -n --arg sql "$SQL_ISSUES" '{
      httpMethod: "POST",
      path: "/api/query",
      headers: {"Authorization": "Bearer test"},
      requestContext: {
        authorizer: {
          claims: {
            sub: "08617390-b001-708d-f61e-07a1698282ec",
            "custom:organization_id": "00000000-0000-0000-0000-000000000001"
          }
        }
      },
      body: ({sql: $sql} | @json)
    }')" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/issues-$ID.json > /dev/null 2>&1
  
  # Get history for this part
  SQL_HISTORY="SELECT 
    change_type,
    old_quantity,
    new_quantity,
    quantity_change,
    change_reason,
    changed_at::text
  FROM parts_history
  WHERE part_id::text = '$ID'
  ORDER BY changed_at DESC LIMIT 10"
  
  aws lambda invoke \
    --function-name cwf-core-lambda \
    --payload "$(jq -n --arg sql "$SQL_HISTORY" '{
      httpMethod: "POST",
      path: "/api/query",
      headers: {"Authorization": "Bearer test"},
      requestContext: {
        authorizer: {
          claims: {
            sub: "08617390-b001-708d-f61e-07a1698282ec",
            "custom:organization_id": "00000000-0000-0000-0000-000000000001"
          }
        }
      },
      body: ({sql: $sql} | @json)
    }')" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/history-$ID.json > /dev/null 2>&1
  
  # Build full search text
  SEARCH_TEXT="Name: $NAME
Category: $CATEGORY
Description: $DESC
Unit: $UNIT
Location: $LOCATION
Area: $PARENT
Current Quantity: $CURRENT_QTY
Minimum Quantity: $MIN_QTY
Accountable: $ACCOUNTABLE

Issues:"
  
  # Add issues
  if cat /tmp/issues-$ID.json | jq -e '.body | fromjson | .data | length > 0' > /dev/null 2>&1; then
    while IFS= read -r issue; do
      desc=$(echo "$issue" | jq -r '.description')
      reported=$(echo "$issue" | jq -r '.reported_at')
      reporter=$(echo "$issue" | jq -r '.reported_by_name')
      resolved=$(echo "$issue" | jq -r '.resolved_at // ""')
      
      SEARCH_TEXT="$SEARCH_TEXT
- $desc
  Reported: $reported by $reporter"
      [ -n "$resolved" ] && [ "$resolved" != "null" ] && SEARCH_TEXT="$SEARCH_TEXT
  Resolved: $resolved"
    done < <(cat /tmp/issues-$ID.json | jq -r '.body' | jq -c '.data[]')
  fi
  
  SEARCH_TEXT="$SEARCH_TEXT

History:"
  
  # Add history
  if cat /tmp/history-$ID.json | jq -e '.body | fromjson | .data | length > 0' > /dev/null 2>&1; then
    while IFS= read -r hist; do
      change_type=$(echo "$hist" | jq -r '.change_type')
      old_qty=$(echo "$hist" | jq -r '.old_quantity')
      new_qty=$(echo "$hist" | jq -r '.new_quantity')
      qty_change=$(echo "$hist" | jq -r '.quantity_change')
      reason=$(echo "$hist" | jq -r '.change_reason // ""')
      changed=$(echo "$hist" | jq -r '.changed_at')
      
      SEARCH_TEXT="$SEARCH_TEXT
- $change_type: $old_qty → $new_qty (${qty_change:+$qty_change})
  Date: $changed"
      [ -n "$reason" ] && [ "$reason" != "null" ] && SEARCH_TEXT="$SEARCH_TEXT
  Reason: $reason"
    done < <(cat /tmp/history-$ID.json | jq -r '.body' | jq -c '.data[]')
  fi
  
  # Generate embedding
  aws lambda invoke \
    --function-name cwf-embeddings-lambda \
    --payload "$(jq -n --arg text "$SEARCH_TEXT" '{text: $text}')" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/embed-$ID.json > /dev/null 2>&1
  
  EMBEDDING=$(cat /tmp/embed-$ID.json | jq -r '.body' | jq -r '.embedding | join(",")')
  
  # Update database
  SQL_UPDATE="UPDATE parts SET search_embedding = '[$EMBEDDING]'::vector WHERE id::text = '$ID'"
  
  aws lambda invoke \
    --function-name cwf-core-lambda \
    --payload "$(jq -n --arg sql "$SQL_UPDATE" '{
      httpMethod: "POST",
      path: "/api/query",
      headers: {"Authorization": "Bearer test"},
      requestContext: {
        authorizer: {
          claims: {
            sub: "08617390-b001-708d-f61e-07a1698282ec",
            "custom:organization_id": "00000000-0000-0000-0000-000000000001"
          }
        }
      },
      body: ({sql: $sql} | @json)
    }')" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/update-$ID.json > /dev/null 2>&1
  
  echo "  ✓ Full-context embedding generated and saved"
  rm -f /tmp/issues-$ID.json /tmp/history-$ID.json /tmp/embed-$ID.json /tmp/update-$ID.json
  sleep 1
done

echo ""
echo "✅ Complete!"
