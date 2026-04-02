# Requirements Document

## Introduction

A generic state-space equation loader and editor UI for the CWF application. This is the first piece of a larger "Digital Twin" framework that combines physics-based control theory with AI for processes like composting.

The standard discrete-time state-space representation is:

```
x[k+1] = A·x[k] + B·u[k]
y[k]   = C·x[k] + D·u[k]
```

Where `x` is the state vector, `u` is the input (control) vector, `y` is the output (measurement) vector, and `A`, `B`, `C`, `D` are the system matrices that define how states evolve and how outputs relate to states and inputs.

Users paste a JSON model into a textarea, the system validates both the JSON schema and matrix dimensions, and then displays the validated model in a readable format with editable fields. The entry point is a button on the Action detail dialog that navigates to a dedicated page. No backend persistence is included in this spec — the model lives in React state only.

## Glossary

- **State_Space_Page**: The new React page at `/actions/:actionId/state-space` that provides the loader, validator, editor, and display for state-space models
- **State_Space_Model**: A JSON object containing four required top-level sections: `model_metadata`, `state_space`, `ai_flavor`, and `simulation_params`
- **Model_Metadata**: The section of a State_Space_Model containing identification fields: `model_id`, `version`, `author`, and `description`
- **Dimensions_Object**: The `state_space.dimensions` object declaring the expected sizes: `states` (n), `inputs` (m), and `outputs` (p)
- **Matrix_A**: The state transition matrix with dimensions n×n (states × states)
- **Matrix_B**: The input matrix with dimensions n×m (states × inputs)
- **Matrix_C**: The output matrix with dimensions p×n (outputs × states)
- **Matrix_D**: The feedthrough matrix with dimensions p×m (outputs × inputs)
- **Labels_Object**: The `state_space.labels` object containing arrays of human-readable names for states, inputs, and outputs
- **AI_Flavor**: The section containing `system_prompt` and `intervention_guidance` for AI-assisted control
- **Simulation_Params**: The section containing `step_size_minutes`, `default_run_days`, and `spc_threshold_sigma`
- **Schema_Validator**: The Zod schema that validates the JSON structure and required fields of a State_Space_Model
- **Dimension_Validator**: The validation logic that checks matrix dimensions against the declared Dimensions_Object
- **Action_Dialog_Button**: The button added to the UnifiedActionDialog component that navigates to the State_Space_Page for the current action

## Requirements

### Requirement 1: Action Dialog Entry Point

**User Story:** As a user viewing an action, I want a button on the Action detail dialog that takes me to the state-space editor for that action, so that I can load and view a physics model associated with the action.

#### Acceptance Criteria

1. WHEN the UnifiedActionDialog is open for an existing action, THE Action_Dialog_Button SHALL be visible and labeled "State Space"
2. WHEN the user clicks the Action_Dialog_Button, THE State_Space_Page SHALL open at the route `/actions/:actionId/state-space` using the current action's ID
3. THE Action_Dialog_Button SHALL NOT appear when the UnifiedActionDialog is in creation mode (no actionId exists)
4. THE Action_Dialog_Button SHALL use the dormant gundam image (`/dormant_gundam_state.png`) as a clickable graphic with a tooltip for identification

### Requirement 2: Route and Page Setup

**User Story:** As a user, I want a dedicated page for loading and editing state-space models, so that I have enough screen space to work with matrices and model details.

#### Acceptance Criteria

1. THE State_Space_Page SHALL be accessible at the route `/actions/:actionId/state-space` as a protected route requiring authentication
2. THE State_Space_Page SHALL include a back button that navigates to `/actions/:actionId` to return the user to the action dialog
3. THE State_Space_Page SHALL display the action ID in the page header for context
4. THE State_Space_Page SHALL use shadcn-ui components and Tailwind CSS consistent with existing CWF pages

### Requirement 3: JSON Paste Input

**User Story:** As a user, I want to paste a JSON state-space model into a textarea, so that I can load a model without needing file upload.

#### Acceptance Criteria

1. THE State_Space_Page SHALL display a textarea for pasting JSON content
2. THE State_Space_Page SHALL provide a "Validate & Load" button that triggers validation of the pasted JSON
3. WHEN the textarea is empty and the user clicks "Validate & Load", THE State_Space_Page SHALL display an error message indicating that JSON input is required
4. THE textarea SHALL use a monospace font and provide sufficient rows (minimum 15) for readability of the JSON model

### Requirement 4: JSON Schema Validation

**User Story:** As a user, I want the system to validate that my pasted JSON has the correct structure and required fields, so that I catch structural errors before working with the model.

#### Acceptance Criteria

1. WHEN the user submits JSON for validation, THE Schema_Validator SHALL verify the JSON is syntactically valid and display a parse error message if parsing fails
2. THE Schema_Validator SHALL verify the presence of all four required top-level sections: `model_metadata`, `state_space`, `ai_flavor`, and `simulation_params`
3. THE Schema_Validator SHALL verify that `model_metadata` contains required string fields: `model_id`, `version`, `author`, and `description`
4. THE Schema_Validator SHALL verify that `state_space` contains required objects: `dimensions`, `labels`, and `matrices`
5. THE Schema_Validator SHALL verify that `dimensions` contains required positive integer fields: `states`, `inputs`, and `outputs`
6. THE Schema_Validator SHALL verify that `labels` contains three arrays of strings: `states`, `inputs`, and `outputs`
7. THE Schema_Validator SHALL verify that `matrices` contains four required fields: `A`, `B`, `C`, and `D`, each being a two-dimensional array of numbers
8. THE Schema_Validator SHALL verify that `ai_flavor` contains required fields: `system_prompt` (string) and `intervention_guidance` (object with string values)
9. THE Schema_Validator SHALL verify that `simulation_params` contains required numeric fields: `step_size_minutes`, `default_run_days`, and `spc_threshold_sigma`
10. WHEN schema validation fails, THE State_Space_Page SHALL display all Zod validation errors in a readable list so the user can fix all issues at once
11. THE Schema_Validator SHALL be implemented using Zod, consistent with the existing CWF validation approach

### Requirement 5: Matrix Dimension Validation

**User Story:** As a user, I want the system to verify that my matrices have the correct dimensions matching the declared state/input/output counts, so that I catch dimension mismatches before using the model.

#### Acceptance Criteria

1. WHEN schema validation passes, THE Dimension_Validator SHALL verify that Matrix_A has exactly n rows and n columns, where n equals `dimensions.states`
2. THE Dimension_Validator SHALL verify that Matrix_B has exactly n rows and m columns, where n equals `dimensions.states` and m equals `dimensions.inputs`
3. THE Dimension_Validator SHALL verify that Matrix_C has exactly p rows and n columns, where p equals `dimensions.outputs` and n equals `dimensions.states`
4. THE Dimension_Validator SHALL verify that Matrix_D has exactly p rows and m columns, where p equals `dimensions.outputs` and m equals `dimensions.inputs`
5. THE Dimension_Validator SHALL verify that the `labels.states` array length equals `dimensions.states`
6. THE Dimension_Validator SHALL verify that the `labels.inputs` array length equals `dimensions.inputs`
7. THE Dimension_Validator SHALL verify that the `labels.outputs` array length equals `dimensions.outputs`
8. WHEN dimension validation fails, THE State_Space_Page SHALL display specific error messages identifying which matrix or label array has incorrect dimensions, including expected and actual sizes
9. THE Dimension_Validator SHALL verify that each row within a matrix has the same number of columns (no jagged arrays)

### Requirement 6: Model Display

**User Story:** As a user, I want to see the validated model displayed in a readable format with metadata, labels, and matrices rendered as grids, so that I can understand the model at a glance.

#### Acceptance Criteria

1. WHEN validation succeeds, THE State_Space_Page SHALL display the Model_Metadata as a card showing `model_id`, `version`, `author`, and `description`
2. THE State_Space_Page SHALL display the Dimensions_Object as a summary showing the count of states, inputs, and outputs
3. THE State_Space_Page SHALL display the Labels_Object with state, input, and output labels clearly grouped
4. THE State_Space_Page SHALL render each matrix (A, B, C, D) as a grid or table with row and column headers derived from the Labels_Object
5. THE State_Space_Page SHALL display Matrix_A with state labels on both rows and columns
6. THE State_Space_Page SHALL display Matrix_B with state labels on rows and input labels on columns
7. THE State_Space_Page SHALL display Matrix_C with output labels on rows and state labels on columns
8. THE State_Space_Page SHALL display Matrix_D with output labels on rows and input labels on columns
9. THE State_Space_Page SHALL display the AI_Flavor section showing the system prompt and intervention guidance entries
10. THE State_Space_Page SHALL display the Simulation_Params section showing step size, run days, and SPC threshold

### Requirement 7: Model Editing

**User Story:** As a user, I want to edit the loaded model using a textarea-based editor similar to the ScoringPrompts pattern, so that I can make adjustments to the model after loading it.

#### Acceptance Criteria

1. WHEN a model is loaded and displayed, THE State_Space_Page SHALL provide an "Edit" button that switches to an editing mode
2. WHEN the user enters editing mode, THE State_Space_Page SHALL display the current model as formatted JSON in an editable textarea
3. WHEN the user submits edits, THE State_Space_Page SHALL run both schema validation and dimension validation on the edited JSON before accepting changes
4. IF validation of edited JSON fails, THEN THE State_Space_Page SHALL display the validation errors and keep the user in editing mode without losing the edited content
5. WHEN the user clicks "Cancel" during editing, THE State_Space_Page SHALL discard changes and return to the display view of the previously validated model
6. THE editing textarea SHALL pre-populate with the current model JSON formatted with 2-space indentation for readability

### Requirement 8: JSON Pretty-Print and Round-Trip Integrity

**User Story:** As a user, I want the system to format my model JSON consistently, so that the display and edit views always show clean, readable JSON.

#### Acceptance Criteria

1. THE State_Space_Page SHALL format the validated State_Space_Model as JSON with 2-space indentation when displaying in the edit textarea
2. FOR ALL valid State_Space_Model objects, parsing the formatted JSON and re-formatting SHALL produce an identical string (round-trip property)
3. THE State_Space_Page SHALL preserve all numeric precision from the original pasted JSON (no floating-point rounding during parse-format cycles)

### Requirement 9: State Management

**User Story:** As a user, I want the loaded model to persist in React state while I navigate within the page, so that I do not lose my work during editing.

#### Acceptance Criteria

1. THE State_Space_Page SHALL store the validated State_Space_Model in React component state
2. WHEN the user navigates away from the State_Space_Page, THE State_Space_Page SHALL NOT persist the model (no backend storage, no localStorage in this spec)
3. WHEN the user returns to the State_Space_Page after navigating away, THE State_Space_Page SHALL show the empty paste input (no cached model)
