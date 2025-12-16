#!/bin/bash

QUERY="Honda XR 150"

echo "=== Testing 'Honda XR 150' search ==="
echo ""

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$QUERY" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/query-honda.json > /dev/null 2>&1

QUERY_EMB=$(cat /tmp/query-honda.json | jq -r '.body' | jq -r '.embedding')

# Test against full text
FULL_TEXT=$(cat data/embedding-texts/Honda_Xr150.txt)

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$FULL_TEXT" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/full-honda.json > /dev/null 2>&1

FULL_EMB=$(cat /tmp/full-honda.json | jq -r '.body' | jq -r '.embedding')

# Test against short text
SHORT_TEXT=$(cat data/embedding-texts/short_Honda_Xr150.txt)

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$SHORT_TEXT" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/short-honda.json > /dev/null 2>&1

SHORT_EMB=$(cat /tmp/short-honda.json | jq -r '.body' | jq -r '.embedding')

# Calculate distances
SQL_FULL="SELECT '$QUERY_EMB'::vector <=> '$FULL_EMB'::vector as distance"
SQL_SHORT="SELECT '$QUERY_EMB'::vector <=> '$SHORT_EMB'::vector as distance"

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
  /tmp/full-dist.json > /dev/null 2>&1

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
  /tmp/short-dist.json > /dev/null 2>&1

FULL_DIST=$(cat /tmp/full-dist.json | jq -r '.body' | jq -r '.data[0].distance')
SHORT_DIST=$(cat /tmp/short-dist.json | jq -r '.body' | jq -r '.data[0].distance')

echo "Query: '$QUERY'"
echo ""
echo "Full text (62 lines):  distance = $FULL_DIST"
echo "Short text (name only): distance = $SHORT_DIST"
echo ""

if (( $(echo "$FULL_DIST < $SHORT_DIST" | bc -l) )); then
  echo "✅ Full text is MORE similar (lower distance)"
else
  echo "✅ Short text is MORE similar (lower distance)"
fi
