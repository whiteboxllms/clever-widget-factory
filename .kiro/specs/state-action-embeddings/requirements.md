# Requirements Document: State-Transition Embeddings and Action Recommendations

## Introduction

This feature evolves the unified embeddings system to support state-transition learning and asset-aware action recommendations. Currently, actions generate a single embedding that blends state, action, and outcome information. This makes it difficult to search for similar problem states or understand what actions led to successful outcomes.

The new system will decompose actions into four semantic components (state, policy, action, outcome) with separate embeddings for each. This enables users to describe their current problem state and receive ranked recommendations showing what others did in similar situations, filtered by available assets.

## Glossary

- **State_Embedding**: Vector representation of the initial problem or situation before action was taken
- **Policy_Embedding**: Vector representation of the intended approach, strategy, or plan
- **Action_Embedding**: Vector representation of the actual implementation (methods, tools, steps taken)
- **Outcome_Embedding**: Vector representation of the result or consequence of the action
- **Component_Type**: Field distinguishing embedding types (state, policy, action, outcome, or full for legacy)
- **Asset_Availability**: Boolean indicator of whether user has required tools/parts for a recommended action
- **Feasibility_Ranking**: Ordering of recommendations based on asset availability and semantic similarity
- **State_Transition_Tuple**: Complete set of four embeddings (state → policy → action → outcome) for one action
- **AI_Summarizer**: Claude Haiku service that extracts semantic components from action fields
- **Unified_Embeddings_Table**: PostgreSQL table storing all entity embeddings with pgvector extension

## Requirements

### Requirement 1: State-Transition Embedding Generation

**User Story:** As a system, I want to generate four separate embeddings per action (state, policy, action, outcome), so that users can search on specific components of the state-transition learning framework.

#### Acceptance Criteria

1. WHEN an action is created or updated, THE Embeddings_Processor SHALL generate four separate embeddings with component_type values: 'state', 'policy', 'action', 'outcome'
2. WHEN generating state-transition embeddings, THE AI_Summarizer SHALL extract each component separately from action fields (description, evidence_description, policy, observations)
3. WHEN storing state-transition embeddings, THE System SHALL link all four embeddings to the same entity_id (action UUID)
4. WHEN an action lacks sufficient data for a component, THE System SHALL generate an embedding from available fields and mark the component_type accordingly
5. WHEN existing actions have only 'full' embeddings, THE System SHALL preserve backward compatibility by treating component_type as nullable with default 'full'

### Requirement 2: Component Extraction via AI Summarization

**User Story:** As a system, I want to use AI to extract state, policy, action, and outcome components from action data, so that each embedding captures a distinct semantic concept.

#### Acceptance Criteria

1. WHEN extracting the state component, THE AI_Summarizer SHALL identify the initial situation, problem, or context from action fields
2. WHEN extracting the policy component, THE AI_Summarizer SHALL identify the intended approach, strategy, or plan from action fields
3. WHEN extracting the action component, THE AI_Summarizer SHALL identify the actual implementation including methods, tools, and steps taken
4. WHEN extracting the outcome component, THE AI_Summarizer SHALL identify the result, consequence, or learning from action fields
5. WHEN action data is insufficient for extraction, THE AI_Summarizer SHALL return a factual summary without adding interpretations or editorial commentary
6. FOR ALL component extractions, parsing then composing then parsing SHALL produce semantically equivalent text (round-trip property)

### Requirement 3: State-Based Search

**User Story:** As a user, I want to search using only my current problem state, so that I can find similar situations others have faced without mixing in action or outcome information.

#### Acceptance Criteria

1. WHEN a user submits a state query, THE Search_Service SHALL generate an embedding and search only against component_type='state' embeddings
2. WHEN state search returns results, THE System SHALL retrieve all four components (state, policy, action, outcome) for each matching action
3. WHEN displaying state search results, THE System SHALL show the complete state-transition tuple for each recommendation
4. WHEN multiple actions have similar states, THE System SHALL rank results by cosine similarity to the query embedding
5. WHEN state search finds no results above similarity threshold, THE System SHALL return an empty result set with appropriate message

### Requirement 4: Asset-Aware Recommendations

**User Story:** As a user, I want to see which recommended actions I can perform with my available tools and parts, so that I can prioritize feasible solutions.

#### Acceptance Criteria

1. WHEN returning action recommendations, THE System SHALL include a list of assets (tools and parts) used in each action
2. WHEN a user provides their available assets, THE System SHALL filter recommendations to show only actions using available assets
3. WHEN a user does not provide available assets, THE System SHALL return all recommendations with asset requirements listed
4. WHEN ranking recommendations, THE System SHALL prioritize actions where all required assets are available over actions with missing assets
5. WHEN displaying recommendations, THE System SHALL indicate feasibility status: available (all assets present), partial (some assets missing), or unavailable (many assets missing)

### Requirement 5: Feasibility Ranking

**User Story:** As a user, I want recommendations ranked by both similarity and feasibility, so that I see the most relevant and actionable solutions first.

#### Acceptance Criteria

1. WHEN calculating feasibility score, THE System SHALL combine semantic similarity with asset availability percentage
2. WHEN all required assets are available, THE System SHALL boost the recommendation's ranking
3. WHEN some required assets are missing, THE System SHALL reduce the recommendation's ranking proportionally
4. WHEN no asset information is provided, THE System SHALL rank by semantic similarity only
5. WHEN displaying ranked results, THE System SHALL show both similarity score and feasibility indicator for each recommendation

### Requirement 6: Cross-Organization Learning

**User Story:** As a user, I want to learn from actions taken by other organizations, so that I can benefit from collective knowledge while respecting privacy boundaries.

#### Acceptance Criteria

1. WHEN searching for state-transition recommendations, THE System SHALL filter results by organization_id to respect multi-tenancy
2. WHEN cross-organization sharing is enabled, THE System SHALL allow users to opt-in to sharing their action embeddings
3. WHEN displaying cross-organization results, THE System SHALL anonymize organization identifiers while preserving action details
4. WHEN an organization opts out of sharing, THE System SHALL exclude their actions from cross-organization search results
5. WHEN tracking successful outcomes, THE System SHALL record which state-action pairs led to positive results within each organization

### Requirement 7: Backward Compatibility

**User Story:** As a system maintainer, I want the new state-transition embeddings to coexist with existing full embeddings, so that we can migrate gradually without breaking existing functionality.

#### Acceptance Criteria

1. WHEN the component_type column is added, THE System SHALL make it nullable with default value 'full' for existing rows
2. WHEN existing search queries run, THE System SHALL continue to work with 'full' component_type embeddings
3. WHEN new actions are created, THE System SHALL generate both 'full' and state-transition embeddings during migration period
4. WHEN querying unified_embeddings, THE System SHALL support filtering by component_type to distinguish legacy from new embeddings
5. WHEN migrating existing actions, THE System SHALL backfill state-transition embeddings without deleting 'full' embeddings

### Requirement 8: Database Schema Extension

**User Story:** As a system, I want to extend the unified_embeddings table to support component_type, so that I can store multiple embeddings per action without creating new tables.

#### Acceptance Criteria

1. WHEN adding component_type column, THE System SHALL use VARCHAR(50) with CHECK constraint for valid values: 'full', 'state', 'policy', 'action', 'outcome'
2. WHEN storing state-transition embeddings, THE System SHALL maintain the UNIQUE constraint on (entity_type, entity_id, model_version, component_type)
3. WHEN an action is deleted, THE System SHALL cascade delete all associated embeddings regardless of component_type
4. WHEN querying embeddings, THE System SHALL support efficient filtering by (organization_id, entity_type, component_type) via composite index
5. WHEN the unified_embeddings table exceeds 10,000 rows per organization, THE System SHALL support vector index creation for performance optimization

### Requirement 9: Asset Tracking in Actions

**User Story:** As a system, I want to track which tools and parts were used in each action, so that I can provide asset-aware recommendations.

#### Acceptance Criteria

1. WHEN an action references tools or parts, THE System SHALL store asset relationships in a queryable format
2. WHEN retrieving action recommendations, THE System SHALL join with asset tables to include tool and part names
3. WHEN an asset is deleted, THE System SHALL preserve the action record but mark the asset reference as unavailable
4. WHEN displaying asset requirements, THE System SHALL show both tool names and part names with quantities if available
5. WHEN an action uses no assets, THE System SHALL return an empty asset list without failing the recommendation query

### Requirement 10: Recommendation API

**User Story:** As a frontend developer, I want a dedicated API endpoint for state-based recommendations, so that I can build user interfaces for problem-solving workflows.

#### Acceptance Criteria

1. WHEN a user queries the recommendations endpoint with a state description, THE API SHALL return ranked state-transition tuples
2. WHEN a user provides available assets, THE API SHALL filter and rank results by feasibility
3. WHEN the API returns recommendations, THE Response SHALL include: state text, policy text, action text, outcome text, similarity score, feasibility status, and required assets
4. WHEN no recommendations are found, THE API SHALL return HTTP 200 with empty results array and helpful message
5. WHEN the API encounters errors, THE System SHALL return appropriate HTTP status codes (400 for bad requests, 500 for server errors) with descriptive error messages
