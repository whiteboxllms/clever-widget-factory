#!/bin/bash

# Test sending a single message to SQS for embedding generation
# Format: <name> - <description>

QUEUE_URL="https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue"

# Get a test tool
SQL="SELECT id::text, name, description FROM tools WHERE name LIKE 'Honda%' LIMIT 1"

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
  /tmp/test-tool.json > /dev/null 2>&1

TOOL=$(cat /tmp/test-tool.json | jq -r '.body' | jq -c '.data[0]')
ID=$(echo "$TOOL" | jq -r '.id')
NAME=$(echo "$TOOL" | jq -r '.name')
DESC=$(echo "$TOOL" | jq -r '.description // ""')

echo "Sending message for: $NAME"
echo "ID: $ID"

# Build search text: name - description
SEARCH_TEXT="$NAME - $DESC"

# Send to SQS
MESSAGE=$(jq -n \
  --arg id "$ID" \
  --arg table "tools" \
  --arg text "$SEARCH_TEXT" \
  '{
    id: $id,
    table: $table,
    text: $text
  }')

echo ""
echo "=== MESSAGE BEING SENT ==="
echo "$MESSAGE" | jq '.'
echo "========================="
echo ""

aws sqs send-message \
  --queue-url "$QUEUE_URL" \
  --message-body "$MESSAGE" \
  --region us-west-2

echo ""
echo "Message sent to SQS"
echo "Check Lambda logs: aws logs tail /aws/lambda/cwf-embeddings-processor --follow"
