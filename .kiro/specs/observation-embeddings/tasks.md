# Implementation Plan: Observation Embeddings

## Overview

Add `state` as a new entity type in the unified embeddings system. Implementation follows the established pattern: composition function → States Lambda SQS integration → embeddings processor extension → cascade delete trigger → deploy. Each task builds incrementally so the pipeline is testable end-to-end.

## Tasks

- [x] 1. Add `composeStateEmbeddingSource` to composition module
  - [x] 1.1 Implement `composeStateEmbeddingSource` in `lambda/shared/embedding-composition.js`
    - Add function that accepts `{ entity_names, state_text, photo_descriptions, metrics }` 
    - Concatenate non-null/non-empty components with `. ` separator
    - Format metrics as `"{display_name}: {value} {unit}"` (with unit) or `"{display_name}: {value}"` (without unit)
    - Export the new function alongside existing compose functions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 1.2 Copy updated composition module to all locations
    - Copy to `lambda/layers/cwf-common-nodejs/nodejs/embedding-composition.js`
    - Copy to `lambda/unified-search/shared/embedding-composition.js`
    - Copy to `lambda/embeddings-regenerate/embedding-composition.js`
    - All four copies must export `composeStateEmbeddingSource`
    - _Requirements: 1.1_

  - [x] 1.3 Add unit tests for `composeStateEmbeddingSource` in `lambda/shared/embedding-composition.test.js`
    - Test with all fields populated (entity_names, state_text, photo_descriptions, metrics with/without units)
    - Test with only state_text (no links, photos, or metrics)
    - Test with empty/null fields returns empty string
    - Test that photo URLs are not included in output
    - Test that entity type prefixes are not included
    - Test metric formatting with and without unit
    - Test multiple entity names from different entity types
    - Follow existing test patterns using `node:test` and `node:assert`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 1.4 Write property test: Composition Completeness
    - **Property 1: Composition Completeness**
    - Generate random `StateCompositionInput` objects with varying entity_names (0–5), optional state_text, photo_descriptions (including nulls/empties), and metrics (with/without units)
    - Verify all non-null/non-empty components appear in output separated by `. `
    - Verify metric formatting: `"{display_name}: {value} {unit}"` or `"{display_name}: {value}"`
    - Use fast-check, minimum 100 iterations
    - Tag: `Feature: observation-embeddings, Property 1: Composition Completeness`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.3**

  - [ ]* 1.5 Write property test: Composition Exclusion
    - **Property 2: Composition Exclusion**
    - Generate random composition inputs that include photo_url strings and entity_type strings
    - Verify output does not contain photo URLs or entity type prefixes ("part", "tool", "action")
    - Use fast-check, minimum 100 iterations
    - Tag: `Feature: observation-embeddings, Property 2: Composition Exclusion`
    - **Validates: Requirements 1.7, 1.8**

- [x] 2. Integrate SQS embedding queue into States Lambda
  - [x] 2.1 Add SQS client and `resolveAndQueueEmbedding` function to `lambda/states/index.js`
    - Import `SQSClient` and `SendMessageCommand` from `@aws-sdk/client-sqs`
    - Import `composeStateEmbeddingSource` from `/opt/nodejs/embedding-composition`
    - Add `EMBEDDINGS_QUEUE_URL` constant (from env var or hardcoded fallback matching actions Lambda pattern)
    - Implement `resolveAndQueueEmbedding(stateId, organizationId, client)` that:
      - Runs the resolution query to gather entity_names, photo_descriptions, and metrics
      - Calls `composeStateEmbeddingSource` with resolved data
      - Sends SQS message with `{ entity_type: 'state', entity_id, embedding_source, organization_id }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Call `resolveAndQueueEmbedding` after create and update commits
    - In `createState`: after COMMIT, call `resolveAndQueueEmbedding` fire-and-forget (`.then()/.catch()`)
    - In `updateState`: after COMMIT, call `resolveAndQueueEmbedding` fire-and-forget (`.then()/.catch()`)
    - Ensure SQS failures are logged but do not affect API response
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.3 Write property test: SQS Message on Create/Update
    - **Property 4: SQS Message on Create/Update**
    - Mock SQS client, generate random state create/update payloads
    - Verify exactly one SQS message sent with entity_type='state', valid entity_id, non-empty embedding_source, and matching organization_id
    - Use fast-check, minimum 100 iterations
    - Tag: `Feature: observation-embeddings, Property 4: SQS Message on Create/Update`
    - **Validates: Requirements 3.1, 3.2, 3.5**

- [x] 3. Checkpoint - Verify composition and SQS integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend embeddings processor to handle `state` entity type
  - [x] 4.1 Add `'state'` to validTypes and getEmbeddingSource switch in `lambda/embeddings-processor/index.js`
    - Add `'state'` to the `validTypes` array
    - Import `composeStateEmbeddingSource` from `/opt/nodejs/lib/embedding-composition`
    - Add `case 'state': return composeStateEmbeddingSource(fields);` to the `getEmbeddingSource` switch
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write property test: One Embedding Per State (UPSERT Idempotence)
    - **Property 3: One Embedding Per State (UPSERT Idempotence)**
    - Generate random state embeddings, verify the UPSERT SQL produces exactly one row per (entity_type, entity_id, model_version)
    - Tag: `Feature: observation-embeddings, Property 3: One Embedding Per State (UPSERT Idempotence)`
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [ ]* 4.3 Write property test: Organization ID on Storage
    - **Property 6: Organization ID on Storage**
    - Generate random states with various organization_ids, verify unified_embeddings row has matching organization_id
    - Tag: `Feature: observation-embeddings, Property 6: Organization ID on Storage`
    - **Validates: Requirements 7.1**

- [x] 5. Add cascade delete trigger for states
  - [x] 5.1 Create database migration SQL for cascade delete trigger
    - Write migration: `CREATE TRIGGER states_delete_embedding AFTER DELETE ON states FOR EACH ROW EXECUTE FUNCTION delete_unified_embedding('state');`
    - Execute via `cwf-db-migration` Lambda
    - Verify trigger exists with a follow-up query
    - _Requirements: 5.1, 5.2_

  - [ ]* 5.2 Write property test: Cascade Delete
    - **Property 5: Cascade Delete**
    - Verify that deleting a state with an associated embedding removes the embedding row
    - Tag: `Feature: observation-embeddings, Property 5: Cascade Delete`
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. Add `state` to embeddings-regenerate Lambda
  - [x] 6.1 Add `'state'` entry to `ENTITY_CONFIG` in `lambda/embeddings-regenerate/index.js`
    - Import `composeStateEmbeddingSource` from `/opt/nodejs/lib/embedding-composition`
    - Add `state: { table: 'states', composeFn: composeStateEmbeddingSource, needsResolution: true }` to ENTITY_CONFIG
    - Add resolution query logic for state entities (fetch entity_names, photo_descriptions, metrics before composing)
    - _Requirements: 4.2, 4.4_

- [x] 7. Checkpoint - Verify full pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Deploy changes
  - [x] 8.1 Deploy updated Lambda layer with new composition function
    - Update `lambda/layers/cwf-common-nodejs/nodejs/embedding-composition.js` (done in 1.2)
    - Deploy layer and note new version number
    - _Requirements: 1.1_

  - [x] 8.2 Deploy States Lambda with EMBEDDINGS_QUEUE_URL env var
    - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh states cwf-states-lambda`
    - Add `EMBEDDINGS_QUEUE_URL` environment variable to the Lambda configuration
    - _Requirements: 3.1, 3.2_

  - [x] 8.3 Deploy embeddings processor Lambda
    - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh embeddings-processor cwf-embeddings-processor`
    - _Requirements: 4.1_

  - [x] 8.4 Deploy embeddings-regenerate Lambda
    - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh embeddings-regenerate cwf-embeddings-regenerate`
    - _Requirements: 4.2_

- [x] 9. Final checkpoint - End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The unified search Lambda requires no code changes (already dynamic)
- The composition module must be updated in 4 locations (shared, layer, unified-search/shared, embeddings-regenerate)
- The states Lambda uses a connection pool (`getDbClient`) unlike the actions Lambda which creates new `Client` instances
