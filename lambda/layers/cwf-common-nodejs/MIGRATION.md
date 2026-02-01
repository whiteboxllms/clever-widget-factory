# Migration Guide: Using cwf-common-nodejs Layer

## Overview

The `cwf-common-nodejs` layer contains shared utilities that were previously copied from `lambda/shared/`.

**Layer ARN:** `arn:aws:lambda:us-west-2:131745734428:layer:cwf-common-nodejs:1`

## Lambdas to Migrate

- ✅ actions
- ✅ core
- ✅ embeddings-processor
- ✅ embeddings-regenerate

## Migration Steps (Per Lambda)

### 1. Attach Layer to Lambda

```bash
cd lambda/layers/cwf-common-nodejs
./attach-layer-to-lambda.sh cwf-actions-lambda 1
```

### 2. Update Import Path in Lambda Code

**Before:**
```javascript
const { composeActionEmbeddingSource } = require('./shared/embedding-composition');
```

**After:**
```javascript
const { composeActionEmbeddingSource } = require('/opt/nodejs/lib/embedding-composition');
```

### 3. Remove Shared Copy from Deploy

The deploy script will no longer copy `embedding-composition.js` since it's in the layer.

### 4. Deploy Lambda

```bash
./scripts/deploy/deploy-lambda-generic.sh actions cwf-actions-lambda
```

### 5. Test

Verify the Lambda still works by calling its API endpoint.

## Rollback

If issues occur:

```bash
# Revert code changes
git checkout lambda/<lambda-name>/index.js

# Remove layer
aws lambda update-function-configuration \
  --function-name <function-name> \
  --layers [] \
  --region us-west-2

# Redeploy
./scripts/deploy/deploy-lambda-generic.sh <lambda-dir> <function-name>
```

## Benefits After Migration

- ✅ Smaller Lambda packages (~5KB less per Lambda)
- ✅ Faster deployments (no need to copy shared files)
- ✅ Consistent version across all Lambdas
- ✅ Update once, all Lambdas get the update

## Next Steps

After embedding-composition migration is complete, consider adding:
- `authorizerContext.js`
- `db.js`
- `response.js`
