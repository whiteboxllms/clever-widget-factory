#!/bin/bash

TABLE="${1:-parts}"
LIMIT="${2:-999999}"
QUEUE_URL="https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue"

echo "🔄 Regenerating embeddings for $LIMIT $TABLE via SQS..."
echo ""

if [ "$TABLE" = "parts" ]; then
  SQL="SELECT id::text, name, COALESCE(description, '') as description, COALESCE(category, '') as category FROM $TABLE WHERE organization_id = '00000000-0000-0000-0000-000000000001' ORDER BY name LIMIT $LIMIT"
else
  SQL="SELECT id::text, name, COALESCE(description, '') as description, COALESCE(category, '') as category FROM $TABLE WHERE organization_id = '00000000-0000-0000-0000-000000000001' ORDER BY name LIMIT $LIMIT"
fi

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL" '{
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
  /tmp/batch.json > /dev/null 2>&1

COUNT=$(cat /tmp/batch.json | jq -r '.body' | jq -r '.data | length')
echo "Sending $COUNT items to SQS..."
echo ""

for i in $(seq 0 $((COUNT - 1))); do
  item=$(cat /tmp/batch.json | jq -r ".body" | jq -r ".data[$i]" | jq -c '.')
  ID=$(echo "$item" | jq -r '.id')
  NAME=$(echo "$item" | jq -r '.name')
  DESC=$(echo "$item" | jq -r '.description // ""')
  CAT=$(echo "$item" | jq -r '.category // ""')
  
  TEXT="$NAME"
  [ -n "$DESC" ] && TEXT="$TEXT - $DESC"
  [ -n "$CAT" ] && TEXT="$TEXT (Category: $CAT)"
  
  echo "[$((i + 1))/$COUNT] $NAME"
  
  MESSAGE=$(jq -n \
    --arg table "$TABLE" \
    --arg id "$ID" \
    --arg text "$TEXT" \
    '{
      id: $id,
      table: $table,
      text: $text
    }')
  
  aws sqs send-message \
    --queue-url "$QUEUE_URL" \
    --message-body "$MESSAGE" \
    --region us-west-2 > /dev/null 2>&1
  
  echo "  ✓ Queued"
  sleep 0.5
done

echo ""
echo "✅ Complete! $COUNT messages sent to SQS"
echo "⏳ Embeddings will be processed asynchronously"
