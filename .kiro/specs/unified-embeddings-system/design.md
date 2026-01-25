# Design Document: Unified Embeddings System

## Overview

The Unified Embeddings System consolidates entity embeddings from multiple domain tables (parts, tools, actions, issues, policies) into a single searchable table. This enables cross-entity semantic search, certification evidence gathering, and serves as the foundation for future RAG/AI capabilities.

The system extends the existing embeddings infrastructure (SQS queue, embeddings-processor Lambda, Bedrock integration) to support additional entity types and writes to a new unified_embeddings table while maintaining backward compatibility with inline embedding columns.

## Architecture

### High-Level Flow

```
Entity CRUD Operation (Core/Actions Lambda)
  ↓
Compose embedding_source text
  ↓
Send message to SQS Queue
  ↓
embeddings-processor Lambda triggered
  ↓
Generate Titan v1 embedding via Bedrock
  ↓
Write to unified_embeddings table
  ↓
(Optional) Write to inline columns for backward compatibility
```

### Search Flow

```
User Query
  ↓
POST /api/semantic-search/unified
  ↓
Generate query embedding via Bedrock
  ↓
Vector similarity search on unified_embeddings table
  ↓
Return entity_type, entity_id, embedding_source, similarity
  ↓
Frontend fetches full entity details from appropriate endpoints
```

## Components and Interfaces

### 1. Database Schema

#### unified_embeddings Table

```sql
CREATE TABLE unified_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    embedding_source TEXT NOT NULL,
    model_version VARCHAR(50) NOT NULL DEFAULT 'titan-v1',
    embedding VECTOR(1536) NOT NULL,
    organization_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(entity_type, entity_id, model_version),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_unified_embeddings_org ON unified_embeddings(organization_id);
CREATE INDEX idx_unified_embeddings_entity_type ON unified_embeddings(entity_type);
CREATE INDEX idx_unified_embeddings_composite ON unified_embeddings(organization_id, entity_type);

-- Vector index (add when dataset exceeds 10,000 embeddings per org)
-- CREATE INDEX idx_unified_embeddings_vector ON unified_embeddings 
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Cascade delete triggers for each entity type
CREATE OR REPLACE FUNCTION delete_unified_embedding()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM unified_embeddings 
    WHERE entity_type = TG_ARGV[0] AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parts_delete_embedding
    AFTER DELETE ON parts
    FOR EACH ROW
    EXECUTE FUNCTION delete_unified_embedding('part');

CREATE TRIGGER tools_delete_embedding
    AFTER DELETE ON tools
    FOR EACH ROW
    EXECUTE FUNCTION delete_unified_embedding('tool');

CREATE TRIGGER actions_delete_embedding
    AFTER DELETE ON actions
    FOR EACH ROW
    EXECUTE FUNCTION delete_unified_embedding('action');

CREATE TRIGGER issues_delete_embedding
    AFTER DELETE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION delete_unified_embedding('issue');

CREATE TRIGGER policies_delete_embedding
    AFTER DELETE ON policy
    FOR EACH ROW
    EXECUTE FUNCTION delete_unified_embedding('policy');
```

### 2. Embedding Source Composition

Each entity type has specific logic for composing the embedding_source text:

#### Parts
```javascript
function composePartEmbeddingSource(part) {
  const parts = [
    part.name,
    part.description,
    part.policy
  ].filter(Boolean);
  
  return parts.join('. ');
}
```

#### Tools
```javascript
function composeToolEmbeddingSource(tool) {
  const parts = [
    tool.name,
    tool.description
  ].filter(Boolean);
  
  return parts.join('. ');
}
```

#### Actions
```javascript
function composeActionEmbeddingSource(action) {
  const parts = [
    action.description,
    action.state_text,
    action.summary_policy_text,
    action.observations
  ].filter(Boolean);
  
  return parts.join('. ');
}
```

#### Issues
```javascript
function composeIssueEmbeddingSource(issue) {
  const parts = [
    issue.title,
    issue.description,
    issue.resolution_notes
  ].filter(Boolean);
  
  return parts.join('. ');
}
```

#### Policies
```javascript
function composePolicyEmbeddingSource(policy) {
  const parts = [
    policy.title,
    policy.description_text
  ].filter(Boolean);
  
  return parts.join('. ');
}
```

### 3. Modified embeddings-processor Lambda

```javascript
const { generateEmbeddingV1 } = require('../shared/embeddings');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambda = new LambdaClient({ region: 'us-west-2' });

// Configuration flag for migration
const WRITE_TO_UNIFIED = process.env.WRITE_TO_UNIFIED === 'true';
const WRITE_TO_INLINE = process.env.WRITE_TO_INLINE !== 'false'; // default true

async function writeToUnifiedTable(entityType, entityId, embeddingSource, embedding, organizationId) {
  const embeddingArray = `[${embedding.join(',')}]`;
  const escapedSource = embeddingSource.replace(/'/g, "''");
  const escapedOrgId = organizationId.replace(/'/g, "''");
  
  const sql = `
    INSERT INTO unified_embeddings (entity_type, entity_id, embedding_source, model_version, embedding, organization_id)
    VALUES ('${entityType}', '${entityId}', '${escapedSource}', 'titan-v1', '${embeddingArray}'::vector, '${escapedOrgId}')
    ON CONFLICT (entity_type, entity_id, model_version) 
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

async function writeToInlineColumns(table, id, embeddingSource, embedding) {
  // Only for parts and tools (backward compatibility)
  if (!['parts', 'tools'].includes(table)) {
    return;
  }
  
  const embeddingArray = `[${embedding.join(',')}]`;
  const escapedSource = embeddingSource.replace(/'/g, "''");
  
  const sql = `
    UPDATE ${table} 
    SET search_text = '${escapedSource}', 
        search_embedding = '${embeddingArray}'::vector 
    WHERE id = '${id}'
  `;
  
  const response = await lambda.send(new InvokeCommand({
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  }));
  
  return JSON.parse(new TextDecoder().decode(response.Payload));
}

exports.handler = async (event) => {
  console.log('Processing embedding generation events');
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { entity_type, entity_id, embedding_source, organization_id } = message;
      
      console.log(`Processing ${entity_type} ${entity_id}`);
      
      // Validate entity type
      const validTypes = ['part', 'tool', 'action', 'issue', 'policy'];
      if (!validTypes.includes(entity_type)) {
        console.log(`Skipping ${entity_type} - not a valid entity type`);
        continue;
      }
      
      if (!embedding_source || !embedding_source.trim()) {
        console.log(`No embedding_source for ${entity_type} ${entity_id}`);
        continue;
      }
      
      // Generate embedding
      console.log(`Generating embedding for: ${embedding_source.substring(0, 100)}...`);
      const embedding = await generateEmbeddingV1(embedding_source);
      console.log(`Generated embedding (${embedding.length} dimensions)`);
      
      // Write to unified table
      if (WRITE_TO_UNIFIED) {
        console.log(`Writing to unified_embeddings table`);
        await writeToUnifiedTable(entity_type, entity_id, embedding_source, embedding, organization_id);
      }
      
      // Write to inline columns (backward compatibility)
      if (WRITE_TO_INLINE) {
        const table = entity_type === 'part' ? 'parts' : entity_type === 'tool' ? 'tools' : null;
        if (table) {
          console.log(`Writing to inline columns in ${table}`);
          await writeToInlineColumns(table, entity_id, embedding_source, embedding);
        }
      }
      
      console.log(`Successfully processed ${entity_type} ${entity_id}`);
    } catch (error) {
      console.error('Error processing record:', error);
      throw error; // Let SQS retry
    }
  }
  
  return { statusCode: 200, body: 'Success' };
};
```

### 4. Modified Core Lambda (Parts/Tools)

```javascript
// In PUT /parts/:id handler
if (body.name !== undefined || body.description !== undefined || body.policy !== undefined) {
  const part = result[0];
  const embeddingSource = composePartEmbeddingSource(part);
  
  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.EMBEDDINGS_QUEUE_URL,
      MessageBody: JSON.stringify({
        entity_type: 'part',
        entity_id: part.id,
        embedding_source: embeddingSource,
        organization_id: part.organization_id
      })
    }));
    console.log('Queued embedding generation for part', part.id);
  } catch (error) {
    console.error('Failed to queue embedding:', error);
    // Non-fatal - continue with response
  }
}
```

### 5. Modified Actions Lambda

```javascript
// In POST /actions handler
const action = result[0];
const embeddingSource = composeActionEmbeddingSource(action);

try {
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.EMBEDDINGS_QUEUE_URL,
    MessageBody: JSON.stringify({
      entity_type: 'action',
      entity_id: action.id,
      embedding_source: embeddingSource,
      organization_id: action.organization_id
    })
  }));
  console.log('Queued embedding generation for action', action.id);
} catch (error) {
  console.error('Failed to queue embedding:', error);
}
```

### 6. New Unified Search Lambda

```javascript
const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');
const { generateEmbeddingV1 } = require('./shared/embeddings');

exports.handler = async (event) => {
  const { httpMethod } = event;
  
  if (httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  if (httpMethod !== 'POST') {
    return error('Method not allowed', 405);
  }
  
  try {
    const authContext = getAuthorizerContext(event);
    const organizationId = authContext.organization_id;
    
    if (!organizationId) {
      return error('Unauthorized', 401);
    }
    
    const body = JSON.parse(event.body || '{}');
    const { query: searchQuery, entity_types, limit = 10 } = body;
    
    if (!searchQuery) {
      return error('query is required', 400);
    }
    
    if (limit > 100) {
      return error('limit cannot exceed 100', 400);
    }
    
    // Generate query embedding
    const queryEmbedding = await generateEmbeddingV1(searchQuery);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Build entity type filter
    const escapedOrgId = organizationId.replace(/'/g, "''");
    let entityTypeFilter = '';
    if (entity_types && Array.isArray(entity_types) && entity_types.length > 0) {
      const escapedTypes = entity_types.map(t => `'${t.replace(/'/g, "''")}'`).join(',');
      entityTypeFilter = `AND entity_type IN (${escapedTypes})`;
    }
    
    // Search unified embeddings table
    const sql = `
      SELECT 
        entity_type,
        entity_id,
        embedding_source,
        (embedding <=> '${embeddingStr}'::vector) as distance,
        (1 - (embedding <=> '${embeddingStr}'::vector)) as similarity
      FROM unified_embeddings
      WHERE organization_id = '${escapedOrgId}'
        ${entityTypeFilter}
      ORDER BY distance
      LIMIT ${limit}
    `;
    
    console.log('Executing unified semantic search');
    const results = await query(sql);
    
    console.log(`Found ${results.length} results`);
    return success({ 
      results, 
      query: searchQuery,
      entity_types: entity_types || 'all',
      count: results.length 
    });
    
  } catch (err) {
    console.error('Unified semantic search error:', err);
    return error(err.message, 500);
  }
};
```

### 7. Coverage Endpoint Lambda

```javascript
const { query } = require('./shared/db');
const { getAuthorizerContext } = require('./shared/auth');
const { success, error, corsResponse } = require('./shared/response');

exports.handler = async (event) => {
  const { httpMethod } = event;
  
  if (httpMethod === 'OPTIONS') {
    return corsResponse();
  }
  
  if (httpMethod !== 'GET') {
    return error('Method not allowed', 405);
  }
  
  try {
    const authContext = getAuthorizerContext(event);
    const organizationId = authContext.organization_id;
    
    if (!organizationId) {
      return error('Unauthorized', 401);
    }
    
    const escapedOrgId = organizationId.replace(/'/g, "''");
    
    // Get embedding counts by entity type
    const countsSql = `
      SELECT 
        entity_type,
        model_version,
        COUNT(*) as count
      FROM unified_embeddings
      WHERE organization_id = '${escapedOrgId}'
      GROUP BY entity_type, model_version
      ORDER BY entity_type, model_version
    `;
    
    const counts = await query(countsSql);
    
    // Get total entity counts for coverage percentage
    const totalsSql = `
      SELECT 
        'part' as entity_type, COUNT(*) as total FROM parts WHERE organization_id = '${escapedOrgId}'
      UNION ALL
      SELECT 'tool', COUNT(*) FROM tools WHERE organization_id = '${escapedOrgId}'
      UNION ALL
      SELECT 'action', COUNT(*) FROM actions WHERE organization_id = '${escapedOrgId}'
      UNION ALL
      SELECT 'issue', COUNT(*) FROM issues WHERE organization_id = '${escapedOrgId}'
      UNION ALL
      SELECT 'policy', COUNT(*) FROM policy WHERE organization_id = '${escapedOrgId}'
    `;
    
    const totals = await query(totalsSql);
    
    // Calculate coverage percentages
    const coverage = totals.map(t => {
      const embeddingCount = counts.find(c => c.entity_type === t.entity_type)?.count || 0;
      return {
        entity_type: t.entity_type,
        total_entities: parseInt(t.total),
        embeddings_count: parseInt(embeddingCount),
        coverage_percentage: t.total > 0 ? ((embeddingCount / t.total) * 100).toFixed(2) : 0
      };
    });
    
    return success({ 
      counts,
      coverage,
      total_embeddings: counts.reduce((sum, c) => sum + parseInt(c.count), 0)
    });
    
  } catch (err) {
    console.error('Coverage endpoint error:', err);
    return error(err.message, 500);
  }
};
```

## Data Models

### SQS Message Format

```typescript
interface EmbeddingQueueMessage {
  entity_type: 'part' | 'tool' | 'action' | 'issue' | 'policy';
  entity_id: string; // UUID
  embedding_source: string;
  organization_id: string; // UUID
}
```

### Unified Search Request

```typescript
interface UnifiedSearchRequest {
  query: string;
  entity_types?: string[]; // Optional filter
  limit?: number; // Default 10, max 100
}
```

### Unified Search Response

```typescript
interface UnifiedSearchResponse {
  results: Array<{
    entity_type: string;
    entity_id: string;
    embedding_source: string;
    distance: number;
    similarity: number;
  }>;
  query: string;
  entity_types: string[] | 'all';
  count: number;
}
```

### Coverage Response

```typescript
interface CoverageResponse {
  counts: Array<{
    entity_type: string;
    model_version: string;
    count: number;
  }>;
  coverage: Array<{
    entity_type: string;
    total_entities: number;
    embeddings_count: number;
    coverage_percentage: string;
  }>;
  total_embeddings: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Embedding Storage Completeness
*For any* embedding stored in the unified_embeddings table, the record must include entity_type, entity_id, embedding_source, model_version, embedding vector (1536 dimensions), organization_id, created_at, and updated_at fields.

**Validates: Requirements 1.2, 1.3**

### Property 2: Cascade Delete Integrity
*For any* entity (part, tool, action, issue, policy), when the entity is deleted, all associated embeddings in the unified_embeddings table must also be deleted.

**Validates: Requirements 1.4**

### Property 3: Query Embedding Generation
*For any* non-empty search query string, the system must generate a 1536-dimension embedding vector.

**Validates: Requirements 2.1**

### Property 4: Search Result Completeness
*For any* semantic search query, all returned results must include entity_type, entity_id, embedding_source, and similarity score fields.

**Validates: Requirements 2.3**

### Property 5: Organization Data Isolation
*For any* semantic search query with a given organization_id, all returned results must belong to that organization_id only.

**Validates: Requirements 2.4, 9.2, 9.3**

### Property 6: Entity Type Filtering
*For any* semantic search query with entity_types filter specified, all returned results must have entity_type values that are in the specified filter list.

**Validates: Requirements 2.5**

### Property 7: Result Ordering by Similarity
*For any* semantic search results list, each result's similarity score must be greater than or equal to the next result's similarity score (descending order).

**Validates: Requirements 2.6**

### Property 8: Result Limit Enforcement
*For any* semantic search query with a limit parameter, the number of returned results must be less than or equal to the specified limit.

**Validates: Requirements 2.7**

### Property 9: Embedding Source Composition
*For any* entity of a given type, the composed embedding_source must contain all required fields for that entity type:
- Parts: name, description, policy
- Tools: name, description
- Actions: description, state_text, summary_policy_text, observations
- Issues: title, description, resolution_notes
- Policies: title, description_text

**Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6**

### Property 10: SQS Message Triggering
*For any* entity (part, tool, action, issue, policy) creation or update that modifies embedding-relevant fields, an SQS message must be sent to the Embedding_Queue with entity_type, entity_id, embedding_source, and organization_id.

**Validates: Requirements 5.1, 5.2**

### Property 11: Embedding Dimension Consistency
*For any* SQS message processed by the embeddings-processor Lambda, the generated embedding must be exactly 1536 dimensions (Titan v1).

**Validates: Requirements 5.3**

### Property 12: Regeneration Timestamp Update
*For any* embedding that is regenerated, the updated_at timestamp must be greater than the created_at timestamp.

**Validates: Requirements 7.5**

### Property 13: Organization Cascade Delete
*For any* organization, when the organization is deleted, all associated embeddings in the unified_embeddings table must also be deleted.

**Validates: Requirements 9.4**

## Error Handling

### Embedding Generation Failures

1. **Invalid Input**: If embedding_source is empty or null, skip embedding generation and log warning
2. **Bedrock API Errors**: If Bedrock API fails, let SQS retry mechanism handle (throw error)
3. **Database Errors**: If database write fails, let SQS retry mechanism handle (throw error)
4. **Dimension Mismatch**: If generated embedding is not 1536 dimensions, log error and throw

### Search Errors

1. **Missing Query**: Return 400 error with message "query is required"
2. **Invalid Limit**: If limit > 100, return 400 error with message "limit cannot exceed 100"
3. **Unauthorized**: If organization_id missing from auth context, return 401 error
4. **Bedrock API Errors**: Return 500 error with message from Bedrock
5. **Database Errors**: Return 500 error with database error message

### Migration Errors

1. **Duplicate Embeddings**: Use UPSERT (ON CONFLICT DO UPDATE) to handle duplicates
2. **Missing Organization**: Foreign key constraint will prevent orphaned embeddings
3. **Invalid Entity Type**: Validate entity_type against allowed list before processing

## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions:

1. **Embedding Source Composition**
   - Test composePartEmbeddingSource with all fields populated
   - Test composePartEmbeddingSource with missing optional fields (policy)
   - Test composeToolEmbeddingSource with all fields
   - Test composeActionEmbeddingSource with all fields
   - Test composeIssueEmbeddingSource with all fields
   - Test composePolicyEmbeddingSource with all fields

2. **SQS Message Format**
   - Test message contains required fields
   - Test message JSON serialization

3. **API Endpoints**
   - Test POST /api/semantic-search/unified with valid query
   - Test POST /api/semantic-search/unified with missing query (400 error)
   - Test POST /api/semantic-search/unified with limit > 100 (400 error)
   - Test POST /api/semantic-search/unified with entity_types filter
   - Test GET /api/embeddings/coverage returns correct format
   - Test POST /api/embeddings/regenerate with valid entity

4. **Error Handling**
   - Test embeddings-processor with empty embedding_source
   - Test embeddings-processor with Bedrock API failure (mock)
   - Test search endpoint with unauthorized request

### Property-Based Tests

Property tests verify universal properties across all inputs using randomization. Each test should run minimum 100 iterations.

1. **Property 1: Embedding Storage Completeness**
   - Generate random embeddings with all required fields
   - Insert into unified_embeddings table
   - Verify all fields are present and correct types
   - Tag: **Feature: unified-embeddings-system, Property 1: Embedding Storage Completeness**

2. **Property 2: Cascade Delete Integrity**
   - Generate random entities (parts, tools, actions, issues, policies)
   - Create embeddings for each entity
   - Delete random entities
   - Verify associated embeddings are deleted
   - Tag: **Feature: unified-embeddings-system, Property 2: Cascade Delete Integrity**

3. **Property 3: Query Embedding Generation**
   - Generate random non-empty query strings
   - Call embedding generation function
   - Verify result is 1536-dimension vector
   - Tag: **Feature: unified-embeddings-system, Property 3: Query Embedding Generation**

4. **Property 4: Search Result Completeness**
   - Generate random search queries
   - Execute semantic search
   - Verify all results have required fields
   - Tag: **Feature: unified-embeddings-system, Property 4: Search Result Completeness**

5. **Property 5: Organization Data Isolation**
   - Create embeddings for multiple organizations
   - Execute search with specific organization_id
   - Verify all results belong to that organization
   - Tag: **Feature: unified-embeddings-system, Property 5: Organization Data Isolation**

6. **Property 6: Entity Type Filtering**
   - Create embeddings for multiple entity types
   - Execute search with entity_types filter
   - Verify all results match filter
   - Tag: **Feature: unified-embeddings-system, Property 6: Entity Type Filtering**

7. **Property 7: Result Ordering by Similarity**
   - Execute random search queries
   - Verify results are ordered by similarity (descending)
   - Tag: **Feature: unified-embeddings-system, Property 7: Result Ordering by Similarity**

8. **Property 8: Result Limit Enforcement**
   - Execute search with random limit values
   - Verify result count <= limit
   - Tag: **Feature: unified-embeddings-system, Property 8: Result Limit Enforcement**

9. **Property 9: Embedding Source Composition**
   - Generate random entities of each type
   - Compose embedding_source
   - Verify all required fields are present in composed text
   - Tag: **Feature: unified-embeddings-system, Property 9: Embedding Source Composition**

10. **Property 10: SQS Message Triggering**
    - Create/update random entities
    - Verify SQS message sent with correct fields
    - Tag: **Feature: unified-embeddings-system, Property 10: SQS Message Triggering**

11. **Property 11: Embedding Dimension Consistency**
    - Generate random SQS messages
    - Process with embeddings-processor
    - Verify embedding is 1536 dimensions
    - Tag: **Feature: unified-embeddings-system, Property 11: Embedding Dimension Consistency**

12. **Property 12: Regeneration Timestamp Update**
    - Create random embeddings
    - Regenerate embeddings
    - Verify updated_at > created_at
    - Tag: **Feature: unified-embeddings-system, Property 12: Regeneration Timestamp Update**

13. **Property 13: Organization Cascade Delete**
    - Create organizations with embeddings
    - Delete random organizations
    - Verify all associated embeddings deleted
    - Tag: **Feature: unified-embeddings-system, Property 13: Organization Cascade Delete**

### Integration Tests

1. **End-to-End Flow**
   - Create a part with name, description, policy
   - Verify SQS message sent
   - Process message (trigger embeddings-processor)
   - Verify embedding stored in unified_embeddings table
   - Execute semantic search for related query
   - Verify part appears in results

2. **Backward Compatibility**
   - Enable inline column writes (WRITE_TO_INLINE=true)
   - Create/update part
   - Verify embedding written to both inline columns and unified table
   - Execute search on existing /api/semantic-search endpoint
   - Verify results returned

3. **Migration Flow**
   - Start with inline embeddings only
   - Enable unified table writes
   - Backfill existing entities
   - Verify coverage endpoint shows 100% coverage
   - Switch search to unified table
   - Verify search results match previous results

### Test Configuration

- **Property Test Library**: fast-check (JavaScript/TypeScript)
- **Minimum Iterations**: 100 per property test
- **Test Database**: Separate test database with pgvector extension
- **Mock Services**: Mock Bedrock API for unit tests, use real Bedrock for integration tests
- **SQS Testing**: Use LocalStack or AWS SQS with test queue

## Deployment Notes

### Migration Strategy

1. **Phase 1: Deploy Infrastructure**
   - Deploy unified_embeddings table migration
   - Deploy modified embeddings-processor with WRITE_TO_UNIFIED=false, WRITE_TO_INLINE=true
   - Verify existing functionality unchanged

2. **Phase 2: Enable Dual Writes**
   - Update embeddings-processor: WRITE_TO_UNIFIED=true, WRITE_TO_INLINE=true
   - Deploy unified search Lambda (not yet exposed via API Gateway)
   - Monitor CloudWatch logs for errors

3. **Phase 3: Backfill Existing Data**
   - Run backfill script to populate unified_embeddings from existing entities
   - Monitor coverage endpoint until 100% coverage achieved
   - Verify unified search returns expected results

4. **Phase 4: Switch to Unified Search**
   - Deploy API Gateway changes to expose /api/semantic-search/unified
   - Update frontend to use new endpoint
   - Monitor search performance and accuracy

5. **Phase 5: Deprecate Inline Embeddings**
   - Update embeddings-processor: WRITE_TO_UNIFIED=true, WRITE_TO_INLINE=false
   - Monitor for any issues
   - After stable period, consider dropping inline embedding columns

### Rollback Plan

- If issues in Phase 2: Set WRITE_TO_UNIFIED=false
- If issues in Phase 4: Revert API Gateway changes, frontend uses old endpoint
- If issues in Phase 5: Set WRITE_TO_INLINE=true

### Performance Considerations

- Vector index should be added when organization has > 10,000 embeddings
- Monitor query performance via CloudWatch metrics
- Consider read replicas for high search volume
- SQS queue should handle burst traffic (default 3000 messages/second)

### Security Considerations

- Organization_id filtering enforced at database level (WHERE clause)
- Lambda authorizer provides organization_id from JWT token
- No cross-organization data leakage possible due to foreign key constraints
- Embedding_source may contain sensitive data - ensure proper access controls
