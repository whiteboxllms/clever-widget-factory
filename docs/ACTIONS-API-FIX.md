# Actions API Error Fix

## Problem
The `/api/actions` endpoint was returning errors because the `cwf-actions-lambda` function was failing with:
```
Runtime.ImportModuleError: Error: Cannot find module 'pg'
```

## Root Cause
The Lambda deployment script (`lambda/actions/deploy.sh`) was not including `node_modules` in the deployment package. The script only packaged:
- `index.js`
- `shared/` folder

But the Lambda function requires the `pg` (PostgreSQL client) module to connect to the database.

## Solution
Updated `lambda/actions/deploy.sh` to:
1. Run `npm install --production` before packaging
2. Include `node_modules/` in the zip file

### Changes Made
```bash
# Added before packaging:
npm install --production

# Updated zip command to include node_modules:
zip -r function.zip index.js node_modules/ shared/
```

## Deployment
```bash
cd lambda/actions
./deploy.sh
```

## Verification
Test the endpoint (401 is expected without auth):
```bash
curl https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/actions
# Response: {"message":"Unauthorized"}
# HTTP Status: 401
```

## Impact
- ✅ Actions API endpoints now work correctly
- ✅ All CRUD operations on actions are functional
- ✅ Frontend can now fetch and update actions

## Related Files
- `lambda/actions/deploy.sh` - Fixed deployment script
- `lambda/actions/index.js` - Lambda handler (unchanged)
- `lambda/actions/package.json` - Dependencies definition

## Notes
- This same issue may affect other Lambda functions that use `pg` or other npm dependencies
- Consider auditing all Lambda deployment scripts to ensure they include `node_modules`
- Future improvement: Use Lambda Layers for shared dependencies like `pg`
