#!/bin/bash

echo "=== Embedding Comparison Test ==="
echo ""

# Generate query embedding for "motorcycle"
QUERY="motorcycle"
echo "Query: $QUERY"
echo ""

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$QUERY" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/query-moto.json > /dev/null 2>&1

QUERY_EMB=$(cat /tmp/query-moto.json | jq -r '.body' | jq -r '.embedding')

# Generate embedding for full Honda text
echo "1. Full Honda XR150 text (62 lines with issues, actions, implementations):"
FULL_TEXT=$(cat data/embedding-texts/Honda_Xr150.txt)

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$FULL_TEXT" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/full-emb.json > /dev/null 2>&1

FULL_EMB=$(cat /tmp/full-emb.json | jq -r '.body' | jq -r '.embedding')

# Generate embedding for short Honda text
echo "2. Short Honda XR150 text (just name):"
SHORT_TEXT=$(cat data/embedding-texts/short_Honda_Xr150.txt)

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$SHORT_TEXT" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/short-emb.json > /dev/null 2>&1

SHORT_EMB=$(cat /tmp/short-emb.json | jq -r '.body' | jq -r '.embedding')

# Calculate cosine distances using PostgreSQL
SQL_FULL="SELECT 1 - ('$QUERY_EMB'::vector <=> '$FULL_EMB'::vector) as similarity"
SQL_SHORT="SELECT 1 - ('$QUERY_EMB'::vector <=> '$SHORT_EMB'::vector) as similarity"

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL_FULL" '{
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
  /tmp/full-sim.json > /dev/null 2>&1

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL_SHORT" '{
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
  /tmp/short-sim.json > /dev/null 2>&1

FULL_SIM=$(cat /tmp/full-sim.json | jq -r '.body' | jq -r '.data[0].similarity')
SHORT_SIM=$(cat /tmp/short-sim.json | jq -r '.body' | jq -r '.data[0].similarity')

FULL_DIST=$(echo "1 - $FULL_SIM" | bc -l)
SHORT_DIST=$(echo "1 - $SHORT_SIM" | bc -l)

echo ""
echo "=== Results ==="
echo "Full text:"
echo "  Cosine distance:  $FULL_DIST (lower = more similar)"
echo "  Similarity score: $FULL_SIM (higher = more similar)"
echo ""
echo "Short text:"
echo "  Cosine distance:  $SHORT_DIST (lower = more similar)"
echo "  Similarity score: $SHORT_SIM (higher = more similar)"
echo ""
if (( $(echo "$FULL_DIST < $SHORT_DIST" | bc -l) )); then
  echo "✅ Full text is MORE similar (lower distance: $FULL_DIST < $SHORT_DIST)"
else
  echo "❌ Short text is MORE similar (lower distance: $SHORT_DIST < $FULL_DIST)"
fi
