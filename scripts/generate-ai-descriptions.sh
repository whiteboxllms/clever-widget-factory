#!/bin/bash
set -e

# Generate AI descriptions using Claude Haiku API
# Usage: ANTHROPIC_API_KEY=your-key ./scripts/generate-ai-descriptions.sh <csv-file> <num-parts>

CSV_FILE="$1"
NUM_PARTS="${2:-5}"

if [ -z "$CSV_FILE" ]; then
  echo "Usage: ANTHROPIC_API_KEY=your-key $0 <csv-file> [num-parts]"
  echo "Example: ANTHROPIC_API_KEY=sk-... $0 parts-review.csv 5"
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY environment variable not set"
  echo "Get your API key from: https://console.anthropic.com/"
  exit 1
fi

if [ ! -f "$CSV_FILE" ]; then
  echo "Error: File not found: $CSV_FILE"
  exit 1
fi

OUTPUT_FILE="${CSV_FILE%.csv}-ai-generated.csv"

echo "🤖 Generating AI descriptions using Claude Haiku..."
echo "   Input: $CSV_FILE"
echo "   Output: $OUTPUT_FILE"
echo "   Processing: $NUM_PARTS parts"
echo ""

# Create output CSV with header
echo "id,original_name,standardized_name,ai_description,ai_policy" > "$OUTPUT_FILE"

# Process first N parts (skip header)
PROCESSED=0
tail -n +2 "$CSV_FILE" | head -n "$NUM_PARTS" | while IFS= read -r line; do
  ((PROCESSED++))
  
  # Extract fields from CSV
  ID=$(echo "$line" | cut -d',' -f1 | tr -d '"')
  NAME=$(echo "$line" | cut -d',' -f2 | tr -d '"')
  CURRENT_DESC=$(echo "$line" | cut -d',' -f3 | tr -d '"')
  CATEGORY=$(echo "$line" | cut -d',' -f5 | tr -d '"')
  UNIT=$(echo "$line" | cut -d',' -f6 | tr -d '"')
  
  echo "[$PROCESSED/$NUM_PARTS] Processing: $NAME"
  
  # Create prompt for Claude
  PROMPT="You are a hardware inventory specialist. Given a part name and details, provide:
1. Standardized name (proper capitalization, clear, concise)
2. Description (1 sentence describing physical characteristics)
3. Policy (1 sentence on how to use it properly)

Part Details:
- Name: $NAME
- Current Description: $CURRENT_DESC
- Category: $CATEGORY
- Unit: $UNIT

Respond in JSON format:
{
  \"standardized_name\": \"...\",
  \"description\": \"...\",
  \"policy\": \"...\"
}"

  # Call Claude API
  RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "{
      \"model\": \"claude-3-haiku-20240307\",
      \"max_tokens\": 300,
      \"messages\": [{
        \"role\": \"user\",
        \"content\": $(echo "$PROMPT" | jq -Rs .)
      }]
    }")
  
  # Extract the response text
  CONTENT=$(echo "$RESPONSE" | jq -r '.content[0].text' 2>/dev/null || echo "{}")
  
  # Parse JSON response
  STD_NAME=$(echo "$CONTENT" | jq -r '.standardized_name' 2>/dev/null || echo "$NAME")
  DESCRIPTION=$(echo "$CONTENT" | jq -r '.description' 2>/dev/null || echo "")
  POLICY=$(echo "$CONTENT" | jq -r '.policy' 2>/dev/null || echo "")
  
  # Escape quotes for CSV
  STD_NAME=$(echo "$STD_NAME" | sed 's/"/""/g')
  DESCRIPTION=$(echo "$DESCRIPTION" | sed 's/"/""/g')
  POLICY=$(echo "$POLICY" | sed 's/"/""/g')
  
  # Write to output CSV
  echo "\"$ID\",\"$NAME\",\"$STD_NAME\",\"$DESCRIPTION\",\"$POLICY\"" >> "$OUTPUT_FILE"
  
  echo "   ✓ Standardized: $STD_NAME"
  echo ""
  
  # Small delay to avoid rate limits
  sleep 1
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AI generation complete!"
echo "   Output: $OUTPUT_FILE"
echo ""
echo "Review the results and if satisfied, run with more parts:"
echo "  ANTHROPIC_API_KEY=\$ANTHROPIC_API_KEY $0 $CSV_FILE 100"
