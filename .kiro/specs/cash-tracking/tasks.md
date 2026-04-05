# Implementation Plan: Cash Tracking

## Overview

This plan implements the cash tracking feature in dependency order: shared PhotoUploadPanel first (prerequisite for the creation UI and improves existing code), then database schema, then Lambda backend, then frontend service/hooks layer, then pages and dashboard card, then embeddings integration, and finally refactoring existing consumers to use the shared component.

## Tasks

- [x] 1. Extract shared PhotoUploadPanel component
  - [x] 1.1 Create PhotoUploadPanel component and PhotoItem type
    - Create `src/components/shared/PhotoUploadPanel.tsx` with props: `photos`, `onPhotosChange`, `photoTypes`, `requiredTypes`, `maxPhotos`, `showDescriptions`, `disabled`, `className`
    - Create `PhotoItem` interface with `id`, `file`, `photo_url`, `photo_type`, `photo_description`, `photo_order`, `previewUrl`, `isUploading`, `isExisting`
    - Implement file selection (with `capture` attribute for mobile camera), blob URL preview creation/cleanup, photo type tagging, per-photo description fields, remove/reorder, upload progress indicators, and validation feedback for `requiredTypes`
    - The component does NOT handle S3 upload — parent calls `useFileUpload().uploadFiles()` on save
    - _Requirements: 11.1, 11.3, 11.4, 11.5, 11.6, 2.2, 2.3, 2.4_

  - [ ]* 1.2 Write unit tests for PhotoUploadPanel
    - Test that save action is disabled when no receipt photo exists and enabled when one does
    - Test photo type tagging, add/remove, reorder, and requiredTypes validation
    - _Requirements: 11.5, 5.10_

- [x] 2. Create database schema
  - [x] 2.1 Create `financial_records` table and indexes
    - Write migration SQL for `financial_records` table with columns: `id` (UUID PK), `organization_id` (UUID FK), `created_by` (UUID), `transaction_date` (DATE), `description` (TEXT), `amount` (NUMERIC(12,2)), `funding_source` (VARCHAR(20) with CHECK), `external_source_note` (TEXT), `category_tag` (TEXT), `per_unit_price` (NUMERIC(12,2)), `photos` (JSONB DEFAULT '[]'), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)
    - Create indexes: `idx_financial_records_org`, `idx_financial_records_org_date`, `idx_financial_records_created_by`, `idx_financial_records_funding`
    - Save migration file to `migrations/` directory
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x] 2.2 Create `financial_record_edits` table and index
    - Write migration SQL for `financial_record_edits` table with columns: `id` (UUID PK), `record_id` (UUID FK with ON DELETE CASCADE), `edited_by` (UUID), `edited_at` (TIMESTAMPTZ), `field_changed` (VARCHAR(100)), `old_value` (TEXT), `new_value` (TEXT)
    - Create index: `idx_financial_record_edits_record`
    - _Requirements: 7.3_

- [x] 3. Implement cwf-financial-records-lambda
  - [x] 3.1 Create Lambda handler with route dispatch
    - Create `lambda/financial-records/index.js` with handler that extracts auth context (`organization_id`, `cognito_user_id`, `permissions`) from authorizer and dispatches by HTTP method + path
    - Use `@cwf/authorizerContext` and `@cwf/response` from the shared layer
    - Follow the `cwf-explorations-lambda` pattern for structure
    - _Requirements: 8.1, 8.7_

  - [x] 3.2 Implement POST `/api/financial-records` (create)
    - Validate required fields: `transaction_date`, `description`, `amount`, `funding_source`, `photos` (with at least one receipt)
    - Validate `funding_source` is `'petty_cash'` or `'external'`
    - Auto-set `created_by` from authorizer context `cognito_user_id` (ignore any client-sent value)
    - Insert into `financial_records` table, return created record
    - _Requirements: 1.1, 1.3, 1.5, 2.3, 5.9, 5.10, 8.1_

  - [ ]* 3.3 Write property test: Transaction round-trip persistence
    - **Property 1: Transaction round-trip persistence**
    - Generate random valid record data → create → retrieve by ID → assert field equality for `transaction_date`, `description`, `amount`, `funding_source`, `external_source_note`, `photos`
    - **Validates: Requirements 1.1, 1.7, 2.2**

  - [ ]* 3.4 Write property test: Required field validation
    - **Property 2: Required field validation**
    - Generate record data with random required fields removed → assert 400 rejection and no record persisted
    - **Validates: Requirements 1.5, 2.3, 7.8**

  - [ ]* 3.5 Write property test: Funding source enum validation
    - **Property 3: Funding source enum validation**
    - Generate random strings → assert only `'petty_cash'` and `'external'` accepted
    - **Validates: Requirements 1.3**

  - [ ]* 3.6 Write property test: Creator auto-assignment
    - **Property 7: Creator auto-assignment**
    - Generate records with arbitrary `created_by` in body → assert persisted `created_by` equals `cognito_user_id` from auth context
    - **Validates: Requirements 5.9**

  - [x] 3.7 Implement GET `/api/financial-records` (list with filters and balance)
    - Query `financial_records` filtered by `organization_id` and optional filters: `funding_source`, `start_date`, `end_date`, `created_by`
    - Apply permission scoping: `data:read:all` → all org records; otherwise → only `created_by = cognito_user_id`
    - Sort by `transaction_date DESC`, then `created_at DESC`
    - Compute running balance as `-SUM(amount) WHERE funding_source = 'petty_cash'` (always included)
    - Support pagination with `limit` (default 50) and `offset` (default 0)
    - Return `{ data: { records, running_balance, total_count } }`
    - Join with users/members to include `created_by_name`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 8.2, 8.3, 8.5, 8.6, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.8 Write property test: Running balance equals negative sum of petty cash amounts
    - **Property 4: Running balance equals negative sum of petty cash amounts**
    - Generate random sets of transactions with mixed funding sources → compute expected balance → assert API returns matching balance
    - **Validates: Requirements 1.2, 3.1, 7.6**

  - [ ]* 3.9 Write property test: External transactions do not affect running balance
    - **Property 5: External transactions do not affect running balance**
    - Generate petty_cash transactions → record balance → add/update/delete external transactions → assert balance unchanged
    - **Validates: Requirements 3.2**

  - [ ]* 3.10 Write property test: Transaction list sort order
    - **Property 8: Transaction list sort order**
    - Generate transactions with random dates → list → assert descending order by `transaction_date`, ties broken by `created_at` descending
    - **Validates: Requirements 6.2**

  - [ ]* 3.11 Write property test: Filter correctness
    - **Property 9: Filter correctness**
    - Generate transactions with varied attributes → apply random filter combinations → assert all results match all active predicates
    - **Validates: Requirements 6.6, 6.7, 6.8**

  - [ ]* 3.12 Write property test: Pagination consistency
    - **Property 10: Pagination consistency**
    - Generate N transactions → paginate with `limit=L` incrementing `offset` → assert non-overlapping subsets covering all N records
    - **Validates: Requirements 6.4**

  - [ ]* 3.13 Write property test: Read authorization scoping
    - **Property 15: Read authorization scoping**
    - Generate transactions from multiple users → query as user with/without `data:read:all` → assert correct filtering
    - **Validates: Requirements 8.3, 8.5**

  - [ ]* 3.14 Write property test: Multi-tenancy isolation
    - **Property 6: Multi-tenancy isolation**
    - Create records in org A and org B → list in org A → assert no org B records appear, and vice versa
    - **Validates: Requirements 1.6, 8.7**

  - [x] 3.15 Implement GET `/api/financial-records/:id` (single record with edit history)
    - Fetch record by ID scoped to `organization_id`
    - Apply permission check: owner or `data:read:all`
    - Include associated `financial_record_edits` sorted by `edited_at DESC`
    - Return 404 if not found
    - _Requirements: 6.5, 7.3, 8.2, 8.3_

  - [x] 3.16 Implement PUT `/api/financial-records/:id` (update with audit trail)
    - Validate record exists and belongs to org
    - Check authorization: `created_by = cognito_user_id` OR `data:write:all` permission; otherwise 403
    - For each changed field, insert a row into `financial_record_edits` with `old_value` and `new_value`
    - If photos are updated, ensure at least one receipt photo remains
    - Update `updated_at` timestamp
    - Return updated record with recomputed running balance
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 3.17 Write property test: Edit audit trail completeness
    - **Property 11: Edit audit trail completeness**
    - Generate random field updates → assert `financial_record_edits` contains correct `record_id`, `edited_by`, `field_changed`, `old_value`, `new_value`
    - **Validates: Requirements 7.3**

  - [ ]* 3.18 Write property test: Edit field persistence
    - **Property 12: Edit field persistence**
    - Generate random values for editable fields → update via PUT → retrieve → assert new values returned
    - **Validates: Requirements 7.2**

  - [ ]* 3.19 Write property test: Timestamp monotonicity
    - **Property 13: Timestamp monotonicity**
    - Perform random sequence of updates → assert `updated_at` never decreases and `created_at` never changes
    - **Validates: Requirements 1.7, 7.7**

  - [ ]* 3.20 Write property test: Edit authorization
    - **Property 14: Edit authorization**
    - Generate random user/transaction ownership combinations → assert owner and `data:write:all` users can edit, others get 403
    - **Validates: Requirements 7.4, 7.5**

  - [x] 3.21 Implement DELETE `/api/financial-records/:id`
    - Validate record exists and belongs to org
    - Check authorization: `created_by = cognito_user_id` OR `data:write:all` permission; otherwise 403
    - Delete record (CASCADE deletes `financial_record_edits`)
    - Delete associated `unified_embeddings` record where `entity_type='financial_record'` and matching `entity_id`
    - _Requirements: 2.5, 7.4, 7.5, 10.5_

  - [ ]* 3.22 Write property test: Cascade delete
    - **Property 16: Cascade delete**
    - Create record → add edits → delete record → assert all `financial_record_edits` and `unified_embeddings` for that record are gone
    - **Validates: Requirements 2.5, 10.5**

- [x] 4. Checkpoint - Backend core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create frontend types, service, and hooks
  - [x] 5.1 Create TypeScript types for financial records
    - Create `src/types/financialRecords.ts` with interfaces: `FinancialRecord`, `FinancialRecordPhoto`, `FinancialRecordEdit`, `FinancialRecordFilters`, `FinancialRecordListResponse`
    - Use exact types from design: `funding_source: 'petty_cash' | 'external'`, `photo_type: 'receipt' | 'evidence'`
    - _Requirements: 1.1, 1.3, 2.2, 7.3_

  - [x] 5.2 Create financialRecordsService
    - Create `src/services/financialRecordsService.ts` following the `explorationService` pattern
    - Implement methods: `listRecords(filters)`, `getRecord(id)`, `createRecord(data)`, `updateRecord(id, data)`, `deleteRecord(id)`
    - Use `apiService` for HTTP calls to `/api/financial-records`
    - _Requirements: 5.1, 6.1, 7.1_

  - [x] 5.3 Create TanStack Query hooks for financial records
    - Create `src/hooks/useFinancialRecords.ts` following the `useExplorations` pattern
    - Implement query hooks: `useFinancialRecords(filters)`, `useFinancialRecord(id)`
    - Implement mutation hooks: `useCreateFinancialRecord()`, `useUpdateFinancialRecord()`, `useDeleteFinancialRecord()`
    - Define `financialRecordKeys` for query key management
    - Use optimistic updates for `useUpdateFinancialRecord`, invalidation for create/delete
    - _Requirements: 6.1, 5.1, 7.1_

- [x] 6. Implement transaction creation page
  - [x] 6.1 Create RecordFinancialRecord page
    - Create `src/pages/RecordFinancialRecord.tsx` modeled after `AddObservation.tsx`
    - Use `PhotoUploadPanel` with `photoTypes={['receipt', 'evidence']}` and `requiredTypes={['receipt']}`
    - Include: Total Cost input (numeric, allows negative for reloads), description textarea, funding source selector (`petty_cash` / `external`), conditional external source note input, transaction date picker (defaults to today)
    - Save button disabled until PhotoUploadPanel reports all required types satisfied
    - On save: call `useFileUpload().uploadFiles()` for photos, then `useCreateFinancialRecord()` with photo URLs
    - Add route in React Router
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10, 11.1, 11.4, 11.5_

  - [ ]* 6.2 Write property test: Save button requires receipt photo
    - **Property 18: Save button requires receipt photo**
    - Generate random UI states of the creation form → assert save is disabled iff zero photos with `photo_type = 'receipt'`
    - **Validates: Requirements 11.5, 5.10**

- [x] 7. Implement transaction detail/edit page
  - [x] 7.1 Create FinancialRecordDetail page
    - Create `src/pages/FinancialRecordDetail.tsx`
    - Display all record fields and photos
    - Edit mode for owner or `data:write:all` users
    - Edit history section showing audit trail from `financial_record_edits`
    - Photo add/remove maintaining receipt requirement via `PhotoUploadPanel`
    - On save edits: call `useUpdateFinancialRecord()` mutation
    - Add route in React Router
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 8.2, 8.3_

- [x] 8. Implement Dashboard Finances card
  - [x] 8.1 Add Finances card to Dashboard
    - Add a "Finances" card component to `Dashboard.tsx`
    - Display running balance using `useFinancialRecords` hook
    - Display table of last 30 days of transactions (use `start_date` filter)
    - Filter table based on user permissions (own transactions for regular users, all for leadership)
    - "Record Transaction" button navigating to `RecordFinancialRecord` page
    - Click row → navigate to `FinancialRecordDetail` page
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 9. Checkpoint - Frontend core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add embeddings integration
  - [x] 10.1 Add SQS embedding queue call to Lambda create/update handlers
    - On create and update in `cwf-financial-records-lambda`, queue an embedding generation message to `cwf-embeddings-queue`
    - Compose `embedding_source` by joining non-null values of `[description, category_tag, external_source_note]` with `'. '`
    - Set `entity_type = 'financial_record'` and include `entity_id` and `organization_id`
    - Fire-and-forget pattern (do not block response on SQS send)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 10.2 Add `financial_record` entity type to embeddings processor
    - Update `lambda/embeddings-processor` to handle `entity_type = 'financial_record'`
    - Add `composeFinancialRecordEmbeddingSource(record)` function to `embedding-composition.js`
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 10.3 Write property test: Embedding composition
    - **Property 17: Embedding composition**
    - Generate random transaction fields → assert composed `embedding_source` equals `[description, category_tag, external_source_note].filter(Boolean).join('. ')`
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 11. Refactor existing consumers to use PhotoUploadPanel
  - [x] 11.1 Refactor AddObservation.tsx to use PhotoUploadPanel
    - Replace duplicated photo upload logic in `AddObservation.tsx` with `PhotoUploadPanel` (no `photoTypes` prop — general observation photos)
    - Verify existing observation photo upload behavior is preserved
    - _Requirements: 11.1_

  - [x] 11.2 Refactor StatesInline.tsx to use PhotoUploadPanel
    - Replace duplicated photo upload logic in `StatesInline.tsx` with `PhotoUploadPanel` (no `photoTypes` prop)
    - Verify existing state photo upload behavior is preserved
    - _Requirements: 11.1_

  - [x] 11.3 Refactor issue dialogs to use PhotoUploadPanel
    - Replace duplicated photo upload logic in issue dialog components with `PhotoUploadPanel` (no `photoTypes` prop)
    - Verify existing issue photo upload behavior is preserved
    - _Requirements: 11.1_

- [x] 12. Final checkpoint - All features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–18)
- Unit tests validate specific examples and edge cases
- Test framework: Vitest + fast-check, minimum 100 iterations per property
- Backend tests in `lambda/financial-records/__tests__/`, frontend tests in `src/tests/cash-tracking/`
- Tag format for property tests: `// Feature: cash-tracking, Property {N}: {title}`
