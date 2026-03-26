# Requirements Document: Maxwell Storage Location Advisor

## Introduction

Maxwell currently helps users understand entity history through the `GetEntityObservations` Action Group. This feature adds a new capability: advising users on where to store new items by leveraging semantic search across existing inventory. When a user asks "where should I put a tap and die set?", Maxwell searches tools and parts for similar items, examines their storage locations, and provides 3 reasoned suggestions. If an exact or near-exact match already exists in inventory, Maxwell flags the potential duplicate with its photo and still provides location options (co-locate, toolbox for frequent use, or distribute to reduce walking).

This feature also makes Maxwell accessible from the dashboard via the FAB, establishing a foundation for future context-free capabilities.

## Glossary

- **Maxwell**: The AWS Bedrock Agent that orchestrates conversation, selects Action Groups, and synthesizes responses for CWF users.
- **SuggestStorageLocation**: The new Action Group that searches inventory for similar items and returns their storage locations.
- **Storage_Advisor_Lambda**: The Tool Lambda backing the SuggestStorageLocation Action Group.
- **Semantic_Match**: An item returned by vector similarity search against the unified_embeddings table.
- **Near_Exact_Match**: A semantic match with very high similarity (e.g., >0.90), indicating the item may already exist in inventory.
- **Area**: A parent structure (tool record acting as a container/zone) referenced by `parent_structure_id`.
- **Storage_Location**: A free-text field describing the specific shelf, drawer, or spot within an area.

## Requirements

### Requirement 1: SuggestStorageLocation Action Group

**User Story:** As a developer, I want a new Action Group on the Maxwell Bedrock Agent that searches inventory for similar items and returns their storage locations, so that Maxwell can advise users on where to store new items.

#### Acceptance Criteria

1. THE Maxwell Bedrock Agent SHALL have a new Action Group named `SuggestStorageLocation`, backed by a Storage_Advisor_Lambda.
2. THE Action Group's OpenAPI schema SHALL include a `description` parameter (string, required) described as: "A rich natural language description of the item to search for. If the user provides only a name, expand it with your knowledge of what the item is, what it's used for, and what related items it might be stored near."
3. THE Action Group's OpenAPI schema description SHALL instruct the agent to use this tool when a user asks where to store, place, or put something, or asks for storage recommendations for a new item.
4. THE Storage_Advisor_Lambda SHALL be deployed using `deploy-lambda-with-layer.sh` with the `cwf-common-nodejs` layer.
5. THE Storage_Advisor_Lambda SHALL be registered with a resource-based policy allowing the Bedrock Agent to invoke it.

### Requirement 2: Semantic Search Across Tools and Parts

**User Story:** As a user asking where to store something, I want Maxwell to search both tools and parts in my organization's inventory, so that suggestions consider all relevant items regardless of entity type.

#### Acceptance Criteria

1. THE Storage_Advisor_Lambda SHALL generate an embedding for the provided `description` using AWS Bedrock Titan v1 (1536 dimensions).
2. THE Storage_Advisor_Lambda SHALL query the `unified_embeddings` table filtered to `entity_type IN ('tool', 'part')` and scoped to the user's `organization_id`.
3. THE Storage_Advisor_Lambda SHALL return the top 10 most similar items ordered by similarity score descending.
4. FOR each result, THE Storage_Advisor_Lambda SHALL join to the corresponding `tools` or `parts` table to retrieve: `name`, `image_url`, `parent_structure_id`, `storage_location`, and the parent structure's `name` (as `area_name`).
5. THE Storage_Advisor_Lambda SHALL return each result with: `entity_type`, `entity_id`, `name`, `similarity`, `area_name`, `storage_location`, `image_url`, and `embedding_source`.

### Requirement 3: Three Location Suggestions with Reasoning

**User Story:** As a user, I want Maxwell to suggest 3 distinct storage locations with reasoning for each, so that I can make an informed decision about where to put my item.

#### Acceptance Criteria

1. THE Maxwell system prompt SHALL instruct the agent to always provide exactly 3 storage location suggestions when the SuggestStorageLocation tool returns results.
2. THE Maxwell system prompt SHALL instruct the agent to consider these placement strategies when formulating suggestions: (a) co-locating with identical or very similar items for inventory consistency, (b) placing in a mobile or toolbox location for frequently used items, (c) distributing across different work areas to reduce walking distance when working in multiple zones.
3. EACH suggestion SHALL include the location name and a brief explanation of why that location is appropriate, referencing the specific similar items stored there.
4. WHEN the SuggestStorageLocation tool returns no results, THE Maxwell SHALL inform the user that no similar items were found in inventory and suggest they choose a location based on general organizational principles.

### Requirement 4: Duplicate Detection and Photo Display

**User Story:** As a user, I want Maxwell to alert me if the item I'm asking about may already exist in inventory and show me a photo if available, so that I can avoid creating duplicates.

#### Acceptance Criteria

1. WHEN the top search result has a very high similarity score AND its name closely matches the user's described item, THE Maxwell SHALL flag this as a potential duplicate before providing location suggestions.
2. WHEN flagging a potential duplicate, THE Maxwell SHALL include the item's name, entity type (tool or part), current storage location, and image (if `image_url` is present) using markdown image syntax `![name](url)`.
3. AFTER flagging a potential duplicate, THE Maxwell SHALL still provide 3 location suggestions, acknowledging that the user may want to: (a) co-locate with the existing item, (b) place it in a frequently-used toolbox, or (c) store it in a different work area to reduce walking.
4. THE Maxwell system prompt SHALL instruct the agent to handle duplicates naturally in conversation — not as an error, but as useful context for the storage decision.

### Requirement 5: Description Enrichment by Maxwell

**User Story:** As a user, I want to be able to just name an item without describing it in detail, and have Maxwell enrich the search query with its own knowledge, so that I get good results even with minimal input.

#### Acceptance Criteria

1. THE Action Group's `description` parameter schema SHALL instruct the agent to expand a bare item name with its knowledge of the item's purpose, common uses, related tools/materials, and typical storage companions.
2. THE Maxwell system prompt SHALL reinforce that when calling SuggestStorageLocation, the agent should compose a rich description even if the user only provides a name.
3. THE Storage_Advisor_Lambda SHALL accept any non-empty string as the `description` parameter and perform the search regardless of description length or detail.

### Requirement 6: Dashboard FAB Accessibility

**User Story:** As a user on the dashboard, I want to access Maxwell via the FAB, so that I can ask storage questions and other general queries without navigating to an entity detail page first.

#### Acceptance Criteria

1. THE GlobalMaxwellFAB component SHALL render on the dashboard page (`/` and `/dashboard` routes) in addition to entity detail pages.
2. WHEN opened from the dashboard, THE Maxwell panel SHALL operate without entity context (no entityId, entityType, or entityName in session attributes).
3. WHEN opened from the dashboard, THE Maxwell panel SHALL display general-purpose starter questions appropriate for context-free usage, such as "Where should I store a new item?" and "What tools do we have for metalworking?".
4. THE existing entity-context behavior SHALL be preserved — when opened from an entity detail page, Maxwell continues to receive full entity context as before.
5. THE `useMaxwell` hook SHALL handle the case where `sessionAttributes` has no entity context without errors.

### Requirement 7: Organization Scoping and Authorization

**User Story:** As a system administrator, I want the storage advisor to enforce the same multi-tenancy rules as the rest of the system, so that users only see inventory from their own organization.

#### Acceptance Criteria

1. THE Storage_Advisor_Lambda SHALL receive `organization_id` from `event.sessionAttributes` (forwarded by cwf-maxwell-chat).
2. THE Storage_Advisor_Lambda SHALL filter all unified_embeddings queries by `organization_id`.
3. THE Storage_Advisor_Lambda SHALL filter all tools/parts joins by `organization_id`.
4. IF `organization_id` is missing from session attributes, THE Storage_Advisor_Lambda SHALL return a structured error response.
