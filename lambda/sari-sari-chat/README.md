# Sari-Sari Chat Lambda

Conversational product search interface for the Sari-Sari store using AWS Bedrock Claude Haiku.

## Features

- Natural language product search
- Price filtering
- Negation handling ("without alcohol")
- Conversational context (remembers last 2 exchanges)
- Health benefits highlighting (when using unified embeddings)

## Unified Embeddings Support

The Lambda supports two search modes via the `USE_UNIFIED_EMBEDDINGS` environment variable:

### Legacy Mode (default)
- Uses inline `search_embedding` column in `parts` table
- Searches only name + description
- Set `USE_UNIFIED_EMBEDDINGS=false` or leave unset

### Unified Embeddings Mode (recommended)
- Uses `unified_embeddings` table
- Searches name + description + policy (health benefits)
- Better semantic matching for health-related queries
- Set `USE_UNIFIED_EMBEDDINGS=true`

## Environment Variables

- `AWS_REGION`: AWS region (default: us-west-2)
- `BEDROCK_MODEL_ID`: Claude model ID (default: anthropic.claude-3-5-haiku-20241022-v1:0)
- `USE_UNIFIED_EMBEDDINGS`: Enable unified embeddings search (default: false)
- `DB_HOST`: PostgreSQL host
- `DB_PASSWORD`: PostgreSQL password

## Deployment

```bash
cd lambda/sari-sari-chat
./deploy.sh
```

## Enabling Unified Embeddings

```bash
aws lambda update-function-configuration \
  --function-name sari-sari-chat \
  --environment Variables="{USE_UNIFIED_EMBEDDINGS=true,...}" \
  --region us-west-2
```

## Testing

```bash
# Test with health-related query
curl -X POST https://your-api.execute-api.us-west-2.amazonaws.com/prod/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need something for better sleep",
    "sessionId": "test-123"
  }'
```

## Migration Path

1. Deploy updated Lambda code
2. Verify all sellable parts have embeddings in `unified_embeddings` table
3. Test with `USE_UNIFIED_EMBEDDINGS=false` (baseline)
4. Test with `USE_UNIFIED_EMBEDDINGS=true` (new mode)
5. Compare results and switch permanently if satisfied
6. Eventually deprecate inline `search_embedding` column

## Benefits of Unified Embeddings

- **Better health queries**: "better sleep" finds Banana Wine (tryptophan content)
- **Usage context**: Policy field provides usage guidelines
- **Consistent architecture**: Same pattern as other entity types
- **Easier maintenance**: Single embedding generation pipeline
