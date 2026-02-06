# Tasks: Actions Table Cleanup

## Task 1: Pre-Migration Data Verification
- [ ] 1.1 Query actions table to check for non-NULL data in obsolete columns
- [ ] 1.2 Document any existing data in observations, evidence_description, qa_approved_at, or score fields
- [ ] 1.3 Confirm with stakeholders that data can be safely removed

## Task 2: Create Migration Script
- [ ] 2.1 Create `migrations/004-remove-obsolete-action-fields.sql` with DROP COLUMN statements
- [ ] 2.2 Use IF EXISTS clauses for all DROP COLUMN statements
- [ ] 2.3 Add comments explaining why each field is being removed
- [ ] 2.4 Review migration script for safety

## Task 3: Execute Database Migration
- [ ] 3.1 Execute migration via cwf-db-migration Lambda function
- [ ] 3.2 Verify migration completed without errors
- [ ] 3.3 Query information_schema.columns to confirm columns are removed
- [ ] 3.4 Document migration execution results

## Task 4: Update TypeScript Types
- [ ] 4.1 Remove `observations?: string;` from BaseAction interface in src/types/actions.ts
- [ ] 4.2 Remove `score?: number | null;` from BaseAction interface
- [ ] 4.3 Remove `observations: ''` from helper functions (createMissionAction, createIssueAction, etc.)
- [ ] 4.4 Run TypeScript compiler to check for errors

## Task 5: Search and Remove Code References
- [ ] 5.1 Search codebase for references to `.observations` field
- [ ] 5.2 Search codebase for references to `.score` field
- [ ] 5.3 Search codebase for references to `evidence_description` field
- [ ] 5.4 Search codebase for references to `qa_approved_at` field
- [ ] 5.5 Remove or update any found references

## Task 6: Build and Test
- [ ] 6.1 Run `npm run build` to verify frontend builds successfully
- [ ] 6.2 Run `npm run test:run` to verify tests pass
- [ ] 6.3 Manually test action creation in UI
- [ ] 6.4 Manually test action editing in UI
- [ ] 6.5 Verify action list displays correctly

## Task 7: Documentation
- [ ] 7.1 Update MIGRATION_STATUS.md with migration details
- [ ] 7.2 Document any issues encountered during migration
- [ ] 7.3 Update this tasks file with completion notes
