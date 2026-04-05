a# Implementation Plan: Financial Records Schema Refactor & CSV Seed

## Overview

Refactor the `financial_records` table to a lean schema (drop description, photos, funding_source, external_source_note, category_tag, per_unit_price; add payment_method; make created_by nullable), move descriptions/photos to the existing states system, rewrite the seed script for ~3,275 CSV rows, and update the Lambda + frontend to match.

## Tasks

- [x] 1. Schema migration
  - [x] 1.1 Create migration SQL file `migrations/alter-financial-records-schema.sql`
    - ALTER `states.captured_by` DROP NOT NULL
    - ALTER `financial_records.created_by` DROP NOT NULL
    - ADD `payment_method VARCHAR(20)` column
    - UPDATE existing rows: map `funding_source`/`external_source_note` → `payment_method`
    - ALTER `payment_method` SET NOT NULL after backfill
    - DROP columns: `description`, `photos`, `funding_source`, `external_source_note`, `category_tag`, `per_unit_price`
    - CREATE INDEX `idx_financial_records_payment_method` ON `(organization_id, payment_method)`
    - Wrap in BEGIN/COMMIT
    - _Requirements: 1, 4, 7, 8_

- [x] 2. Rewrite seed script
  - [x] 2.1 Rewrite `migrations/seed-financial-records.js` to generate SQL for `financial_records` + `states` + `state_links`
    - Update ORG_ID to `00000000-0000-0000-0000-000000000001`
    - Implement PURCHASER_MAP (Mae, Lester, Stefan, Malone → cognito IDs; Jun Jun, Mark, Kuya Juan, Janeth, Dhodie, empty → NULL)
    - Map CSV `Payment Method` directly to `payment_method` column (Cash, SCash, GCash, Wise)
    - Compose `state_text` per Requirement 3: `[Purchaser] Transaction — Comment (Category: X, ₱Y/unit) {{photo:URL}}`
    - Generate deterministic UUIDs or use `gen_random_uuid()` in SQL for financial_records and states
    - For each CSV row emit: INSERT `financial_records`, INSERT `states`, INSERT `state_links`
    - Set `created_at`/`updated_at` on financial_records and `captured_at`/`created_at`/`updated_at` on states to `transaction_date T08:00:00Z`
    - Set `states.captured_by` to mapped cognito_user_id or NULL for unknown purchasers
    - Strict date parsing (M/D/YYYY) — throw on unparseable dates
    - Strict amount parsing — throw on non-numeric amounts (strip commas first)
    - Properly escape single quotes in all string values
    - Output wrapped in BEGIN/COMMIT
    - _Requirements: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11_

- [x] 3. Checkpoint — Migration and seed script
  - Ensure migration SQL and seed script are correct. Ask the user if questions arise.

- [x] 4. Lambda handler updates
  - [x] 4.1 Update `lambda/financial-records/index.js` — createRecord (POST)
    - Accept `payment_method` instead of `funding_source`/`external_source_note`
    - Validate `payment_method` ∈ `['Cash', 'SCash', 'GCash', 'Wise']`
    - In a transaction: INSERT `financial_records` (no description/photos columns), INSERT `states` with `state_text = description`, INSERT `state_links` with `entity_type = 'financial_record'`, INSERT `state_photos` for each photo
    - Queue embedding for the state entity (not financial_record)
    - Remove receipt photo requirement (photos are optional)
    - Return the created record with description and photos populated from the state
    - _Requirements: 4, 7, 12_

  - [x] 4.2 Update `lambda/financial-records/index.js` — listRecords (GET)
    - JOIN `financial_records` with `state_links` + `states` to get `state_text` as `description`
    - Replace `funding_source` filter with `payment_method` filter
    - Balance query: `WHERE payment_method = 'Cash'` instead of `funding_source = 'petty_cash'`
    - Handle NULL `created_by`: use `COALESCE(om.full_name, 'Unknown')` instead of casting UUID
    - Handle NULL `created_by` in permission scoping (NULL created_by records visible to `data:read:all` users)
    - _Requirements: 1, 4, 12_

  - [x] 4.3 Update `lambda/financial-records/index.js` — getRecord (GET :id)
    - JOIN with `states` via `state_links` to get description
    - JOIN with `state_photos` via the state to get photos
    - Return `state_id` in response for frontend editing
    - Handle NULL `created_by` for permission check (null → only `data:read:all` can view)
    - _Requirements: 1, 7, 12_

  - [x] 4.4 Update `lambda/financial-records/index.js` — updateRecord (PUT :id)
    - Editable fields on `financial_records`: `transaction_date`, `amount`, `payment_method`
    - Description/photo changes update the linked state (UPDATE `states` SET `state_text`, manage `state_photos`)
    - Audit trail in `financial_record_edits` for `amount`, `payment_method`, `transaction_date`
    - Handle NULL `created_by` for permission check (null → only `data:write:all` can edit)
    - Remove old editable fields: `funding_source`, `external_source_note`, `category_tag`, `per_unit_price`, `photos`
    - _Requirements: 1, 4, 7, 12_

  - [x] 4.5 Update `lambda/financial-records/index.js` — deleteRecord (DELETE :id)
    - Delete the financial_record (CASCADE handles `financial_record_edits`)
    - Look up linked state via `state_links`, delete the state (CASCADE handles `state_photos`, `state_links`)
    - Delete associated `unified_embeddings` for both `financial_record` and `state` entity types
    - Handle NULL `created_by` for permission check
    - _Requirements: 1, 7, 12_

  - [x] 4.6 Remove `composeFinancialRecordEmbeddingSource` helper function
    - No longer needed — embeddings are generated for states, not financial_records directly
    - _Requirements: 7, 12_

- [x] 5. Checkpoint — Lambda updates
  - Ensure all Lambda handler changes are consistent and complete. Ask the user if questions arise.

- [x] 6. Frontend types and service updates
  - [x] 6.1 Update `src/types/financialRecords.ts`
    - `FinancialRecord`: remove `description` (string), `funding_source`, `external_source_note`, `category_tag`, `per_unit_price`, `photos` (FinancialRecordPhoto[])
    - `FinancialRecord`: add `payment_method: 'Cash' | 'SCash' | 'GCash' | 'Wise'`, `description?: string`, `photos?: ObservationPhoto[]`, `state_id?: string`
    - `FinancialRecord`: make `created_by: string | null`
    - `FinancialRecordFilters`: replace `funding_source` with `payment_method?: 'Cash' | 'SCash' | 'GCash' | 'Wise'`
    - Remove `FinancialRecordPhoto` interface (photos now come from state_photos)
    - _Requirements: 1, 4, 7, 8, 12_

  - [x] 6.2 Update `src/services/financialRecordsService.ts`
    - `CreateFinancialRecordRequest`: replace `funding_source`/`external_source_note` with `payment_method`, make `photos` optional
    - `UpdateFinancialRecordRequest`: replace old fields with `payment_method?`, `description?`, `photos?`; remove `funding_source`, `external_source_note`, `category_tag`, `per_unit_price`
    - `listRecords`: replace `funding_source` query param with `payment_method`
    - _Requirements: 4, 7, 12_

  - [x] 6.3 Update `src/hooks/useFinancialRecords.ts`
    - Update type imports to match new interfaces
    - No structural changes needed — hooks are generic over the types
    - _Requirements: 12_

- [x] 7. Frontend page updates
  - [x] 7.1 Update `src/pages/Finances.tsx` (list page)
    - Replace "Source" column header with "Method"
    - Display `record.payment_method` instead of `record.funding_source` mapping
    - Handle null `created_by` — show "Unknown" or "—" where creator name is displayed
    - _Requirements: 1, 4, 12_

  - [x] 7.2 Update `src/pages/RecordFinancialRecord.tsx` (creation form)
    - Replace `fundingSource` state (`petty_cash`/`external`) with `paymentMethod` state (`Cash`/`SCash`/`GCash`/`Wise`)
    - Replace funding source Select with payment method Select (Cash, SCash, GCash, Wise)
    - Remove `externalSourceNote` field and state
    - Remove receipt photo requirement — photos are optional
    - Update `handleSave` to send `payment_method` instead of `funding_source`/`external_source_note`
    - Update `canSave` validation: remove `hasReceiptPhoto` requirement
    - _Requirements: 4, 12_

  - [x] 7.3 Update `src/pages/FinancialRecordDetail.tsx` (detail + edit page)
    - Read-only view: show `payment_method` instead of `funding_source`/`external_source_note`
    - Read-only view: remove `category_tag` and `per_unit_price` display
    - Read-only view: handle null `created_by` — show "Unknown" for creator name
    - Edit mode: replace funding source Select with payment method Select
    - Edit mode: remove `editExternalSourceNote`, `editCategoryTag`, `editPerUnitPrice` state and fields
    - Edit mode: remove receipt photo requirement
    - Permission: null `created_by` records → only `data:write:all` (isLeadership) can edit/delete
    - Update `handleSave` to send `payment_method` instead of old fields
    - _Requirements: 1, 4, 7, 8, 12_

- [-] 8. Final checkpoint
  - Ensure all changes compile and are consistent across migration, seed, Lambda, and frontend. Ask the user if questions arise.

## Notes

- Tasks are ordered: schema migration → seed script → Lambda → frontend
- No property-based tests — this is a data migration/refactor
- The migration must run before the new seed script
- Existing seed data should be cleared before running the new seed
- All code uses JavaScript (Lambda) and TypeScript (frontend) matching the existing codebase
