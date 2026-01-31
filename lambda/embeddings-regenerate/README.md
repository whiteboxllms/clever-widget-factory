# Embeddings Regenerate Lambda

Lambda function that provides an API endpoint to regenerate embeddings for specific entities.

## Purpose

This Lambda enables on-demand regeneration of embeddings when:
- Entity content has been updated and needs re-embedding
- Embedding model version has changed
- Embedding quality needs improvement
- Manual intervention is required

## Requirements

Implements requirements:
- 7.3: Provide API endpoint to regenerate embeddings for a specific entity
- 7.4: Provide API endpoint to regenerate embeddings for all entities of a type
- 10.4: POST /api/embeddings/regenerate endpoint
- 10.5: Accept entity_type and entity_id parameters

## API Endpoint

**POST /api/embeddings/regenerate**

### Request Body

```json
{
  "entity_type": "part",
  "entity_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Parameters

- `entity_type` (required): Type of entity to regenerate. Must be one of: `part`, `tool`, `action`, `issue`, `policy`
- `entity_id` (required): UUID of the entity to regenerate

### Response

**Success (200)**
```json
{
  "data": {
    "message": "Embedding regeneration queued successfully",
    "entity_type": "part",
    "entity_id": "550e8400-e29b-41d4-a716-446655440000",
    "embedding_source_length": 245
  }
}
```

**Error Responses**
- `400`: Missing or invalid parameters
- `401`: Unauthorized (missing organization_id)
- `404`: Entity not found or access denied
- `405`: Method not allowed (non-POST request)
- `500`: Server error

## How It Works

1. **Validate Request**: Check entity_type and entity_id are provided
2. **Fetch Entity**: Query the appropriate table (parts, tools, actions, issues, policy)
3. **Compose Embedding Source**: Use entity-specific composition function to create natural language description
4. **Queue for Processing**: Send SQS message to embeddings-processor Lambda
5. **Return Success**: Confirm regeneration has been queued

## Entity Type Configuration

The Lambda supports five entity types with their corresponding tables and composition functions:

| Entity Type | Database Table | Composition Function |
|-------------|----------------|---------------------|
| part        | parts          | composePartEmbeddingSource |
| tool        | tools          | composeToolEmbeddingSource |
| action      | actions        | composeActionEmbeddingSource |
| issue       | issues         | composeIssueEmbeddingSource |
| policy      | policy         | composePolicyEmbeddingSource |

## Security

- **Organization Scoping**: Only entities belonging to the user's organization can be regenerated
- **Authorization**: Requires valid JWT token with organization_id
- **SQL Injection Prevention**: All user inputs are escaped before SQL queries

## Environment Variables

- `EMBEDDINGS_QUEUE_URL`: SQS queue URL for embedding generation (default: cwf-embeddings-queue)

## Dependencies

- `@aws-sdk/client-sqs`: Send messages to SQS queue
- `pg`: PostgreSQL database client
- `../shared/db`: Database query helper
- `../shared/auth`: Authorization context helper
- `../shared/response`: HTTP response helpers
- `../shared/embedding-composition`: Entity-specific composition functions

## Deployment

```bash
# Package and deploy
cd lambda/embeddings-regenerate
npm install
zip -r embeddings-regenerate.zip index.js package.json node_modules/
aws lambda update-function-code \
  --function-name cwf-embeddings-regenerate \
  --zip-file fileb://embeddings-regenerate.zip \
  --region us-west-2
```

Or use the deployment script:
```bash
./scripts/deploy-embeddings-regenerate.sh
```

## Testing

```bash
# Test regenerating a part embedding
curl -X POST https://api.example.com/api/embeddings/regenerate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "part",
    "entity_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Error Handling

- **Invalid entity_type**: Returns 400 with list of valid types
- **Entity not found**: Returns 404 (could be missing or wrong organization)
- **Empty embedding_source**: Returns 400 if entity has no content to embed
- **SQS failure**: Returns 500 with error details
- **Database errors**: Returns 500 with error message

## Future Enhancements

- Batch regeneration endpoint (regenerate all entities of a type)
- Progress tracking for bulk regenerations
- Webhook notifications when regeneration completes
- Dry-run mode to preview embedding_source without queuing
