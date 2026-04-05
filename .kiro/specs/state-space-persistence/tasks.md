# Implementation Plan: State Space Persistence

## Overview

Implement full-stack persistence for state-space models: update the Zod schema to the new canonical format, create PostgreSQL tables, build a dedicated Lambda for CRUD + associations, integrate with the embeddings pipeline, add TanStack Query hooks, and wire a model library dialog into the existing StateSpacePage. Tasks are ordered so each step builds on the previous — schema first, then database, then backend, then frontend.

## Tasks

- [x] 1. Update Zod schema and tests to new canonical format
  - [x] 1.1 Update `src/lib/stateSpaceSchema.ts` — rename `model_id` to `name` in `modelMetadataSchema`, remove any `ai_flavor` or `simulation_params` references, ensure `model_description_prompt` is a required top-level string
    - Update `modelMetadataSchema` to use `name: z.string()` instead of `model_id: z.string()`
    - Verify `stateSpaceModelSchema` has `model_metadata`, `state_space`, and `model_description_prompt` (no `ai_flavor`, no `simulation_params`)
    - Update the `StateSpaceModel` and `ModelMetadata` inferred types
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 Update `src/lib/stateSpaceSchema.test.ts` — fix `makeModel` helper and all assertions to use `name` instead of `model_id`
    - Change `model_id: 'test'` to `name: 'test'` in `makeModel`
    - Update any assertion that references `model_metadata.model_id`
    - Add a test that rejects JSON with `model_id` instead of `name` (old format)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.3 Update `src/pages/StateSpacePage.tsx` to reflect schema changes
    - Replace `model.model_metadata.model_id` display with `model.model_metadata.name`
    - Remove any `ai_flavor` or `simulation_params` display sections
    - Update the example model JSON to use `name` instead of `model_id`
    - _Requirements: 3.5_

- [x] 2. Checkpoint — Ensure schema tests pass
  - Run `npm run test:run` and ensure all stateSpaceSchema tests pass. Ask the user if questions arise.

- [x] 3. Create database migration
  - [x] 3.1 Create `migrations/add-state-space-models.sql` with both tables
    - `state_space_models` table with columns: `id` (UUID PK), `organization_id` (UUID NOT NULL FK to organizations), `name` (TEXT NOT NULL), `description` (TEXT), `version` (TEXT DEFAULT '1.0.0'), `author` (TEXT), `model_definition` (JSONB NOT NULL), `is_public` (BOOLEAN DEFAULT false), `created_by` (UUID FK to users), `created_at` (TIMESTAMPTZ DEFAULT NOW()), `updated_at` (TIMESTAMPTZ DEFAULT NOW())
    - UNIQUE constraint on `(organization_id, name, author, version)`
    - `state_space_model_associations` table with columns: `id` (UUID PK), `model_id` (UUID NOT NULL FK to state_space_models ON DELETE CASCADE), `entity_type` (TEXT NOT NULL), `entity_id` (UUID NOT NULL), `created_at` (TIMESTAMPTZ DEFAULT NOW())
    - UNIQUE constraint on `(model_id, entity_type, entity_id)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_

- [x] 4. Implement Lambda handler for state-space model CRUD and associations
  - [x] 4.1 Create `lambda/state-space-models/package.json` with `zod` dependency
    - _Requirements: 6.1_

  - [x] 4.2 Create `lambda/state-space-models/shared/validation.js` — server-side Zod schema mirroring `stateSpaceSchema.ts`
    - Implement `validateStateSpaceModel(jsonBody)` returning `{ success, model/errors }`
    - Include dimension validation logic (matrix sizes, label counts)
    - _Requirements: 4.6, 3.1, 3.2, 3.4_

  - [x] 4.3 Create `lambda/state-space-models/index.js` — Lambda handler with all routes
    - Use `Pool`, `getAuthorizerContext`, `success`, `error` from common layer (pattern: `lambda/explorations/index.js`)
    - POST `/api/state-space-models` — validate with Zod, insert into `state_space_models`, extract `name`/`description` from `model_definition.model_metadata`, send SQS embedding message, return created record
    - GET `/api/state-space-models` — return org models + public models from other orgs
    - GET `/api/state-space-models/by-entity` — query associations + join models by `entity_type` and `entity_id`
    - GET `/api/state-space-models/:id` — return single model if org-owned or public
    - PUT `/api/state-space-models/:id` — re-validate, update record, send SQS embedding message
    - DELETE `/api/state-space-models/:id` — delete model (cascade removes associations)
    - POST `/api/state-space-models/:id/associations` — create association, return 409 on duplicate
    - DELETE `/api/state-space-models/:modelId/associations/:associationId` — remove association
    - Scope all queries by `organization_id`, return 401 if missing
    - Return 404 for not-found or not-owned (non-public) models
    - Return 400 with all validation errors on create/update failure
    - Return 409 on unique constraint violations (PostgreSQL error code 23505)
    - SQS message: `entity_type: 'state_space_model'`, `entity_id`, `organization_id`, `embedding_source` composed from `name + description + model_description_prompt`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 8.2, 8.3_

  - [x] 4.4 Write property test for schema validation (Property 1)
    - **Property 1: Schema validation accepts valid models and rejects invalid ones**
    - Use `fast-check` to generate random valid and invalid models
    - Valid models with correct `name`, `version`, `author`, `description`, matching dimensions/labels/matrices, and non-empty `model_description_prompt` must pass
    - Invalid models (missing fields, wrong types, mismatched dimensions) must fail with errors
    - **Validates: Requirements 3.1, 3.2, 3.4, 4.6**

  - [x] 4.5 Write property test for embedding source composition (Property 8)
    - **Property 8: Embedding source composition completeness**
    - Use `fast-check` to generate random `{ name, description, model_description_prompt }` with varying emptiness
    - Composed source must contain all non-empty fields joined by `. `
    - **Validates: Requirements 8.3**

- [x] 5. Checkpoint — Ensure Lambda validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update embeddings processor to recognize `state_space_model` entity type
  - [x] 6.1 Update `lambda/embeddings-processor/index.js` — add `state_space_model` to `validTypes` array and add a `state_space_model` case in `getEmbeddingSource` switch
    - Add `'state_space_model'` to the `validTypes` array
    - Add composition function or inline case for `state_space_model` in the `getEmbeddingSource` switch that composes from `fields.name`, `fields.description`, `fields.model_description_prompt`
    - _Requirements: 8.1, 8.3, 8.4_

- [x] 7. Add frontend API service and query hooks
  - [x] 7.1 Create `src/lib/stateSpaceApi.ts` — API service functions for all state-space model endpoints
    - `createStateSpaceModel`, `listStateSpaceModels`, `getStateSpaceModel`, `updateStateSpaceModel`, `deleteStateSpaceModel`
    - `createModelAssociation`, `deleteModelAssociation`, `getModelsByEntity`
    - Use `apiService` pattern from existing code
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3_

  - [x] 7.2 Add query keys to `src/lib/queryKeys.ts`
    - `stateSpaceModelsQueryKey`, `stateSpaceModelQueryKey`, `stateSpaceModelsByEntityQueryKey`
    - _Requirements: 7.3_

  - [x] 7.3 Create `src/hooks/useStateSpaceModels.ts` — TanStack Query hooks
    - `useStateSpaceModelsByEntity(entityType, entityId)` — fetches models associated with an entity
    - `useStateSpaceModels()` — fetches all org + public models
    - `useCreateStateSpaceModel()` — mutation with cache invalidation
    - `useUpdateStateSpaceModel()` — mutation with cache invalidation
    - `useDeleteStateSpaceModel()` — mutation with cache invalidation
    - `useCreateModelAssociation()` — mutation with cache invalidation
    - `useDeleteModelAssociation()` — mutation with cache invalidation
    - _Requirements: 7.3, 7.4_

- [x] 8. Update StateSpacePage to use persistence hooks
  - [x] 8.1 Update `src/pages/StateSpacePage.tsx` — replace local-only state with hook-based persistence
    - On mount, call `useStateSpaceModelsByEntity('action', actionId)` to load associated model
    - If a model exists, display it; otherwise show the paste/load UI
    - Add a Save button that calls `useCreateStateSpaceModel` (new) or `useUpdateStateSpaceModel` (existing), then `useCreateModelAssociation` to link to the action
    - Show loading indicator and disable Save button while mutation is in progress
    - Show error toast on save failure, retain model in editor for retry
    - Format model JSON with 2-space indentation in the edit textarea
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 10.3_

- [x] 9. Checkpoint — Ensure frontend compiles and hooks work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Model Library dialog
  - [x] 10.1 Create `src/components/StateSpaceModelLibrary.tsx` — dialog for browsing and selecting models
    - Display all org models and public models using `useStateSpaceModels()`
    - Support semantic search using the unified search endpoint
    - On model select, call `useCreateModelAssociation` to link to the current action, then close dialog
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 10.2 Add Model Library button to `src/pages/StateSpacePage.tsx`
    - Add a "Browse Library" button that opens the `StateSpaceModelLibrary` dialog
    - Pass `actionId` and an `onSelect` callback that loads the selected model into the page
    - _Requirements: 9.4, 9.5_

- [x] 11. Write property test for JSONB round-trip (Property 3)
  - **Property 3: Model JSONB round-trip**
  - Use `fast-check` to generate random valid `StateSpaceModel` objects
  - `JSON.parse(JSON.stringify(model))` must deep-equal the original, including numeric precision in matrices
  - **Validates: Requirements 1.3, 10.1, 10.2**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Zod schema update (task 1) must happen first since both frontend and backend depend on it
- DB migration (task 3) must happen before Lambda deployment
- Lambda (task 4) must be deployed before frontend hooks can be tested end-to-end
- Embeddings processor update (task 6) can happen in parallel with frontend work (tasks 7-8)
- Property tests validate universal correctness properties from the design document
- Deployment commands (deploy-lambda-with-layer.sh, add-api-endpoint.sh, cwf-db-migration) are run manually by the user — not included as tasks
