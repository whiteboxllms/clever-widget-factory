# Design Document: Actions Table Cleanup

## Overview

This document outlines the design for removing four obsolete fields from the actions table: `observations`, `evidence_description`, `qa_approved_at`, and `score`. These fields are no longer used in the application and should be removed to reduce technical debt and prevent confusion.

## Architecture

### Database Schema Changes

The migration will remove the following columns from the `actions` table:

1. **observations** (text) - Replaced by the `states` table system
2. **evidence_description** (text) - Never implemented, always NULL
3. **qa_approved_at** (timestamp) - Unused approval tracking field
4. **score** (numeric) - Replaced by `scoring_data` JSONB and `action_scores` table

### Fields to Preserve

The following fields will be **preserved** as they are actively used:

- `estimated_duration` - Used in mission/task editors and action dialogs
- `actual_duration` - Used in mission/task editors
- `scoring_data` - Current scoring system (JSONB)

## Implementation Strategy

### Phase 1: Database Migration

**Migration Script**: `migrations/004-remove-obsolete-action-fields.sql`

```sql
-- Remove obsolete fields from actions table
-- Safe migration using IF EXISTS to prevent errors

-- 1. Remove observations field (replaced by states table)
ALTER TABLE actions 
DROP COLUMN IF EXISTS observations;

-- 2. Remove evidence_description field (never implemented)
ALTER TABLE actions 
DROP COLUMN IF EXISTS evidence_description;

-- 3. Remove qa_approved_at field (unused approval tracking)
ALTER TABLE actions 
DROP COLUMN IF EXISTS qa_approved_at;

-- 4. Remove score field (replaced by scoring_data and action_scores)
ALTER TABLE actions 
DROP COLUMN IF EXISTS score;
```

**Verification Query**:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'actions' 
ORDER BY ordinal_position;
```

### Phase 2: TypeScript Type Updates

**File**: `src/types/actions.ts`

Remove the following fields from `BaseAction` interface:
- `observations?: string;`
- `score?: number | null;`

Note: `evidence_description` and `qa_approved_at` are not in the TypeScript types, so no changes needed there.

### Phase 3: Code Cleanup

**Search for references**:
```bash
# Search for observations field usage
grep -r "\.observations" src/

# Search for score field usage  
grep -r "\.score" src/

# Search for evidence_description usage
grep -r "evidence_description" src/

# Search for qa_approved_at usage
grep -r "qa_approved_at" src/
```

**Expected findings**:
- `observations` - Used in helper functions that initialize empty strings (can be removed)
- `score` - May be referenced in old scoring components (should use `scoring_data` instead)
- `evidence_description` - Should have no references
- `qa_approved_at` - Should have no references

## Migration Execution Plan

### Step 1: Pre-Migration Verification

1. Check if any columns contain non-NULL data:
```sql
SELECT 
  COUNT(*) FILTER (WHERE observations IS NOT NULL) as observations_count,
  COUNT(*) FILTER (WHERE evidence_description IS NOT NULL) as evidence_description_count,
  COUNT(*) FILTER (WHERE qa_approved_at IS NOT NULL) as qa_approved_at_count,
  COUNT(*) FILTER (WHERE score IS NOT NULL) as score_count
FROM actions;
```

2. If any counts are > 0, document the data before proceeding

### Step 2: Execute Migration

```bash
cat migrations/004-remove-obsolete-action-fields.sql | jq -Rs '{sql: .}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

### Step 3: Verify Migration

```bash
echo '{"sql": "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '\''actions'\'' ORDER BY ordinal_position;"}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json | jq -r '.body' | jq
```

Expected result: The four columns should NOT appear in the output.

### Step 4: Update TypeScript Types

Remove obsolete fields from `src/types/actions.ts`:
- Remove `observations?: string;` from `BaseAction` interface
- Remove `score?: number | null;` from `BaseAction` interface
- Remove `observations: ''` from helper functions

### Step 5: Build and Test

```bash
npm run build
npm run test:run
```

## Rollback Plan

If issues are discovered after migration:

1. **Add columns back** (they will be NULL for all rows):
```sql
ALTER TABLE actions ADD COLUMN observations text;
ALTER TABLE actions ADD COLUMN evidence_description text;
ALTER TABLE actions ADD COLUMN qa_approved_at timestamp with time zone;
ALTER TABLE actions ADD COLUMN score numeric;
```

2. **Revert TypeScript changes** using git:
```bash
git checkout src/types/actions.ts
```

3. **Rebuild frontend**:
```bash
npm run build
```

## Risk Assessment

### Low Risk
- **observations**: Fully replaced by states table, no code references
- **evidence_description**: Never implemented, always NULL
- **qa_approved_at**: No code references found

### Medium Risk
- **score**: May have legacy references in old scoring components
  - Mitigation: Search codebase thoroughly before migration
  - Fallback: Use `scoring_data` or `action_scores` table instead

## Success Criteria

1. ✅ Migration executes without errors
2. ✅ Four columns removed from actions table
3. ✅ TypeScript types updated and build succeeds
4. ✅ No references to obsolete fields in codebase
5. ✅ Frontend loads and displays actions correctly
6. ✅ Action creation/editing works as expected

## Timeline

- **Phase 1** (Database Migration): 15 minutes
- **Phase 2** (TypeScript Updates): 15 minutes
- **Phase 3** (Code Cleanup): 30 minutes
- **Testing**: 30 minutes

**Total estimated time**: 90 minutes
