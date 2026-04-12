# Requirements Document: Financial Record Embeddings

## Introduction

Financial records exist with a lean schema (`id`, `org_id`, `created_by`, `transaction_date`, `amount`, `payment_method`) and their descriptions live in linked states via `state_links` (`entity_type='financial_record'`). The existing unified embeddings architecture (unified_embeddings table, SQS queue, embeddings-processor Lambda, Bedrock Titan v1) supports parts, tools, actions, issues, policies, and states.

This specification adds `financial_record` as a first-class entity type in the unified embeddings system, enabling an LLM to use financial record descriptions as context to answer cost and expense questions (e.g., "what are the chicken costs?"). The embedding source is composed from the linked `state_text` and `state_photos.photo_description`, with structured metadata (purchaser prefix, category parentheticals, per-unit price, photo markers) stripped out since those are either SQL-filterable or being deprecated. Amount, date, and payment method are excluded from the embedding source for the same reason.

## Glossary

- **Financial_Record**: A transaction record in the `financial_records` table with lean schema (id, org_id, created_by, transaction_date, amount, payment_method)
- **State_Text**: The `state_text` column in the `states` table, linked to a financial record via `state_links` (entity_type='financial_record'). Contains the composed description including purchaser prefix, category, per-unit price, and photo markers
- **Photo_Description**: The `photo_description` column in `state_photos`, linked to the financial record's state. Contains AI-generated or user-provided descriptions of receipt/transaction photos
- **Embedding_Source**: The cleaned text used to generate the embedding vector, stored in `unified_embeddings.embedding_source`
- **Stripping_Logic**: The text cleaning process that removes `[Purchaser]` prefix, `(Category: X)` parentheticals, `(₱X.XX/unit)` per-unit price, and `{{photo:URL}}` markers from state_text
- **Unified_Embeddings_Table**: The central `unified_embeddings` table storing embeddings for all entity types
- **Embeddings_Processor**: The `cwf-embeddings-processor` Lambda that consumes SQS messages and generates Titan v1 embeddings
- **Embedding_Queue**: The `cwf-embeddings-queue` SQS queue for async embedding generation
- **Coverage_Endpoint**: The `cwf-embeddings-coverage` Lambda that reports embedding counts and coverage percentages per entity type
- **Compose_Function**: The `composeFinancialRecordEmbeddingSource` function in `lambda/shared/embedding-composition.js`

## Requirements

### Requirement 1: Embedding Source Composition

**User Story:** As a developer, I want financial record embedding sources composed from cleaned state_text and photo descriptions, so that the LLM gets semantically meaningful text without redundant structured metadata.

#### Acceptance Criteria

1. WHEN composing an embedding source for a financial record, THE Compose_Function SHALL accept `state_text` and `photo_descriptions` (array of strings) as inputs
2. WHEN the state_text contains a `[Purchaser]` prefix (e.g., `[Mae]`), THE Compose_Function SHALL strip the bracketed purchaser name and any trailing whitespace from the beginning of the text
3. WHEN the state_text contains `(Category: X)` parentheticals, THE Compose_Function SHALL remove the entire parenthetical including the parentheses
4. WHEN the state_text contains `(₱X.XX/unit)` per-unit price parentheticals, THE Compose_Function SHALL remove the entire parenthetical including the parentheses
5. WHEN the state_text contains `{{photo:URL}}` markers, THE Compose_Function SHALL remove the entire marker including the double braces
6. THE Compose_Function SHALL NOT include amount, transaction_date, or payment_method in the embedding source
7. WHEN photo_descriptions are provided, THE Compose_Function SHALL append non-empty photo descriptions after the cleaned state_text, joined with '. '
8. WHEN the state_text is `[Mae] Nipa 100 pcs — Additional nipa for vermi protection (Category: Construction, ₱10.00/unit) {{photo:https://...}}`, THE Compose_Function SHALL produce `Nipa 100 pcs — Additional nipa for vermi protection`
9. THE Compose_Function SHALL be the single source of truth for embedding source composition, used by both the Lambda handlers and the backfill script
10. FOR ALL valid financial records, composing the embedding source then re-composing from the same inputs SHALL produce an identical result (idempotence)

### Requirement 2: Entity Type Registration

**User Story:** As a developer, I want financial record embeddings stored with `entity_type: 'financial_record'` using the financial record's ID, so that they follow the existing pattern where each domain entity gets its own entity_type in unified_embeddings.

#### Acceptance Criteria

1. WHEN storing an embedding for a financial record, THE Embeddings_Processor SHALL use `entity_type = 'financial_record'` in the Unified_Embeddings_Table
2. WHEN storing an embedding for a financial record, THE Embeddings_Processor SHALL use the financial record's ID as `entity_id`, not the linked state's ID
3. THE Embeddings_Processor SHALL accept `'financial_record'` as a valid entity type in its validation list

### Requirement 3: Embedding Generation Triggers

**User Story:** As a user, I want financial record embeddings generated and updated automatically when records are created, updated, or when photos change, so that search results stay current.

#### Acceptance Criteria

1. WHEN a financial record is created (POST), THE Financial_Records_Lambda SHALL compose the embedding source from the new state_text and photo descriptions, and send a message to the Embedding_Queue with `entity_type = 'financial_record'`, the financial record's ID, the composed embedding source, and the organization_id
2. WHEN a financial record's description (state_text) is updated (PUT), THE Financial_Records_Lambda SHALL recompose the embedding source and send a new message to the Embedding_Queue
3. WHEN a photo is added to, updated on, or removed from a financial record, THE Financial_Records_Lambda SHALL recompose the embedding source (including updated photo descriptions) and send a new message to the Embedding_Queue
4. WHEN an embedding generation message fails, THE Embeddings_Processor SHALL log the error and rely on the SQS retry mechanism
5. THE Financial_Records_Lambda SHALL treat embedding queue failures as non-fatal and continue returning the API response

### Requirement 4: Cascade Delete Trigger

**User Story:** As a developer, I want financial record embeddings automatically deleted when the financial record is deleted, so that orphaned embeddings do not accumulate.

#### Acceptance Criteria

1. WHEN a financial record is deleted, THE Database SHALL cascade delete associated rows from the Unified_Embeddings_Table where `entity_type = 'financial_record'` and `entity_id` matches the deleted record's ID
2. THE cascade delete SHALL be implemented as a database trigger on the `financial_records` table, following the same pattern as existing triggers for parts, tools, actions, issues, and policies

### Requirement 5: Backfill Existing Records

**User Story:** As a developer, I want to backfill embeddings for all existing financial records (~3,275), so that historical transactions are searchable and the pipeline is validated end-to-end.

#### Acceptance Criteria

1. THE Backfill_Script SHALL query all existing financial records joined with their linked state_text and photo descriptions via state_links
2. THE Backfill_Script SHALL clean the state_text using the same Stripping_Logic as the Compose_Function
3. THE Backfill_Script SHALL send each cleaned embedding source to the Embedding_Queue as `entity_type = 'financial_record'` with the financial record's ID
4. WHEN a financial record has no linked state or empty state_text, THE Backfill_Script SHALL skip that record and log a warning
5. THE Backfill_Script SHALL report the total number of records processed, queued, and skipped

### Requirement 6: Rewrite composeFinancialRecordEmbeddingSource

**User Story:** As a developer, I want the existing `composeFinancialRecordEmbeddingSource` function in `lambda/shared/embedding-composition.js` rewritten to accept state_text and photo_descriptions, so that it serves as the single source of truth for the stripping logic.

#### Acceptance Criteria

1. THE Compose_Function SHALL accept an object with `state_text` (string) and `photo_descriptions` (array of strings) as its parameter
2. THE Compose_Function SHALL apply the Stripping_Logic to the state_text: remove `[Purchaser]` prefix, `(Category: X)` parentheticals, `(₱X.XX/unit)` per-unit price, and `{{photo:URL}}` markers
3. THE Compose_Function SHALL trim excess whitespace resulting from the stripping process
4. THE Compose_Function SHALL append non-empty photo descriptions after the cleaned text, joined with '. '
5. THE Compose_Function SHALL return an empty string when both state_text is empty and photo_descriptions is empty or absent
6. THE Compose_Function SHALL be importable from the shared embedding-composition module by both the Lambda handlers and the backfill script

### Requirement 7: Coverage Endpoint Update

**User Story:** As a developer, I want the coverage endpoint to include `financial_record` in its reporting, so that I can monitor embedding coverage for financial records.

#### Acceptance Criteria

1. THE Coverage_Endpoint SHALL include `financial_record` in its total entity count query by adding a UNION ALL clause that counts rows from the `financial_records` table for the organization
2. THE Coverage_Endpoint SHALL report embedding count and coverage percentage for `financial_record` alongside existing entity types

### Requirement 8: Unified Search Includes Financial Records

**User Story:** As a user, I want to search for financial records alongside other entity types, so that I can find cost and expense information through semantic search.

#### Acceptance Criteria

1. THE Unified_Search_Endpoint SHALL accept `'financial_record'` as a valid value in the `entity_types` filter parameter
2. WHEN no entity_types filter is specified, THE Unified_Search_Endpoint SHALL include financial record embeddings in search results
3. WHEN `entity_types` includes `'financial_record'`, THE Unified_Search_Endpoint SHALL return matching financial record embeddings with entity_type, entity_id, embedding_source, and similarity score
