#!/bin/bash

# Generate CSV with LLM-enhanced descriptions for tools and parts
# Output: id, table, current_name, proposed_name, category, current_description, proposed_description

OUTPUT_FILE="data/enhanced-descriptions.csv"
ORG_ID="00000000-0000-0000-0000-000000000001"
USER_ID="08617390-b001-708d-f61e-07a1698282ec"

# Write CSV header
echo "id,table,current_name,proposed_name,category,current_description,proposed_description" > "$OUTPUT_FILE"

# Function to enhance item (simple rule-based for now)
enhance_item() {
    local name="$1"
    
    # Simple name translations only
    local proposed_name="$name"
    case "$name" in
        *"Bara"*|*"bara"*|*"Barra"*) proposed_name="Crow Bar" ;;
        *"Kaing"*|*"kaing"*) proposed_name="Bamboo Basket" ;;
    esac
    
    echo "$proposed_name"
}

# Process tools
echo "Processing tools..." >&2
SQL="SELECT id::text, name, description, category FROM tools WHERE organization_id = '$ORG_ID' ORDER BY name"

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL" '{
    httpMethod: "POST",
    path: "/api/query",
    headers: {"Authorization": "Bearer test"},
    requestContext: {
      authorizer: {
        claims: {
          sub: "'$USER_ID'",
          "custom:organization_id": "'$ORG_ID'"
        }
      }
    },
    body: ({sql: $sql} | @json)
  }')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/tools.json > /dev/null 2>&1

cat /tmp/tools.json | jq -r '.body' | jq -c '.data[]' | while IFS= read -r row; do
    id=$(echo "$row" | jq -r '.id')
    name=$(echo "$row" | jq -r '.name')
    description=$(echo "$row" | jq -r '.description // ""')
    category=$(echo "$row" | jq -r '.category // ""')
    
    echo "  Tool: $name" >&2
    
    # Get enhanced name
    proposed_name=$(enhance_item "$name")
    
    # Proposed description: keep existing or generate category-based
    proposed_desc="$description"
    if [ -z "$description" ] && [ -n "$category" ]; then
        proposed_desc="$category tool/equipment"
    fi
    
    # Build CSV row using jq to properly escape everything
    jq -n \
        --arg id "$id" \
        --arg table "tools" \
        --arg name "$name" \
        --arg pname "$proposed_name" \
        --arg cat "$category" \
        --arg desc "$description" \
        --arg pdesc "$proposed_desc" \
        '[$id, $table, $name, $pname, $cat, $desc, $pdesc] | @csv' \
        >> "$OUTPUT_FILE"
done

# Process parts
echo "Processing parts..." >&2
SQL="SELECT id::text, name, description, category FROM parts WHERE organization_id = '$ORG_ID' ORDER BY name"

aws lambda invoke \
  --function-name cwf-core-lambda \
  --payload "$(jq -n --arg sql "$SQL" '{
    httpMethod: "POST",
    path: "/api/query",
    headers: {"Authorization": "Bearer test"},
    requestContext: {
      authorizer: {
        claims: {
          sub: "'$USER_ID'",
          "custom:organization_id": "'$ORG_ID'"
        }
      }
    },
    body: ({sql: $sql} | @json)
  }')" \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/parts.json > /dev/null 2>&1

cat /tmp/parts.json | jq -r '.body' | jq -c '.data[]' | while IFS= read -r row; do
    id=$(echo "$row" | jq -r '.id')
    name=$(echo "$row" | jq -r '.name')
    description=$(echo "$row" | jq -r '.description // ""')
    category=$(echo "$row" | jq -r '.category // ""')
    
    echo "  Part: $name" >&2
    
    # Get enhanced name
    proposed_name=$(enhance_item "$name")
    
    # Proposed description: keep existing or generate category-based
    proposed_desc="$description"
    if [ -z "$description" ] && [ -n "$category" ]; then
        proposed_desc="$category tool/equipment"
    fi
    
    # Build CSV row using jq to properly escape everything
    jq -n \
        --arg id "$id" \
        --arg table "parts" \
        --arg name "$name" \
        --arg pname "$proposed_name" \
        --arg cat "$category" \
        --arg desc "$description" \
        --arg pdesc "$proposed_desc" \
        '[$id, $table, $name, $pname, $cat, $desc, $pdesc] | @csv' \
        >> "$OUTPUT_FILE"
done

echo "Done! Output: $OUTPUT_FILE" >&2
echo "Total items: $(tail -n +2 "$OUTPUT_FILE" | wc -l)" >&2
