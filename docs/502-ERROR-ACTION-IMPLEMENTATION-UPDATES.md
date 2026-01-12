# 502 Error: action_implementation_updates Endpoint

## Root Cause Analysis

### Symptom
```bash
curl 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/action_implementation_updates?action_id=57b8ca48-0f22-46b8-83ef-3b955b66e338&limit=1'
```
Returns: **502 Bad Gateway**

### Root Cause
The `GET /api/action_implementation_updates` endpoint had an **incorrect JOIN** to the `profiles` table:

```sql
-- BROKEN CODE (line 3562 in lambda/core/index.js)
LEFT JOIN profiles om ON aiu.updated_by = om.user_id
```

**Why this caused a 502:**

1. **Type mismatch**: `aiu.updated_by` is a UUID/text field containing Cognito user IDs, but the JOIN didn't cast types properly
2. **Wrong table**: The code should use `organization_members` table (which has `cognito_user_id` field) instead of `profiles` table
3. **Missing error handling**: When the SQL query failed, the Lambda returned 502 instead of a proper error response
4. **No fallback**: If the JOIN failed to find a user, it returned NULL instead of falling back to the user ID

### The Fix

**Changed from:**
```javascript
LEFT JOIN profiles om ON aiu.updated_by = om.user_id
```

**Changed to:**
```javascript
LEFT JOIN organization_members om ON aiu.updated_by::text = om.cognito_user_id::text
LEFT JOIN profiles p ON aiu.updated_by::text = p.user_id::text
```

**Key improvements:**
1. ✅ Uses `organization_members` table (correct table for Cognito user lookups)
2. ✅ Explicit type casting with `::text` to prevent type mismatch errors
3. ✅ Falls back to `profiles` table as secondary lookup
4. ✅ Uses `COALESCE()` to provide fallback values: `COALESCE(om.full_name, p.full_name, aiu.updated_by::text)`
5. ✅ Added try-catch error handling with proper error response
6. ✅ Added SQL logging for debugging
7. ✅ Added `parseInt(limit)` to prevent SQL injection

## Testing

Run the test suite to verify the fix:

```bash
# Get a valid auth token first
TOKEN="Bearer eyJraWQ..."

# Run the test
./tests/api/action-implementation-updates-502.test.sh "$TOKEN"
```

Expected output:
```
✅ PASS: Test 1 passed
✅ PASS: Test 2 passed  
✅ PASS: Test 3 passed
✅ ALL TESTS PASSED
```

## Prevention

To prevent similar issues in the future:

### 1. Always use explicit type casting in JOINs
```sql
-- ❌ BAD
LEFT JOIN table1 t1 ON t2.id = t1.user_id

-- ✅ GOOD
LEFT JOIN table1 t1 ON t2.id::text = t1.user_id::text
```

### 2. Use COALESCE for fallback values
```sql
-- ❌ BAD
om.full_name as updated_by_name

-- ✅ GOOD
COALESCE(om.full_name, p.full_name, user_id::text) as updated_by_name
```

### 3. Add error handling to all database queries
```javascript
// ❌ BAD
const result = await queryJSON(sql);
return { statusCode: 200, body: JSON.stringify({ data: result }) };

// ✅ GOOD
try {
  const result = await queryJSON(sql);
  return { statusCode: 200, body: JSON.stringify({ data: result }) };
} catch (error) {
  console.error('Error:', error);
  return { 
    statusCode: 500, 
    body: JSON.stringify({ error: 'Failed to fetch', details: error.message }) 
  };
}
```

### 4. Use organization_members for Cognito user lookups
```sql
-- ✅ CORRECT pattern for user lookups
LEFT JOIN organization_members om ON field::text = om.cognito_user_id::text
```

### 5. Always deploy with shared folder
```bash
# ❌ BAD - Missing shared folder causes 502
cd lambda/core && zip function.zip index.js

# ✅ GOOD - Use deploy script
cd lambda/core && node deploy.js
```

## Related Files
- Lambda: `lambda/core/index.js` (line ~3528)
- Test: `tests/api/action-implementation-updates-502.test.sh`
- Deploy: `lambda/core/deploy.js`

## Deployment
```bash
cd clever-widget-factory/lambda/core
node deploy.js
```

## Verification
After deployment, verify the endpoint works:
```bash
curl 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/action_implementation_updates?action_id=57b8ca48-0f22-46b8-83ef-3b955b66e338&limit=1' \
  -H 'authorization: Bearer YOUR_TOKEN'
```

Expected: `200 OK` with JSON response containing `{ "data": [...] }`
