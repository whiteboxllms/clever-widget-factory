# Requirements Document: Maxwell Unified Search

## Introduction

Maxwell is the Bedrock Agent (Claude 3.5 Sonnet) that serves as the AI assistant for Clever Widget Factory. Currently Maxwell has three action groups: `GetEntityObservations`, `SearchFinancialRecords`, and `SuggestStorageLocation`. Each searches a narrow slice of the `unified_embeddings` table — financial records only, or parts/tools only.

The `unified_embeddings` table already contains embeddings for nine entity types: part, tool, action, issue, policy, action_existing_state, state, financial_record, and state_space_model. This feature creates a single `UnifiedSearch` action group that searches across all entity types in one call, returning rich joined results with per-type diversity quotas. This replaces and consolidates `SearchFinancialRecords` and `SuggestStorageLocation` into one powerful cross-domain search tool, enabling Maxwell to answer questions that span multiple entity types (e.g., "What is my coconut yield breakeven point?" pulling assets, expenses, observations, and policies together).

## Glossary

- **Maxwell**: The AWS Bedrock Agent (Claude 3.5 Sonnet) that orchestrates conversation, selects action groups, and synthesizes responses for CWF users
- **Unified_Search_Lambda**: The new `cwf-maxwell-unified-search` Lambda function backing the `UnifiedSearch` action group
- **Unified_Embeddings_Table**: The `unified_embeddings` table storing embedding vectors (Titan V1, 1536 dimensions) for all entity types, scoped by `organization_id`
- **Entity_Type**: One of the nine types stored in `unified_embeddings`: part, tool, action, issue, policy, action_existing_state, state, financial_record, state_space_model
- **Per_Type_Quota**: The maximum number of results returned per entity type to ensure diversity across types in the result set
- **Source_Table**: The domain-specific table (e.g., `parts`, `tools`, `actions`, `financial_records`, `policy`) that holds the full record for a given entity
- **State_Links**: The `state_links` table that provides many-to-many linking between `states` and entities, used to retrieve descriptive text for financial records and other state-linked entities
- **Embedding_Source**: The `embedding_source` column in `unified_embeddings` containing the natural language text used to generate the embedding vector
- **Maxwell_Chat_Lambda**: The `cwf-maxwell-chat` Lambda that proxies user messages to the Bedrock Agent with prompt routing and session management
- **Organization_Members**: The `organization_members` table containing user profiles with `full_name` and `cognito_user_id`

## Requirements

### Requirement 1: Cross-Entity Semantic Search

**User Story:** As a user, I want Maxwell to search across all entity types in a single call, so that I get a complete picture when asking cross-domain questions like "What is my coconut yield breakeven point?"

#### Acceptance Criteria

1. THE Unified_Search_Lambda SHALL accept a `query` parameter (required) containing the user's search text for semantic matching against the Unified_Embeddings_Table
2. THE Unified_Search_Lambda SHALL generate an embedding vector for the `query` parameter using Bedrock Titan V1 (1536 dimensions)
3. THE Unified_Search_Lambda SHALL search the Unified_Embeddings_Table across all Entity_Types, filtered by the requesting user's `organization_id`
4. THE Unified_Search_Lambda SHALL rank results by cosine similarity between the query embedding and stored embeddings
5. THE Unified_Search_Lambda SHALL return each result with: `entity_type`, `entity_id`, `embedding_source`, `similarity` score, and a `details` object containing type-specific fields from the joined Source_Table

### Requirement 2: Per-Type Diversity Quotas

**User Story:** As a user, I want search results to include a balanced mix of entity types, so that one dominant type (e.g., financial records) does not crowd out relevant results from other types.

#### Acceptance Criteria

1. THE Unified_Search_Lambda SHALL accept an optional `per_type_limit` parameter (integer, default 3) controlling the maximum number of results returned per Entity_Type
2. WHEN results are gathered, THE Unified_Search_Lambda SHALL return at most `per_type_limit` results for each Entity_Type, selecting the highest-similarity matches within each type
3. THE Unified_Search_Lambda SHALL return the combined results sorted by similarity score descending across all types
4. THE Unified_Search_Lambda SHALL include a `result_counts` object in the response showing how many results were returned for each Entity_Type

### Requirement 3: Optional Entity Type Filtering

**User Story:** As a user, I want Maxwell to optionally narrow searches to specific entity types when it knows what it needs, so that targeted questions get focused results.

#### Acceptance Criteria

1. THE Unified_Search_Lambda SHALL accept an optional `entity_types` parameter (comma-separated string) to restrict the search to specific Entity_Types
2. WHEN `entity_types` is provided, THE Unified_Search_Lambda SHALL search only the specified types in the Unified_Embeddings_Table
3. WHEN `entity_types` is omitted, THE Unified_Search_Lambda SHALL search across all Entity_Types
4. IF an invalid Entity_Type value is provided in the `entity_types` parameter, THEN THE Unified_Search_Lambda SHALL ignore the invalid value and search only the valid types

### Requirement 4: Rich Result Joining

**User Story:** As a user, I want Maxwell to return rich details for each result so it can give informed answers without needing follow-up tool calls.

#### Acceptance Criteria

1. WHEN a result has `entity_type` of `part`, THE Unified_Search_Lambda SHALL join with the `parts` table and return: `name`, `description`, `category`, `storage_location`, `current_quantity`, `unit`, `cost_per_unit`, `sellable`
2. WHEN a result has `entity_type` of `tool`, THE Unified_Search_Lambda SHALL join with the `tools` table and return: `name`, `description`, `category`, `storage_location`, `status`
3. WHEN a result has `entity_type` of `action`, THE Unified_Search_Lambda SHALL join with the `actions` table and return: `title`, `description`, `status`, `created_at`, `completed_at`
4. WHEN a result has `entity_type` of `issue`, THE Unified_Search_Lambda SHALL join with the `issues` table and return: `description`, `issue_type`, `status`, `resolution_notes`
5. WHEN a result has `entity_type` of `policy`, THE Unified_Search_Lambda SHALL join with the `policy` table and return: `title`, `description_text`, `status`, `effective_from`
6. WHEN a result has `entity_type` of `financial_record`, THE Unified_Search_Lambda SHALL join with the `financial_records` table and the linked `states` table (via `state_links`) and return: `description` (from state_text), `amount`, `transaction_date`, `payment_method` (derived from funding_source/external_source_note or category_tag), `created_by_name` (resolved from `organization_members`)
7. WHEN a result has `entity_type` of `state`, `action_existing_state`, or `state_space_model`, THE Unified_Search_Lambda SHALL return the `embedding_source` text as the primary detail

### Requirement 5: Bedrock Agent Configuration

**User Story:** As a developer, I want the Bedrock Agent configured with the new unified search action group, so that the agent can invoke it for cross-domain questions.

#### Acceptance Criteria

1. THE Bedrock Agent SHALL have an OpenAPI schema registered for the Unified_Search_Lambda defining the `/unifiedSearch` endpoint with all accepted parameters, their types, descriptions, and the response schema
2. THE OpenAPI schema description SHALL instruct the agent to use this tool as the primary search tool for any question requiring information from the organization's knowledge base, including expenses, inventory, actions, issues, policies, and observations
3. THE Bedrock Agent SHALL have the `UnifiedSearch` action group configured to invoke the Unified_Search_Lambda
4. THE Unified_Search_Lambda SHALL have a resource-based policy allowing the Bedrock Agent to invoke it
5. THE Unified_Search_Lambda SHALL be deployed with the `cwf-common-nodejs` layer for shared utilities (db, sqlUtils) and include the shared embeddings module

### Requirement 6: Consolidation of Existing Action Groups

**User Story:** As a developer, I want to retire the `SearchFinancialRecords` and `SuggestStorageLocation` action groups after the unified search is deployed, so that Maxwell has a single, consistent search interface.

#### Acceptance Criteria

1. WHEN the UnifiedSearch action group is deployed and verified, THE Bedrock Agent SHALL have the `SearchFinancialRecords` action group removed
2. WHEN the UnifiedSearch action group is deployed and verified, THE Bedrock Agent SHALL have the `SuggestStorageLocation` action group removed
3. THE Maxwell system prompt SHALL be updated to reference the UnifiedSearch tool instead of the removed action groups
4. THE Unified_Search_Lambda SHALL preserve the financial record presentation instructions (amount sign convention, Philippine Peso formatting, referenced_records tag) currently provided by the Maxwell_Expenses_Lambda

### Requirement 7: Error Handling

**User Story:** As a user, I want Maxwell to handle errors gracefully during unified search, so that I get a helpful response instead of a failure.

#### Acceptance Criteria

1. IF the embedding generation fails for the query, THEN THE Unified_Search_Lambda SHALL return a 500 status with a descriptive error message
2. IF the database query fails, THEN THE Unified_Search_Lambda SHALL return a 500 status with a generic error message and log the detailed error
3. IF the `organization_id` is missing from session attributes, THEN THE Unified_Search_Lambda SHALL return a 400 status indicating missing organization context
4. IF the required `query` parameter is missing or empty, THEN THE Unified_Search_Lambda SHALL return a 400 status indicating the missing parameter
5. IF a Source_Table join fails for a specific entity (e.g., orphaned embedding), THEN THE Unified_Search_Lambda SHALL omit that result from the response and continue processing remaining results

### Requirement 8: Response Instructions for Agent

**User Story:** As a developer, I want the unified search response to include context-aware instructions so the agent knows how to present different entity types to the user.

#### Acceptance Criteria

1. THE Unified_Search_Lambda SHALL return an `instructions` field in the response body containing guidance for the agent on how to present the mixed-type results
2. THE instructions SHALL tell the agent to group results by entity type when presenting them to the user
3. THE instructions SHALL include the financial record presentation conventions (amount sign convention: positive = expense, negative = income; currency: Philippine Peso ₱; include referenced_records tag)
4. THE instructions SHALL tell the agent to mention the entity type and similarity context for each result so the user understands where the information comes from
5. WHEN no results are found, THE Unified_Search_Lambda SHALL return instructions suggesting the user try different search terms
