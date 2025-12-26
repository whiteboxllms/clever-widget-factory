#!/bin/bash

QUERY="${1:-pipe}"

echo "Generating embedding for query: $QUERY"

aws lambda invoke \
  --function-name cwf-embeddings-lambda \
  --payload "$(jq -n --arg text "$QUERY" '{text: $text}')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/query-embedding.json > /dev/null 2>&1

QUERY_EMBEDDING=$(cat /tmp/query-embedding.json | jq -r '.body' | jq -r '.embedding | join(",")')

echo "Searching for similar parts..."

SQL="SELECT 
  name, 
  category,
  search_embedding <=> '[$QUERY_EMBEDDING]'::vector as distance
FROM parts 
WHERE search_embedding IS NOT NULL
ORDER BY search_embedding <=> '[$QUERY_EMBEDDING]'::vector
LIMIT 10"

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
  /tmp/search-results.json > /dev/null 2>&1

echo ""
echo "Top 10 results for '$QUERY' (lower distance = more similar):"
echo ""
cat /tmp/search-results.json | jq -r '.body' | jq -r '.data[] | "\(.distance | tonumber | . * 100 | floor / 100) - \(.name) (\(.category))"'
