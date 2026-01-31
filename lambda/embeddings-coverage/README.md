# Embeddings Coverage Lambda

Provides statistics on embedding coverage across entity types in the unified embeddings system.

## Purpose

Reports total embeddings, counts by entity_type and model_version, and coverage percentages (embeddings vs total entities) for monitoring the health of the unified embeddings system.

## API

### GET /api/embeddings/coverage

Returns embedding coverage statistics for the authenticated user's organization.

**Authorization**: Required (organization_id from JWT token)

**Response Format**:
```json
{
  "data": {
    "counts": [
      {
        "entity_type": "part",
        "model_version": "titan-v1",
        "count": 50
      },
      {
        "entity_type": "tool",
        "model_version": "titan-v1",
        "count": 30
      }
    ],
    "coverage": [
      {
        "entity_type": "part",
        "total_entities": 100,
        "embeddings_count": 50,
        "coverage_percentage": 50.00
      },
      {
        "entity_type": "tool",
        "total_entities": 60,
        "embeddings_count": 30,
        "coverage_percentage": 50.00
      }
    ],
    "total_embeddings": 80
  }
}
```

## Requirements

Validates requirements:
- 7.7: Provide metrics on embedding coverage
- 10.6: GET /api/embeddings/coverage endpoint
- 10.7: Return counts by entity_type and model_version
- 11.3: Report percentage of entities with embeddings

## Testing

Run unit tests:
```bash
cd lambda/embeddings-coverage
npm test
```

## Deployment

Deploy using the generic Lambda deployment script:
```bash
./scripts/deploy-lambda-generic.sh embeddings-coverage
```

## Environment Variables

- `DB_HOST`: RDS PostgreSQL host
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name (default: postgres)
- `DB_USER`: Database user (default: postgres)
- `DB_PASSWORD`: Database password (required)

## Dependencies

- `pg`: PostgreSQL client for database queries
- `../shared/db`: Database connection utilities
- `../shared/auth`: Authorization context extraction
- `../shared/response`: HTTP response formatting

## Error Handling

- **401 Unauthorized**: Missing organization_id from authorizer context
- **405 Method Not Allowed**: Non-GET requests
- **500 Internal Server Error**: Database errors or missing unified_embeddings table

## Notes

- Queries are scoped to the user's organization_id for multi-tenancy
- Coverage percentage is calculated as (embeddings_count / total_entities) * 100
- Multiple model versions for the same entity_type are summed in coverage calculation
- Returns 0% coverage when total_entities is 0 (avoids division by zero)
