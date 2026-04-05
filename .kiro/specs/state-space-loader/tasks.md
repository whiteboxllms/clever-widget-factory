# Implementation Plan: State Space Loader

## Overview

Frontend-only feature that adds a state-space model loader/validator/editor page. Implementation proceeds bottom-up: validation logic first, then the page component, then wiring into existing routes and dialogs.

## Tasks

- [x] 1. Create Zod schema and validation module
  - [x] 1.1 Create `src/lib/stateSpaceSchema.ts` with Zod schema and types
    - Define all TypeScript interfaces: `ModelMetadata`, `Dimensions`, `Labels`, `Matrix`, `Matrices`, `StateSpace`, `AiFlavor`, `SimulationParams`, `StateSpaceModel`
    - Implement Zod schemas: `modelMetadataSchema`, `dimensionsSchema`, `labelsSchema`, `matrixSchema`, `matricesSchema`, `stateSpaceSchema`, `aiFlavorSchema`, `simulationParamsSchema`, `stateSpaceModelSchema`
    - Export inferred `StateSpaceModel` type from Zod schema
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11_

  - [x] 1.2 Implement `validateDimensions` function in `src/lib/stateSpaceSchema.ts`
    - Check Matrix A is n×n, B is n×m, C is p×n, D is p×m
    - Check label array lengths match declared dimensions
    - Check for jagged arrays (rows with inconsistent column counts)
    - Return specific error messages with expected vs actual sizes (e.g., "Matrix A: expected 4×4, got 4×3")
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 1.3 Implement `validateStateSpaceJson` combined entry point in `src/lib/stateSpaceSchema.ts`
    - Parse JSON string, catch `SyntaxError` and return parse error message
    - Run Zod schema validation, flatten `ZodError.issues` into readable error list with paths
    - Run dimension validation if schema passes
    - Return `{ success: true; model: StateSpaceModel }` or `{ success: false; errors: string[] }`
    - Handle empty input with "JSON input is required." error
    - _Requirements: 3.3, 4.1, 4.10_

  - [ ]* 1.4 Write property test: Invalid JSON produces parse errors
    - **Property 1: Invalid JSON produces parse errors**
    - Use `fc.string()` filtered to non-valid-JSON to generate arbitrary invalid JSON strings
    - Assert `validateStateSpaceJson` returns `{ success: false }` with error array containing parse-related message
    - **Validates: Requirements 4.1**

  - [ ]* 1.5 Write property test: Schema validation rejects structurally invalid models
    - **Property 2: Schema validation rejects structurally invalid models**
    - Generate valid JSON objects missing required top-level sections or with wrong field types
    - Assert Zod schema rejects with one or more errors
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**

  - [ ]* 1.6 Write property test: Schema validation accepts all valid models
    - **Property 3: Schema validation accepts all valid models**
    - Build `arbValidStateSpaceModel()` arbitrary composing `arbValidDimensions()`, `arbValidLabels(dims)`, `arbValidMatrices(dims)`
    - Assert Zod schema accepts without errors
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**

  - [ ]* 1.7 Write property test: Dimension validation rejects mismatched models
    - **Property 4: Dimension validation rejects mismatched models**
    - Use `arbMismatchedModel()` to generate schema-valid models with intentionally wrong matrix dimensions or label lengths
    - Assert `validateDimensions` returns one or more error messages
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**

  - [ ]* 1.8 Write property test: Dimension validation accepts correctly dimensioned models
    - **Property 5: Dimension validation accepts correctly dimensioned models**
    - Use `arbValidStateSpaceModel()` with correctly dimensioned matrices and labels
    - Assert `validateDimensions` returns empty error array
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9**

  - [ ]* 1.9 Write property test: JSON format round-trip
    - **Property 7: JSON format round-trip**
    - For any valid `StateSpaceModel`, `JSON.stringify(JSON.parse(JSON.stringify(model, null, 2)), null, 2)` produces identical output
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 2. Checkpoint - Validation module complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create StateSpacePage component
  - [x] 3.1 Create `src/pages/StateSpacePage.tsx` with empty/paste state
    - Extract `actionId` from `useParams`
    - Implement page header with back button navigating to `/actions/${actionId}` and action ID display
    - Implement monospace textarea (min 15 rows) for JSON paste input
    - Implement "Validate & Load" button that calls `validateStateSpaceJson`
    - Display validation errors as a list when validation fails
    - Use shadcn-ui `Card`, `Button`, `Textarea` and Tailwind CSS consistent with existing pages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Implement model display view in `StateSpacePage`
    - Render `model_metadata` card showing `model_id`, `version`, `author`, `description`
    - Render dimensions summary (states, inputs, outputs counts)
    - Render labels grouped by states, inputs, outputs
    - Render each matrix (A, B, C, D) as a table with row/column headers from labels: A uses state/state, B uses state/input, C uses output/state, D uses output/input
    - Render `ai_flavor` section with system prompt and intervention guidance entries
    - Render `simulation_params` section with step size, run days, SPC threshold
    - Transition from empty state to display state on successful validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 9.1_

  - [x] 3.3 Implement edit mode in `StateSpacePage`
    - Add "Edit" button visible in display mode
    - Switch to editable textarea pre-populated with `JSON.stringify(model, null, 2)`
    - "Save" button runs full validation pipeline; on success update model and return to display, on failure show errors and stay in edit mode preserving content
    - "Cancel" button discards edits and returns to display view with previous valid model
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 9.1, 9.2, 9.3_

  - [ ]* 3.4 Write property test: Matrix label mapping correctness
    - **Property 6: Matrix label mapping correctness**
    - For any valid model, verify the display component assigns: A → state rows/state cols, B → state rows/input cols, C → output rows/state cols, D → output rows/input cols
    - Test the label-mapping helper/logic, not the rendered DOM
    - **Validates: Requirements 6.5, 6.6, 6.7, 6.8**

- [x] 4. Checkpoint - Page component complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Wire route and dialog entry point
  - [x] 5.1 Add protected route in `src/App.tsx`
    - Import `StateSpacePage` from `@/pages/StateSpacePage`
    - Add `<Route path="/actions/:actionId/state-space" element={<ProtectedRoute><StateSpacePage /></ProtectedRoute>} />` above the catch-all route
    - _Requirements: 2.1_

  - [x] 5.2 Add "State Space" image button to `src/components/UnifiedActionDialog.tsx`
    - Import `useNavigate` from `react-router-dom`
    - Add a clickable image button conditionally rendered when `actionId` exists (not creation mode)
    - Use the dormant gundam image at `/dormant_gundam_state.png` (from `public/` directory) as the button graphic
    - Button navigates to `/actions/${actionId}/state-space` on click
    - Image should be small (e.g., 32×32 or 40×40) with hover effect and tooltip "State Space"
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 6. Final checkpoint - Feature complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` with minimum 100 iterations per property
- All validation logic is in `stateSpaceSchema.ts` (pure functions, no React dependencies) for easy testing
- No backend, no API calls, no localStorage — model lives in React state only
