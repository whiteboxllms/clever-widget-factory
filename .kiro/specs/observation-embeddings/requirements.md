# Requirements Document: Observation Embeddings

## Introduction

The unified embeddings system currently supports parts, tools, actions, issues, and policies. Observations (stored as `states` in the database) are a rich source of field knowledge — they capture what a worker saw, photographed, and measured about an asset at a specific point in time. This data is currently invisible to semantic search.

This specification adds `state` as a new entity type in the unified embeddings system. Each observation gets one embedding composed from its linked entity names, observation text, photo descriptions, and metric snapshot values. The embedding is generated asynchronously via SQS when observations are created or updated, following the same pattern used by the actions Lambda.

This is a foundational feature consumed by multiple downstream systems (sari-sari store agent, entropy reports, Maxwell assistant). Temporal scoring (recency weighting) is explicitly out of scope — that is a retrieval concern handled by consumers at query time.

## Glossary

- **State**: Database entity representing an observation (table: `states`). Code uses "state", UI uses "observation".
- **State_Link**: Polymorphic join record connecting a state to a part, tool, or action (table: `state_links`)
- **State_Photo**: Photo attached to an observation with optional description (table: `state_photos`)
- **Metric_Snapshot**: Quantitative measurement recorded within an observation (table: `metric_snapshots`, joined to `metrics` for display_name and unit)
- **Embedding_Composition**: The process of concatenating entity fields into a single text string for embedding generation
- **Embeddings_Processor**: Lambda function that consumes SQS messages and generates Titan v1 embeddings (1536 dimensions)
- **Embedding_Queue**: SQS queue (`cwf-embeddings-queue`) for async embedding generation
- **Unified_Embeddings_Table**: Central table storing all entity embeddings (`unified_embeddings`)
- **Unified_Search**: Lambda providing cross-entity semantic search via `/api/semantic-search/unified`
- **States_Lambda**: Lambda handling CRUD for observations (`cwf-states-lambda`)
- **Composition_Module**: Shared module containing compose functions per entity type (`lambda/shared/embedding-composition.js`)

## Requirements

### Requirement 1: State Embedding Composition

**User Story:** As a system, I want to compose a rich text description from observation data, so that semantic search can find observations by what was seen, photographed, and measured.

#### Acceptance Criteria

1. WHEN composing an embedding source for a state, THE Composition_Module SHALL include the linked entity name(s) from State_Link records by resolving entity_id against the appropriate table (parts.name, tools.name, actions.description)
2. WHEN composing an embedding source for a state, THE Composition_Module SHALL include the state_text field from the states table
3. WHEN composing an embedding source for a state, THE Composition_Module SHALL include photo_description fields from State_Photo records, skipping entries where photo_description is null or empty
4. WHEN composing an embedding source for a state, THE Composition_Module SHALL include metric snapshot values formatted as "{display_name}: {value}" from Metric_Snapshot records joined with the metrics table
5. WHEN a metric has a unit defined, THE Composition_Module SHALL append the unit to the metric value (e.g., "Girth: 45 cm")
6. THE Composition_Module SHALL concatenate all non-null, non-empty components using ". " as separator, following the existing filter(Boolean).join('. ') pattern
7. THE Composition_Module SHALL NOT include photo URLs in the embedding source, as URLs carry no semantic value
8. THE Composition_Module SHALL NOT include entity type prefixes in the composition text — the entity name alone carries semantic meaning
9. WHEN all composition fields are null or empty, THE Composition_Module SHALL return an empty string, and the embedding generation SHALL be skipped

### Requirement 2: One Embedding Per Observation

**User Story:** As a system architect, I want each observation to produce exactly one embedding in the unified_embeddings table, so that each observation is treated as its own semantic unit with its own timestamp.

#### Acceptance Criteria

1. WHEN a state is created or updated, THE System SHALL generate exactly one embedding with entity_type 'state' and entity_id set to the state row UUID
2. THE System SHALL NOT generate separate embeddings per State_Link — the observation is the semantic unit, not the link
3. WHEN a state has multiple State_Link records, THE Composition_Module SHALL include all linked entity names in the single embedding source
4. WHEN storing the embedding, THE Unified_Embeddings_Table SHALL use the existing UPSERT pattern (ON CONFLICT on entity_type, entity_id, model_version DO UPDATE)

### Requirement 3: SQS Trigger from States Lambda

**User Story:** As a developer, I want the states Lambda to send SQS messages on create and update, so that observation embeddings are generated asynchronously without blocking the API response.

#### Acceptance Criteria

1. WHEN a state is successfully created, THE States_Lambda SHALL send a message to the Embedding_Queue with entity_type 'state', entity_id, and organization_id
2. WHEN a state is successfully updated, THE States_Lambda SHALL send a message to the Embedding_Queue with entity_type 'state', entity_id, and organization_id
3. THE States_Lambda SHALL send the SQS message asynchronously (fire-and-forget) without blocking the API response, following the same pattern used by the actions Lambda
4. IF the SQS send fails, THEN THE States_Lambda SHALL log the error and continue returning the successful API response
5. THE SQS message SHALL include a fields object with the data needed for composition, OR the Embeddings_Processor SHALL fetch the state data from the database using entity_id

### Requirement 4: Embeddings Processor Extension

**User Story:** As a developer, I want the embeddings processor to handle the 'state' entity type, so that observation embeddings are generated and stored in the unified_embeddings table.

#### Acceptance Criteria

1. WHEN the Embeddings_Processor receives a message with entity_type 'state', THE Embeddings_Processor SHALL recognize it as a valid entity type
2. WHEN processing a 'state' message, THE Embeddings_Processor SHALL use the composeStateEmbeddingSource function from the Composition_Module
3. WHEN processing a 'state' message with a fields object, THE Embeddings_Processor SHALL compose the embedding source from the provided fields
4. WHEN processing a 'state' message without a fields object, THE Embeddings_Processor SHALL fetch the state data (including links, photos, and metric snapshots) from the database and compose the embedding source
5. WHEN the composed embedding source is empty, THE Embeddings_Processor SHALL skip embedding generation and log a warning
6. WHEN the embedding is generated, THE Embeddings_Processor SHALL write to the Unified_Embeddings_Table using the existing writeToUnifiedTable function

### Requirement 5: Cascade Delete for States

**User Story:** As a system, I want observation embeddings to be automatically deleted when the observation is deleted, so that the unified_embeddings table stays consistent.

#### Acceptance Criteria

1. WHEN a state is deleted from the states table, THE System SHALL cascade delete the associated embedding from the Unified_Embeddings_Table where entity_type = 'state' and entity_id = the deleted state's id
2. THE cascade delete SHALL use the same database trigger pattern (delete_unified_embedding function) used by parts, tools, actions, issues, and policies

### Requirement 6: Unified Search Extension

**User Story:** As a user, I want semantic search to include observations in results, so that I can find relevant field observations alongside other entity types.

#### Acceptance Criteria

1. WHEN performing unified semantic search, THE Unified_Search Lambda SHALL accept 'state' as a valid value in the entity_types filter array
2. WHEN no entity_types filter is specified, THE Unified_Search Lambda SHALL include 'state' embeddings in the search results alongside all other entity types
3. WHEN search results include a 'state' entity, THE result SHALL contain entity_type 'state', entity_id (state UUID), embedding_source, and similarity score

### Requirement 7: Multi-Tenant Data Isolation

**User Story:** As a system administrator, I want observation embeddings to respect organization boundaries, so that users only see observations from their own organization.

#### Acceptance Criteria

1. WHEN storing a state embedding, THE System SHALL include the organization_id from the states table
2. WHEN performing semantic search that includes state embeddings, THE System SHALL filter by the user's organization_id
3. WHEN a state's organization does not match the authenticated user's organization, THE System SHALL exclude that state's embedding from search results
