# Requirements Document: Unified Embeddings System

## Introduction

The Clever Widget Factory currently maintains embeddings in two separate patterns: inline columns (search_embedding, search_embedding_v2, search_text) in parts and tools tables, and separate per-entity embedding tables (action_embedding, exploration_embedding, policy_embedding) that are not currently used. This fragmentation prevents cross-entity semantic search and limits the system's ability to serve as institutional memory.

This specification defines a unified embeddings table that consolidates entity embeddings into a single searchable structure, enabling cross-entity semantic search, certification evidence gathering, enhanced product recommendations, and future RAG/AI capabilities. Initial scope includes parts, tools, actions, issues, and policies. Explorations will be added in a future iteration once that workflow is finalized.

**How it works:** When a user creates or updates an entity (e.g., a part), the system automatically composes a rich text description by concatenating relevant fields (name, description, policy, etc.), generates an embedding vector from that text using AWS Bedrock, and stores both the text and vector in the unified embeddings table. Later, when a user searches for "something for better sleep", the system converts their query to a vector and finds the most similar vectors in the database, returning relevant parts (banana wine with tryptophan), tools, actions, or policies.

## Glossary

- **Embedding**: A vector representation of text in high-dimensional space (1536 dimensions for Titan v1)
- **Entity**: A domain object that can be embedded (parts, tools, actions, issues, policies)
- **Entity_Type**: The type of entity being embedded (e.g., "part", "tool", "action")
- **Entity_Id**: The UUID of the specific entity instance
- **Embedding_Source**: The text that was used to generate the embedding (column name: embedding_source)
- **Model_Version**: The embedding model used (e.g., "titan-v1")
- **Organization_Id**: Multi-tenant identifier for data scoping
- **Unified_Embeddings_Table**: Central table storing all entity embeddings
- **Semantic_Search**: Vector similarity search using cosine distance
- **Pgvector**: PostgreSQL extension for vector operations
- **AWS_Bedrock**: AWS service providing Titan embedding models
- **Embedding_Queue**: SQS queue for async embedding generation

## Requirements

### Requirement 1: Unified Embeddings Table

**User Story:** As a system architect, I want a single embeddings table for all entities, so that I can perform cross-entity semantic search and simplify embedding management.

#### Acceptance Criteria

1. THE Unified_Embeddings_Table SHALL store embeddings for parts, tools, actions, issues, and policies
2. WHEN an embedding is stored, THE Unified_Embeddings_Table SHALL record entity_type, entity_id, embedding_source, model_version, embedding vector, organization_id, created_at, and updated_at
3. THE Unified_Embeddings_Table SHALL support 1536-dimension vectors (Titan v1)
4. WHEN an entity is deleted, THE Unified_Embeddings_Table SHALL cascade delete associated embeddings
5. THE Unified_Embeddings_Table SHALL include created_at and updated_at timestamps

### Requirement 2: Cross-Entity Semantic Search

**User Story:** As a user, I want to search across all entity types with a single query, so that I can find relevant information regardless of where it's stored.

#### Acceptance Criteria

1. WHEN a user submits a search query, THE System SHALL generate an embedding for the query
2. WHEN performing semantic search, THE System SHALL search across all entity types in a single database query
3. WHEN returning search results, THE System SHALL include entity_type, entity_id, embedding_source, and similarity score
4. WHEN filtering by organization, THE System SHALL only return results for the user's organization_id
5. WHERE entity_type filtering is specified, THE System SHALL restrict results to those entity types
6. THE System SHALL order results by similarity score (highest first)
7. THE System SHALL support configurable result limits (default 10, maximum 100)

### Requirement 3: Enhanced Embedding Source Composition

**User Story:** As a product manager, I want richer natural language descriptions in embeddings, so that semantic search can find products based on both physical characteristics and use cases.

**Note:** "Composing embedding_source" refers to the backend process of creating natural language descriptions from entity fields. We use two main fields: `description` (physical/anatomical characteristics) and `policy` (use case, benefits, how it fits into operations). For example, chamomile's description might be "small white flowers with yellow centers" while its policy might be "aids in sleep and relaxation, used for evening tea."

#### Acceptance Criteria

1. WHEN generating an embedding for a part, THE System SHALL compose embedding_source from name, description, and policy fields
2. WHEN generating an embedding for a part that is a storage container, THE System SHALL include natural language in the policy field indicating it can store other items
3. WHEN generating an embedding for a tool, THE System SHALL compose embedding_source from name and description fields using natural language
4. WHEN generating an embedding for an action, THE System SHALL compose embedding_source from description, state_text, summary_policy_text, and observations fields
5. WHEN generating an embedding for an issue, THE System SHALL compose embedding_source from title, description, and resolution_notes fields
6. WHEN generating an embedding for a policy, THE System SHALL compose embedding_source from title and description_text fields
7. THE System SHALL store the composed text in the embedding_source column for debugging and regeneration purposes
8. THE System SHALL avoid including categorical labels or codes in embedding_source unless they provide semantic meaning

### Requirement 4: Backward Compatibility

**User Story:** As a system administrator, I want existing semantic search endpoints to continue working during migration, so that users experience no service disruption.

#### Acceptance Criteria

1. WHEN the unified embeddings table is deployed, THE System SHALL maintain existing inline embedding columns
2. WHEN existing semantic search endpoints are called, THE System SHALL continue to function using inline embeddings
3. THE System SHALL support gradual migration from inline embeddings to unified embeddings
4. WHEN both inline and unified embeddings exist, THE System SHALL prefer unified embeddings
5. THE System SHALL provide a migration flag to control which embedding source is used

### Requirement 5: Embedding Generation and Updates

**User Story:** As a developer, I want automatic embedding generation when entities are created or updated, so that search results stay current.

#### Acceptance Criteria

1. WHEN a part or tool is created or updated, THE System SHALL send a message to the existing Embedding_Queue (SQS) with entity_type, entity_id, and composed embedding_source text
2. WHEN an action, issue, or policy is created or updated, THE System SHALL send a message to the Embedding_Queue with entity_type, entity_id, and composed embedding_source text
3. WHEN the embeddings-processor Lambda processes a queue message, THE System SHALL generate a Titan v1 embedding (1536 dimensions)
4. WHEN storing embeddings, THE embeddings-processor SHALL write to the Unified_Embeddings_Table with entity_type, entity_id, embedding_source, model_version ('titan-v1'), embedding vector, and organization_id
5. WHEN an embedding generation fails, THE System SHALL log the error and rely on SQS retry mechanism
6. THE embeddings-processor Lambda SHALL continue to support inline column updates for backward compatibility during migration
7. THE System SHALL use a configuration flag to control whether embeddings are written to inline columns, unified table, or both

### Requirement 6: Performance and Indexing

**User Story:** As a user, I want fast semantic search results, so that I can quickly find relevant information.

#### Acceptance Criteria

1. THE Unified_Embeddings_Table SHALL have an index on organization_id for fast filtering
2. THE Unified_Embeddings_Table SHALL have an index on entity_type for fast filtering
3. THE Unified_Embeddings_Table SHALL have a composite index on (organization_id, entity_type)
4. THE Unified_Embeddings_Table SHALL have a vector index for similarity search when dataset exceeds 10,000 embeddings per organization
5. WHEN performing semantic search, THE System SHALL use organization_id and entity_type indexes to filter before vector comparison
6. THE System SHALL complete semantic search queries in under 500ms for datasets under 10,000 embeddings

### Requirement 7: Data Quality and Observability

**User Story:** As a system administrator, I want to track embedding quality and regenerate embeddings when needed, so that search quality remains high.

#### Acceptance Criteria

1. WHEN storing an embedding, THE System SHALL record the exact embedding_source used for generation
2. WHEN storing an embedding, THE System SHALL record the model_version used
3. THE System SHALL provide an API endpoint to regenerate embeddings for a specific entity
4. THE System SHALL provide an API endpoint to regenerate embeddings for all entities of a type
5. WHEN regenerating embeddings, THE System SHALL update the updated_at timestamp
6. THE System SHALL log embedding generation failures with entity_type and entity_id
7. THE System SHALL provide metrics on embedding coverage (percentage of entities with embeddings)

### Requirement 8: Search Result Enrichment

**User Story:** As a frontend developer, I want search results to include entity identifiers, so that I can fetch full entity details as needed.

**Note:** Search results return entity_type and entity_id, allowing the frontend to fetch complete entity data from the appropriate endpoint (e.g., GET /api/parts/:id). This avoids data duplication and ensures consistency with the source tables.

#### Acceptance Criteria

1. WHEN returning search results, THE System SHALL include entity_type, entity_id, embedding_source, and similarity score
2. WHEN a frontend needs full entity details, THE System SHALL provide the entity_id for fetching from the appropriate API endpoint
3. THE Unified_Embeddings_Table SHALL NOT duplicate entity data that exists in source tables
4. THE System SHALL rely on existing API endpoints (parts, tools, actions, issues, policies) for fetching complete entity details

### Requirement 9: Multi-Tenant Data Isolation

**User Story:** As a system administrator, I want strict organization-based data isolation, so that users only see embeddings from their organization.

#### Acceptance Criteria

1. WHEN storing an embedding, THE System SHALL require organization_id
2. WHEN performing semantic search, THE System SHALL filter by the user's organization_id
3. THE System SHALL prevent cross-organization embedding access
4. WHEN an organization is deleted, THE System SHALL cascade delete all associated embeddings
5. THE Unified_Embeddings_Table SHALL have a foreign key constraint on organization_id

### Requirement 10: API Endpoints

**User Story:** As a frontend developer, I want clear API endpoints for semantic search, so that I can integrate search functionality into the UI.

#### Acceptance Criteria

1. THE System SHALL provide a POST /api/semantic-search/unified endpoint
2. WHEN calling the unified search endpoint, THE System SHALL accept query, entity_types (optional array), and limit (optional) parameters
3. WHEN calling the unified search endpoint, THE System SHALL return results with entity_type, entity_id, embedding_source, and similarity score
4. THE System SHALL provide a POST /api/embeddings/regenerate endpoint
5. WHEN calling the regenerate endpoint, THE System SHALL accept entity_type and entity_id parameters
6. THE System SHALL provide a GET /api/embeddings/coverage endpoint to report embedding statistics
7. WHEN calling the coverage endpoint, THE System SHALL return counts by entity_type and model_version

### Requirement 11: Observability and Testing

**User Story:** As a developer, I want to verify the unified embeddings system is working correctly, so that I can catch issues early.

#### Acceptance Criteria

1. THE System SHALL log embedding generation events with entity_type, entity_id, and success/failure status
2. THE System SHALL log semantic search queries with query text, result count, and execution time
3. THE coverage endpoint SHALL report total embeddings count, embeddings by entity_type, and percentage of entities with embeddings
4. THE System SHALL provide a test script that verifies end-to-end flow (create entity → embedding generated → searchable)
5. WHEN an embedding generation fails, THE System SHALL log the error with entity details and error message
6. THE System SHALL track SQS queue metrics (messages sent, processed, failed) via CloudWatch
