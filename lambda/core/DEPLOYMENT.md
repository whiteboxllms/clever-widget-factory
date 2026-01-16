# Core Lambda Deployment

## Overview
The `cwf-core-lambda` function handles all core API endpoints including tools, parts, actions, missions, profiles, etc.

## Deployment Process

### Prerequisites
- AWS credentials configured with Lambda update permissions
- Node.js installed
- `node_modules` installed (`npm install`)

### Deploy Command
```bash
cd lambda/core
node deploy.js
```

### What the Deploy Script Does
1. **Copies shared folder** from `lambda/shared/` to `lambda/core/shared/`
   - This is necessary because Lambda needs the shared utilities in the deployment package
   - The shared folder contains: `authorizerContext.js`, `response.js`, `db.js`, etc.

2. **Verifies shared folder** has required files
   - Checks for `authorizerContext.js`, `response.js`, `db.js`
   - Exits with error if any are missing

3. **Creates deployment package** (`function.zip`)
   - Includes: `index.js`, `package.json`, `node_modules/`, `shared/`
   - Excludes: other `.zip` files

4. **Verifies zip contents**
   - Ensures `shared/authorizerContext.js` is in the package
   - This prevents deployment of broken packages

5. **Deploys to AWS Lambda**
   - Updates `cwf-core-lambda` function in `us-west-2`
   - Waits 5 seconds for Lambda to be ready

## Common Issues

### Issue: 500 errors on all endpoints
**Cause**: Lambda deployment package missing `shared/` folder

**Solution**: Run `node deploy.js` to redeploy with shared folder included

### Issue: AccessDeniedException during deployment
**Cause**: AWS credentials don't have Lambda update permissions

**Solution**: Configure AWS credentials with appropriate permissions:
```bash
aws configure
```

### Issue: "Cannot find module './shared/authorizerContext'"
**Cause**: Shared folder not copied before creating zip

**Solution**: The deploy script handles this automatically. If you're manually creating a zip, ensure you copy the shared folder first:
```bash
rm -rf shared
cp -r ../shared .
zip -r function.zip index.js package.json node_modules/ shared/
```

## Manual Deployment (if deploy.js fails)
```bash
# 1. Copy shared folder
rm -rf shared
cp -r ../shared .

# 2. Create zip
zip -q -r function.zip index.js package.json package-lock.json node_modules/ shared/

# 3. Verify zip
unzip -l function.zip | grep "shared/authorizerContext.js"

# 4. Deploy
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://function.zip \
  --region us-west-2
```

## Architecture

### Shared Folder Pattern
The `lambda/shared/` folder contains utilities used by multiple Lambda functions:
- `authorizerContext.js` - Extract organization context from API Gateway authorizer
- `response.js` - Standard response formatting
- `db.js` - Database connection utilities

Each Lambda function copies this folder into its deployment package to avoid code duplication.

### Why Not Use Layers?
Lambda Layers would be ideal, but require additional AWS configuration. The copy approach is simpler for development and ensures each Lambda has exactly the dependencies it needs.

## Testing After Deployment
```bash
# Test health endpoint
curl https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-01-13T..."}
```
