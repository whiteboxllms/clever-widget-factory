# Implementation Plan: Nonlinear State-Space Simulator

## Overview

This plan replaces the linear A/B/C/D state-space format with a nonlinear simulator. The work proceeds in layers: schema first (frontend + Lambda), then simulation engine, then page UI, then tests. Each task builds on the previous — no orphaned code.

## Tasks

- [x] 1. Install mathjs dependency and rewrite frontend schema
  - [x] 1.1 Add `mathjs` to root `package.json` and run install
    - Add `mathjs` as a production dependency in the root `package.json`
    - Run `npm install` to update `package-lock.json`
    - _Requirements: 9.1, 11.1, 11.2, 11.3_

  - [x] 1.2 Rewrite `src/lib/stateSpaceSchema.ts` with nonlinear Zod schemas
    - Remove all linear-format schemas: `dimensionsSchema`, `labelsSchema`, `matrixSchema`, `matricesSchema`, `stateSpaceSchema` (the `state_space` sub-schema)
    - Remove the `validateDimensions` function
    - Define new Zod schemas for all 8 top-level sections: `modelMetadataSchema`, `constantsSchema` (record of `{ value: number, name: string, unit: string }`), `stateDefinitionsSchema` (record of `{ id: string, name: string, unit: string, default_value: number }`), `inputVectorsSchema` (`{ u_actuators: Record<string, string>, v_shocks: Record<string, string> }`), `nonLinearTransitionsSchema` (record of string to string), `stateUpdateEquationsSchema` (record of string to string), `simulationConfigSchema` (`{ dt: positive number, total_days: positive number }`), and the top-level `nonlinearModelSchema`
    - Export `NonlinearModel` type inferred from the schema, and alias `StateSpaceModel = NonlinearModel` for backward compat with `stateSpaceApi.ts`
    - Remove old types: `Dimensions`, `Labels`, `Matrix`, `Matrices`, `StateSpace`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 9.1, 9.2, 9.3_

  - [x] 1.3 Implement `validateCrossReferences` function in `stateSpaceSchema.ts`
    - Verify every key `K_next` in `state_update_equations` has a corresponding `K` in `state_definitions`
    - Verify every key `K` in `state_definitions` has a corresponding `K_next` in `state_update_equations`
    - Return error strings identifying orphaned equation keys and missing equations
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.4 Implement `validateExpressions` function in `stateSpaceSchema.ts`
    - Use `mathjs.parse()` to check each expression in `non_linear_transitions` and `state_update_equations` for syntax validity
    - Extract variable references from parsed AST (`SymbolNode` names), filtering out mathjs built-in functions (`exp`, `max`, `min`, `abs`, `sqrt`, `log`, `sin`, `cos`, `tan`, `pow`, `ceil`, `floor`, `round`) and constants (`pi`, `e`)
    - Validate that each referenced variable exists in the valid scope: constants keys, state_definitions keys, u_actuators keys, v_shocks keys, previously declared transition keys (for transitions) / all transition keys (for equations), and built-ins `dt`, `t`
    - Return error strings identifying the expression key and the parse error or undefined variable name
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 9.5_

  - [x] 1.5 Update `validateStateSpaceJson` to use new validation pipeline
    - Keep the same signature: `(jsonString: string) => ValidationResult`
    - Phase 1: empty input check (unchanged)
    - Phase 2: JSON.parse (unchanged)
    - Phase 3: Zod schema validation with `nonlinearModelSchema`
    - Phase 4: cross-reference validation via `validateCrossReferences`
    - Phase 5: expression validation via `validateExpressions`
    - Each phase short-circuits on failure
    - Reject old linear format (containing `state_space` with `dimensions`/`labels`/`matrices`) with descriptive errors
    - _Requirements: 1.11, 9.4_

- [x] 2. Checkpoint — Verify schema compiles and exports are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Rewrite Lambda server-side validation
  - [x] 3.1 Add `mathjs` to `lambda/state-space-models/package.json` and run install
    - Add `mathjs` as a production dependency
    - Run `npm install` in the `lambda/state-space-models/` directory
    - _Requirements: 8.1_

  - [x] 3.2 Rewrite `lambda/state-space-models/shared/validation.js` for nonlinear format
    - Remove all linear-format Zod schemas (`dimensionsSchema`, `labelsSchema`, `matrixSchema`, `matricesSchema`, `stateSpaceSchema`)
    - Remove the `validateDimensions` function
    - Define new Zod schemas mirroring the frontend `stateSpaceSchema.ts` (8 top-level sections)
    - Implement cross-reference validation: `state_update_equations` keys match `state_definitions` keys with `_next` suffix
    - Implement expression syntax validation using `mathjs.parse()`
    - Keep the same `validateStateSpaceModel(jsonBody)` export signature returning `{ success: true, model }` or `{ success: false, errors: string[] }`
    - Remove all linear-format validation (dimensions, labels, matrices)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4. Create simulation engine
  - [x] 4.1 Create `src/lib/simulationEngine.ts` with Forward Euler integration
    - Export `SimulationResult`, `SimulationError`, `SimulationOutcome` types as defined in the design
    - Export `runSimulation(model, initialConditionOverrides?, actuatorOverrides?)` function
    - Compile all `non_linear_transitions` and `state_update_equations` expressions once using `mathjs.compile()`
    - Implement dry-run validation: evaluate all expressions once with initial conditions, check for NaN/Infinity
    - Implement Forward Euler loop: for each time step, build scope (states, constants, actuator inputs, `dt`, `t`), evaluate transitions in declaration order, evaluate state update equations, record state vector
    - Compute total steps as `Math.floor((total_days * 24) / dt)`; record initial state at t=0 plus one entry per step
    - Initialize state values from `default_value` in `state_definitions`, overridden by `initialConditionOverrides`
    - Initialize actuator values from `actuatorOverrides` (default 0 if not provided)
    - Check for NaN/Infinity after each time step; halt simulation and return error with expression key and time step
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 4.2 Export `normalizeTrajectory` utility function
    - Given a `SimulationResult`, return a new `stateHistory` where each state's values are mapped to [0, 100] based on observed min/max
    - If min equals max for a state, map all values to 50
    - _Requirements: 6.4_

- [x] 5. Checkpoint — Verify simulation engine compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Rewrite StateSpacePage for nonlinear display and simulation
  - [x] 6.1 Rewrite `src/pages/StateSpacePage.tsx` — model display sections
    - Remove the `MatrixTable` component, `getMatrixConfigs` helper, KaTeX imports, `Latex` component, and the linear equations collapsible header
    - Remove the Dimensions & Labels card
    - Keep Model Metadata card (name, version, author, description) — unchanged
    - Keep Model Description Prompt card — unchanged
    - Add Constants table card (key, name, value, unit)
    - Add State Definitions table card (key, id, name, unit, default_value)
    - Add Input Vectors section card (u_actuators table, v_shocks table with key and description)
    - Add Non-Linear Transitions section card (key + expression in monospace `<code>` blocks)
    - Add State Update Equations section card (key + expression in monospace `<code>` blocks)
    - Add Simulation Config card (dt, total_days)
    - Update the example model in the "Show Example" button to use the Sapi-an composting test fixture from the design doc
    - Keep existing persistence integration (save/load/library) — the `model_definition` is opaque JSONB
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [x] 6.2 Add simulation controls and Recharts chart to `StateSpacePage.tsx`
    - Add a sliders panel with one Radix Slider per state variable for initial conditions, initialized from `default_value`
    - Add a sliders panel with one Radix Slider per actuator input (from `u_actuators`), default range 0–1
    - Add a "Run Simulation" button that calls `runSimulation` from `simulationEngine.ts` with slider overrides
    - Display simulation errors in a destructive Card above the chart area
    - Add a Recharts `LineChart` with time in days on x-axis, state values on y-axis, one `Line` per state variable with distinct colors
    - Support toggling individual state series visibility by clicking legend items
    - Add a toggle between raw values view and normalized view (using `normalizeTrajectory`)
    - Transform `SimulationResult` to Recharts data format: `[{ time, x1, x2, ... }, ...]`
    - Chart is populated only after simulation completes (not during)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 7. Update StateSpaceModelLibrary display
  - [x] 7.1 Update `src/components/StateSpaceModelLibrary.tsx` for new format
    - Update the model card display to show state count (`Object.keys(model_definition.state_definitions).length`) and equation count instead of matrix dimensions
    - No functional changes — just display text updates
    - _Requirements: 7.10_

- [x] 8. Checkpoint — Verify page renders and simulation runs
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Rewrite schema unit tests
  - [x] 9.1 Rewrite `src/lib/stateSpaceSchema.test.ts` for nonlinear format
    - Remove all linear-format test helpers (`makeModel` with dimensions/matrices)
    - Add a `makeNonlinearModel` helper that builds a minimal valid `NonlinearModel`
    - Include the full Sapi-an composting test fixture from the design doc as a test constant
    - Test: validate the complete Sapi-an composting model passes validation
    - Test: reject old linear format with `state_space.dimensions.matrices` with descriptive errors
    - Test: reject model with orphaned equation key (e.g., `x3_next` without `x3` in `state_definitions`)
    - Test: reject model with missing equation (e.g., `x1` in `state_definitions` but no `x1_next`)
    - Test: reject model with unparseable expression (e.g., `"x1 ** x2"`)
    - Test: reject model with undefined variable reference
    - Test: validate empty `constants` and `input_vectors` (valid — optional records)
    - Test: reject negative `dt` or `total_days`
    - Test: empty input and invalid JSON still return appropriate errors
    - _Requirements: 10.4_

- [x] 10. Rewrite schema property tests
  - [x] 10.1 Rewrite `src/lib/stateSpaceSchema.property.test.ts` with nonlinear arbitraries
    - Remove all linear-format arbitraries (`arbMatrix`, `arbValidStateSpace`, etc.)
    - Implement custom arbitraries: `arbIdentifier`, `arbValidModelMetadata`, `arbConstants`, `arbStateDefinitions`, `arbInputVectors`, `arbTransitions`, `arbStateUpdateEquations`, `arbSimulationConfig`, `arbValidNonlinearModel`, `arbInvalidNonlinearModel`
    - Use the expression generation strategy from the design: template-based expressions with scope variable substitution to ensure syntactic validity
    - _Requirements: 10.1_

  - [ ]* 10.2 Write property test for Property 1: Schema validation accepts valid nonlinear models and rejects invalid ones
    - **Property 1: Schema validation accepts valid nonlinear models and rejects invalid ones**
    - Generate valid models → pass. Generate invalid models (missing sections, wrong types, old format) → fail with errors.
    - **Validates: Requirements 1.1–1.11, 9.4, 10.2, 10.3**

  - [ ]* 10.3 Write property test for Property 2: Cross-reference key consistency
    - **Property 2: Cross-reference key consistency**
    - Generate models with matching keys → pass. Generate models with orphaned/missing equation keys → fail.
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 10.4 Write property test for Property 3: Expression parseability
    - **Property 3: Expression parseability**
    - Generate models with valid expressions → pass. Generate models with syntax errors → fail.
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 10.5 Write property test for Property 4: Variable reference resolution
    - **Property 4: Variable reference resolution**
    - Generate models with all variables in scope → pass. Generate models with undefined variables → fail.
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [ ]* 10.6 Write property test for Property 5: JSON round-trip
    - **Property 5: JSON round-trip**
    - Generate valid models → `JSON.stringify` → `JSON.parse` → deep equal.
    - **Validates: Requirements 10.5, 7.10**

- [ ] 11. Create simulation engine property tests
  - [ ]* 11.1 Write property test for Property 6: Forward Euler single-step correctness
    - **Property 6: Forward Euler single-step correctness**
    - Generate simple models with constant/linear expressions → run 1 step → verify `x_next = x + f(x) * dt`.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.1**

  - [ ]* 11.2 Write property test for Property 7: Simulation output length
    - **Property 7: Simulation output length**
    - Generate valid models with various `dt`/`total_days` → verify output has `Math.floor((total_days * 24) / dt) + 1` time points and each state history has the same length.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 11.3 Write property test for Property 8: Initial condition overrides
    - **Property 8: Initial condition overrides**
    - Generate models + random overrides → verify first state entry matches override or default_value.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.6**

  - [ ]* 11.4 Write property test for Property 9: Dry-run catches expression errors
    - **Property 9: Dry-run catches expression errors before full simulation**
    - Generate models with bad expressions (undefined variables) → verify failure before any trajectory data.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 11.5 Write property test for Property 10: NaN/Infinity halts simulation
    - **Property 10: NaN/Infinity halts simulation mid-run**
    - Generate models with expressions that blow up (e.g., `exp(1000 * t)`) → verify halt with error identifying expression key and time step.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 11.5**

  - [ ]* 11.6 Write property test for Property 11: Normalization bounds
    - **Property 11: Normalization bounds**
    - Generate random trajectories → normalize → verify all values in [0, 100], min maps to 0, max maps to 100, constant values map to 50.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 6.4**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–11)
- Unit tests validate specific examples and edge cases (Sapi-an composting fixture)
- The existing persistence infrastructure (Lambda CRUD, hooks, API service) is unchanged — only validation and display change
