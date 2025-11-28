# Area Dropdown Fix Plan

## Problem Analysis

### Current Issue
When creating a new Asset, the "Area" dropdown is showing incorrect options, including "Hand Tools" and other categories that should not be there. The Area field should only show high-level location structures like:
- Buildings
- Infrastructure  
- Containers

### Root Cause
1. **Backend Issue**: The Lambda function (`lambda/core/index.js`) at the `/tools` GET endpoint does NOT handle the `category` query parameter. It only extracts `limit` and `offset`, so all tools are returned regardless of category.

2. **Frontend Issue**: The frontend hook `useParentStructures.tsx` sends:
   ```
   /tools?category=Infrastructure,Container&status=!removed
   ```
   But the backend ignores these parameters.

3. **Query Format**: The comma-separated format `category=Infrastructure,Container` may not be the standard way to pass multiple values in query strings.

### Evidence from Codebase

**Frontend (`src/hooks/tools/useParentStructures.tsx`)**:
```typescript
const result = await apiService.get('/tools?category=Infrastructure,Container&status=!removed');
```

**Backend (`lambda/core/index.js` line 174)**:
```javascript
const { limit = 50, offset = 0 } = event.queryStringParameters || {};
// category and status parameters are completely ignored!
```

**Correct Implementation Example** (from `src/pages/Audit.tsx` line 175):
```typescript
.in('category', ['Infrastructure', 'Container'])
.neq('status', 'removed')
```

### Categories to Include
Based on codebase analysis:
- ✅ **Infrastructure** - confirmed in use
- ✅ **Container** - confirmed in use  
- ❓ **Building** - mentioned by user but not found in `TOOL_CATEGORY_OPTIONS`. Need to verify if this exists in database or if it's a different concept.

## Solution Plan

### Step 1: Update Lambda Function
Modify `lambda/core/index.js` GET `/tools` endpoint to:
1. Parse `category` query parameter (handle comma-separated values or array)
2. Parse `status` query parameter (handle `!removed` syntax)
3. Add SQL WHERE clauses to filter by category and status

### Step 2: Update Frontend Query Format
Modify `src/hooks/tools/useParentStructures.tsx` to:
1. Use proper query parameter format (either multiple `category` params or comma-separated)
2. Verify the format works with the updated backend

### Step 3: Verify Building Category
Check if "Building" should be included:
- Check database for existing tools with "Building" category
- If it exists, add it to the filter
- If not, confirm with user if it's needed

### Step 4: Testing
- Verify only Infrastructure, Container (and Building if applicable) appear in Area dropdown
- Verify Hand Tools and other categories do NOT appear
- Test with existing assets to ensure backward compatibility

## Implementation Details

### Backend Changes (`lambda/core/index.js`)
```javascript
if (httpMethod === 'GET') {
  const { limit = 50, offset = 0, category, status } = event.queryStringParameters || {};
  
  // Build WHERE clauses
  let whereClauses = [];
  
  // Handle category filter (comma-separated or array)
  if (category) {
    const categories = category.split(',').map(c => c.trim());
    if (categories.length === 1) {
      whereClauses.push(`tools.category = ${formatSqlValue(categories[0])}`);
    } else {
      const categoryValues = categories.map(c => formatSqlValue(c)).join(', ');
      whereClauses.push(`tools.category IN (${categoryValues})`);
    }
  }
  
  // Handle status filter
  if (status === '!removed' || status === '!=removed') {
    whereClauses.push(`tools.status != 'removed'`);
  } else if (status) {
    whereClauses.push(`tools.status = ${formatSqlValue(status)}`);
  }
  
  const whereClause = whereClauses.length > 0 
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';
  
  const sql = `SELECT json_agg(row_to_json(result)) FROM (
    SELECT DISTINCT ON (tools.id)
      tools.*,
      ...
    FROM tools
    ${whereClause}
    LEFT JOIN LATERAL (...)
    ...
  ) result;`;
}
```

### Frontend Changes
The current format should work, but we may need to adjust based on how query strings are parsed. The format `category=Infrastructure,Container` should be parsed as a single string that we split.

## Files to Modify
1. `lambda/core/index.js` - Add category and status filtering
2. `src/hooks/tools/useParentStructures.tsx` - Verify/update query format if needed

## Testing Checklist
- [ ] Area dropdown shows only Infrastructure and Container (and Building if applicable)
- [ ] Hand Tools does NOT appear in Area dropdown
- [ ] Other tool categories do NOT appear
- [ ] Existing assets with parent structures still work correctly
- [ ] Creating new assets with Area selection works correctly

