#!/bin/bash
set -e

echo "🔄 Triggering embeddings by touching each product via Core Lambda..."
echo ""

# Product IDs (excluding Banana Wine which already has an embedding)
PRODUCTS=(
  "b70f4702-9576-4d85-813f-d736726aac2c:Bignay Wine"
  "63a78c6c-9176-4db7-8ea2-d937b666f835:Lansones Wine"
  "29dac526-4b9d-4246-a14e-414586911da7:Long Neck Vinegar Spice"
  "7d4fe3bf-de2b-4e78-9d79-bccfe723dd62:Mango Wine"
  "87fb9e44-3ab9-4566-9acd-77f2a1d1f34e:Pure Vinegar"
  "6ba21e95-3d40-4ffe-9f92-edb6b8d20c4b:Spiced Vinegar Lipid"
)

SUCCESS=0
FAILED=0

for PRODUCT in "${PRODUCTS[@]}"; do
  IFS=':' read -r PART_ID PART_NAME <<< "$PRODUCT"
  
  echo "📦 $PART_NAME"
  
  # Fetch current part data
  aws lambda invoke \
    --function-name cwf-db-migration \
    --payload "{\"sql\":\"SELECT description, policy FROM parts WHERE id = '$PART_ID'\"}" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/fetch-$PART_ID.json > /dev/null 2>&1
  
  DESCRIPTION=$(cat /tmp/fetch-$PART_ID.json | jq -r '.body' | jq -r '.rows[0].description')
  POLICY=$(cat /tmp/fetch-$PART_ID.json | jq -r '.body' | jq -r '.rows[0].policy')
  
  # Create update payload (same data, just to trigger SQS)
  BODY=$(jq -n \
    --arg desc "$DESCRIPTION" \
    --arg pol "$POLICY" \
    '{description: $desc, policy: $pol}')
  
  PAYLOAD=$(jq -n \
    --arg id "$PART_ID" \
    --arg body "$BODY" \
    '{
      httpMethod: "PUT",
      path: ("/api/parts/" + $id),
      pathParameters: {id: $id},
      body: $body,
      requestContext: {
        authorizer: {
          organization_id: "00000000-0000-0000-0000-000000000001",
          user_id: "test-user-id"
        }
      }
    }')
  
  # Update via Core Lambda (triggers SQS)
  aws lambda invoke \
    --function-name cwf-core-lambda \
    --payload "$PAYLOAD" \
    --region us-west-2 \
    --cli-binary-format raw-in-base64-out \
    /tmp/update-$PART_ID.json > /dev/null 2>&1
  
  STATUS=$(cat /tmp/update-$PART_ID.json | jq -r '.statusCode' 2>/dev/null || echo "error")
  
  if [ "$STATUS" = "200" ]; then
    echo "   ✅ Triggered"
    ((SUCCESS++))
  else
    echo "   ❌ Failed (HTTP $STATUS)"
    ((FAILED++))
  fi
  
  sleep 1
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Triggered: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All embeddings triggered!"
  echo ""
  echo "Wait 10-30 seconds for async processing, then check:"
  echo "  ./scripts/check-sellable-embeddings.sh"
else
  echo "⚠️  Some triggers failed."
  exit 1
fi
