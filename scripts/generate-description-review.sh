#!/bin/bash

OUTPUT_FILE="data/tool-descriptions-review.csv"
mkdir -p data

echo "Fetching all tools..."

SQL="SELECT id::text, name, category, COALESCE(description, '') as description 
FROM tools 
WHERE organization_id = '00000000-0000-0000-0000-000000000001' 
ORDER BY name 
LIMIT 50"

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
  /tmp/all-tools.json > /dev/null 2>&1

echo "id,current_name,proposed_name,category,current_description,proposed_description" > "$OUTPUT_FILE"

TOTAL=$(cat /tmp/all-tools.json | jq -r '.body' | jq -r '.data | length')
echo "Processing $TOTAL tools..."

cat /tmp/all-tools.json | jq -r '.body' | jq -c '.data[]' | while read -r tool; do
  ID=$(echo "$tool" | jq -r '.id')
  NAME=$(echo "$tool" | jq -r '.name')
  CATEGORY=$(echo "$tool" | jq -r '.category')
  DESC=$(echo "$tool" | jq -r '.description')
  
  echo "Processing: $NAME"
  
  # Generate proposed name and description using Claude
  PROMPT="Tool: $NAME
Category: $CATEGORY
Current description: $DESC

Provide:
1. PROPOSED_NAME: Standard English name (translate local terms like 'Bara' to 'Crow Bar', fix typos like 'Gardin' to 'Garden')
2. PROPOSED_DESCRIPTION: Concise functional description (1-2 sentences) explaining what it is, primary function, and key features (e.g., 'electric motor', 'manual', 'steel blade')

Format your response as:
NAME: [proposed name]
DESCRIPTION: [proposed description]"

  RESPONSE=$(aws bedrock-runtime invoke-model \
    --model-id anthropic.claude-3-haiku-20240307-v1:0 \
    --body "{\"anthropic_version\":\"bedrock-2023-05-31\",\"max_tokens\":200,\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]}" \
    --region us-west-2 \
    /tmp/claude-$ID.json 2>&1 > /dev/null && \
    cat /tmp/claude-$ID.json | jq -r '.content[0].text' || echo "ERROR")
  
  PROPOSED_NAME=$(echo "$RESPONSE" | grep "^NAME:" | sed 's/^NAME: *//' | tr '\n' ' ' | tr '"' "'")
  PROPOSED_DESC=$(echo "$RESPONSE" | grep "^DESCRIPTION:" | sed 's/^DESCRIPTION: *//' | tr '\n' ' ' | tr '"' "'")
  
  # Escape CSV fields
  NAME_ESC=$(echo "$NAME" | sed 's/"/""/g')
  PROPOSED_NAME_ESC=$(echo "$PROPOSED_NAME" | sed 's/"/""/g')
  DESC_ESC=$(echo "$DESC" | sed 's/"/""/g')
  PROPOSED_DESC_ESC=$(echo "$PROPOSED_DESC" | sed 's/"/""/g')
  
  echo "\"$ID\",\"$NAME_ESC\",\"$PROPOSED_NAME_ESC\",\"$CATEGORY\",\"$DESC_ESC\",\"$PROPOSED_DESC_ESC\"" >> "$OUTPUT_FILE"
  
  rm -f /tmp/claude-$ID.json
  sleep 0.5
done

echo ""
echo "✅ Generated: $OUTPUT_FILE"
echo "Review and edit the proposed_description column, then use the import script to update."
