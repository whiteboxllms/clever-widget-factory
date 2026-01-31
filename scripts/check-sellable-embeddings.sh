#!/bin/bash
set -e

# Check embedding status for all 7 sellable products

echo "🔍 Checking embeddings for sellable products..."
echo ""

# Query unified_embeddings for all sellable parts
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload '{"sql":"SELECT ue.entity_type, ue.entity_id, p.name, LEFT(ue.embedding_source, 80) as source_preview, ue.model_version, ue.created_at FROM unified_embeddings ue JOIN parts p ON ue.entity_id = p.id WHERE ue.entity_type = '\''part'\'' AND p.sellable = true ORDER BY p.name"}' \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/sellable-embeddings.json > /dev/null 2>&1

echo "Embeddings found:"
cat /tmp/sellable-embeddings.json | jq -r '.body' | jq -r '.rows[] | "✅ \(.name)\n   Preview: \(.source_preview)...\n   Created: \(.created_at)\n"'

EMBEDDING_COUNT=$(cat /tmp/sellable-embeddings.json | jq -r '.body' | jq -r '.rows | length')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary: $EMBEDDING_COUNT / 7 sellable products have embeddings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$EMBEDDING_COUNT" -eq 7 ]; then
  echo "🎉 All sellable products have embeddings!"
else
  echo "⚠️  Missing embeddings for $((7 - EMBEDDING_COUNT)) products"
  echo ""
  echo "To regenerate missing embeddings:"
  echo "  ./scripts/test-sellable-parts-update-lambda.sh"
fi
