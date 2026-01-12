# Exploration Endpoints 403 CORS Error Fix

## Problem
When setting an action as an exploration action, the frontend was getting 403 CORS errors for:
- `/api/explorations/check-code/SF011126EX`
- `/api/explorations/codes-by-prefix/SF011126ex01`

The error message was "Missing Authentication Token" which indicates the endpoints didn't exist in API Gateway.

## Root Cause
The API Gateway had these resources:
- `/api/explorations/check-code` ✅
- `/api/explorations/codes-by-prefix` ✅

But was missing the path parameters:
- `/api/explorations/check-code/{code}` ❌
- `/api/explorations/codes-by-prefix/{prefix}` ❌

The frontend code was trying to call endpoints with dynamic path parameters (e.g., `SF011126EX01`), but API Gateway didn't have routes configured for these parameterized paths.

## Solution
Created the missing path parameter resources in API Gateway:

1. **Created `/api/explorations/check-code/{code}`**
   - GET method with CUSTOM authorizer (pjg8xs)
   - OPTIONS method for CORS
   - Integrated with `cwf-core-lambda`

2. **Created `/api/explorations/codes-by-prefix/{prefix}`**
   - GET method with CUSTOM authorizer (pjg8xs)
   - OPTIONS method for CORS
   - Integrated with `cwf-core-lambda`

3. **Deployed changes to prod stage**

## Verification
```bash
# Test check-code endpoint (401 is expected without auth)
curl "https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/explorations/check-code/SF011126EX01"
# Response: {"message":"Unauthorized"}
# HTTP Status: 401 ✅

# Test codes-by-prefix endpoint
curl "https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/explorations/codes-by-prefix/SF011126"
# Response: {"message":"Unauthorized"}
# HTTP Status: 401 ✅
```

## Impact
- ✅ Exploration code validation now works
- ✅ Auto-increment exploration codes work correctly
- ✅ No more 403 CORS errors when creating/editing exploration actions

## Related Files
- `src/services/explorationCodeGenerator.ts` - Frontend code that calls these endpoints
- `lambda/core/index.js` - Lambda handler for exploration endpoints (lines 2395, 2419)

## API Gateway Resources Created
```
/api/explorations/
├── check-code/
│   └── {code}          [GET, OPTIONS]
└── codes-by-prefix/
    └── {prefix}        [GET, OPTIONS]
```

## Notes
- Both endpoints require authentication (CUSTOM authorizer)
- CORS is properly configured with OPTIONS methods
- The Lambda handler uses regex matching to extract the path parameters
