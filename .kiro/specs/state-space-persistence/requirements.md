# Requirements Document

## Introduction

This spec adds backend persistence, API endpoints, frontend data hooks, embeddings integration, and a model library for state-space models. The state-space-loader spec (completed) created a frontend-only page at `/actions/:actionId/state-space` where users paste JSON, validate it, and view/edit models in React state. This persistence spec makes those models durable — stored in PostgreSQL, served via a dedicated Lambda, discoverable through semantic search, and associable with actions (and future entity types).

The canonical JSON format has been updated from the loader spec: `model_id` is now `name` in `model_metadata`, `ai_flavor` is replaced by a single `model_description_prompt` string, and `simulation_params` is removed entirely (deferred to a future spec).

## Glossary

- **State_Space_Model**: A JSON object containing three top-level sections: `model_metadata`, `state_space`, and `model_description_prompt`
- **Model_Metadata**: The section containing `name`, `version`, `author`, and `description`
- **State_Space_Lambda**: The new dedicated Lambda function `cwf-state-space-lambda` that handles all state-space model CRUD and association operations
- **State_Space_Models_Table**: The PostgreSQL table `state_space_models` storing persisted model records
- **Associations_Table**: The PostgreSQL table `state_space_model_associations` storing many-to-many links between models and entities (actions, assets, etc.)
- **Schema_Validator**: The server-side Zod schema that validates the JSON structure and matrix dimensions of a State_Space_Model
- **Embeddings_Processor**: The existing `cwf-embeddings-processor` Lambda that generates embedding vectors via SQS
- **Model_Library**: A UI view for browsing, searching, and selecting state-space models from the organization's collection and public models
- **State_Space_Page**: The existing React page at `/actions/:actionId/state-space` (from the loader spec) that will be updated to use persistence hooks
- **Organization_Context**: The `organization_id` extracted from the Lambda authorizer, used to scope all queries

## Requirements

### Requirement 1: Database Schema — Models Table

**User Story:** As a system administrator, I want state-space models stored in a dedicated PostgreSQL table with proper constraints, so that models are durable, queryable, and scoped to organizations.

#### Acceptance Criteria

1. THE State_Space_Models_Table SHALL contain columns: `id` (UUID primary key, system-generated), `organization_id` (UUID, NOT NULL, foreign key to organizations), `name` (TEXT, NOT NULL), `description` (TEXT), `version` (TEXT, DEFAULT '1.0.0'), `author` (TEXT), `model_definition` (JSONB, NOT NULL), `is_public` (BOOLEAN, DEFAULT false), `created_by` (UUID, foreign key to users), `created_at` (TIMESTAMPTZ), and `updated_at` (TIMESTAMPTZ)
2. THE State_Space_Models_Table SHALL enforce a UNIQUE constraint on `(organization_id, name, author, version)` to prevent duplicate models within an organization
3. THE `model_definition` column SHALL store the complete JSON object including `model_metadata`, `state_space`, and `model_description_prompt`
4. THE `name` column SHALL be extracted from `model_metadata.name` and stored as a separate column for direct querying
5. THE `description` column SHALL be extracted from `model_metadata.description` and stored as a separate column for vectorization and search

### Requirement 2: Database Schema — Associations Table

**User Story:** As a user, I want to associate state-space models with actions and other entities, so that I can link a physics model to the work context where it applies.

#### Acceptance Criteria

1. THE Associations_Table SHALL contain columns: `id` (UUID primary key), `model_id` (UUID, NOT NULL, foreign key to state_space_models with ON DELETE CASCADE), `entity_type` (TEXT, NOT NULL), `entity_id` (UUID, NOT NULL), and `created_at` (TIMESTAMPTZ)
2. THE Associations_Table SHALL enforce a UNIQUE constraint on `(model_id, entity_type, entity_id)` to prevent duplicate associations
3. WHEN a state-space model is deleted, THE Associations_Table SHALL automatically remove all associations for that model via CASCADE delete

### Requirement 3: Zod Schema Update

**User Story:** As a developer, I want the shared Zod schema updated to match the new canonical JSON format, so that both frontend and backend validate against the same structure.

#### Acceptance Criteria

1. THE Schema_Validator SHALL validate `model_metadata` with fields: `name` (string), `version` (string), `author` (string), and `description` (string) — replacing the previous `model_id` field
2. THE Schema_Validator SHALL validate `model_description_prompt` as a required string at the top level — replacing the previous `ai_flavor` structured object
3. THE Schema_Validator SHALL NOT validate `simulation_params` or `ai_flavor` sections (removed from the canonical format)
4. THE Schema_Validator SHALL continue to validate `state_space` with `dimensions`, `labels`, and `matrices` using the same dimension validation logic from the loader spec
5. THE State_Space_Page SHALL be updated to reflect the schema changes (display `name` instead of `model_id`, display `model_description_prompt` instead of `ai_flavor` and `simulation_params`)

### Requirement 4: Lambda API — Model CRUD

**User Story:** As a user, I want API endpoints to create, read, update, and delete state-space models, so that models are persisted and manageable through the backend.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/state-space-models` with a valid model JSON body, THE State_Space_Lambda SHALL validate the model using the Schema_Validator (Zod schema + dimension validation), persist it to the State_Space_Models_Table, and return the created record with a system-generated UUID
2. WHEN a GET request is sent to `/api/state-space-models`, THE State_Space_Lambda SHALL return all models belonging to the requesting organization plus all models where `is_public` is true from other organizations
3. WHEN a GET request is sent to `/api/state-space-models/:id`, THE State_Space_Lambda SHALL return the single model if it belongs to the requesting organization or is public
4. WHEN a PUT request is sent to `/api/state-space-models/:id` with a valid model JSON body, THE State_Space_Lambda SHALL re-validate the model, update the record, and return the updated record
5. WHEN a DELETE request is sent to `/api/state-space-models/:id`, THE State_Space_Lambda SHALL delete the model and return a success confirmation
6. IF the Schema_Validator or dimension validation fails on create or update, THEN THE State_Space_Lambda SHALL return a 400 response with all validation error messages
7. THE State_Space_Lambda SHALL scope all queries by `organization_id` from the authorizer context, returning 401 if the organization ID is not present
8. IF a model is not found or does not belong to the requesting organization (and is not public), THEN THE State_Space_Lambda SHALL return a 404 response

### Requirement 5: Lambda API — Association Endpoints

**User Story:** As a user, I want API endpoints to attach and detach state-space models to entities like actions, so that I can manage which models are linked to which work contexts.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/state-space-models/:id/associations` with `entity_type` and `entity_id` in the body, THE State_Space_Lambda SHALL create an association record and return it
2. WHEN a DELETE request is sent to `/api/state-space-models/:modelId/associations/:associationId`, THE State_Space_Lambda SHALL remove the association and return a success confirmation
3. WHEN a GET request is sent to `/api/state-space-models/by-entity?entity_type=action&entity_id=xxx`, THE State_Space_Lambda SHALL return all models associated with the specified entity
4. IF the specified model does not exist or does not belong to the requesting organization, THEN THE State_Space_Lambda SHALL return a 404 response when creating an association
5. IF a duplicate association already exists (same model_id, entity_type, entity_id), THEN THE State_Space_Lambda SHALL return a 409 conflict response

### Requirement 6: Lambda Deployment and Infrastructure

**User Story:** As a developer, I want the new Lambda deployed with the common layer and API Gateway routes configured, so that the endpoints are accessible from the frontend.

#### Acceptance Criteria

1. THE State_Space_Lambda SHALL be deployed using the `scripts/deploy/deploy-lambda-with-layer.sh` script with the `cwf-common-nodejs` layer
2. THE State_Space_Lambda SHALL use the `Pool`, `getAuthorizerContext`, `success`, and `error` helpers from the common layer, following the pattern in `lambda/explorations/index.js`
3. THE State_Space_Lambda SHALL have API Gateway routes created using `scripts/add-api-endpoint.sh` for all endpoints
4. THE database migration SHALL be executed using the `cwf-db-migration` Lambda

### Requirement 7: Frontend Persistence Hooks

**User Story:** As a user, I want the state-space page to automatically load and save models from the backend, so that my models persist across sessions and are shared with my organization.

#### Acceptance Criteria

1. WHEN the user navigates to `/actions/:actionId/state-space`, THE State_Space_Page SHALL fetch associated models for that action using the `by-entity` endpoint and display the first model if one exists
2. WHEN the user validates a model and clicks Save, THE State_Space_Page SHALL POST or PUT the model to the backend and create an association to the current action
3. THE State_Space_Page SHALL use TanStack Query hooks for data fetching and caching, following existing patterns (e.g., `useActionScores`, `useScoringPrompts`)
4. THE State_Space_Page SHALL replace local-only React state management with hook-based state derived from the TanStack Query cache
5. WHILE a save operation is in progress, THE State_Space_Page SHALL display a loading indicator and disable the Save button to prevent duplicate submissions
6. IF a save operation fails, THEN THE State_Space_Page SHALL display an error message and retain the model in the editor so the user can retry

### Requirement 8: Unified Embeddings Integration

**User Story:** As a user, I want state-space models to be discoverable through semantic search, so that I can find relevant models by describing my process or action context.

#### Acceptance Criteria

1. THE Embeddings_Processor SHALL recognize `state_space_model` as a valid entity type
2. WHEN a state-space model is created or updated, THE State_Space_Lambda SHALL send an SQS message to the embeddings queue with entity_type `state_space_model`, the model's `id`, `organization_id`, and fields for embedding source composition
3. THE embedding source for a state-space model SHALL be composed from: `name` + `description` + `model_description_prompt`
4. THE `unified_embeddings` table SHALL store embeddings for `state_space_model` entities, enabling semantic search alongside other entity types

### Requirement 9: Model Library

**User Story:** As a user, I want a simple library view to browse and search available state-space models, so that I can discover and attach existing models to my actions.

#### Acceptance Criteria

1. THE Model_Library SHALL display all models belonging to the user's organization
2. THE Model_Library SHALL display all public models (where `is_public` is true) from any organization
3. THE Model_Library SHALL support semantic search using the unified search endpoint to find models by natural language description
4. THE Model_Library SHALL be accessible from the State_Space_Page so users can browse and select a model to attach to the current action
5. WHEN the user selects a model from the Model_Library, THE State_Space_Page SHALL create an association between the selected model and the current action

### Requirement 10: JSON Pretty-Print and Round-Trip Integrity

**User Story:** As a user, I want the system to preserve my model JSON exactly through save and load cycles, so that no data is lost or altered during persistence.

#### Acceptance Criteria

1. FOR ALL valid State_Space_Model objects, saving to the database and loading back SHALL produce an equivalent JSON object (round-trip property)
2. THE system SHALL preserve all numeric precision from the original model JSON through the PostgreSQL JSONB storage and retrieval cycle
3. THE State_Space_Page SHALL format the model as JSON with 2-space indentation when displaying in the edit textarea, consistent with the loader spec behavior
