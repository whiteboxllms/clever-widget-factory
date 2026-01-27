# Design Document: State-Based Action Recommendations

## Overview

This design implements state-based search and asset-aware action recommendations by generating dedicated embeddings from the `actions.description` field. The system will enable users to describe their current problem state and receive ranked recommendations showing what others did in similar situations, filtered by available tools and parts.

### Key Design Decisions

1. **Leverage Existing Infrastructure**: Extend the unified_embeddings table with an `embedding_type` field rather than creating new tables
2. **Simple State Extraction**: Use `actions.description` field directly as the embedding source (no AI summarization needed initially)
3. **Asset Tracking via Checkouts**: Leverage existing `checkouts` table to track tool usage in actions
4. **Dual Embedding Strategy**: Generate both 'full' and 'action_existing_state' embeddings for each action
5. **New Lambda Function**: Create dedicated `cwf-action-recommendations` Lambda for state-based search with asset filtering

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  - State query input                                            │
│  - Available assets selection                                   │
│  - Ranked recommendations display                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ POST /api/action-recommendations
                 │ { query, available_tools, available_parts }
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│          cwf-action-recommendations Lambda                       │
│  - Generate query embedding                                     │
│  - Search state embeddings                                      │
│  - Fetch action details + assets                                │
│  - Calculate feasibility scores                                 │
│  - Rank by similarity + feasibility                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Vector similarity search
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              unified_embeddings Table                            │
│  - entity_type = 'action'                                       │
│  - embedding_type = 'action_existing_state'                     │
│  - embedding_source = actions.description                       │
│  - embedding (1536-dim vector)                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Join on entity_id
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    actions Table                                 │
│  - id (UUID)                                                    │
│  - description (state text)                                     │
│  - evidence_description                                         │
│  - policy                                                       │
│  - observations                                                 │
│  - status                                                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Join on action_id
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  checkouts Table                                 │
│  - action_id                                                    │
│  - tool_id                                                      │
│  - is_returned                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Embedding Generation** (when action created/updated):
   - Extract `actions.description` field
   - Generate embedding via Bedrock Titan v1
   - Store in unified_embeddings with `embedding_type='action_existing_state'`
   - Also generate 'full' embedding from all action fields (existing behavior)

2. **State-Based Search**:
   - User submits state query + optional available assets
   - Generate query embedding
   - Search unified_embeddings WHERE entity_type='action' AND embedding_type='action_existing_state'
   - Join with actions table to get full details
   - Join with checkouts table to get required tools
   - Calculate feasibility scores based on asset availability
   - Rank by combined similarity + feasibility score
   - Return recommendations with state, action details, outcome, and asset requirements

## Components and Interfaces

### 1. Database Schema Extension

**Migration: Add embedding_type to unified_embeddings**

```sql
-- Add embedding_type column (nullable for backward compatibility)
ALTER TABLE unified_embeddings 
ADD COLUMN IF NOT EXISTS embedding_type VARCHAR(50);

-- Update UNIQUE constraint to include embedding_type
ALTER TABLE unified_embeddings 
DROP CONSTRAINT IF EXISTS unified_embeddings_entity_type_entity_id_model_version_key;

ALTER TABLE unified_embeddings 
ADD CONSTRAINT unified_embeddings_unique_embedding 
UNIQUE (entity_type, entity_id, model_version, embedding_type);

-- Add index for efficient filtering by embedding_type
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_type 
ON unified_embeddings(embedding_type);

-- Add composite index for state-based search
CREATE INDEX IF NOT EXISTS idx_unified_embeddings_state_search 
ON unified_embeddings(organization_id, entity_type, embedding_type) 
WHERE entity_type = 'action' AND embedding_type = 'action_existing_state';

-- Add comment
COMMENT ON COLUMN unified_embeddings.embedding_type IS 
'Distinguishes embedding types: NULL (legacy full embeddings), action_existing_state (state-only embeddings)';
```

### 2. Embeddings Processor Extension

**Module**: `lambda/embeddings-processor/index.js`

**Changes**:
- Extend `processMessage` function to generate dual embeddings for actions
- Add `generateStateEmbedding` function

```javascript
/**
 * Generate state embedding from actions.description field
 * @param {Object} action - Action entity
 * @param {string} action.id - Action UUID
 * @param {string} action.description - State text
 * @param {string} action.organization_id - Organization UUID
 * @returns {Promise<void>}
 */
async function generateStateEmbedding(action) {
  if (!action.description || action.description.trim() === '') {
    console.log(`Skipping state embedding for action ${action.id} - no description`);
    return;
  }
  
  const embeddingSource = action.description.trim();
  
  // Generate embedding
  const embedding = await generateEmbeddingV1(embeddingSource);
  
  // Write to unified_embeddings with embedding_type='action_existing_state'
  await writeToUnifiedTableWithType(
    'action',
    action.id,
    embeddingSource,
    embedding,
    action.organization_id,
    'action_existing_state'
  );
}

/**
 * Write embedding to unified_embeddings with embedding_type
 */
async function writeToUnifiedTableWithType(
  entityType, 
  entityId, 
  embeddingSource, 
  embedding, 
  organizationId,
  embeddingType = null
) {
  const embeddingArray = `[${embedding.join(',')}]`;
  const escapedSource = embeddingSource.replace(/'/g, "''");
  const escapedOrgId = organizationId.replace(/'/g, "''");
  const escapedEntityType = entityType.replace(/'/g, "''");
  const escapedEntityId = entityId.replace(/'/g, "''");
  const embeddingTypeClause = embeddingType 
    ? `'${embeddingType.replace(/'/g, "''")}'` 
    : 'NULL';
  
  const sql = `
    INSERT INTO unified_embeddings (
      entity_type, 
      entity_id, 
      embedding_source, 
      model_version, 
      embedding, 
      organization_id,
      embedding_type
    )
    VALUES (
      '${escapedEntityType}', 
      '${escapedEntityId}', 
      '${escapedSource}', 
      'titan-v1', 
      '${embeddingArray}'::vector, 
      '${escapedOrgId}',
      ${embeddingTypeClause}
    )
    ON CONFLICT (entity_type, entity_id, model_version, embedding_type) 
    DO UPDATE SET 
      embedding_source = EXCLUDED.embedding_source,
      embedding = EXCLUDED.embedding,
      updated_at = NOW()
  `;
  
  const response = await lambda.send(new InvokeCommand({
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  }));
  
  return JSON.parse(new TextDecoder().decode(response.Payload));
}
```

**Integration Point**: Modify the action processing logic to:
1. Check if `actions.description` is non-empty (not null, not empty string, not whitespace-only)
2. If description exists: Generate state embedding (embedding_type='action_existing_state')
3. Always generate full embedding from all action fields (embedding_type=NULL, existing behavior)

**Validation Logic**:
```javascript
function shouldGenerateStateEmbedding(action) {
  return action.description && 
         action.description.trim().length > 0;
}
```

### 3. Action Recommendations Lambda

**New Lambda**: `lambda/action-recommendations/index.js`

**Purpose**: Dedicated endpoint for state-based action recommendations with asset-aware ranking

**API Endpoint**: `POST /api/action-recommendations`

**Request Body**:
```json
{
  "query": "Battery voltage is 5V, won't start",
  "available_tools": ["uuid1", "uuid2"],
  "available_parts": ["uuid3", "uuid4"],
  "limit": 10,
  "similarity_threshold": 0.7
}
```

**Response Body**:
```json
{
  "recommendations": [
    {
      "action_id": "uuid",
      "state": "Battery voltage low, engine won't start",
      "action_details": {
        "description": "...",
        "evidence_description": "...",
        "policy": "...",
        "observations": "...",
        "status": "completed"
      },
      "similarity_score": 0.92,
      "feasibility": {
        "status": "available",
        "required_tools": [
          {"id": "uuid1", "name": "Multimeter", "available": true}
        ],
        "required_parts": [
          {"id": "uuid3", "name": "12V Battery", "available": true}
        ],
        "availability_percentage": 100
      },
      "combined_score": 0.96
    }
  ],
  "total_results": 5
}
```

**Core Logic**:

```javascript
async function searchStateBasedRecommendations(
  queryText, 
  availableTools, 
  availableParts, 
  organizationId,
  limit = 10,
  similarityThreshold = 0.7
) {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbeddingV1(queryText);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  // 2. Search state embeddings
  const searchSql = `
    SELECT 
      ue.entity_id as action_id,
      ue.embedding_source as state,
      (1 - (ue.embedding <=> '${embeddingStr}'::vector)) as similarity
    FROM unified_embeddings ue
    WHERE ue.organization_id = '${organizationId}'
      AND ue.entity_type = 'action'
      AND ue.embedding_type = 'action_existing_state'
      AND (1 - (ue.embedding <=> '${embeddingStr}'::vector)) >= ${similarityThreshold}
    ORDER BY similarity DESC
    LIMIT ${limit * 2}
  `;
  
  const stateMatches = await query(searchSql);
  
  // 3. Fetch full action details + required assets
  const actionIds = stateMatches.map(m => m.action_id);
  const actions = await fetchActionsWithAssets(actionIds, organizationId);
  
  // 4. Calculate feasibility scores
  const recommendations = actions.map(action => {
    const stateMatch = stateMatches.find(m => m.action_id === action.id);
    const feasibility = calculateFeasibility(
      action.required_tools,
      action.required_parts,
      availableTools,
      availableParts
    );
    
    // Combined score: 70% similarity + 30% feasibility
    const combinedScore = (stateMatch.similarity * 0.7) + (feasibility.percentage * 0.3);
    
    return {
      action_id: action.id,
      state: stateMatch.state,
      action_details: {
        description: action.description,
        evidence_description: action.evidence_description,
        policy: action.policy,
        observations: action.observations,
        status: action.status
      },
      similarity_score: stateMatch.similarity,
      feasibility,
      combined_score: combinedScore
    };
  });
  
  // 5. Sort by combined score and limit
  recommendations.sort((a, b) => b.combined_score - a.combined_score);
  return recommendations.slice(0, limit);
}

function calculateFeasibility(requiredTools, requiredParts, availableTools, availableParts) {
  const toolsAvailable = requiredTools.filter(t => availableTools.includes(t.id));
  const partsAvailable = requiredParts.filter(p => availableParts.includes(p.id));
  
  const totalRequired = requiredTools.length + requiredParts.length;
  const totalAvailable = toolsAvailable.length + partsAvailable.length;
  
  const percentage = totalRequired > 0 ? totalAvailable / totalRequired : 1.0;
  
  let status;
  if (percentage === 1.0) status = 'available';
  else if (percentage >= 0.5) status = 'partial';
  else status = 'unavailable';
  
  return {
    status,
    required_tools: requiredTools.map(t => ({
      ...t,
      available: availableTools.includes(t.id)
    })),
    required_parts: requiredParts.map(p => ({
      ...p,
      available: availableParts.includes(p.id)
    })),
    availability_percentage: Math.round(percentage * 100)
  };
}

async function fetchActionsWithAssets(actionIds, organizationId) {
  if (actionIds.length === 0) return [];
  
  const actionIdList = actionIds.map(id => `'${id}'`).join(',');
  
  // Fetch actions with their required tools via checkouts
  const sql = `
    SELECT 
      a.id,
      a.description,
      a.evidence_description,
      a.policy,
      a.observations,
      a.status,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'type', 'tool'
          )
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) as required_tools,
      '[]'::json as required_parts
    FROM actions a
    LEFT JOIN checkouts c ON c.action_id = a.id
    LEFT JOIN tools t ON t.id = c.tool_id
    WHERE a.id IN (${actionIdList})
      AND a.organization_id = '${organizationId}'
    GROUP BY a.id
  `;
  
  return await query(sql);
}
```

### 4. Migration Script for Existing Actions

**Script**: `scripts/backfill-action-state-embeddings.sh`

```bash
#!/bin/bash
# Backfill state embeddings for existing actions

# Get auth token
source scripts/get-auth-token.sh

# Trigger backfill via embeddings-regenerate Lambda
curl -X POST \
  "${API_BASE_URL}/api/embeddings/regenerate" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "action",
    "embedding_type": "action_existing_state",
    "batch_size": 100
  }'
```

**Lambda Extension**: Extend `cwf-embeddings-regenerate` to support `embedding_type` parameter

## Data Models

### unified_embeddings Table (Extended)

```sql
CREATE TABLE unified_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    embedding_source TEXT NOT NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'titan-v1',
    embedding VECTOR(1536) NOT NULL,
    organization_id UUID NOT NULL,
    embedding_type VARCHAR(50),  -- NEW: 'action_existing_state', NULL (legacy)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_type, entity_id, model_version, embedding_type),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CHECK (entity_type IN ('part', 'tool', 'action', 'issue', 'policy'))
);
```

### Action-Asset Relationships

**Existing**: `checkouts` table tracks tool usage
```sql
checkouts (
  id UUID,
  tool_id UUID,
  action_id UUID,
  user_id UUID,
  is_returned BOOLEAN,
  organization_id UUID
)
```

**Note**: Parts usage is tracked via `parts_history.action_id` (optional field)

## Error Handling

### Embedding Generation Errors

1. **Empty Description**: Skip state embedding generation, log warning
2. **Bedrock API Failure**: Retry with exponential backoff (3 attempts)
3. **Database Write Failure**: Log error, continue processing other actions

### Search Errors

1. **No Results**: Return empty array with HTTP 200
2. **Invalid Query**: Return HTTP 400 with descriptive message
3. **Missing Organization Context**: Return HTTP 401
4. **Database Query Failure**: Return HTTP 500 with generic error message

### Asset Tracking Errors

1. **Missing Asset Data**: Return empty asset lists, don't fail recommendation
2. **Deleted Assets**: Mark as unavailable in response
3. **Invalid Asset IDs**: Filter out invalid IDs, continue with valid ones

## Testing Strategy

### Unit Tests

1. **Embedding Generation**:
   - Test state embedding generation from actions.description
   - Test handling of null/empty descriptions
   - Test dual embedding generation (full + state)

2. **Feasibility Calculation**:
   - Test 100% availability (all assets present)
   - Test partial availability (some assets missing)
   - Test 0% availability (no assets present)
   - Test empty asset lists

3. **Combined Scoring**:
   - Test similarity-only ranking (no assets provided)
   - Test feasibility boost for available assets
   - Test feasibility penalty for missing assets

### Integration Tests

1. **End-to-End Search**:
   - Create action with description
   - Generate state embedding
   - Search with similar query
   - Verify action returned in results

2. **Asset-Aware Ranking**:
   - Create multiple actions with different tool requirements
   - Search with specific available tools
   - Verify actions with available tools ranked higher

3. **Cross-Organization Isolation**:
   - Create actions in different organizations
   - Verify search only returns actions from user's organization

### Property-Based Tests

(To be defined after prework analysis)



## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: State Embedding Source Matches Description

*For any* action with a non-empty description field, when a state embedding is generated, the embedding_source in unified_embeddings should exactly match the actions.description field value.

**Validates: Requirements 1.1**

### Property 2: Description Update Triggers Regeneration

*For any* action, when the description field is updated, the state embedding should be regenerated and the new embedding_source should match the updated description.

**Validates: Requirements 1.4**

### Property 3: Embedding Dimensions Are Consistent

*For any* state embedding generated, the embedding vector should have exactly 1536 dimensions (Titan v1 model).

**Validates: Requirements 1.5**

### Property 4: Search Results Include Complete Action Data

*For any* state-based search result, the returned action record should include all required fields: description, evidence_description, policy, observations, and status.

**Validates: Requirements 2.2**

### Property 5: Search Results Contain Required Fields

*For any* state-based search result, the response should include: state text, action details, similarity score, and feasibility information.

**Validates: Requirements 2.3**

### Property 6: Results Ordered By Similarity

*For any* state-based search with multiple results, the results should be ordered in descending order by similarity score (highest similarity first).

**Validates: Requirements 2.4**

### Property 7: Asset Information Included in Recommendations

*For any* action recommendation where the action has associated checkouts, the response should include the list of required tools with their names.

**Validates: Requirements 3.1**

### Property 8: Asset Filtering Works Correctly

*For any* state-based search with provided available_tools, all returned recommendations should only include actions that use tools from the available_tools list.

**Validates: Requirements 3.2**

### Property 9: Asset Availability Affects Ranking

*For any* two actions with similar semantic similarity scores, the action with higher asset availability percentage should rank higher in the combined score.

**Validates: Requirements 3.4**

### Property 10: Feasibility Status Matches Availability

*For any* action recommendation, the feasibility status should be:
- 'available' when availability_percentage = 100
- 'partial' when 50 <= availability_percentage < 100
- 'unavailable' when availability_percentage < 50

**Validates: Requirements 3.5**

### Property 11: Combined Score Formula

*For any* action recommendation, the combined_score should equal (similarity_score * 0.7) + (availability_percentage * 0.3).

**Validates: Requirements 4.1**

### Property 12: Proportional Feasibility Penalty

*For any* action recommendation, when X% of required assets are available, the feasibility component of the combined score should be X/100.

**Validates: Requirements 4.3**

### Property 13: Response Includes Both Scores

*For any* action recommendation, the response should include both similarity_score and feasibility information with availability_percentage.

**Validates: Requirements 4.5**

### Property 14: Multi-Tenancy Isolation

*For any* state-based search, the results should only include actions where organization_id matches the user's organization_id from the authorizer context.

**Validates: Requirements 5.1**

### Property 15: Asset Relationships Are Queryable

*For any* action that has checkouts, querying the checkouts table by action_id should return the associated tool_id values.

**Validates: Requirements 6.1**

### Property 16: Tool Names Fetched From Tools Table

*For any* action recommendation with required tools, the tool names should be fetched from the tools table via join on tool_id.

**Validates: Requirements 6.2**

### Property 17: Asset Response Structure

*For any* action recommendation, the required_tools array should contain objects with id, name, type, and available fields.

**Validates: Requirements 6.4**

### Property 18: State Embeddings Use Correct Entity Type

*For any* state embedding stored in unified_embeddings, the entity_type field should be 'action' and entity_id should match the action's UUID.

**Validates: Requirements 8.1**

### Property 19: Model Version Consistency

*For any* state embedding stored in unified_embeddings, the model_version field should be 'titan-v1'.

**Validates: Requirements 8.3**

### Property 20: Embedding Type Distinguishes State Embeddings

*For any* state embedding stored in unified_embeddings, the embedding_type field should be 'action_existing_state'.

**Validates: Requirements 10.1**

### Property 21: Dual Embeddings Per Action

*For any* action with a non-empty description, there should exist two rows in unified_embeddings: one with embedding_type='action_existing_state' and one with embedding_type=NULL (full embedding).

**Validates: Requirements 10.4**

### Property 22: Search Results Indicate Embedding Type

*For any* state-based search result, the response metadata should indicate that the match came from embedding_type='action_existing_state'.

**Validates: Requirements 10.5**

