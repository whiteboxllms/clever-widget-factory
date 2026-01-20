# Exploration Association Requirements

## Overview

When a user indicates an action is an exploration, they should be able to associate it with an existing non-integrated exploration or create a new one. This spec focuses on the GUI flow and logic for managing this association.

## User Stories

### US1: Associate Action with Existing Exploration
**As a** user creating or editing an action  
**I want to** see a list of existing non-integrated explorations and associate my action with one  
**So that** I can link my action to an ongoing exploration effort

**Acceptance Criteria:**
- When I check "This is an exploration" in the action form, a dialog appears showing all non-integrated explorations
- The list displays exploration code, state_text, and exploration_notes_text for each exploration
- I can select an exploration from the list to associate with my action
- On selection, the action is linked to that exploration (one exploration per action)
- The dialog closes and the action is saved with the exploration association

### US2: Create New Exploration with Manual Code Entry
**As a** user  
**I want to** create a new exploration by entering a code I choose  
**So that** I can document explorations with codes I've already written on stakes (including historical dates)

**Acceptance Criteria:**
- There is a "Create New Exploration" button in the dialog
- Clicking the button opens a form where I can enter the exploration code
- The form suggests today's date with the next available number (e.g., SF011826EX01)
- I can accept the suggestion or enter a different code (for historical explorations)
- The form validates that the code doesn't already exist
- On confirmation, the exploration is created with status `in_progress`
- The new exploration immediately appears in the explorations list
- The new exploration is automatically selected and linked to the current action
- If an exploration already exists for this action, the button is disabled with tooltip "This action already has an exploration"

### US3: View Non-Integrated Explorations Only
**As a** user  
**I want to** see only explorations that are not yet integrated  
**So that** I focus on active exploration efforts

**Acceptance Criteria:**
- The explorations list filters to show only explorations with status `!= 'integrated'`
- Integrated explorations are not shown in the association dialog
- The list is sorted by creation date (most recent first)
- If no non-integrated explorations exist, the list is empty with a message "No active explorations"

### US4: Edit Exploration Association
**As a** user  
**I want to** change which exploration an action is associated with  
**So that** I can correct an association or move an action to a different exploration

**Acceptance Criteria:**
- If an action already has an exploration association, the dialog shows the current association
- I can select a different exploration from the list to change the association
- On selection, the action is re-associated with the new exploration
- The previous exploration is no longer linked to this action

### US5: Delete Exploration Association
**As a** user  
**I want to** remove an exploration association from an action  
**So that** the action is no longer marked as an exploration

**Acceptance Criteria:**
- In the association dialog, there is a "Remove Exploration" or "Not an Exploration" option
- Clicking this option removes the exploration association
- The action is no longer marked as an exploration
- The exploration record itself is not deleted (only the association is removed)

## Requirements

### 1. Exploration Association Logic

**1.1 Many-to-Many Relationship**
- Each action can be associated with multiple explorations
- Each exploration can be associated with multiple actions
- The `action_exploration` junction table manages the relationships
- No hierarchy - all linked actions are equal participants in the exploration

**1.2 Non-Integrated Filter**
- When displaying explorations for association, filter to `status != 'integrated'`
- This includes explorations with status `in_progress` and `ready_for_analysis`

**1.3 Association Persistence**
- When an action is associated with an exploration, store the `exploration.id` or `exploration.action_id` relationship
- The association persists across action edits
- The association is deleted if the action is deleted (via CASCADE)

**1.4 Existing Exploration Check**
- Before allowing "Create New Exploration", check if the action already has an exploration (any status)
- If exploration exists, disable the "Create New Exploration" button
- Show tooltip: "This action already has an exploration"
- This prevents duplicate explorations for the same action

### 2. Dialog Behavior

**2.1 Trigger**
- Dialog appears when user checks "This is an exploration" checkbox in action form
- Dialog also appears when user clicks "Change Exploration" on an action that already has an exploration

**2.2 Content**
- Title: "Select Exploration"
- "Create New Exploration" button at the top
- List of non-integrated explorations with columns:
  - Exploration Code (e.g., "SF010326EX01")
  - State Text (first 100 characters)
  - Exploration Notes (first 100 characters)
  - Action Count (number of actions linked to this exploration, e.g., "1 action" or "3 actions")
- "Cancel" button to close without changes

**2.3 Create New Exploration Flow**
- User clicks "Create New Exploration" button
- New exploration is created with status `in_progress`
- Auto-generated exploration code is assigned
- New exploration is added to the top of the list
- New exploration is automatically selected (highlighted)
- User can then click "Confirm" to associate it with the action

**2.4 Selection and Confirmation**
- Clicking an exploration in the list selects it
- Visual feedback (highlight/checkbox) indicates selection
- "Confirm" or "Associate" button becomes enabled
- Clicking confirm:
  1. Saves the action-exploration link immediately (API call)
  2. Shows success feedback (e.g., "Exploration linked")
  3. Closes the dialog
  4. Returns to action form with exploration association active
- If link save fails, show error message and keep dialog open for retry

### 3. API Requirements

**3.1 List Non-Integrated Explorations**
- Endpoint: `GET /explorations/list?status=in_progress,ready_for_analysis`
- Returns: Array of explorations with `id`, `exploration_code`, `state_text`, `exploration_notes_text`, `action_count`
- `action_count`: Number of actions linked to this exploration (0 for newly created explorations)
- Filters: Only explorations with status `!= 'integrated'`

**3.2 Check if Action Has Exploration**
- Endpoint: `GET /actions/{action_id}/exploration`
- Returns: Exploration record if exists, or 404 if not found
- Used to determine if "Create New Exploration" button should be enabled
- Checks all statuses (in_progress, ready_for_analysis, integrated)

**3.3 Create Exploration**
- Endpoint: `POST /explorations`
- Input: Auto-generated `exploration_code` (no action_id required at creation time)
- Validation: Check if action already has exploration before allowing creation
- Returns: New exploration record with status `in_progress` on success
- Returns: 409 Conflict if action already has an exploration
- Note: Exploration is created without action association; association happens in separate step

**3.3.1 Update Exploration**
- Endpoint: `PUT /explorations/{exploration_id}`
- Input: `exploration_notes_text`, `metrics_text`, `state_text`, `public_flag` (all optional)
- Validation: Verify exploration exists (404 if not)
- Behavior: Update exploration fields, preserve `exploration_code` and `status`
- Returns: Updated exploration record
- Note: Allows adjusting exploration details after creation (e.g., field notes added later)

**3.4 Associate Action with Exploration**
- Endpoint: `PUT /actions/{action_id}` or `POST /actions/{action_id}/exploration`
- Input: `exploration_id`
- Validation: 
  - Verify exploration exists (404 if not)
  - Verify exploration status is not `integrated` (409 if integrated)
  - Verify action doesn't already have a different exploration (409 if different exploration exists)
- Behavior: Link action to exploration (update `exploration.action_id`)
- Returns: Updated action record

**3.5 Disassociate Action from Exploration**
- Endpoint: `DELETE /actions/{action_id}/exploration`
- Behavior: Remove exploration association (set `exploration.action_id` to null or delete exploration record)
- Returns: Updated action record

### 4. Data Validation

**4.1 Exploration Existence**
- Verify exploration exists before associating
- Return 404 if exploration not found

**4.2 Status Validation**
- Verify exploration status is not `integrated` before allowing association
- Return 409 if attempting to associate with integrated exploration

**4.3 Uniqueness**
- Verify action doesn't already have an exploration association (unless updating)
- Return 409 if action already associated with different exploration
- Check all statuses (in_progress, ready_for_analysis, integrated) when validating

**4.4 Action Existence**
- Verify action exists before creating or associating exploration
- Return 404 if action not found

**4.5 Exploration Code Uniqueness**
- Verify generated exploration code is unique system-wide
- If code collision occurs, retry with next number
- Return 409 if unable to generate unique code after retries

### 5. Error Handling

**5.1 User-Facing Errors**
- "No active explorations available" - when list is empty
- "This action already has an exploration" - when trying to create new exploration for action that already has one
- "Failed to load explorations" - when API call fails
- "Failed to create exploration" - when creation fails
- "Failed to associate exploration" - when association fails
- "This exploration is archived and cannot be modified" - when attempting to associate with integrated exploration
- "Exploration not found" - when selected exploration no longer exists

**5.2 Error Recovery**
- If dialog fails to load, show error message with "Retry" button
- If association fails, show error and keep dialog open for retry
- If creation fails, show error and allow user to try again or cancel
- If action already has exploration, show message and disable "Create New Exploration" button

**5.3 Validation Error Codes**
- `EXPLORATION_ALREADY_EXISTS` (409): Action already has an exploration
- `EXPLORATION_NOT_FOUND` (404): Selected exploration doesn't exist
- `EXPLORATION_INTEGRATED` (409): Cannot associate with integrated exploration
- `ACTION_NOT_FOUND` (404): Action doesn't exist
- `EXPLORATION_CODE_COLLISION` (409): Unable to generate unique exploration code
- `INVALID_STATUS` (400): Invalid exploration status value
- `DUPLICATE_ASSOCIATION` (409): Action already associated with different exploration

### 6. Save Timing

**6.1 Link Save on Confirmation**
- When user clicks "Confirm" in the dialog, the action-exploration link is saved immediately
- This is a separate API call from the action save
- Link save happens before dialog closes
- If link save fails, dialog remains open with error message

**6.2 Action Save**
- After dialog closes, user continues editing the action
- Action is saved separately when user clicks "Save" or "Done" on the action form
- Action save includes the exploration association (already linked)

**6.3 Resilience**
- Link persists even if action save fails
- User can close action form without saving and link remains
- Link can be changed by opening the dialog again and selecting a different exploration


### 7. Troubleshooting and Observability

**7.1 Logging and Tracing**
- All API calls include request/response logging with timestamps
- Log format: `[timestamp] [level] [endpoint] [action_id] [exploration_id] [status] [duration_ms]`
- Include correlation IDs for tracing multi-step operations (create → link → save)
- Log all validation failures with specific error codes and details

**7.2 Error Context**
- API responses include `requestId` for support troubleshooting
- Error responses include:
  - `code`: Machine-readable error code
  - `message`: User-friendly error message
  - `details`: Additional context (e.g., which validation failed)
  - `timestamp`: When error occurred
- Example: `{ code: "EXPLORATION_INTEGRATED", message: "Cannot link to archived exploration", details: { exploration_id: "123", status: "integrated" }, requestId: "req-abc123" }`

**7.3 State Validation**
- Before any operation, validate state consistency:
  - Action exists and is accessible
  - Exploration exists and has correct status
  - No orphaned links (exploration without action or vice versa)
- Log validation results for debugging

**7.4 Monitoring Points**
- Track link creation success/failure rate
- Monitor dialog load times (should be < 500ms)
- Alert on repeated failures for same action/exploration pair
- Track action count per exploration (should match database)

### 8. TanStack Query Integration

**8.1 Cache Key Strategy**
- Explorations list: `['explorations', 'list', { status: 'in_progress,ready_for_analysis' }]`
- Single exploration: `['explorations', explorationId]`
- Action with exploration: `['actions', actionId]` (includes exploration data)
- Action count per exploration: `['explorations', explorationId, 'action_count']`

**8.2 Response Format for Cache Updates**
All API responses must include complete data for TanStack to update cache:

**Create Exploration Response:**
```json
{
  "id": "exp-123",
  "exploration_code": "SF010326EX01",
  "state_text": "...",
  "exploration_notes_text": null,
  "metrics_text": null,
  "public_flag": false,
  "action_count": 0,
  "status": "in_progress",
  "created_at": "2026-01-18T...",
  "updated_at": "2026-01-18T..."
}
```

**Link Exploration Response:**
```json
{
  "action": {
    "id": "action-456",
    "title": "...",
    "exploration_id": "exp-123",
    "is_exploration": true,
    // ... all other action fields
  },
  "exploration": {
    "id": "exp-123",
    "action_count": 1,
    // ... all exploration fields
  }
}
```

**List Explorations Response:**
```json
{
  "data": [
    {
      "id": "exp-123",
      "exploration_code": "SF010326EX01",
      "state_text": "...",
      "exploration_notes_text": "...",
      "action_count": 1,
      "status": "in_progress",
      "created_at": "2026-01-18T...",
      "updated_at": "2026-01-18T..."
    }
  ],
  "total": 1,
  "timestamp": "2026-01-18T..."
}
```

**8.3 Cache Invalidation Strategy**
- After creating exploration: Invalidate `['explorations', 'list']` to refresh list
- After linking exploration: Invalidate both `['actions', actionId]` and `['explorations', explorationId]`
- After unlinking: Invalidate same keys
- Use `queryClient.invalidateQueries()` with specific keys, not broad invalidation

**8.4 Optimistic Updates**
- When linking exploration, update cache optimistically before API response
- Revert on error with user notification
- Example: Immediately update action with exploration_id, then confirm on API success

**8.5 Error Handling with Cache**
- On API error, do NOT update cache
- Show error to user with retry option
- Keep previous cache state intact for retry
- Log cache state at time of error for debugging

### 9. Integration with Existing System

**9.1 Backward Compatibility**
- All new fields are optional in existing action schema
- Existing actions without explorations continue to work unchanged
- No breaking changes to existing API contracts

**9.2 Data Consistency**
- Exploration association is stored in `exploration.action_id` (not on action table)
- Action table remains unchanged except for optional new fields
- Queries must JOIN exploration table to get full context

**9.3 Existing Workflows**
- Action creation flow: Add optional exploration checkbox
- Action editing: Show exploration tab only if exploration exists
- Action deletion: CASCADE delete exploration (via foreign key)
- No changes to existing action list, filtering, or search
