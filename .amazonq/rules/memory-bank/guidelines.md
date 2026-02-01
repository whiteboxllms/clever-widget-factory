# Clever Widget Factory - Development Guidelines

## Code Quality Standards

### Code Formatting
- **Indentation**: 2 spaces for JavaScript/TypeScript, consistent throughout codebase
- **Line Length**: Pragmatic approach - break long lines for readability, especially in SQL queries
- **Semicolons**: Used consistently in TypeScript/JavaScript
- **Quotes**: Single quotes for strings in JavaScript, double quotes in JSX/TSX attributes
- **Trailing Commas**: Used in multi-line arrays and objects for cleaner diffs

### Structural Conventions
- **File Organization**: Group related functionality in dedicated directories (components, hooks, services, lib)
- **Export Patterns**: Named exports preferred over default exports for better refactoring
- **Module Structure**: Clear separation between business logic (services), UI (components), and utilities (lib)
- **Test Collocation**: Tests live in `__tests__` directories or alongside source files with `.test.ts` suffix

### Naming Standards
- **Files**: kebab-case for directories, PascalCase for React components, camelCase for utilities
- **Variables**: camelCase for variables and functions, PascalCase for classes and React components
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for configuration objects
- **Database Fields**: snake_case for all database columns and table names
- **API Endpoints**: kebab-case in URLs (e.g., `/action-implementation-updates`)
- **Boolean Variables**: Prefix with `is`, `has`, `should`, `can` (e.g., `isActive`, `hasPermission`)

### Documentation Standards
- **JSDoc Comments**: Used extensively in Lambda functions and complex utilities
- **Inline Comments**: Explain "why" not "what", especially for business logic
- **Property-Based Test Documentation**: Clear property statements in test descriptions
- **README Files**: Present in major directories explaining purpose and usage
- **Type Definitions**: Comprehensive TypeScript interfaces with descriptive property names

## Semantic Patterns

### React Component Patterns

#### Store IDs, Not Objects (TanStack Query Cache Pattern)
```typescript
// ❌ BAD - Creates stale snapshot
const [editingAction, setEditingAction] = useState<Action | null>(null);

// ✅ GOOD - Always fresh from cache
const [editingActionId, setEditingActionId] = useState<string | null>(null);
const editingAction = actions.find(a => a.id === editingActionId);
```
**Frequency**: Critical pattern used in Actions.tsx and should be used in all entity dialogs

#### Context Providers Pattern
```typescript
// Wrap app with multiple context providers for cross-cutting concerns
<AuthProvider>
  <OrganizationProvider>
    <AppSettingsProvider>
      <TooltipProvider>
        {/* App content */}
      </TooltipProvider>
    </AppSettingsProvider>
  </OrganizationProvider>
</AuthProvider>
```
**Frequency**: Standard pattern in App.tsx, used for authentication, organization, and settings

#### Protected Routes Pattern
```typescript
// Route protection with role-based access control
<Route path="/admin" element={
  <AdminRoute>
    <AdminPage />
  </AdminRoute>
} />
```
**Frequency**: Used throughout routing configuration for access control

### Backend Lambda Patterns

#### Organization-Based Filtering
```javascript
// Always filter by organization from authorizer context
const authContext = getAuthorizerContext(event);
const organizationId = authContext.organization_id;
const hasDataReadAll = hasPermission(authContext, 'data:read:all');

// Build organization filter
const orgFilter = buildOrganizationFilter(authContext, 'table_alias');
if (orgFilter.condition) {
  whereClauses.push(orgFilter.condition);
}
```
**Frequency**: Used in every Lambda endpoint that queries multi-tenant data

#### SQL Query Construction with Security
```javascript
// Use formatSqlValue for SQL injection prevention
const sql = `
  INSERT INTO table (field1, field2, organization_id)
  VALUES (
    ${formatSqlValue(body.field1)},
    ${formatSqlValue(body.field2)},
    ${formatSqlValue(organizationId)}
  )
  RETURNING *
`;
```
**Frequency**: Standard pattern for all database operations in Lambda functions

#### CORS Headers Pattern
```javascript
// Define CORS headers early for all responses including OPTIONS
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Handle preflight OPTIONS immediately
if (httpMethod === 'OPTIONS') {
  return { statusCode: 200, headers, body: '' };
}
```
**Frequency**: Used in every Lambda function handler

#### Embedding Queue Pattern
```javascript
// Queue embedding generation after entity creation/update
const embeddingSource = composeToolEmbeddingSource(tool);
if (embeddingSource && embeddingSource.trim()) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: EMBEDDINGS_QUEUE_URL,
    MessageBody: JSON.stringify({
      entity_type: 'tool',
      entity_id: toolId,
      embedding_source: embeddingSource,
      organization_id: organizationId
    })
  }));
}
```
**Frequency**: Used after CREATE and UPDATE operations for searchable entities

### Testing Patterns

#### Property-Based Testing
```typescript
// Test universal properties rather than specific scenarios
describe('Property 17: Data Mutability', () => {
  it('should allow updating exploration notes without affecting exploration status', async () => {
    // Property: For any exploration, updating notes should not change status
    // Test implementation validates the property holds
  });
});
```
**Frequency**: Used extensively in exploration system tests, recommended for all feature tests

#### Mock Service Pattern
```typescript
// Mock external services at module level
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));
```
**Frequency**: Standard pattern in all unit tests that interact with external services

#### Test Scenario Objects
```typescript
// Define reusable test scenarios with expected outcomes
export const testScenarios: TestScenario[] = [
  {
    name: 'Happy Path - Complete Flow',
    description: 'Tests complete flow from start to finish',
    exchanges: [
      {
        userMessage: 'Input',
        expectedNextStage: 'stage_name',
        expectedResponsePattern: /pattern/
      }
    ]
  }
];
```
**Frequency**: Used for complex workflow testing, especially in Five Whys agent tests

### Service Layer Patterns

#### Service Class Structure
```typescript
export class ExplorationService {
  async createExploration(data: CreateExplorationData) {
    return apiService.post('/explorations', data);
  }
  
  async updateExploration(id: string, updates: Partial<Exploration>) {
    return apiService.put(`/explorations/${id}`, updates);
  }
}
```
**Frequency**: Standard pattern for all service classes (actionService, explorationService, policyService)

#### Query Rewriting Pattern
```javascript
// Transform natural language to structured queries
class QueryRewriter {
  async rewrite(rawQuery) {
    // Try LLM extraction first
    const llmResult = await this._extractWithLLM(rawQuery);
    if (llmResult) return llmResult;
    
    // Fallback to regex-based extraction
    return this._extractWithRegex(rawQuery);
  }
}
```
**Frequency**: Used in semantic search pipeline for query processing

## Internal API Usage Patterns

### TanStack Query Hooks
```typescript
// Standard query hook pattern
const { data: actions, isLoading, error } = useQuery({
  queryKey: ['actions', organizationId],
  queryFn: () => apiService.get('/actions'),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutation hook pattern with optimistic updates
const mutation = useMutation({
  mutationFn: (data) => apiService.post('/actions', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['actions'] });
  }
});
```
**Frequency**: Used in every custom hook that fetches or mutates data

### API Service Pattern
```typescript
// Centralized API client with automatic error handling
export const apiService = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }
};
```
**Frequency**: Used for all HTTP requests, never use fetch directly

### Authorization Context Pattern
```javascript
// Extract and validate authorization context in Lambda
const authContext = getAuthorizerContext(event);
const organizationId = authContext.organization_id;

if (!organizationId) {
  console.error('❌ ERROR: organization_id missing from authorizer context');
  return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
}
```
**Frequency**: First step in every authenticated Lambda endpoint

## Code Idioms

### Null Coalescing and Optional Chaining
```typescript
// Use optional chaining and nullish coalescing
const userName = user?.profile?.name ?? 'Unknown User';
const count = data?.items?.length ?? 0;
```
**Frequency**: Used extensively throughout TypeScript code

### Array Destructuring and Spread
```typescript
// Destructure arrays and objects for cleaner code
const [first, ...rest] = items;
const updated = { ...original, field: newValue };
```
**Frequency**: Common pattern in React hooks and data transformations

### Template Literals for SQL
```javascript
// Use template literals for readable SQL queries
const sql = `
  SELECT 
    a.*,
    om.full_name as assigned_to_name
  FROM actions a
  LEFT JOIN organization_members om ON a.assigned_to = om.cognito_user_id
  WHERE ${whereClause}
  ORDER BY a.updated_at DESC
`;
```
**Frequency**: Standard pattern for all SQL query construction

### Early Returns for Guard Clauses
```typescript
// Use early returns to reduce nesting
if (!data) return null;
if (error) return <ErrorMessage error={error} />;
if (isLoading) return <Spinner />;

return <DataDisplay data={data} />;
```
**Frequency**: Used in most React components and functions

### Async/Await Over Promises
```typescript
// Prefer async/await over .then() chains
async function fetchData() {
  try {
    const response = await apiService.get('/data');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
```
**Frequency**: Standard pattern for all asynchronous operations

## Common Annotations

### TypeScript Type Annotations
```typescript
// Explicit type annotations for function parameters and returns
function processAction(action: Action): ProcessedAction {
  // Implementation
}

// Interface definitions for data structures
interface Action {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  assigned_to?: string;
}
```
**Frequency**: Used throughout TypeScript codebase for type safety

### JSDoc Comments in Lambda Functions
```javascript
/**
 * Extracts query components using LLM
 * @private
 * @param {string} query - The query to process
 * @returns {Promise<QueryComponents|null>} Extracted components or null if failed
 */
async _extractWithLLM(query) {
  // Implementation
}
```
**Frequency**: Used in all Lambda utility functions and complex methods

### React Component Props Types
```typescript
interface ActionCardProps {
  action: Action;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function ActionCard({ action, onEdit, onDelete, className }: ActionCardProps) {
  // Component implementation
}
```
**Frequency**: Every React component has explicit props interface

### Vitest Test Annotations
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should perform expected behavior', async () => {
    // Test implementation
  });
  
  afterEach(() => {
    // Cleanup
  });
});
```
**Frequency**: Standard structure for all test files

## Kiro Development Workflow

### Architecture Change Protocol

**ALL architecture changes require explicit user approval BEFORE implementation.**

#### What Qualifies as an Architecture Change:
1. **Data Structure Changes**: New tables/columns, field name changes, indexes, constraints
2. **API/Interface Changes**: New endpoints, request/response format changes, new Lambda functions
3. **Pattern Deviations**: Different state management, new libraries, error handling changes
4. **Cross-Cutting Concerns**: Logging, security, performance, multi-tenancy changes

#### Architecture Change Steps:
1. **IDENTIFY**: State clearly "This requires an architecture change"
2. **DOCUMENT**: Describe current architecture and what will change
3. **PROPOSE**: Present 2-3 options with pros/cons, recommend one with reasoning
4. **WAIT**: Do NOT implement until user explicitly approves
5. **DOCUMENT**: Record decision, trade-offs, and update documentation

### Root Cause Investigation Protocol

**NO CODE CHANGES until root cause is identified, documented, and approved.**

#### Investigation Process:
1. **GATHER FACTS**: Ask for symptoms, error messages, logs, reproduction steps, environment
2. **ANALYZE**: Read code, trace execution, identify multiple possible causes
3. **DOCUMENT HYPOTHESES**: Present 2-3 root cause hypotheses with evidence
4. **WAIT FOR AGREEMENT**: User must confirm root cause before proceeding
5. **PROPOSE SOLUTION**: Explain how solution addresses confirmed root cause

#### What NOT to Do:
- ❌ Make assumptions about user behavior
- ❌ Implement speculative fixes without confirming root cause
- ❌ Modify shared components without discussion
- ❌ Add complex workarounds before understanding the issue
- ❌ Make multiple changes at once

### Database Migration Protocol

**All database changes MUST follow this two-step process:**

1. **Execute Migration**:
```bash
cat migrations/your-migration.sql | jq -Rs '{sql: .}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

2. **Verify Changes**:
```bash
# For schema changes
echo '{"sql": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''your_table'\'';"}' | \
aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out response.json && cat response.json | jq
```

**Never assume a migration succeeded without verification.**

### Design Decision Authority

**Follow specs exactly - do not interpret, extend, or "improve" the design.**

When implementing features:
- Follow the spec exactly as written
- Ask before changing field names (even if inconsistent)
- Ask before reordering fields (composition order may matter)
- Ask before adding features (even if obviously useful)
- Ask before making "improvements" (may break intended behavior)

If spec is unclear: **STOP, ASK, WAIT** for explicit direction.

## Architecture Patterns from Kiro Specs

### Unified Embeddings Pattern
- **Use unified_embeddings table** for all entity types (parts, tools, actions, issues, policies)
- **Do NOT create per-entity embedding tables** (enables cross-entity search)
- **Field name**: Use `embedding_source` (not `search_text`) for embedding text
- **Composition**: Concatenate relevant fields with natural language
- **No embedding_type categorization** (semantic overlap makes it harmful)
- **Multi-tenancy**: Always filter by organization_id with foreign key constraints

### Analysis System Pattern (Scoring Refactor)
- **Generic container**: `analyses` table stores metadata (prompt_id, ai_response)
- **Separate scores**: `analysis_scores` table for numeric values (-2 to +2)
- **Separate attributes**: `analysis_attributes` table for categorical data
- **Context linking**: `analysis_contexts` table links to source entities
- **Cascade deletes**: ON DELETE CASCADE for all child tables

#### Schema Design
```sql
-- Container for analysis metadata
CREATE TABLE analyses (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  created_by uuid,
  prompt_id uuid NOT NULL,
  ai_response jsonb,
  created_at timestamp DEFAULT NOW()
);

-- Numeric scores (-2 to +2)
CREATE TABLE analysis_scores (
  id uuid PRIMARY KEY,
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE,
  score_name text NOT NULL,
  score numeric NOT NULL,
  reason text NOT NULL,
  how_to_improve text,
  UNIQUE(analysis_id, score_name)
);

-- Categorical attributes
CREATE TABLE analysis_attributes (
  id uuid PRIMARY KEY,
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  attribute_values text[] NOT NULL,
  UNIQUE(analysis_id, attribute_name)
);

-- Context links to source entities
CREATE TABLE analysis_contexts (
  id uuid PRIMARY KEY,
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE,
  context_service text NOT NULL,  -- 'action_score', 'issue_score'
  context_id uuid NOT NULL,
  UNIQUE(analysis_id, context_service, context_id)
);
```

#### API Pattern
```javascript
POST /api/analyses
{
  "organization_id": "org-uuid",
  "scores": [
    { "score_name": "quality", "score": 2, "reason": "...", "how_to_improve": "..." }
  ],
  "analysis_attributes": [
    { "attribute_name": "likely_root_cause", "attribute_values": ["equipment failure"] }
  ],
  "contexts": [
    { "context_service": "action_score", "context_id": "action-uuid" }
  ]
}
```

#### Query Pattern
```sql
-- Get scores for an action
SELECT s.score_name, s.score, s.reason, s.how_to_improve
FROM analyses e
JOIN analysis_contexts ec ON ec.analysis_id = e.id
JOIN analysis_scores s ON s.analysis_id = e.id
WHERE ec.context_service = 'action_score' 
  AND ec.context_id = 'action-uuid';
```

### Lambda Deployment Pattern
```bash
# Deploy with layer (automatically loads DB_PASSWORD from .env.local)
./scripts/deploy/deploy-lambda-with-layer.sh <function-name> <lambda-name>

# Wire API Gateway endpoints (includes CORS)
cd lambda/<function-name>
./wire-api-gateway.sh
```

## Best Practices Summary

### Security
- Always use `formatSqlValue` or parameterized queries to prevent SQL injection
- Never trust request body for `organization_id` - always use authorizer context
- Validate all user inputs before processing
- Use JWT tokens for authentication, validate on every request
- Implement proper CORS headers on all API endpoints

### Performance
- Use TanStack Query for automatic caching and background refetching
- Implement pagination for large data sets (limit/offset pattern)
- Use database indexes on frequently queried columns
- Batch database operations when possible
- Lazy load components and routes with React.lazy()
- Add vector indexes when embeddings exceed 10,000 per organization

### Error Handling
- Always wrap async operations in try/catch blocks
- Log errors with context (user ID, organization ID, operation)
- Return user-friendly error messages, log technical details
- Use proper HTTP status codes (400 for client errors, 500 for server errors)
- Implement error boundaries in React for graceful degradation
- Let SQS retry mechanism handle transient failures (throw error)

### Testing
- Write property-based tests for universal behaviors (minimum 100 iterations)
- Mock external services at module level
- Test error cases and edge conditions
- Tag property tests: **Feature: feature-name, Property N: Property Name**
- Aim for high coverage on business logic, not just lines of code
- Use descriptive test names that explain the expected behavior

### Code Organization
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Use service layer for API interactions
- Separate business logic from presentation
- Group related files in feature directories
- Keep AWS-specific details in infrastructure/adapters, not domain code
