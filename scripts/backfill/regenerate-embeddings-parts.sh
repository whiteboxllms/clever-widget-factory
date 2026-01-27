#!/bin/bash

LIMIT="${1:-10}"

echo "🔄 Regenerating embeddings for $LIMIT parts..."
echo ""

SQL_BATCH="SELECT 
  id::text,
  name,
  description,
  category
FROM parts
WHERE organization_id = '00000000-0000-0000-0000-000000000001'
ORDER BY name
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
  DESC=$(echo "$part" | jq -r '.description // ""')
  CATEGORY=$(echo "$part" | jq -r '.category')
  
  echo "[$((i + 1))/$BATCH_COUNT] $NAME"
  
  # Generate embedding text
  TEXT="Name: $NAME\nCategory: $CATEGORY\nDescription: $DESC"
  
  aws lambda invoke \
    --function-name cwf-embeddings-lambda \
    --payload "$(jq -n --arg text "$TEXT" '{text: $text}')" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/embed-$ID.json > /dev/null 2>&1
  
  EMBEDDING=$(cat /tmp/embed-$ID.json | jq -r '.body' | jq -r '.embedding | join(",")')
  
  # Update database with embedding
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
  
  echo "  ✓ Embedding generated and saved"
  rm -f /tmp/embed-$ID.json /tmp/update-$ID.json
  sleep 1
done

echo ""
echo "✅ Complete!"
