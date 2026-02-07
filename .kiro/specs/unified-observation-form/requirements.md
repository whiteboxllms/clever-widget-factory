# Requirements Document: Unified State Form

## Introduction

This specification defines the unification of state capture UI across the CWF system. Currently, the `AddObservation` page (for parts/tools) and `StatesInline` component (for actions) have different layouts and behaviors. This spec will create a shared form component that provides consistent UX while supporting entity-specific customization through route-based polymorphism.

## Glossary

- **StateForm**: Shared UI component for capturing state updates with photos and text
- **Entity Type**: The type of entity being observed (part, tool, action)
- **Route-Based Polymorphism**: Using URL parameters to determine entity-specific labels and prompts
- **Text Erasure Bug**: Current bug in AddObservation where observationText state is cleared when photo uploads complete
- **StatesInline**: Existing inline component for action state updates (photo left, text right layout)
- **AddObservation**: Existing full-page component for asset observations (photo right, text left layout)

## Background

### Current Issues

1. **Inconsistent Layouts**: AddObservation has photos on right (table layout), StatesInline has photos on left (card layout)
2. **Text Erasure Bug**: AddObservation clears the observation text when photos finish uploading
3. **Code Duplication**: Similar form logic exists in two places with different implementations
4. **Inconsistent UX**: Users experience different interfaces for the same conceptual operation

### Design Goals

1. **Unified Layout**: Use StatesInline's layout pattern (photo left, text right) across all entity types
2. **Fix Text Erasure**: Ensure text is preserved during photo upload operations
3. **Entity-Specific Customization**: Support different labels/prompts based on entity type
4. **Maintain Routes**: Keep existing `/add-observation/:assetType/:id` route structure
5. **Reusable Component**: Extract shared form logic into a composable component

## Requirements

### Requirement 1: Create Shared StateForm Component

**User Story:** As a developer, I want a reusable state form component, so that all entity types have consistent behavior and appearance.

#### Acceptance Criteria

1. WHEN the StateForm component is created, THE System SHALL accept entity_type, entity_id, and customization props
2. WHEN the StateForm renders, THE System SHALL display photos on the left and text input on the right
3. WHEN the StateForm receives textLabel prop, THE System SHALL use it as the label for the text input field
4. WHEN the StateForm receives textPlaceholder prop, THE System SHALL use it as the placeholder text
5. WHEN the StateForm receives mode prop, THE System SHALL adapt layout for "inline" or "full-page" contexts
6. WHEN photos are uploading, THE System SHALL preserve the text input value without clearing it
7. WHEN the StateForm is used, THE System SHALL support text-only, photo-only, and combined submissions
8. WHEN the StateForm validates submission, THE System SHALL require at least one of: text OR photos

### Requirement 2: Update AddObservation Page to Use Shared Component

**User Story:** As a user adding observations to parts or tools, I want a consistent interface that doesn't lose my text, so that I can efficiently document asset states.

#### Acceptance Criteria

1. WHEN the AddObservation page renders, THE System SHALL use the StateForm component internally
2. WHEN the assetType is "parts", THE System SHALL display "Observation Details" as the text label
3. WHEN the assetType is "parts", THE System SHALL display "Describe what you observed..." as the placeholder
4. WHEN the assetType is "tools", THE System SHALL display "Observation Details" as the text label
5. WHEN the assetType is "tools", THE System SHALL display "Describe what you observed..." as the placeholder
6. WHEN photos are uploaded, THE System SHALL preserve the observation text without clearing it
7. WHEN the observation is saved successfully, THE System SHALL navigate to '/combined-assets'
8. WHEN the user cancels, THE System SHALL navigate to '/combined-assets'

### Requirement 3: Maintain StatesInline Component with Shared Form

**User Story:** As a user adding observations to actions, I want the same reliable form behavior, so that my workflow is consistent.

#### Acceptance Criteria

1. WHEN the StatesInline component renders for actions, THE System SHALL use the StateForm component internally
2. WHEN the entity_type is "action", THE System SHALL display "Action and Reasoning" as the text label
3. WHEN the entity_type is "action", THE System SHALL display "What did you do, and why?" as the placeholder
4. WHEN the entity_type is "part", THE System SHALL display "Observation Text" as the text label
5. WHEN the entity_type is "part", THE System SHALL display "Describe what you observed..." as the placeholder
6. WHEN the entity_type is "tool", THE System SHALL display "Observation Text" as the text label
7. WHEN the entity_type is "tool", THE System SHALL display "Describe what you observed..." as the placeholder
8. WHEN the observation is saved, THE System SHALL keep the dialog open and refresh the list

### Requirement 4: Fix Text Erasure Bug

**User Story:** As a user, I want my observation text to remain intact during photo uploads, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN a user types observation text, THE System SHALL store it in component state
2. WHEN photos begin uploading, THE System SHALL NOT modify the text state
3. WHEN photos finish uploading successfully, THE System SHALL NOT modify the text state
4. WHEN photos fail to upload, THE System SHALL NOT modify the text state
5. WHEN the form is reset after successful submission, THE System SHALL clear the text state
6. WHEN the user cancels the form, THE System SHALL clear the text state

### Requirement 5: Standardize Photo Layout

**User Story:** As a user, I want a consistent photo layout across all observation forms, so that I have a predictable experience.

#### Acceptance Criteria

1. WHEN photos are displayed in the form, THE System SHALL show them in a vertical list
2. WHEN each photo is displayed, THE System SHALL show the image on the left (50% width)
3. WHEN each photo is displayed, THE System SHALL show the description textarea on the right (50% width)
4. WHEN each photo is displayed, THE System SHALL show a remove button
5. WHEN multiple photos are present, THE System SHALL display them as separate rows
6. WHEN a photo is uploading, THE System SHALL show a loading indicator on the image
7. WHEN a photo preview is available, THE System SHALL display it immediately (before S3 upload completes)

### Requirement 6: Support Entity-Specific Customization

**User Story:** As a developer, I want to customize form labels based on entity type, so that the UI is contextually appropriate.

#### Acceptance Criteria

1. WHEN the StateForm receives entity_type prop, THE System SHALL determine default labels
2. WHEN the StateForm receives textLabel prop, THE System SHALL override the default label
3. WHEN the StateForm receives textPlaceholder prop, THE System SHALL override the default placeholder
4. WHEN the StateForm receives submitButtonText prop, THE System SHALL use it for the submit button
5. WHEN the StateForm receives cancelButtonText prop, THE System SHALL use it for the cancel button
6. WHEN no custom labels are provided, THE System SHALL use sensible defaults based on entity_type

### Requirement 7: Maintain Existing Routes and Navigation

**User Story:** As a user, I want to access observation forms through familiar routes, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN a user navigates to `/add-observation/parts/:id`, THE System SHALL render the AddObservation page
2. WHEN a user navigates to `/add-observation/tools/:id`, THE System SHALL render the AddObservation page
3. WHEN the AddObservation page loads, THE System SHALL extract assetType and id from route params
4. WHEN the AddObservation page loads, THE System SHALL determine entity_type from assetType ("parts" → "part", "tools" → "tool")
5. WHEN the observation is saved, THE System SHALL navigate to the appropriate destination
6. WHEN the user cancels, THE System SHALL navigate to the appropriate destination

### Requirement 8: Preserve Existing Functionality

**User Story:** As a user, I want all existing observation features to continue working, so that I don't lose capabilities.

#### Acceptance Criteria

1. WHEN the StateForm is used, THE System SHALL support uploading multiple photos
2. WHEN the StateForm is used, THE System SHALL support adding descriptions to each photo
3. WHEN the StateForm is used, THE System SHALL support removing photos before submission
4. WHEN the StateForm is used, THE System SHALL support editing photo descriptions
5. WHEN the StateForm is used, THE System SHALL show upload progress for multiple files
6. WHEN the StateForm is used, THE System SHALL validate that at least one of text or photos is provided
7. WHEN the StateForm is used, THE System SHALL display appropriate error messages
8. WHEN the StateForm is used, THE System SHALL disable the submit button during upload/save operations

### Requirement 9: Maintain Inline Component Behavior

**User Story:** As a user working within dialogs, I want inline observation forms to behave correctly, so that I can work efficiently without navigation.

#### Acceptance Criteria

1. WHEN StatesInline uses the StateForm, THE System SHALL render it in inline mode
2. WHEN an observation is saved in inline mode, THE System SHALL NOT navigate away
3. WHEN an observation is saved in inline mode, THE System SHALL refresh the observations list
4. WHEN an observation is saved in inline mode, THE System SHALL reset the form
5. WHEN the user cancels in inline mode, THE System SHALL hide the form without navigation
6. WHEN the form is in inline mode, THE System SHALL use compact styling appropriate for dialogs

### Requirement 10: Ensure Consistent Validation

**User Story:** As a user, I want consistent validation across all observation forms, so that I understand what is required.

#### Acceptance Criteria

1. WHEN a user attempts to submit with no text and no photos, THE System SHALL display "Please add observation text or at least one photo"
2. WHEN a user attempts to submit with text only, THE System SHALL accept the submission
3. WHEN a user attempts to submit with photos only, THE System SHALL accept the submission
4. WHEN a user attempts to submit with both text and photos, THE System SHALL accept the submission
5. WHEN validation fails, THE System SHALL keep the form open with data intact
6. WHEN validation fails, THE System SHALL focus on the appropriate field or show a toast message
