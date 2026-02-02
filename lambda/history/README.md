# History Lambda

Dedicated Lambda function for history endpoints. Extracted from core Lambda to reduce size and improve maintainability.

## Endpoints

### GET /api/history/tools/{id}
Returns complete history for a tool including:
- Asset history (changes to tool fields)
- Checkouts
- Issues
- Actions
- **Observations** (with photos)
- Unified timeline

### GET /api/history/parts/{id}
Returns complete history for a part including:
- Parts history (quantity changes)
- **Observations** (with photos)
- Issues
- Actions

## Deployment

```bash
# Deploy Lambda (uses generic script)
./scripts/deploy/deploy-lambda-with-layer.sh history cwf-history-lambda
```

## API Gateway Setup

Per memory bank **API Gateway Wiring Protocol**:

```bash
# Add endpoints (one command per endpoint with method and Lambda)
./scripts/add-api-endpoint.sh /api/history/tools/{id} GET cwf-history-lambda
./scripts/add-api-endpoint.sh /api/history/parts/{id} GET cwf-history-lambda

# Add Lambda permission (single wildcard covers all history endpoints)
aws lambda add-permission \
  --function-name cwf-history-lambda \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-west-2:131745734428:0720au267k/*/*/api/history/*" \
  --region us-west-2

# Deploy API Gateway
aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2
```

## Dependencies

Uses shared layer (`cwf-common-nodejs`) for:
- `authorizerContext` - Authorization helpers
- `db` - PostgreSQL connection
- `sqlUtils` - SQL utilities

## Deployment

Use the generic deployment script (per memory bank guidelines):
```bash
./scripts/deploy/deploy-lambda-with-layer.sh history cwf-history-lambda
```

No custom deploy script needed - the generic script handles:
- Installing dependencies
- Packaging code and node_modules
- Attaching cwf-common-nodejs layer
- Setting environment variables from .env.local
- Creating or updating Lambda function

## Why Separate Lambda?

1. **Core Lambda too large** - 72KB caused VS Code crashes
2. **Clean separation** - History is read-only display logic
3. **Independent deployment** - Can update without touching core
4. **Follows pattern** - Like semantic-search, embeddings, analysis Lambdas
