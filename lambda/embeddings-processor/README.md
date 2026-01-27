# Embeddings Processor Lambda

Processes SQS messages to generate embeddings for entities (parts, tools, actions, issues, policies) and stores them in the unified_embeddings table.

## Features

- **Async Processing**: Triggered by SQS queue for scalable embedding generation
- **AI Summarization**: Optional Claude Haiku summarization for verbose content (actions, issues)
- **Dual Write**: Supports writing to both unified_embeddings table and inline columns (backward compatibility)
- **Feature Flags**: Configurable behavior via environment variables

## Architecture

```
SQS Queue (cwf-embeddings-queue)
  ↓
Embeddings Processor Lambda
  ↓
1. Compose/Summarize embedding source
2. Generate embedding via Bedrock Titan
3. Write to unified_embeddings table
4. Write to inline columns (parts/tools only)
```

## Environment Variables

- `USE_AI_SUMMARIZATION` (default: false) - Enable AI summarization for actions/issues
- `WRITE_TO_UNIFIED` (default: true) - Write to unified_embeddings table
- `WRITE_TO_INLINE` (default: true) - Write to inline columns (parts/tools backward compatibility)

## SQS Message Format

### Standard Format (with pre-composed embedding_source)

```json
{
  "entity_type": "part",
  "entity_id": "uuid",
  "organization_id": "uuid",
  "embedding_source": "Banana Wine. Fermented banana beverage. Rich in potassium..."
}
```

### Fields Format (compose/summarize from fields)

```json
{
  "entity_type": "action",
  "entity_id": "uuid",
  "organization_id": "uuid",
  "fields": {
    "description": "Applied compost to banana plants",
    "evidence_description": "Spread 2 inches...",
    "policy": "Organic matter improves...",
    "observations": "Started at 7am..."
  },
  "assets": ["Wheelbarrow", "Shovel"]
}
```

## AI Summarization

When `USE_AI_SUMMARIZATION=true`, the Lambda uses Claude Haiku to summarize verbose content:

### Actions
- **Input**: description, evidence_description, policy, observations, assets
- **Output**: 2-3 sentence summary capturing WHAT, HOW, WHY
- **Benefit**: Reduces noise from verbose observations, standardizes format

### Issues
- **Input**: title, description, resolution_notes
- **Output**: 2-3 sentence summary capturing problem, resolution, insights
- **Benefit**: Consistent format for issue embeddings

### When to Summarize
- Actions with observations > 100 chars
- Issues with description > 200 chars
- Parts and tools are NOT summarized (already concise)

## Deployment

```bash
cd lambda/embeddings-processor
./deploy.sh
```

This will:
1. Install dependencies
2. Bundle code with shared modules
3. Deploy to Lambda
4. Show instructions for enabling AI summarization

## Testing

### Test AI Summarization Locally

```bash
cd lambda/embeddings-processor
node test-summarization.js
```

### Test with Sample SQS Message

```bash
# Send test message to queue
aws sqs send-message \
  --queue-url https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue \
  --message-body '{
    "entity_type": "action",
    "entity_id": "test-id",
    "organization_id": "org-id",
    "fields": {
      "description": "Test action",
      "observations": "Verbose observations..."
    }
  }' \
  --region us-west-2
```

### Monitor Processing

```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/cwf-embeddings-processor --follow --region us-west-2

# Check embedding coverage
./scripts/check-embedding-coverage.sh
```

## Backfilling Embeddings

### Actions

```bash
./scripts/backfill-actions-embeddings.sh
```

This will:
1. Query all actions with missing embeddings
2. Fetch related assets
3. Send to SQS queue with fields format
4. Lambda processes asynchronously

### Parts

```bash
./scripts/backfill-parts-embeddings-full-context.sh
```

## Enabling AI Summarization

```bash
aws lambda update-function-configuration \
  --function-name cwf-embeddings-processor \
  --environment Variables="{USE_AI_SUMMARIZATION=true,WRITE_TO_UNIFIED=true,WRITE_TO_INLINE=true}" \
  --region us-west-2
```

## Cost Considerations

### Without AI Summarization
- Bedrock Titan embeddings: ~$0.0001 per 1000 tokens
- 390 actions × ~200 tokens = ~$0.008

### With AI Summarization
- Claude Haiku: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- 390 actions × ~500 input tokens × $0.25/1M = ~$0.05
- 390 actions × ~100 output tokens × $1.25/1M = ~$0.05
- Total: ~$0.10 for summarization + $0.008 for embeddings = ~$0.11

## Troubleshooting

### Lambda Timeout
- Default timeout: 60 seconds
- Increase if AI summarization takes longer
- Consider batch size in SQS trigger

### Bedrock Throttling
- Titan embeddings: 100 requests/second
- Claude Haiku: 50 requests/second
- Adjust SQS batch size if throttled

### Missing Embeddings
- Check CloudWatch logs for errors
- Verify organization_id is present
- Ensure fields have content (not all null)

## Related Files

- `lambda/shared/ai-summarizer.js` - AI summarization logic
- `lambda/shared/embedding-composition.js` - Standard composition logic
- `scripts/backfill-actions-embeddings.sh` - Backfill script
- `scripts/check-embedding-coverage.sh` - Coverage reporting
