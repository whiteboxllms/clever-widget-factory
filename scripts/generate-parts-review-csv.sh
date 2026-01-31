#!/bin/bash
set -e

# Generate CSV of all parts with suggested descriptions and policies for review

OUTPUT_FILE="parts-review-$(date +%Y%m%d-%H%M%S).csv"

echo "📝 Generating parts review CSV..."
echo ""

# Create CSV header
echo "id,name,current_description,current_policy,category,unit,suggested_policy" > "$OUTPUT_FILE"

# Fetch all parts in batches
OFFSET=0
BATCH_SIZE=100
TOTAL_PROCESSED=0

while true; do
  echo "Fetching batch starting at offset $OFFSET..."
  
  aws lambda invoke \
    --function-name cwf-db-migration \
    --payload "{\"sql\":\"SELECT id, name, COALESCE(description, '') as description, COALESCE(policy, '') as policy, COALESCE(category, '') as category, COALESCE(unit, '') as unit FROM parts ORDER BY name LIMIT $BATCH_SIZE OFFSET $OFFSET\"}" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/parts-batch-$OFFSET.json > /dev/null 2>&1
  
  # Extract rows
  ROWS=$(cat /tmp/parts-batch-$OFFSET.json | jq -r '.body' | jq -r '.rows')
  ROW_COUNT=$(echo "$ROWS" | jq 'length')
  
  if [ "$ROW_COUNT" -eq 0 ]; then
    break
  fi
  
  # Process each row and add to CSV
  echo "$ROWS" | jq -r '.[] | [.id, .name, .description, .policy, .category, .unit] | @csv' >> "$OUTPUT_FILE"
  
  TOTAL_PROCESSED=$((TOTAL_PROCESSED + ROW_COUNT))
  echo "  Processed $ROW_COUNT parts (total: $TOTAL_PROCESSED)"
  
  if [ "$ROW_COUNT" -lt "$BATCH_SIZE" ]; then
    break
  fi
  
  OFFSET=$((OFFSET + BATCH_SIZE))
  sleep 1
done

echo ""
echo "✅ CSV generated: $OUTPUT_FILE"
echo "   Total parts: $TOTAL_PROCESSED"
echo ""
echo "Next steps:"
echo "1. Open the CSV in a spreadsheet editor"
echo "2. Review and edit the 'suggested_policy' column"
echo "3. Add best practices for using each part"
echo "4. Save and use the updated CSV to bulk update the database"
