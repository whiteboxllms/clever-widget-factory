# Tasks: Observation Editing

**Note:** Backend uses "states" terminology (tables: `states`, `state_photos`, `state_links`; Lambda: `cwf-states-lambda`; API: `/api/states`). Frontend also uses "states" terminology (hooks: `useStates`, `useStateById`, `useStateMutations`; service: `stateService`). The UI still displays "Observation" to users for familiarity, and types remain named `Observation` and `CreateObservationData`.

**Migration Complete:** Legacy `/api/observations` endpoints and `observationService`/`useObservations` have been removed. All code now uses the states infrastructure.

**Implementation Note:** When implementing these tasks, use the state terminology in code (useStateById, stateService.updateState, etc.) but keep user-facing text as "Observation" for consistency with the UI.

## Phase 1: Backend API Enhancement

### Task 1: Add permission validation to PUT /api/states/:id endpoint
- [x] 1.1 Add permission check before update (verify user is creator or admin)
- [x] 1.2 Add organization boundary check
- [x] 1.3 Return 403 error for unauthorized users
- [x] 1.4 Return 404 error for non-existent observations
- [x] 1.5 Test permission validation with different user scenarios

## Phase 2: Frontend Data Layer

### Task 2: Verify state fetch hook exists
- [x] 2.1 Verify useStateById hook exists in src/hooks/useStates.ts
- [x] 2.2 Confirm hook uses proper query key (stateQueryKey)
- [x] 2.3 Test hook fetches state by ID correctly

### Task 3: Verify state update mutation exists
- [x] 3.1 Verify updateState method exists in stateService
- [x] 3.2 Verify useStateMutations hook includes update mutation
- [x] 3.3 Verify cache invalidation for states and tool history
- [x] 3.4 Add optimistic update logic if missing
- [x] 3.5 Test mutation handles success and error cases

### Task 4: Verify UpdateObservationData type exists
- [x] 4.1 Verify UpdateObservationData interface exists in src/types/observations.ts
- [x] 4.2 Confirm it includes observation_text, observed_at, photos, and links fields
- [x] 4.3 Confirm all fields are optional for partial updates

## Phase 3: UI Components

### Task 5: Enhance AddObservation page for edit mode
- [x] 5.1 Add observationId URL parameter detection
- [x] 5.2 Add isEditMode boolean based on observationId presence
- [x] 5.3 Fetch existing state using useStateById when in edit mode
- [x] 5.4 Pre-populate form fields with existing state data
- [x] 5.5 Add captured_at datetime picker field
- [x] 5.6 Update page title dynamically ("Add Observation" vs "Edit Observation")
- [x] 5.7 Update button text dynamically ("Save Observation" vs "Update Observation")
- [x] 5.8 Modify handleSubmit to call createState or updateState based on mode
- [x] 5.9 Handle loading state while fetching state
- [x] 5.10 Test edit mode loads and saves correctly

### Task 6: Add edit button to AssetHistoryDialog
- [x] 6.1 Import Edit icon and useNavigate from react-router-dom
- [x] 6.2 Add canEditObservation permission check function
- [x] 6.3 Add edit button to observation history entries
- [x] 6.4 Wire edit button to navigate to /observations/edit/:id
- [x] 6.5 Test edit button visibility based on permissions
- [x] 6.6 Test edit button navigation

### Task 7: Add edit route to router
- [x] 7.1 Add /observations/edit/:observationId route to router configuration
- [x] 7.2 Map route to AddObservation component
- [x] 7.3 Test route navigation works correctly

## Phase 4: Error Handling & Polish

### Task 8: Add comprehensive error handling
- [x] 8.1 Add validation error messages for empty observation
- [x] 8.2 Add validation error for invalid datetime format
- [x] 8.3 Add toast notification for 403 permission errors
- [x] 8.4 Add toast notification for 404 not found errors
- [x] 8.5 Add toast notification for network errors with retry option
- [x] 8.6 Test all error scenarios display correct messages

### Task 9: Add unsaved changes confirmation
- [x] 9.1 Track form dirty state
- [x] 9.2 Add beforeunload event listener for browser navigation
- [x] 9.3 Add confirmation dialog for cancel button when form is dirty
- [x] 9.4 Test confirmation prompts appear correctly

### Task 10: Add loading and disabled states
- [x] 10.1 Disable save button while photos are uploading
- [x] 10.2 Show loading spinner during state fetch
- [x] 10.3 Show loading state during save operation
- [x] 10.4 Disable form fields during save operation
- [x] 10.5 Test loading states display correctly

## Phase 5: Testing

### Task 11: Write unit tests for components
- [x] 11.1 Test AddObservation renders in create mode
- [x] 11.2 Test AddObservation renders in edit mode with pre-populated data
- [x] 11.3 Test AddObservation validates empty observation
- [x] 11.4 Test AddObservation calls correct mutation based on mode (createState vs updateState)
- [x] 11.5 Test AssetHistoryDialog shows/hides edit button based on permissions
- [x] 11.6 Test AssetHistoryDialog navigates to edit page on button click

### Task 12: Write integration tests
- [x] 12.1 Test end-to-end edit flow (click edit → modify → save → see updated data)
- [x] 12.2 Test permission scenarios (creator, admin, other user)
- [x] 12.3 Test error scenarios (network error, 403, 404, validation)
- [x] 12.4 Test optimistic update and rollback

### Task 13: Write property-based tests
- [x] 13.1 Property test: Edit button visibility based on permissions
- [x] 13.2 Property test: Page pre-populates all state data
- [x] 13.3 Property test: Backend permission enforcement
- [x] 13.4 Property test: Cache invalidation on success
- [x] 13.5 Property test: Optimistic update rollback on failure

## Phase 6: Documentation

### Task 14: Update documentation
- [x] 14.1 Add observation editing to user guide
- [x] 14.2 Document permission requirements
- [x] 14.3 Add API endpoint documentation (/api/states/:id PUT endpoint)
- [x] 14.4 Update architecture diagrams if needed
