# Requirements Document: Observation Editing

## Introduction

This feature enables users to edit observations from the asset history dialog. Users can correct mistakes in observation text, update photo descriptions, add or remove photos, and modify the captured timestamp. The feature maintains data integrity through permission checks and optimistic UI updates.

## Glossary

- **Observation**: A record documenting field notes, photos, and context about an asset (tool or part) at a specific point in time
- **Asset_History_Dialog**: The UI component displaying chronological history of an asset including observations, checkouts, issues, and changes
- **Observation_Creator**: The user who originally created an observation (identified by observed_by field)
- **Organization_Admin**: A user with administrative permissions within an organization
- **Optimistic_Update**: A UI pattern where changes are immediately reflected in the interface before server confirmation
- **TanStack_Query**: The state management library used for data fetching and caching
- **Observation_Photo**: An image associated with an observation, including URL, description, and display order
- **Captured_At**: The timestamp when an observation was originally recorded

## Requirements

### Requirement 1: Display Edit Button

**User Story:** As a user, I want to see an edit button on observations I created, so that I can correct mistakes or add missing information.

#### Acceptance Criteria

1. WHEN viewing the asset history dialog, THE System SHALL display an edit button on each observation entry
2. WHEN the current user is the observation creator, THE System SHALL show the edit button as enabled
3. WHEN the current user is an organization admin, THE System SHALL show the edit button as enabled
4. WHEN the current user is neither the creator nor an admin, THE System SHALL hide the edit button
5. THE Edit_Button SHALL be visually distinct and positioned consistently with other action buttons in the history entry

### Requirement 2: Open Edit Dialog

**User Story:** As a user, I want to click the edit button and see a dialog with my observation data, so that I can make changes.

#### Acceptance Criteria

1. WHEN a user clicks the edit button, THE System SHALL open an edit dialog
2. WHEN the edit dialog opens, THE System SHALL pre-populate the observation text field with the existing observation_text
3. WHEN the edit dialog opens, THE System SHALL display all existing photos with their descriptions and order
4. WHEN the edit dialog opens, THE System SHALL pre-populate the captured_at timestamp
5. THE Edit_Dialog SHALL use the same UI components and layout as the observation creation flow

### Requirement 3: Edit Observation Text

**User Story:** As a user, I want to modify the observation text, so that I can correct typos or add missing details.

#### Acceptance Criteria

1. WHEN a user modifies the observation text field, THE System SHALL accept the changes
2. WHEN a user clears the observation text field, THE System SHALL allow saving if at least one photo exists
3. WHEN a user attempts to save with empty text and no photos, THE System SHALL prevent submission and display a validation error
4. THE Observation_Text_Field SHALL support multi-line text input

### Requirement 4: Edit Photos

**User Story:** As a user, I want to add, remove, or modify photo descriptions, so that I can improve the documentation quality.

#### Acceptance Criteria

1. WHEN a user uploads new photos, THE System SHALL add them to the existing photo list
2. WHEN a user removes a photo, THE System SHALL delete it from the observation
3. WHEN a user modifies a photo description, THE System SHALL update the description text
4. WHEN photos are reordered, THE System SHALL maintain the new display order
5. THE Photo_Upload_Process SHALL follow the same pattern as observation creation (parallel uploads with progress indicators)

### Requirement 5: Edit Captured Timestamp

**User Story:** As a user, I want to modify the captured_at timestamp, so that I can correct the observation time if it was recorded incorrectly.

#### Acceptance Criteria

1. WHEN a user modifies the captured_at field, THE System SHALL accept valid ISO 8601 datetime values
2. WHEN a user provides an invalid datetime format, THE System SHALL display a validation error
3. THE Captured_At_Field SHALL provide a datetime picker interface for easy selection

### Requirement 6: Backend Update Endpoint

**User Story:** As a developer, I want a PUT endpoint for updating observations, so that the frontend can persist changes.

#### Acceptance Criteria

1. THE System SHALL provide a PUT /api/observations/{id} endpoint
2. WHEN the endpoint receives a valid update request, THE System SHALL update the observation record
3. WHEN updating photos, THE System SHALL delete existing photos and insert new ones within a transaction
4. WHEN updating links, THE System SHALL delete existing links and insert new ones within a transaction
5. WHEN the observation does not exist, THE System SHALL return a 404 error
6. WHEN the user lacks permission to edit, THE System SHALL return a 403 error
7. THE Update_Endpoint SHALL validate that the observation belongs to the user's organization

### Requirement 7: Permission Validation

**User Story:** As a system administrator, I want to ensure only authorized users can edit observations, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN a user attempts to edit an observation, THE System SHALL verify the user is the creator or an admin
2. WHEN the user is the observation creator, THE System SHALL allow the edit
3. WHEN the user has admin permissions, THE System SHALL allow the edit
4. WHEN the user is neither creator nor admin, THE System SHALL reject the edit with a 403 error
5. THE Permission_Check SHALL occur on the backend before any database modifications

### Requirement 8: Frontend Mutation Hook

**User Story:** As a developer, I want a mutation hook for updating observations, so that the frontend can trigger updates with proper state management.

#### Acceptance Criteria

1. THE System SHALL provide a useUpdateObservation mutation hook
2. WHEN the mutation succeeds, THE System SHALL invalidate the observations query cache
3. WHEN the mutation succeeds, THE System SHALL invalidate the tool history query cache
4. WHEN the mutation fails, THE System SHALL display an error toast notification
5. THE Mutation_Hook SHALL follow the existing TanStack Query patterns in the codebase

### Requirement 9: Optimistic UI Updates

**User Story:** As a user, I want to see my changes immediately, so that the interface feels responsive.

#### Acceptance Criteria

1. WHEN a user saves an edit, THE System SHALL immediately update the UI with the new data
2. WHEN the server request fails, THE System SHALL revert the UI to the previous state
3. WHEN the server request succeeds, THE System SHALL replace the optimistic data with the server response
4. THE Optimistic_Update SHALL update the observations cache using queryClient.setQueryData
5. THE Optimistic_Update SHALL update the tool history cache to reflect the changes

### Requirement 10: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and can take corrective action.

#### Acceptance Criteria

1. WHEN a network error occurs, THE System SHALL display a toast notification with a retry option
2. WHEN a validation error occurs, THE System SHALL display inline error messages on the relevant fields
3. WHEN a permission error occurs, THE System SHALL display a toast notification explaining the user lacks permission
4. WHEN a 404 error occurs, THE System SHALL display a toast notification that the observation was not found
5. THE Error_Messages SHALL be user-friendly and actionable

### Requirement 11: Dialog State Management

**User Story:** As a user, I want the dialog to close after saving, so that I can see my updated observation in the history.

#### Acceptance Criteria

1. WHEN a user successfully saves an edit, THE System SHALL close the edit dialog
2. WHEN a user clicks cancel, THE System SHALL close the edit dialog without saving
3. WHEN a user clicks outside the dialog, THE System SHALL prompt for confirmation if unsaved changes exist
4. THE Dialog_State SHALL be managed using React state hooks
5. THE Dialog_Close_Action SHALL clear any temporary state (uploaded photos, form data)
