#!/bin/bash

# Optional: Start from a specific tool name
START_FROM="${1:-}"

TEXTS_DIR="data/embedding-texts"
mkdir -p "$TEXTS_DIR"

echo "📝 Generating embedding texts (NOT pushing to database)..."
echo "📁 Saving to $TEXTS_DIR/"
if [ -n "$START_FROM" ]; then
  echo "🎯 Starting from: $START_FROM"
fi
echo ""

# Get total count
SQL_COUNT="SELECT COUNT(*) as count FROM tools WHERE organization_id = '00000000-0000-0000-0000-000000000001'"

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL_COUNT" '{
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
  /tmp/total-count.json > /dev/null 2>&1

TOTAL=$(cat /tmp/total-count.json | jq -r '.body' | jq -r '.data[0].count')
echo "Found $TOTAL tools to embed"
echo "💰 Estimated cost: ~\$$(echo "scale=4; $TOTAL * 0.00005" | bc) USD"
echo ""

PROCESSED=0
BATCH_NUM=0

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))
  echo ""
  echo "=== BATCH $BATCH_NUM ==="
  
  # Get next batch of 5 tools with full context
  WHERE_CLAUSE="t.organization_id = '00000000-0000-0000-0000-000000000001'"
  if [ -n "$START_FROM" ]; then
    WHERE_CLAUSE="$WHERE_CLAUSE AND t.name >= '$START_FROM'"
  fi
  
  SQL_BATCH="SELECT 
    t.id::text,
    t.name,
    t.category,
    t.status,
    COALESCE(t.description, '') as description,
    COALESCE(t.storage_location, '') as storage_location,
    COALESCE(t.serial_number, '') as serial_number,
    COALESCE(t.created_at::text, '') as created_at,
    COALESCE(t.updated_at::text, '') as updated_at,
    COALESCE(parent.name, '') as parent_structure_name,
    COALESCE(om.full_name, '') as accountable_person_name
  FROM tools t
  LEFT JOIN tools parent ON t.parent_structure_id::text = parent.id::text
  LEFT JOIN organization_members om ON t.accountable_person_id::text = om.cognito_user_id::text
  WHERE $WHERE_CLAUSE
  ORDER BY t.name
  LIMIT 5 OFFSET $PROCESSED"
  
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
    /tmp/tools-batch.json > /dev/null 2>&1

  BATCH_COUNT=$(cat /tmp/tools-batch.json | jq -r '.body' | jq -r '.data | length')
  
  if [ "$BATCH_COUNT" -eq 0 ]; then
    echo "No more tools to process"
    break
  fi
  
  echo "Processing batch of $BATCH_COUNT tools..."

  # Process each tool (avoid subshell to preserve PROCESSED counter)
  for i in $(seq 0 $((BATCH_COUNT - 1))); do
    tool=$(cat /tmp/tools-batch.json | jq -r ".body" | jq -r ".data[$i]" | jq -c '.')
    ID=$(echo "$tool" | jq -r '.id')
    NAME=$(echo "$tool" | jq -r '.name')
    CATEGORY=$(echo "$tool" | jq -r '.category')
    STATUS=$(echo "$tool" | jq -r '.status')
    DESC=$(echo "$tool" | jq -r '.description')
    LOCATION=$(echo "$tool" | jq -r '.storage_location')
    SERIAL=$(echo "$tool" | jq -r '.serial_number')
    CREATED=$(echo "$tool" | jq -r '.created_at')
    UPDATED=$(echo "$tool" | jq -r '.updated_at')
    PARENT=$(echo "$tool" | jq -r '.parent_structure_name')
    ACCOUNTABLE=$(echo "$tool" | jq -r '.accountable_person_name')
    
    PROCESSED=$((PROCESSED + 1))
    echo "[$PROCESSED/$TOTAL] $NAME"
    
    # Get issues for this tool with resolved date
    SQL_ISSUES="SELECT 
      i.id::text as issue_id,
      i.description, 
      i.reported_at::text, 
      i.resolved_at::text,
      COALESCE(om.full_name, 'Unknown') as reported_by_name
    FROM issues i 
    LEFT JOIN organization_members om ON i.reported_by::text = om.cognito_user_id::text 
    WHERE i.context_type = 'tool' AND i.context_id::text = '$ID' 
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
    
    # Get actions for this tool (both direct asset_id and via linked issues)
    SQL_ACTIONS="SELECT a.id::text, a.title, a.linked_issue_id::text, COALESCE(a.completed_at::text, a.created_at::text) as done_at, COALESCE(om.full_name, 'Unknown') as assigned_to_name, COALESCE(a.policy, '') as policy, COALESCE(string_agg(ai.update_text, ' | '), '') as implementations FROM actions a LEFT JOIN organization_members om ON a.assigned_to::text = om.cognito_user_id::text LEFT JOIN issues i ON a.linked_issue_id::text = i.id::text LEFT JOIN action_implementation_updates ai ON a.id::text = ai.action_id::text WHERE (a.asset_id::text = '$ID' OR (i.context_type = 'tool' AND i.context_id::text = '$ID')) GROUP BY a.id, a.title, a.linked_issue_id, a.completed_at, a.created_at, om.full_name, a.policy ORDER BY done_at DESC LIMIT 10"
    
    aws lambda invoke \
      --function-name cwf-core-lambda \
      --payload "$(jq -n --arg sql "$SQL_ACTIONS" '{
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
      /tmp/actions-$ID.json > /dev/null 2>&1
    
    # Build full search text
    SEARCH_TEXT="Name: $NAME
Category: $CATEGORY
Status: $STATUS
Description: $DESC
Location: $LOCATION
Area: $PARENT
Serial: $SERIAL
Accountable: $ACCOUNTABLE
Created: $CREATED
Updated: $UPDATED

Issues:"
    
    # Build issues with their actions nested underneath
    ISSUES=""
    LINKED_ACTION_IDS=""
    if cat /tmp/issues-$ID.json | jq -e '.body | fromjson | .data | length > 0' > /dev/null 2>&1; then
      while IFS= read -r issue; do
        issue_id=$(echo "$issue" | jq -r '.issue_id')
        desc=$(echo "$issue" | jq -r '.description')
        reported=$(echo "$issue" | jq -r '.reported_at')
        reporter=$(echo "$issue" | jq -r '.reported_by_name')
        resolved=$(echo "$issue" | jq -r '.resolved_at // ""')
        
        ISSUES="${ISSUES}- ${desc}\n  Reported: ${reported} by ${reporter}\n"
        [ -n "$resolved" ] && [ "$resolved" != "null" ] && ISSUES="${ISSUES}  Resolved: ${resolved}\n"
        
        # Get actions for this specific issue
        if cat /tmp/actions-$ID.json | jq -e '.body | fromjson | .data | length > 0' > /dev/null 2>&1; then
          while IFS= read -r action; do
            action_id=$(echo "$action" | jq -r '.id // ""')
            linked_issue=$(echo "$action" | jq -r '.linked_issue_id // ""')
            if [ "$linked_issue" = "$issue_id" ]; then
              title=$(echo "$action" | jq -r '.title')
              done_at=$(echo "$action" | jq -r '.done_at')
              worker=$(echo "$action" | jq -r '.assigned_to_name')
              policy=$(echo "$action" | jq -r '.policy')
              impls=$(echo "$action" | jq -r '.implementations')
              ISSUES="${ISSUES}  Action: ${title}\n    Done: ${done_at}\n    Worker: ${worker}\n    Policy: ${policy}\n"
              [ -n "$impls" ] && [ "$impls" != "" ] && ISSUES="${ISSUES}    Implementation: ${impls}\n"
              LINKED_ACTION_IDS="${LINKED_ACTION_IDS}${action_id},"
            fi
          done < <(cat /tmp/actions-$ID.json | jq -r '.body' | jq -c '.data[]')
        fi
        ISSUES="${ISSUES}\n"
      done < <(cat /tmp/issues-$ID.json | jq -r '.body' | jq -c '.data[]')
    fi
    if [ -n "$ISSUES" ]; then
      SEARCH_TEXT="${SEARCH_TEXT}\n$(echo -e "$ISSUES")"
    fi
    
    SEARCH_TEXT="$SEARCH_TEXT

Standalone Actions:"
    
    # Add standalone actions (not linked to issues)
    STANDALONE=""
    if cat /tmp/actions-$ID.json | jq -e '.body | fromjson | .data | length > 0' > /dev/null 2>&1; then
      while IFS= read -r action; do
        action_id=$(echo "$action" | jq -r '.id // ""')
        linked_issue=$(echo "$action" | jq -r '.linked_issue_id // ""')
        if [ -z "$linked_issue" ] || [ "$linked_issue" = "null" ]; then
          title=$(echo "$action" | jq -r '.title')
          done_at=$(echo "$action" | jq -r '.done_at')
          worker=$(echo "$action" | jq -r '.assigned_to_name')
          policy=$(echo "$action" | jq -r '.policy')
          impls=$(echo "$action" | jq -r '.implementations')
          STANDALONE="${STANDALONE}- ${title}\n  Done: ${done_at}\n  Worker: ${worker}\n  Policy: ${policy}\n"
          [ -n "$impls" ] && [ "$impls" != "" ] && STANDALONE="${STANDALONE}  Implementation: ${impls}\n"
          STANDALONE="${STANDALONE}\n"
        fi
      done < <(cat /tmp/actions-$ID.json | jq -r '.body' | jq -c '.data[]')
    fi
    if [ -n "$STANDALONE" ]; then
      SEARCH_TEXT="${SEARCH_TEXT}\n$(echo -e "$STANDALONE")"
    fi
    
    # Save text to file
    SAFE_NAME=$(echo "$NAME" | tr '/' '-' | tr ' ' '_')
    echo -e "$SEARCH_TEXT" > "$TEXTS_DIR/${SAFE_NAME}.txt"
    echo "  ✓ Saved text file"
    
    # Cleanup temp files
    rm -f /tmp/issues-$ID.json /tmp/actions-$ID.json
  done
  
  PROCESSED=$((PROCESSED + BATCH_COUNT))
  
  echo "Batch $BATCH_NUM complete."
done

echo ""
echo "✅ Text generation complete!"
echo "📝 Embedding texts saved to $TEXTS_DIR/"
echo "📊 Total files: $(ls -1 $TEXTS_DIR | wc -l)"
