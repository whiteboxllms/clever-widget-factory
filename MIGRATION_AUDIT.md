# Migration Audit - Simplification Opportunities

## Summary
Review of all migrations to identify unused tables, columns, and functions that can be cleaned up.

---

## ✅ Tables in Use (Keep)

1. **`asset_history`** - ✅ **ACTIVE**
   - Used in: `useToolHistory.tsx`, `useToolsData.tsx`, `useCombinedAssets.tsx`
   - Purpose: Tracks changes to tools/assets
   - Status: Keep - actively used

2. **`five_whys_sessions`** (current version) - ✅ **ACTIVE**
   - Current schema: `conversation_history` (JSONB), `root_cause_analysis` (TEXT)
   - Used throughout the 5 Whys feature
   - Status: Keep - current implementation

---

## ⚠️ Migration Cleanup Opportunities

### 1. **Old `five_whys_sessions` Migration (20251026145237)**

**Issue**: The first migration creates columns that are never used and were later removed in the refactor:

**Unused columns in first migration:**
- `problem_statement` (TEXT)
- `plausible_causes` (TEXT[])
- `why_1`, `why_2`, `why_3`, `why_4`, `why_5` (TEXT)
- `root_cause` (TEXT)

**Also creates unused trigger function:**
- `update_updated_at_column()` - generic function, replaced by `update_five_whys_updated_at()`

**Status**: The refactor migration (20251026191746) does `DROP TABLE IF EXISTS five_whys_sessions CASCADE`, which handles cleanup, but the old migration file itself could be:
- **Option A**: Left as-is (historical record, but confusing)
- **Option B**: Consolidated into a single migration (if migrations haven't been run in production)
- **Option C**: Add comments documenting that these fields are deprecated

**Recommendation**: If migrations haven't been run in production yet, consolidate into one migration. If they have been run, add clear comments explaining the evolution.

---

### 2. **Duplicate Trigger Function Names**

**Issue**: Two different trigger functions for the same purpose:
- `update_updated_at_column()` (from old migration) - generic name
- `update_five_whys_updated_at()` (from refactor) - specific name

Since the table is dropped and recreated, only the new function should exist, but having both defined in migrations is redundant.

---

### 3. **`issues.ai_analysis` Field Status**

**Current Status**: Field exists on `issues` table, but **NOT used for 5 Whys anymore**

**Usage Analysis**:
- ✅ Used in `IssueWorkflowDialog.tsx` for general AI analysis text (not 5 Whys specific)
- ✅ Listed in MCP server schemas as optional field
- ✅ Still valid for storing general AI analysis on issues
- ❌ NOT used for 5 Whys (moved to `five_whys_sessions` table)

**Verdict**: **KEEP** - This field serves a legitimate purpose for general AI analysis on issues, separate from 5 Whys sessions.

---

## 📋 Recommendations

### Immediate Actions:

1. **Add documentation comments** to `20251026145237_create_five_whys_sessions.sql`:
   ```sql
   -- NOTE: This migration creates the initial schema with structured fields.
   -- This was later refactored in 20251026191746 to use conversation_history instead.
   -- The refactor migration drops this table and recreates it with the new schema.
   ```

2. **Verify TypeScript types are updated** - Check `src/integrations/supabase/types.ts` to ensure it doesn't include the old fields (`problem_statement`, `why_1`, etc.)

### Future Considerations:

1. If consolidating migrations (fresh database):
   - Combine both `five_whys_sessions` migrations into one
   - Remove the unused columns from the start
   - Use only `update_five_whys_updated_at()` function

2. Review other migrations for similar patterns of:
   - Deprecated columns
   - Unused indexes
   - Duplicate functions

---

## ✅ No Issues Found For:

- `asset_history` table - actively used
- Function migrations in `20251025025920_*.sql` - utility functions, actively used
- Core schema tables (not reviewed, outside scope of this audit)

---

## Notes

- All migrations checked are in `/supabase/migrations/`
- Codebase searched for references using grep and semantic search
- Focus was on identifying unused tables/columns, not reviewing all schema changes

