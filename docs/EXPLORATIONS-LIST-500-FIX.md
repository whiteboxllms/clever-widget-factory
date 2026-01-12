# Explorations List 500 Error Fix

## Issue
`GET /api/explorations/list` was returning 500 error with message: `{"error":"Failed to list explorations"}`

## Root Cause
SQL error: `operator does not exist: uuid = text`

The JOIN was comparing incompatible types:
```sql
LEFT JOIN organization_members om ON a.created_by = om.cognito_user_id
```

- `actions.created_by` is `uuid`
- `organization_members.cognito_user_id` is `text`

## Fix
Changed the JOIN to use the correct field:
```sql
LEFT JOIN organization_members om ON a.created_by = om.user_id
```

Both fields are now `uuid` type.

## File Changed
- `lambda/core/index.js` (line ~2367)

## Deployment
```bash
cd lambda/core
node deploy.js
```

## Verification
The query should now work:
```sql
SELECT 
  e.exploration_code,
  e.id as exploration_id,
  a.id as action_id,
  om.full_name as explorer_name
FROM exploration e
LEFT JOIN actions a ON e.action_id = a.id
LEFT JOIN organization_members om ON a.created_by = om.user_id
```

## Status
✅ Fixed and deployed
