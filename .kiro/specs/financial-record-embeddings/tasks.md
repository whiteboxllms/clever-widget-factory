# Implementation Plan: Financial Record Embeddings

## Overview

Add `financial_record` as a first-class entity type in the unified embeddings system. This involves rewriting the compose function with stripping logic, updating the financial records Lambda (create/update/delete), adding a cascade delete trigger, updating the coverage endpoint, and creating a backfill script. The unified search and embeddings processor require no changes.

## Tasks

- [x] 1. Rewrite `composeFinancialRecordEmbeddingSource` in shared module
  - [x] 1.1 Rewrite `composeFinancialRecordEmbeddingSource` in `lambda/shared/embedding-composition.js`
    - Change function signature to accept `{ state_text, photo_descriptions }` instead of `{ description, category_tag, external_source_note }`
    - Implement stripping logic: remove `[Purchaser]` prefix via `/^\[.*?\]\s*/`, `(Category: X)` via `/\(Category:\s*[^)]*\)/g`, `(₱X.XX/unit)` via `/\(₱[\d,.]+\/unit\)/g`, `{{photo:URL}}` via `/\{\{photo:.*?\}\}/g`
    - Collapse whitespace and trim
    - Append non-empty photo_descriptions joined with `. `
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.2 Update existing unit tests for `composeFinancialRecordEmbeddingSource` in `lambda/shared/embedding-composition.test.js`
    - Replace old tests (which use `description`, `category_tag`, `external_source_note`) with new tests using `state_text` and `photo_descriptions`
    - Test specific stripping examples from design: `[Mae] Nipa 100 pcs — Additional nipa (Category: Construction, ₱10.00/unit) {{photo:https://...}}` → `Nipa 100 pcs — Additional nipa`
    - Test `[Stefan] GCash reload` → `GCash reload`
    - Test `Chicken feed 50kg (Category: Food)` → `Chicken feed 50kg` (no purchaser)
    - Test `Transaction` → `Transaction` (no metadata)
    - Test empty string input, null state_text with photo descriptions, multiple `{{photo:URL}}` markers
    - Test combined parenthetical `(Category: Construction, ₱10.00/unit)` fully removed
    - Test photo description joining with `. `
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 1.3 Write property test: Metadata stripping completeness (Property 1)
    - **Property 1: Metadata stripping completeness**
    - Generate random state_text with randomly injected `[Name]` prefix, `(Category: X)` parentheticals, `(₱X.XX/unit)` prices, and `{{photo:URL}}` markers
    - Assert output contains none of the metadata patterns, no leading/trailing whitespace, no consecutive spaces
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 6.2, 6.3**

  - [ ]* 1.4 Write property test: Photo description appending (Property 2)
    - **Property 2: Photo description appending**
    - Generate random cleaned state_text (no metadata) and random array of non-empty photo descriptions
    - Assert output starts with state_text, each photo description appears, parts joined with `. `
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.7, 6.4**

  - [ ]* 1.5 Write property test: Composition idempotence (Property 3)
    - **Property 3: Composition idempotence**
    - Generate random state_text with random metadata markers and random photo descriptions
    - Call compose once to get result1, then call with `{ state_text: result1, photo_descriptions: [] }` to get result2
    - Assert result1 === result2
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.10**

- [x] 2. Update `createRecord` in `lambda/financial-records/index.js`
  - [x] 2.1 Update `createRecord` to use `composeFinancialRecordEmbeddingSource` and queue with `entity_type: 'financial_record'`
    - Import `composeFinancialRecordEmbeddingSource` from `/opt/nodejs/embedding-composition`
    - Replace the existing SQS message that sends `entity_type: 'state'` / `entity_id: stateId` / `embedding_source: description`
    - Compose embedding source using `{ state_text: description, photo_descriptions }` from the photos array
    - Send SQS message with `entity_type: 'financial_record'`, `entity_id: createdRecord.id`, composed `embedding_source`, and `organization_id`
    - _Requirements: 2.1, 2.2, 3.1, 3.5_

  - [ ]* 2.2 Write property test: Embedding queue message correctness on create (Property 4)
    - **Property 4: Embedding queue message correctness**
    - Mock SQS and database, generate random creation inputs (description, photos, organization_id)
    - Assert SQS message has `entity_type: 'financial_record'`, `entity_id` matching created record ID, non-empty `embedding_source`, correct `organization_id`
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.1, 2.2, 3.1**

- [x] 3. Update `updateRecord` in `lambda/financial-records/index.js`
  - [x] 3.1 Update `updateRecord` to recompose and queue embedding when description or photos change
    - When `hasDescriptionChange || hasPhotosChange`, fetch updated photo descriptions from `state_photos`
    - Compose embedding source using `composeFinancialRecordEmbeddingSource`
    - Replace the existing SQS message (which sends `entity_type: 'state'`) with `entity_type: 'financial_record'`, `entity_id: id` (the financial record ID)
    - _Requirements: 3.2, 3.3_

- [x] 4. Update `deleteRecord` in `lambda/financial-records/index.js`
  - [x] 4.1 Remove manual `DELETE FROM unified_embeddings` calls from `deleteRecord`
    - Remove the two manual DELETE queries for `entity_type = 'financial_record'` and `entity_type = 'state'`
    - The database trigger (task 5) handles cascade deletion for `financial_record` entity type
    - The state deletion already cascades via the existing state trigger (if present) or is handled by the state DELETE
    - _Requirements: 4.1_

- [x] 5. Checkpoint - Verify Lambda changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create SQL migration for cascade delete trigger
  - [x] 6.1 Create migration file `migrations/add-financial-records-delete-embedding-trigger.sql`
    - Add `CREATE TRIGGER financial_records_delete_embedding AFTER DELETE ON financial_records FOR EACH ROW EXECUTE FUNCTION delete_unified_embedding('financial_record');`
    - This reuses the existing `delete_unified_embedding()` function already deployed for parts, tools, actions, issues, and policies
    - _Requirements: 4.1, 4.2_

  - [ ]* 6.2 Write property test: Cascade delete integrity (Property 5)
    - **Property 5: Cascade delete integrity**
    - Requires real database; create a financial record with an embedding in unified_embeddings, delete the record, assert no rows exist with `entity_type = 'financial_record'` and matching `entity_id`
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 4.1**

- [x] 7. Update coverage endpoint
  - [x] 7.1 Add `financial_record` UNION ALL clause to `lambda/embeddings-coverage/index.js`
    - Add `UNION ALL SELECT 'financial_record', COUNT(*) FROM financial_records WHERE organization_id = '${escapedOrgId}'` to the `totalsSql` query
    - No other changes needed — the counts query already dynamically groups by entity_type
    - _Requirements: 7.1, 7.2_

- [x] 8. Create backfill script
  - [x] 8.1 Create `scripts/backfill/backfill-financial-record-embeddings.js`
    - Node.js script that queries all financial records with linked state_text and photo descriptions via the SQL from the design document
    - Import and use `composeFinancialRecordEmbeddingSource` from `lambda/shared/embedding-composition.js`
    - For each record, compose embedding source and send SQS message with `entity_type: 'financial_record'`
    - Skip records with empty state_text and no photo descriptions, log warning
    - Report totals: processed, queued, skipped
    - Include small delay between batches to avoid SQS throttling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 1.9_

- [x] 9. Deploy Lambda layer with updated `embedding-composition.js`
  - [x] 9.1 Deploy the updated `lambda/shared/embedding-composition.js` to the `cwf-common-nodejs` Lambda layer
    - Run the layer deployment script so the updated compose function is available at `/opt/nodejs/embedding-composition` for all Lambdas
    - Deploy the financial records Lambda with the updated layer
    - _Requirements: 6.6_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The unified search Lambda and embeddings processor Lambda require NO code changes per the design
- The backfill script reuses the existing SQS pipeline rather than writing directly to the database
- Property tests use `fast-check` with minimum 100 iterations per the design's testing strategy
- Each task references specific requirements for traceability
