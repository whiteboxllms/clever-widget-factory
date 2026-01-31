# Manual Update Instructions for Sellable Products

## Task 14: Update 7 Sellable Products with Enhanced Descriptions

Since AWS CLI is experiencing connectivity issues, here are manual steps to complete the task:

### Option 1: Run SQL Migration Directly

The SQL file `migrations/update-sellable-parts-descriptions.sql` contains all the updates.

Run it using the db-migration Lambda:

```bash
# Create a JSON payload with the SQL
cat migrations/update-sellable-parts-descriptions.sql | jq -Rs '{sql: .}' > /tmp/migration-payload.json

# Invoke the Lambda
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///tmp/migration-payload.json \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/migration-result.json

# Check result
cat /tmp/migration-result.json | jq '.body' | jq -r '.' | jq '.'
```

### Option 2: Use psql Directly

Connect to the database and run the migration:

```bash
PGPASSWORD='8T!$T5#N4q0%5j' psql \
  -h cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com \
  -U postgres \
  -d postgres \
  -f migrations/update-sellable-parts-descriptions.sql
```

### Option 3: Update via API (requires auth token)

Use the test script with a valid Cognito token:

```bash
# Get token from browser DevTools (see scripts/get-auth-token-instructions.md)
export AUTH_TOKEN='your-token-here'

# Run the API test script
./scripts/test-sellable-parts-update-api.sh
```

### Verification Steps

After running the updates, verify:

1. **Check database updates:**
```bash
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload '{"sql":"SELECT id, name, LEFT(description, 50) as desc, LEFT(policy, 50) as policy FROM parts WHERE sellable = true ORDER BY name"}' \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  /tmp/check.json && cat /tmp/check.json | jq '.body' | jq -r '.' | jq '.'
```

2. **Check embeddings were generated:**
```bash
./scripts/check-sellable-embeddings.sh
```

3. **Test semantic search:**
```bash
./scripts/test-unified-search.sh "better sleep"
./scripts/test-unified-search.sh "heart health"
./scripts/test-unified-search.sh "digestive health"
```

### Expected Results

All 7 products should have:
- ✅ Updated descriptions (physical characteristics)
- ✅ Updated policies (health benefits and use cases)
- ✅ New embeddings in unified_embeddings table
- ✅ Searchable via unified search endpoint

### Products Being Updated

1. **Banana Wine** - Heart health, better sleep
2. **Bignay Wine** - Immune function, anti-inflammatory
3. **Lansones Wine** - Energy, hydration
4. **Long Neck Vinegar Spice** - Digestion, blood sugar
5. **Mango Wine** - Eye health, immune function
6. **Pure Vinegar** - Digestive health, weight management
7. **Spiced Vinegar Lipid** - Metabolism, circulation

### Troubleshooting

If AWS CLI is hanging:
- Check network connectivity
- Verify AWS credentials are valid
- Try using AWS Console Lambda test feature instead
- Use psql direct connection as fallback
