# Design Document: Action Updates to States Migration

## Overview

This design document specifies the technical approach for migrating from the legacy `action_implementation_updates` table to the modern states system. The migration consolidates state capture functionality, eliminates duplicate code, and enables richer action updates with photos.

### Terminology Approach

The system uses "state" terminology throughout the codebase, with "observation" only in user-facing text:

**Code (Backend + Frontend)**:
- Tables: `states`, `state_photos`, `state_links`
- API Endpoints: `/states`
- Components: `AddState.tsx`, `StatesInline.tsx`
- Fields: `state_text`, `captured_by`, `captured_at`
- Query Keys: `statesQueryKey`
- Lambda: `cwf-states-lambda`

**User-Facing Text Only**:
- UI Labels: "Add Observation", "Observations"
- Button Text: "Save Observation"
- Toast Messages: "Observation saved"
- Help Text: "Add your observation..."

**Key Principle**: Code uses "state", UI text uses "observation". No field name mapping needed.

### System Capabilities

The states system is more flexible than the legacy system:
- Supports photo-first state capture with optional text
- Can link to any entity type (not just actions)
- Provides a reusable component pattern for inline states
- Aligns with RL concepts (Actions, Policy, State, Rewards)
- Uses "observation" only in user-facing text for clarity

## Design Principles

1. **Zero Data Loss**: All existing action_implementation_updates must be preserved with exact timestamps and user references
2. **Backward Compatibility**: System remains operational during migration with no downtime
3. **Reusable Components**: Create StatesInline component that any entity dialog can use
4. **Cache Consistency**: TanStack Query cache must stay synchronized with server state
5. **Atomic Operations**: Database migrations use transactions with rollback capability
6. **Consistent Terminology**: Use "state" in code, "observation" in UI text only

## Architecture

### Current State (Before Migration)

**Action Implementation Updates System**:
- Table: `action_implementation_updates` (text-only updates)
- Endpoints: `/action_implementation_updates` (GET, POST, PUT, DELETE)
- Component: `ActionImplementationUpdates.tsx`
- Query Key: `actionImplementationUpdatesQueryKey`
- Count: Cached in `actions.implementation_update_count`

**States System**:
- Tables: `states`, `state_photos`, `state_links`
- Endpoints: `/states` (maps to `cwf-states-lambda`)
- Lambda: `cwf-states-lambda` (queries states tables)
- Components: `AddState.tsx` (full-page form)
- Query Key: `statesQueryKey`
- Features: Photo-first with optional text, polymorphic links
- UI Text: Uses "observation" for user-friendliness

### Target State (After Migration)

**Unified States System**:
- Tables: `states`, `state_photos`, `state_links` (contain all data)
- Endpoints: `/states` (handles all entity types including actions)
- Lambda: `cwf-states-lambda` (handles all entity types)
- Components:
  - `StatesInline.tsx` (reusable inline component)
  - `AddState.tsx` (full-page form, updated for optional photos)
- Query Keys: `statesQueryKey` (with entity filters)
- Count: Calculated from `state_links` where `entity_type='action'`
- UI Text: Uses "observation" for user-friendliness

**Removed**:
- Table: `action_implementation_updates` (dropped after migration)
- Endpoints: `/action_implementation_updates` (removed from Lambda)
- Component: `ActionImplementationUpdates.tsx` (deleted)
- Query Key: `actionImplementationUpdatesQueryKey` (removed)

## Architecture Decisions

### Decision 1: Make Photos Optional in States System

**Context**: The current states system requires at least one photo, but action_implementation_updates are text-only. To migrate existing data and support text-only updates, we need to make photos optional.

**Decision**: Modify validation to require at least one of: `state_text` OR `photos`. Both frontend and backend validation will enforce this rule.

**Rationale**:
- Preserves all existing action_implementation_updates data (text-only)
- Maintains flexibility for photo-first workflows
- Prevents empty submissions
- Aligns with user expectations for quick text updates

**Alternatives Considered**:
- Require photos always: Would lose existing data or require dummy photos
- Allow empty submissions: Would create meaningless records

### Decision 2: Use StatesInline Component Pattern

**Context**: Action dialogs currently use ActionImplementationUpdates component. We need a reusable pattern for displaying states inline within any entity dialog.

**Decision**: Create `StatesInline.tsx` component that accepts `entity_type` and `entity_id` props and handles all CRUD operations inline without navigation.

**Rationale**:
- Reusable across all entity types (actions, parts, tools, issues)
- Keeps users in context (no navigation away from dialog)
- Consistent UX pattern across the application
- Simplifies future entity state tracking

**Alternatives Considered**:
- Navigate to AddObservation page: Breaks user flow, loses context
- Duplicate code per entity: Maintenance burden, inconsistent UX

### Decision 3: Calculate implementation_update_count from state_links

**Context**: Actions table has a cached `implementation_update_count` column that currently counts action_implementation_updates records.

**Decision**: Calculate count from `state_links` table where `entity_type='action'` and update cache on state create/delete operations.

**Rationale**:
- Single source of truth (state_links table)
- Automatic consistency through database triggers or Lambda logic
- Supports future expansion to other entity types
- Eliminates need for separate counter table

**Alternatives Considered**:
- Keep separate counter: Requires dual writes, risk of inconsistency
- Remove counter entirely: Would require JOIN on every action query (performance impact)

### Decision 4: Preserve Original Timestamps During Migration

**Context**: Audit trails and compliance require accurate historical timestamps.

**Decision**: Copy `created_at`, `updated_at`, and `updated_by` fields directly from action_implementation_updates to states table during migration.

**Rationale**:
- Maintains audit trail integrity
- Supports compliance requirements
- Enables accurate historical analysis
- Prevents confusion about when updates actually occurred

**Alternatives Considered**:
- Use migration timestamp: Would lose historical accuracy
- Store original timestamp in metadata: Complicates queries and display

### Decision 5: Atomic Cutover with Backward Compatibility

**Context**: System must remain operational during migration with zero downtime.

**Decision**: Implement migration in phases:
1. Deploy states system with optional photos
2. Run data migration script
3. Deploy StatesInline component alongside existing component
4. Verify data integrity
5. Remove legacy code and endpoints
6. Drop legacy table

**Rationale**:
- Zero downtime during migration
- Rollback capability at each phase
- Data verification before cleanup
- Gradual risk reduction

**Alternatives Considered**:
- Big bang migration: High risk, potential downtime
- Dual write to both systems: Complex, risk of inconsistency

## Components and Interfaces

### StatesInline Component

**Purpose**: Reusable component for displaying and managing states inline within entity dialogs.

**Props**:
```typescript
interface StatesInlineProps {
  entity_type: 'action' | 'part' | 'tool' | 'issue' | 'policy';
  entity_id: string;
  onCountChange?: (count: number) => void; // For updating parent state
}
```

**Features**:
- Displays list of states linked to the entity
- Inline add form (text + optional photos)
- Edit and delete operations
- Real-time cache updates
- Loading and error states
- Empty state messaging

**UI Layout**:
- Compact list view with thumbnails
- Expandable photo gallery
- Inline text editing
- Delete confirmation
- Add button with inline form

**Query Integration**:
```typescript
const { data: states } = useQuery({
  queryKey: ['states', { entity_type, entity_id }],
  queryFn: () => fetchStates({ entity_type, entity_id })
});
```

### AddObservation Page Updates

**Current Behavior**: Requires at least one photo before submission.

**Updated Behavior**: Requires at least one of: `observation_text` OR `photos`.

**Validation Logic**:
```typescript
const canSubmit = observationText.trim().length > 0 || photos.length > 0;
```

**Error Messages**:
- "Please add observation text or at least one photo"
- Displayed when user attempts to submit empty form

### Dialog Integration Points

**UnifiedActionDialog**:
- Replace `<ActionImplementationUpdates />` with `<StatesInline entity_type="action" entity_id={action.id} />`
- Remove import of ActionImplementationUpdates
- Add import of StatesInline

**ActionScoreDialog**:
- Replace `<ActionImplementationUpdates />` with `<StatesInline entity_type="action" entity_id={action.id} />`
- Remove import of ActionImplementationUpdates
- Add import of StatesInline

## Data Models and Mapping

### Source Schema: action_implementation_updates

```sql
CREATE TABLE action_implementation_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by UUID NOT NULL REFERENCES organization_members(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Target Schema: states + state_links

```sql
CREATE TABLE states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state_text TEXT,
  captured_by UUID NOT NULL REFERENCES organization_members(user_id),
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE state_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Field Mapping

| Source Field | Target Field | Transformation |
|--------------|--------------|----------------|
| `id` | `states.id` | Direct copy (preserve UUID) |
| `action_id` | `state_links.entity_id` | Copy to link record |
| N/A | `state_links.entity_type` | Set to 'action' |
| `update_text` | `states.state_text` | Direct copy |
| `updated_by` | `states.captured_by` | Direct copy |
| `created_at` | `states.created_at` | Direct copy (preserve timestamp) |
| `created_at` | `states.captured_at` | Direct copy (preserve timestamp) |
| `updated_at` | `states.updated_at` | Direct copy (preserve timestamp) |
| N/A | `states.organization_id` | JOIN with actions table |

### Migration SQL

```sql
-- Insert into states table
INSERT INTO states (
  id,
  organization_id,
  state_text,
  captured_by,
  captured_at,
  created_at,
  updated_at
)
SELECT
  aiu.id,
  a.organization_id,
  aiu.update_text,
  aiu.updated_by,
  aiu.created_at,
  aiu.created_at,
  aiu.updated_at
FROM action_implementation_updates aiu
JOIN actions a ON aiu.action_id = a.id;

-- Insert into state_links table
INSERT INTO state_links (
  state_id,
  entity_type,
  entity_id,
  created_at
)
SELECT
  aiu.id,
  'action',
  aiu.action_id,
  aiu.created_at
FROM action_implementation_updates aiu;
```

## Migration Strategy

### Phase 1: Prepare States System (Backend)

**Objective**: Update states Lambda to support optional photos.

**Tasks**:
1. Update `createState` validation to require `state_text` OR `photos` (not both required)
2. Update `updateState` validation to maintain same rule
3. Add validation error messages
4. Deploy updated Lambda
5. Test with API calls (text-only, photos-only, both, neither)

**Validation**: Verify that text-only states can be created via API.

### Phase 2: Update Frontend Validation

**Objective**: Update AddObservation page to support optional photos.

**Tasks**:
1. Update validation logic in AddObservation.tsx
2. Update submit button disabled state
3. Update error messages
4. Test text-only submission
5. Test photo-only submission
6. Test empty submission (should fail)

**Validation**: Verify that users can submit text-only observations.

### Phase 3: Run Data Migration

**Objective**: Migrate all action_implementation_updates to states system.

**Tasks**:
1. Create migration script (SQL file)
2. Test migration on development database
3. Verify record counts match
4. Verify timestamps are preserved
5. Verify organization_id is set correctly
6. Run migration on production database
7. Create backup of action_implementation_updates table

**Validation**: 
- Count of states records = count of action_implementation_updates
- All timestamps match
- All text content matches
- All user references match

### Phase 4: Create StatesInline Component

**Objective**: Build reusable inline states component.

**Tasks**:
1. Create StatesInline.tsx component
2. Implement list view with photos
3. Implement inline add form
4. Implement edit functionality
5. Implement delete functionality
6. Add TanStack Query integration
7. Add loading and error states
8. Test with different entity types

**Validation**: Component displays states and supports CRUD operations.

### Phase 5: Replace ActionImplementationUpdates

**Objective**: Switch action dialogs to use StatesInline.

**Tasks**:
1. Update UnifiedActionDialog to use StatesInline
2. Update ActionScoreDialog to use StatesInline
3. Test action dialog functionality
4. Verify implementation_update_count updates correctly
5. Deploy frontend changes

**Validation**: Action dialogs display states correctly and counts update.

### Phase 6: Remove Legacy Code

**Objective**: Clean up legacy endpoints and code.

**Tasks**:
1. Remove action_implementation_updates endpoints from Lambda
2. Remove ActionImplementationUpdates.tsx component
3. Remove actionImplementationUpdatesQueryKey
4. Remove all references from codebase
5. Drop action_implementation_updates table
6. Deploy final cleanup

**Validation**: No references to action_implementation_updates remain in codebase.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Validation Properties

**Property 1: Text-only observations are valid**

*For any* observation with non-empty state_text and no photos, the system should accept and save the observation successfully.

**Validates: Requirements 1.1**

**Property 2: Photo-only observations are valid**

*For any* observation with at least one photo and no state_text, the system should accept and save the observation successfully.

**Validates: Requirements 1.2**

**Property 3: At least one field required**

*For any* observation submission, the system should require at least one of: state_text OR photos to be present.

**Validates: Requirements 1.5**

### Migration Data Integrity Properties

**Property 4: One-to-one migration mapping**

*For any* action_implementation_update record, the migration should create exactly one state record with a corresponding state_link record.

**Validates: Requirements 2.1**

**Property 5: Timestamp preservation**

*For any* migrated state, the created_at and updated_at timestamps should exactly match the original action_implementation_update timestamps.

**Validates: Requirements 2.2, 9.1, 9.2**

**Property 6: Link creation correctness**

*For any* migrated state, the state_links record should have entity_type='action' and entity_id equal to the original action_id.

**Validates: Requirements 2.3**

**Property 7: Text content preservation**

*For any* migrated state, the state_text should exactly match the original update_text.

**Validates: Requirements 2.4**

**Property 8: User reference preservation**

*For any* migrated state, the captured_by field should exactly match the original updated_by field.

**Validates: Requirements 2.5, 9.3**

**Property 9: Organization assignment correctness**

*For any* migrated state, the organization_id should match the organization_id of the linked action.

**Validates: Requirements 2.6**

### Component Behavior Properties

**Property 10: Entity filtering correctness**

*For any* entity_type and entity_id combination, the StatesInline component should display only states that have a state_link with matching entity_type and entity_id.

**Validates: Requirements 3.1, 3.8**

**Property 11: Required fields display**

*For any* displayed state, the UI should show state_text, photos, captured_by name, and captured_at timestamp.

**Validates: Requirements 3.2**

**Property 12: Inline creation with linking**

*For any* state created through StatesInline, the system should create both the state record and a state_link record pointing to the current entity.

**Validates: Requirements 3.3**

**Property 13: Multi-format support**

*For any* state created through StatesInline, the system should accept both text-only and photo-only submissions.

**Validates: Requirements 3.4**

**Property 14: List refresh without dialog close**

*For any* state creation, update, or deletion in StatesInline, the states list should refresh while the parent dialog remains open.

**Validates: Requirements 3.5, 3.6, 3.7**

**Property 15: Action state retrieval**

*For any* action, the system should retrieve all states that have a state_link with entity_type='action' and entity_id=action.id.

**Validates: Requirements 4.3**

**Property 16: Count increment on creation**

*For any* action, when a state is created with a link to that action, the action's implementation_update_count should increase by 1.

**Validates: Requirements 4.4**

**Property 17: Count decrement on deletion**

*For any* action, when a state linked to that action is deleted, the action's implementation_update_count should decrease by 1.

**Validates: Requirements 4.5**

### Count Calculation Properties

**Property 18: Count calculation correctness**

*For any* action, the implementation_update_count should equal the number of state_links records where entity_type='action' and entity_id=action.id.

**Validates: Requirements 5.1, 5.2**

**Property 19: Cache update on creation**

*For any* state created with an action link, the cached implementation_update_count for that action should be updated immediately.

**Validates: Requirements 5.3**

**Property 20: Cache update on deletion**

*For any* state deleted with an action link, the cached implementation_update_count for that action should be updated immediately.

**Validates: Requirements 5.4**

**Property 21: Count included in responses**

*For any* action returned by the actions Lambda, the response should include the calculated implementation_update_count.

**Validates: Requirements 5.5**

### Cache Consistency Properties

**Property 22: Cache invalidation on creation**

*For any* state creation, the system should invalidate the states query cache for the linked entity.

**Validates: Requirements 10.2**

**Property 23: Cache invalidation on update**

*For any* state update, the system should invalidate the specific state query cache.

**Validates: Requirements 10.3**

**Property 24: Cache invalidation on deletion**

*For any* state deletion, the system should invalidate the states query cache for the linked entity.

**Validates: Requirements 10.4**

**Property 25: Action cache invalidation on count change**

*For any* change to implementation_update_count, the system should invalidate the actions query cache.

**Validates: Requirements 10.5**

### Backward Compatibility Properties

**Property 26: Link creation during migration**

*For any* state created during the migration period, the system should create a state_link record with the correct entity_type and entity_id.

**Validates: Requirements 8.2**

### Audit Trail Properties

**Property 27: Timestamp display correctness**

*For any* migrated state displayed in the UI, the system should show the original created_at timestamp, not the migration timestamp.

**Validates: Requirements 9.4**

**Property 28: Date range query correctness**

*For any* date range query on states, the system should use the preserved created_at timestamps from the original action_implementation_updates.

**Validates: Requirements 9.5**

## Error Handling

### Validation Errors

**Empty Submission**:
- **Trigger**: User submits observation with no text and no photos
- **Response**: Display error message "Please add observation text or at least one photo"
- **Action**: Prevent submission, keep form open

**Invalid Entity Reference**:
- **Trigger**: StatesInline receives invalid entity_type or entity_id
- **Response**: Display error message "Invalid entity reference"
- **Action**: Show empty state, log error

### Migration Errors

**Duplicate ID Conflict**:
- **Trigger**: Migration attempts to insert state with ID that already exists
- **Response**: Rollback transaction, log conflict details
- **Action**: Investigate and resolve conflict before retrying

**Missing Organization ID**:
- **Trigger**: Action record has no organization_id during migration
- **Response**: Rollback transaction, log affected action_id
- **Action**: Fix data integrity issue before retrying

**Foreign Key Violation**:
- **Trigger**: Migration references non-existent user or action
- **Response**: Rollback transaction, log violation details
- **Action**: Investigate and resolve data integrity issue

### Runtime Errors

**State Creation Failure**:
- **Trigger**: Database error during state creation
- **Response**: Display toast "Failed to save observation. Please try again."
- **Action**: Rollback transaction, log error, keep form data

**State Update Failure**:
- **Trigger**: Database error during state update
- **Response**: Display toast "Failed to update observation. Please try again."
- **Action**: Rollback transaction, log error, revert UI changes

**State Deletion Failure**:
- **Trigger**: Database error during state deletion
- **Response**: Display toast "Failed to delete observation. Please try again."
- **Action**: Rollback transaction, log error, revert UI changes

**Cache Invalidation Failure**:
- **Trigger**: TanStack Query cache invalidation fails
- **Response**: Log warning, continue operation
- **Action**: Cache will eventually sync on next query

### Network Errors

**API Timeout**:
- **Trigger**: State API request exceeds timeout
- **Response**: Display toast "Request timed out. Please try again."
- **Action**: Retry with exponential backoff (TanStack Query default)

**Network Disconnection**:
- **Trigger**: No network connection during state operation
- **Response**: Display toast "No network connection. Please check your connection."
- **Action**: Queue operation for retry when connection restored

### Permission Errors

**Unauthorized Access**:
- **Trigger**: User attempts to create/update/delete state without permission
- **Response**: Display toast "You don't have permission to perform this action."
- **Action**: Log security event, prevent operation

**Organization Mismatch**:
- **Trigger**: User attempts to access state from different organization
- **Response**: Return 404 error (don't reveal existence)
- **Action**: Log security event, prevent access

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific examples and edge cases with property-based tests for universal correctness properties. Both are complementary and necessary for comprehensive coverage.

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
**Property Tests**: Verify universal properties across all inputs through randomization

### Property-Based Testing Configuration

**Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: action-updates-to-observations-migration, Property {N}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: action-updates-to-observations-migration, Property 1: Text-only observations are valid
test('text-only observations should be accepted', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1 }), // Generate non-empty strings
      async (stateText) => {
        const observation = {
          state_text: stateText,
          photos: [],
          links: [{ entity_type: 'action', entity_id: 'test-id' }]
        };
        
        const result = await createState(observation);
        expect(result.state_text).toBe(stateText);
        expect(result.id).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage

**Validation Tests**:
- Empty submission rejection (text and photos both empty)
- Text-only submission acceptance
- Photo-only submission acceptance
- Both text and photos submission acceptance

**Migration Tests**:
- Single record migration correctness
- Timestamp preservation verification
- Organization ID assignment verification
- Link creation verification
- Empty table migration (no records)
- Large batch migration (1000+ records)

**Component Tests**:
- StatesInline renders with empty list
- StatesInline renders with multiple states
- StatesInline filters by entity correctly
- Inline add form submission
- Inline edit functionality
- Inline delete with confirmation
- Dialog remains open after operations

**Integration Tests**:
- End-to-end state creation flow
- End-to-end state update flow
- End-to-end state deletion flow
- Cache invalidation verification
- Count update verification

### Property Test Coverage

Each correctness property (Properties 1-28) should have a corresponding property-based test:

**Validation Properties** (1-3):
- Generate random text and photo combinations
- Verify acceptance/rejection based on validation rules

**Migration Properties** (4-9):
- Generate random action_implementation_updates records
- Verify migration correctness for all records

**Component Properties** (10-15):
- Generate random entity types and IDs
- Verify filtering and display correctness

**Count Properties** (16-21):
- Generate random state creation/deletion sequences
- Verify count calculations remain correct

**Cache Properties** (22-25):
- Generate random CRUD operations
- Verify cache invalidation occurs correctly

**Audit Properties** (27-28):
- Generate random timestamps
- Verify timestamp preservation and query correctness

### Test Execution

**Development**:
```bash
npm test                 # Run all tests in watch mode
npm run test:run         # Run all tests once
npm run test:ui          # Open Vitest UI
```

**CI/CD**:
```bash
npm run test:run         # Run all tests
npm run test:coverage    # Generate coverage report
```

**Coverage Targets**:
- Line coverage: 80%+
- Branch coverage: 75%+
- Property tests: 100% of correctness properties
- Unit tests: All edge cases and error conditions

## Deployment Sequence

### Pre-Deployment Checklist

- [ ] All tests passing (unit + property tests)
- [ ] Code review completed
- [ ] Database backup created
- [ ] Migration script tested on development database
- [ ] Rollback plan documented and tested
- [ ] Monitoring alerts configured

### Deployment Steps

**Step 1: Deploy Backend Changes (States Lambda)**

```bash
# Update states Lambda with optional photo validation
./scripts/deploy-lambda-generic.sh cwf-states-lambda

# Verify deployment
aws lambda get-function --function-name cwf-states-lambda --region us-west-2

# Test text-only state creation via API
curl -X POST https://api.example.com/states \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"state_text": "Test", "links": [{"entity_type": "action", "entity_id": "test-id"}]}'
```

**Step 2: Deploy Frontend Changes (AddObservation)**

```bash
# Build and deploy frontend
npm run build
# Deploy to hosting (S3, CloudFront, etc.)

# Verify text-only submission works in UI
```

**Step 3: Run Data Migration**

```bash
# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -t action_implementation_updates > backup_action_updates.sql

# Run migration script
cat migrations/003-migrate-action-updates-to-states.sql | jq -Rs '{sql: .}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Verify migration
echo '{"sql": "SELECT COUNT(*) FROM states WHERE state_text IS NOT NULL AND NOT EXISTS (SELECT 1 FROM state_photos WHERE state_photos.state_id = states.id);"}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json | jq -r '.body' | jq
```

**Step 4: Deploy StatesInline Component**

```bash
# Build and deploy frontend with StatesInline
npm run build
# Deploy to hosting

# Verify component renders in action dialogs
```

**Step 5: Monitor and Verify**

- Monitor error logs for 24 hours
- Verify state creation/update/deletion works correctly
- Verify implementation_update_count updates correctly
- Check user feedback for issues

**Step 6: Remove Legacy Code**

```bash
# Remove action_implementation_updates endpoints from Lambda
# Update cwf-core-lambda or relevant Lambda
./scripts/deploy-lambda-generic.sh cwf-core-lambda

# Deploy frontend without ActionImplementationUpdates component
npm run build
# Deploy to hosting

# Verify no errors in logs
```

**Step 7: Drop Legacy Table**

```bash
# Final verification
echo '{"sql": "SELECT COUNT(*) FROM action_implementation_updates;"}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json | jq -r '.body' | jq

# Drop table
echo '{"sql": "DROP TABLE action_implementation_updates;"}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

### Post-Deployment Verification

- [ ] States display correctly in action dialogs
- [ ] Text-only states can be created
- [ ] Photo-only states can be created
- [ ] implementation_update_count updates correctly
- [ ] No errors in CloudWatch logs
- [ ] User feedback is positive
- [ ] Performance metrics are acceptable

## Rollback Plan

### Rollback Triggers

Initiate rollback if any of the following occur:
- Data integrity issues discovered (missing or corrupted records)
- Critical bugs preventing state creation/update/deletion
- Performance degradation (>2x slower than baseline)
- User-reported issues affecting >10% of users
- Security vulnerabilities discovered

### Rollback Procedures

**Phase 1-2 Rollback (Backend/Frontend Validation)**

If issues discovered after deploying optional photo validation:

```bash
# Revert Lambda to previous version
aws lambda update-function-code \
  --function-name cwf-states-lambda \
  --s3-bucket your-lambda-bucket \
  --s3-key previous-version.zip \
  --region us-west-2

# Revert frontend to previous version
# Deploy previous build from version control
```

**Impact**: Minimal - no data migration has occurred yet.

**Phase 3 Rollback (Data Migration)**

If issues discovered after data migration:

```bash
# Restore from backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_action_updates.sql

# Delete migrated states
echo '{"sql": "DELETE FROM state_links WHERE entity_type = '\''action'\''; DELETE FROM states WHERE id IN (SELECT id FROM action_implementation_updates);"}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json
```

**Impact**: Moderate - states created after migration will be lost. Communicate to users.

**Phase 4-5 Rollback (StatesInline Component)**

If issues discovered after deploying StatesInline:

```bash
# Revert frontend to use ActionImplementationUpdates
# Deploy previous build from version control

# Keep migrated data in states tables
# Legacy endpoints still available
```

**Impact**: Low - data remains intact, UI reverts to previous component.

**Phase 6-7 Rollback (Legacy Code Removal)**

If issues discovered after removing legacy code:

```bash
# Restore action_implementation_updates table from backup
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_action_updates.sql

# Redeploy Lambda with action_implementation_updates endpoints
# Redeploy frontend with ActionImplementationUpdates component
```

**Impact**: High - requires full restoration of legacy system. Avoid if possible.

### Rollback Verification

After rollback, verify:
- [ ] Users can create/update/delete action updates
- [ ] implementation_update_count displays correctly
- [ ] No data loss occurred
- [ ] All timestamps are correct
- [ ] No errors in logs
- [ ] User feedback confirms system is working

### Communication Plan

**During Rollback**:
- Post status update to team Slack channel
- Update status page if customer-facing
- Notify affected users via email if necessary

**After Rollback**:
- Document root cause of issue
- Create action items to prevent recurrence
- Schedule post-mortem meeting
- Update rollback procedures based on learnings

## Success Criteria

### Functional Success Criteria

**Data Migration**:
- [ ] 100% of action_implementation_updates migrated to states
- [ ] All timestamps preserved exactly
- [ ] All text content preserved exactly
- [ ] All user references preserved exactly
- [ ] All organization IDs assigned correctly
- [ ] Zero data loss during migration

**Feature Parity**:
- [ ] Users can create text-only states
- [ ] Users can create photo-only states
- [ ] Users can create states with both text and photos
- [ ] Users can view states in action dialogs
- [ ] Users can edit states inline
- [ ] Users can delete states inline
- [ ] implementation_update_count updates correctly

**Component Integration**:
- [ ] StatesInline component works in UnifiedActionDialog
- [ ] StatesInline component works in ActionScoreDialog
- [ ] Dialog remains open during state operations
- [ ] Cache updates correctly after operations
- [ ] Loading states display correctly
- [ ] Error states display correctly

**Code Cleanup**:
- [ ] action_implementation_updates table dropped
- [ ] Legacy endpoints removed from Lambda
- [ ] ActionImplementationUpdates component deleted
- [ ] actionImplementationUpdatesQueryKey removed
- [ ] No references to legacy system in codebase

### Performance Success Criteria

**Response Times**:
- [ ] State creation: <500ms (p95)
- [ ] State list retrieval: <300ms (p95)
- [ ] State update: <500ms (p95)
- [ ] State deletion: <300ms (p95)
- [ ] Action dialog load: <1s (p95)

**Database Performance**:
- [ ] Migration completes in <5 minutes for 10,000 records
- [ ] No table locks during migration
- [ ] Query performance unchanged or improved

### Quality Success Criteria

**Test Coverage**:
- [ ] All 28 correctness properties have property-based tests
- [ ] All edge cases have unit tests
- [ ] All error conditions have unit tests
- [ ] Line coverage >80%
- [ ] Branch coverage >75%

**Code Quality**:
- [ ] All TypeScript types defined
- [ ] No ESLint errors
- [ ] No console.log statements in production code
- [ ] All functions documented
- [ ] All components have prop types

### User Experience Success Criteria

**Usability**:
- [ ] Users can complete state operations without training
- [ ] Error messages are clear and actionable
- [ ] Loading states provide feedback
- [ ] No unexpected dialog closures
- [ ] Inline forms are intuitive

**Reliability**:
- [ ] Zero critical bugs in first week
- [ ] <5 minor bugs in first week
- [ ] No data corruption issues
- [ ] No cache inconsistency issues

### Business Success Criteria

**Adoption**:
- [ ] 90%+ of users successfully create states in first week
- [ ] <5% support tickets related to migration
- [ ] Positive user feedback (>4/5 rating)

**Operational**:
- [ ] Zero downtime during migration
- [ ] Rollback not required
- [ ] No emergency hotfixes needed
- [ ] Documentation complete and accurate

## Future Enhancements

### Phase 2 Enhancements (Post-Migration)

**Rich Text Editing**:
- Add markdown support for state_text
- Add formatting toolbar (bold, italic, lists)
- Add preview mode
- Rationale: Improve readability of detailed observations

**Photo Annotations**:
- Add drawing/markup tools for photos
- Add text labels on photos
- Add arrow/shape annotations
- Rationale: Highlight specific areas in photos

**State Templates**:
- Create reusable state templates by entity type
- Pre-fill common observations
- Add template library
- Rationale: Speed up common observation workflows

**Bulk Operations**:
- Add bulk state creation (multiple entities at once)
- Add bulk state deletion
- Add bulk state export
- Rationale: Improve efficiency for power users

### Phase 3 Enhancements (Future Roadmap)

**State Versioning**:
- Track edit history for states
- Show who edited and when
- Allow reverting to previous versions
- Rationale: Improve audit trail and accountability

**State Reactions**:
- Add emoji reactions to states
- Add comment threads on states
- Add @mentions in state text
- Rationale: Improve collaboration and communication

**State Analytics**:
- Dashboard showing state creation trends
- Most active users
- Most observed entities
- Rationale: Provide insights into team activity

**State Search**:
- Full-text search across state_text
- Filter by date range, user, entity type
- Search within photos (OCR)
- Rationale: Improve discoverability of historical observations

**State Notifications**:
- Notify users when states are added to their actions
- Notify users when states are edited/deleted
- Configurable notification preferences
- Rationale: Keep users informed of relevant activity

### Technical Debt Reduction

**Database Optimization**:
- Add indexes on state_links (entity_type, entity_id)
- Add indexes on states (captured_at, organization_id)
- Analyze query performance and optimize
- Rationale: Maintain performance as data grows

**Code Refactoring**:
- Extract shared validation logic
- Create reusable photo upload component
- Standardize error handling patterns
- Rationale: Improve maintainability and consistency

**Testing Improvements**:
- Add visual regression tests for components
- Add performance benchmarks
- Add load testing for migration scripts
- Rationale: Catch regressions earlier

## References

### Related Specifications

- `.kiro/specs/observations-to-states-terminology/` - Terminology migration from "observations" to "states"
- `.kiro/specs/unified-embeddings-system/` - Semantic search across entities including states

### Database Schema

- `migrations/001-create-states-tables.sql` - Initial states system schema
- `migrations/002-rename-observations-to-states.sql` - Terminology migration
- `migrations/003-migrate-action-updates-to-states.sql` - This migration (to be created)

### Lambda Functions

- `lambda/states/index.js` - States CRUD operations
- `lambda/core/index.js` - Actions CRUD operations (includes implementation_update_count)

### Frontend Components

- `src/pages/AddObservation.tsx` - Full-page state creation form
- `src/components/UnifiedActionDialog.tsx` - Action dialog (to be updated)
- `src/components/ActionScoreDialog.tsx` - Action scoring dialog (to be updated)

### API Documentation

- `/api/states` - States CRUD endpoints
- `/api/actions` - Actions CRUD endpoints (includes implementation_update_count)

### Testing Resources

- [fast-check documentation](https://github.com/dubzzz/fast-check) - Property-based testing library
- [Vitest documentation](https://vitest.dev/) - Test framework
- [Testing Library](https://testing-library.com/) - Component testing utilities

### AWS Resources

- AWS Lambda: `cwf-states-lambda`
- AWS RDS: PostgreSQL database
- AWS S3: `cwf-dev-assets` bucket (photo storage)
- AWS Cognito: User authentication
