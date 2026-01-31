#!/bin/bash

# Optional: Start from a specific tool name
START_FROM="${1:-}"

echo "🔄 Regenerating embeddings by triggering tool updates..."
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
echo "Found $TOTAL tools to update"
echo ""

PROCESSED=0
BATCH_NUM=0

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))
  echo ""
  echo "=== BATCH $BATCH_NUM ==="
  
  # Get next batch of 5 tools
  WHERE_CLAUSE="organization_id = '00000000-0000-0000-0000-000000000001'"
  if [ -n "$START_FROM" ]; then
    WHERE_CLAUSE="$WHERE_CLAUSE AND name >= '$START_FROM'"
  fi
  
  SQL_BATCH="SELECT 
    id::text,
    name,
    description,
    category,
    status
  FROM tools
  WHERE $WHERE_CLAUSE
  ORDER BY name
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

  # Process each tool
  for i in $(seq 0 $((BATCH_COUNT - 1))); do
    tool=$(cat /tmp/tools-batch.json | jq -r ".body" | jq -r ".data[$i]" | jq -c '.')
    ID=$(echo "$tool" | jq -r '.id')
    NAME=$(echo "$tool" | jq -r '.name')
    DESC=$(echo "$tool" | jq -r '.description // ""')
    CATEGORY=$(echo "$tool" | jq -r '.category')
    STATUS=$(echo "$tool" | jq -r '.status')
    
    PROCESSED=$((PROCESSED + 1))
    echo "[$PROCESSED/$TOTAL] $NAME"
    
    # Directly invoke embeddings processor (safer than PUT)
    aws lambda invoke \
      --function-name cwf-embeddings-processor \
      --payload "$(jq -n \
        --arg id "$ID" \
        --arg name "$NAME" \
        --arg desc "$DESC" \
        --arg cat "$CATEGORY" \
        --arg stat "$STATUS" \
        '{
          table: "tools",
          id: $id,
          data: {
            name: $name,
            description: $desc,
            category: $cat,
            status: $stat
          }
        }')" \
      --region us-west-2 \
      --cli-binary-format raw-in-base64-out \
      /tmp/embed-$ID.json > /dev/null 2>&1
    
    echo "  ✓ Embedding generated"
    
    # Cleanup
    rm -f /tmp/embed-$ID.json
    
    # Small delay to avoid overwhelming the system
    sleep 1
  done
  
  echo "Batch $BATCH_NUM complete. Waiting 5s for embeddings to process..."
  sleep 5
done

echo ""
echo "✅ All tool updates triggered!"
echo "🔍 Check logs: aws logs tail /aws/lambda/cwf-embeddings-processor --since 5m --region us-west-2"
