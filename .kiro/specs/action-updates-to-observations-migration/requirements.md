# Requirements Document

## Introduction

This specification defines the migration from the legacy `action_implementation_updates` table to the modern observations system. The observations system is more flexible, supporting photo-first state capture with optional text, and can link to any entity type (not just actions). This migration will consolidate state capture functionality, eliminate duplicate code, and enable richer action updates with photos.

## Glossary

- **Observation**: A photo-first state capture record with optional text that can link to any entity type
- **Observation_Link**: A polymorphic link connecting an observation to an entity (action, part, tool, issue, etc.)
- **Action_Implementation_Update**: Legacy text-only update record linked to a specific action (to be deprecated)
- **Implementation_Update_Count**: Cached count of updates on an action, used for UI border styling
- **ObservationsInline**: New reusable component for displaying observations within entity dialogs
- **System**: The CWF asset management and accountability system

## Requirements

### Requirement 1: Make Photos Optional in Observations

**User Story:** As a user, I want to add text-only observations without requiring photos, so that I can capture quick notes and updates efficiently.

#### Acceptance Criteria

1. WHEN a user submits an observation with text but no photos, THE System SHALL accept and save the observation
2. WHEN a user submits an observation with photos but no text, THE System SHALL accept and save the observation
3. WHEN a user submits an observation with neither text nor photos, THE System SHALL reject the submission with a validation error
4. WHEN the AddObservation component loads, THE System SHALL display the photo upload section as optional
5. WHEN the AddObservation component validates submission, THE System SHALL require at least one of: observation_text or photos

### Requirement 2: Migrate Existing Action Implementation Updates

**User Story:** As a system administrator, I want to migrate all existing action_implementation_updates to observations, so that all historical data is preserved in the new system.

#### Acceptance Criteria

1. WHEN the migration script runs, THE System SHALL create one observation record for each action_implementation_update record
2. WHEN creating migrated observations, THE System SHALL preserve the original created_at and updated_at timestamps
3. WHEN creating migrated observations, THE System SHALL create observation_links records with entity_type='action' and entity_id=action_id
4. WHEN creating migrated observations, THE System SHALL copy update_text to observation_text
5. WHEN creating migrated observations, THE System SHALL copy updated_by to observed_by
6. WHEN creating migrated observations, THE System SHALL join with actions table to get organization_id
7. WHEN the migration completes, THE System SHALL report the count of successfully migrated records
8. WHEN the migration encounters an error, THE System SHALL rollback all changes and report the error

### Requirement 3: Create Reusable ObservationsInline Component

**User Story:** As a developer, I want a reusable component for displaying observations inline, so that any entity dialog can show linked observations without navigation.

#### Acceptance Criteria

1. WHEN the ObservationsInline component renders, THE System SHALL display all observations linked to the specified entity
2. WHEN displaying observations, THE System SHALL show observation_text, photos, observed_by name, and observed_at timestamp
3. WHEN a user adds a new observation inline, THE System SHALL create the observation and link it to the current entity
4. WHEN a user adds a new observation inline, THE System SHALL support both text and photos
5. WHEN a user adds a new observation inline, THE System SHALL refresh the observations list without closing the dialog
6. WHEN a user edits an observation inline, THE System SHALL update the observation and refresh the list
7. WHEN a user deletes an observation inline, THE System SHALL remove the observation and refresh the list
8. WHEN the component receives entity_type and entity_id props, THE System SHALL filter observations by those values

### Requirement 4: Replace ActionImplementationUpdates Component

**User Story:** As a user, I want to see and manage action observations in the action dialog, so that I can track implementation progress with photos and text.

#### Acceptance Criteria

1. WHEN the UnifiedActionDialog renders, THE System SHALL display the ObservationsInline component instead of ActionImplementationUpdates
2. WHEN the ActionScoreDialog renders, THE System SHALL display the ObservationsInline component instead of ActionImplementationUpdates
3. WHEN displaying action observations, THE System SHALL show all observations linked to the action via observation_links
4. WHEN a user adds an observation to an action, THE System SHALL increment the action's implementation_update_count
5. WHEN a user deletes an observation from an action, THE System SHALL decrement the action's implementation_update_count

### Requirement 5: Update Implementation Update Count Calculation

**User Story:** As a developer, I want implementation_update_count to be calculated from observation_links, so that the count reflects the new observations system.

#### Acceptance Criteria

1. WHEN querying actions, THE System SHALL calculate implementation_update_count from observation_links table
2. WHEN calculating implementation_update_count, THE System SHALL count observation_links records where entity_type='action' and entity_id=action.id
3. WHEN an observation is created with an action link, THE System SHALL automatically update the cached implementation_update_count
4. WHEN an observation is deleted with an action link, THE System SHALL automatically update the cached implementation_update_count
5. WHEN the actions Lambda returns action records, THE System SHALL include the calculated implementation_update_count

### Requirement 6: Remove Legacy Endpoints and Code

**User Story:** As a developer, I want to remove action_implementation_updates endpoints and code, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. WHEN the migration is complete, THE System SHALL remove GET /action_implementation_updates endpoint from Lambda
2. WHEN the migration is complete, THE System SHALL remove POST /action_implementation_updates endpoint from Lambda
3. WHEN the migration is complete, THE System SHALL remove PUT /action_implementation_updates/:id endpoint from Lambda
4. WHEN the migration is complete, THE System SHALL remove DELETE /action_implementation_updates/:id endpoint from Lambda
5. WHEN the migration is complete, THE System SHALL remove ActionImplementationUpdates.tsx component file
6. WHEN the migration is complete, THE System SHALL remove actionImplementationUpdatesQueryKey from queryKeys.ts
7. WHEN the migration is complete, THE System SHALL remove all references to action_implementation_updates from Lambda code

### Requirement 7: Drop Legacy Database Table

**User Story:** As a system administrator, I want to drop the action_implementation_updates table after migration, so that the database schema is clean and storage is optimized.

#### Acceptance Criteria

1. WHEN all data is migrated and verified, THE System SHALL drop the action_implementation_updates table
2. WHEN dropping the table, THE System SHALL verify that no foreign key constraints reference it
3. WHEN dropping the table, THE System SHALL create a backup SQL file with all data before dropping
4. WHEN the table is dropped, THE System SHALL log the operation with timestamp and record count

### Requirement 8: Maintain Backward Compatibility During Migration

**User Story:** As a system administrator, I want the system to remain operational during migration, so that users experience no downtime.

#### Acceptance Criteria

1. WHEN the migration is in progress, THE System SHALL continue serving action_implementation_updates endpoints
2. WHEN new observations are created during migration, THE System SHALL link them to actions via observation_links
3. WHEN the migration completes, THE System SHALL switch to observations-based endpoints atomically
4. WHEN switching to observations, THE System SHALL deploy frontend and backend changes together
5. WHEN the migration fails, THE System SHALL rollback to the previous state without data loss

### Requirement 9: Preserve Audit Trail and Timestamps

**User Story:** As a compliance officer, I want all historical timestamps preserved during migration, so that audit trails remain accurate.

#### Acceptance Criteria

1. WHEN migrating action_implementation_updates, THE System SHALL preserve the original created_at timestamp
2. WHEN migrating action_implementation_updates, THE System SHALL preserve the original updated_at timestamp
3. WHEN migrating action_implementation_updates, THE System SHALL preserve the updated_by user reference
4. WHEN displaying migrated observations, THE System SHALL show the original creation time
5. WHEN querying observations by date range, THE System SHALL use the preserved timestamps

### Requirement 10: Update Frontend Query Keys and Caching

**User Story:** As a developer, I want TanStack Query to properly cache observations, so that the UI remains responsive and consistent.

#### Acceptance Criteria

1. WHEN the ObservationsInline component mounts, THE System SHALL use observationsQueryKey with entity filters
2. WHEN an observation is created, THE System SHALL invalidate the observations query cache
3. WHEN an observation is updated, THE System SHALL invalidate the specific observation query cache
4. WHEN an observation is deleted, THE System SHALL invalidate the observations query cache
5. WHEN implementation_update_count changes, THE System SHALL invalidate the actions query cache
