# Implementation Plan: Control Rule Charts

## Overview

Implement per-variable SPC-style control charts on the StateSpacePage, driven by the control policy in the NonlinearModel. This involves creating a pure utility module for extraction logic, a generic SPCChart component, exporting an existing function, and wiring everything into the StateSpacePage. All work is frontend-only (TypeScript/React).

## Tasks

- [x] 1. Export `extractVariables` from `stateSpaceSchema.ts` and create `controlRuleChartUtils.ts` with extraction functions
  - [x] 1.1 Export the existing `extractVariables` function in `src/lib/stateSpaceSchema.ts`
    - Change `function extractVariables` to `export function extractVariables`
    - Ensure existing internal callers still work
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create `src/lib/controlRuleChartUtils.ts` with `extractControlRuleVariables`
    - Import `parse` from mathjs and `extractVariables` from `stateSpaceSchema`
    - Define `ExtractedThreshold`, `ExtractedDependency` interfaces per design
    - Implement `extractControlRuleVariables(controlPolicy, stateDefinitions)` that parses all phase rule conditions and exit thresholds, collects SymbolNode names, deduplicates, and filters to keys present in `state_definitions`
    - Handle parse errors gracefully by skipping failed expressions
    - Return empty set for missing/empty phases
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.3 Implement `extractThresholds` in `controlRuleChartUtils.ts`
    - Parse rule conditions and exit thresholds with `mathjs.parse()`
    - Find top-level `OperatorNode` with comparison operators (`<`, `>`, `<=`, `>=`, `==`)
    - Extract `ConstantNode` value as threshold, associate with phase name
    - Handle compound LHS expressions (e.g., `x7 / (...) < 0.45`) — extract first state variable as primary
    - Skip expressions comparing two variables (no ConstantNode)
    - Return `ExtractedThreshold[]` with `value`, `label`, `phaseName`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.4 Implement `extractDependencies` in `controlRuleChartUtils.ts`
    - Look up `{variableKey}_next` in `state_update_equations`
    - Use `extractVariables()` to get all referenced symbols
    - Filter to keep only keys in `state_definitions` or `u_actuators`
    - Exclude the variable itself, constants, transition keys, shocks, and built-ins (`dt`, `t`)
    - Mark each dependency with `isActuator: true/false`
    - Return empty array if equation key doesn't exist or parse fails
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ]* 1.5 Write unit tests for `controlRuleChartUtils` in `src/lib/controlRuleChartUtils.test.ts`
    - Test `extractControlRuleVariables` with the Sapi-an composting model (expect `{x1, x8, x9, x7}` or similar)
    - Test empty phases array returns empty set
    - Test phases with no rules and null exit thresholds returns empty set
    - Test filtering out constants (`K_o`) and actuator keys (`u_fan`)
    - Test compound expressions like `x7 / (x2 + x3 + ...) < 0.45`
    - Test `extractThresholds` extracts `{1.0, 0.8, 0.5}` for `x8`
    - Test `extractThresholds` extracts exit threshold values for `x1`
    - Test `extractThresholds` returns empty for variable with no thresholds
    - Test `extractThresholds` skips variable-vs-variable comparisons
    - Test `extractDependencies` for `x8` returns `u_fan`, `x2`, `x3` etc.
    - Test `extractDependencies` returns empty when equation key doesn't exist
    - Test `extractDependencies` excludes self and marks actuators correctly
    - _Requirements: 1.1–1.7, 2.1–2.6, 5.5–5.7_

- [x] 2. Checkpoint — Verify extraction logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create the generic `SPCChart` component
  - [x] 3.1 Create `src/components/SPCChart.tsx` with generic props interface
    - Define `SPCThreshold`, `SPCPhaseBand`, `SPCIndependentVariable`, `SPCChartProps` interfaces per design
    - Do NOT import `NonlinearModel`, `GoldenPathResult`, or any state-space types
    - Implement component using Recharts: `ResponsiveContainer` > `LineChart`
    - Render controlled variable as `Line` on right `YAxis` (linear scale)
    - Render `ReferenceLine` (horizontal, dashed) for each threshold with label
    - Render `ReferenceArea` for each phase band using `PHASE_BAND_COLORS` palette
    - Include "Show Independent Variables" toggle button (only when `independentVariables` is non-empty)
    - When toggle is on: render IV lines on left `YAxis` (log scale), thinner stroke, lower opacity
    - Show `Legend` for IV lines when toggle is on
    - Left Y-axis only visible when toggle is on
    - Use chart title from `label` and `unit` props
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.8, 5.9_

  - [ ]* 3.2 Write unit tests for `SPCChart` in `src/components/SPCChart.test.tsx`
    - Renders without crashing with minimal props (empty thresholds, empty phaseBands)
    - Does not show toggle button when independentVariables is empty/omitted
    - Shows toggle button when independentVariables is provided
    - Verify component does not import state-space-specific types (static import check)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Checkpoint — Verify SPCChart component
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate SPC charts into StateSpacePage
  - [x] 5.1 Wire extraction utils and SPCChart into `src/pages/StateSpacePage.tsx`
    - Import `extractControlRuleVariables`, `extractThresholds`, `extractDependencies` from `controlRuleChartUtils`
    - Import `SPCChart` component
    - After golden path simulation completes and model has `control_policy`:
      - Call `extractControlRuleVariables` to get controlled variable keys
      - For each key: call `extractThresholds`, `extractDependencies`
      - Transform data into `SPCChartProps` format using `gpResult.stateHistory`, `gpResult.actuatorTraces`, `gpResult.timePoints`, `model.state_definitions`
      - Compute `SPCPhaseBand[]` from existing `computePhaseBands` helper
    - Render one `SPCChart` per controlled variable above the main state trajectories chart
    - Skip charts for variables missing from `stateHistory`
    - Skip IV dependencies missing from `actuatorTraces`
    - Do not render SPC charts when `gpResult` is null or `control_policy` is undefined
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.6, 5.7_

- [x] 6. Checkpoint — Verify full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Property-based tests for extraction functions
  - [ ]* 7.1 Write property test for variable extraction (Property 1)
    - **Property 1: Variable extraction returns exactly the state definition keys referenced in control policy expressions**
    - Create custom arbitrary `arbControlPolicyWithKnownVars` that generates control policies with known state variable references across multiple phases and rules
    - Verify `extractControlRuleVariables` returns exactly the expected set — deduplicated, filtered to state_definitions only, no missing keys
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 1.1, 1.4, 1.7**

  - [ ]* 7.2 Write property test for threshold extraction (Property 2)
    - **Property 2: Threshold extraction returns correct numeric values with phase associations for all comparison expressions**
    - Create custom arbitrary `arbSimpleComparison` and `arbCompoundComparison` for generating comparison expressions with known numeric literals
    - Verify `extractThresholds` returns all thresholds with correct values and phase names, including multi-phase scenarios
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ]* 7.3 Write property test for dependency extraction (Property 3)
    - **Property 3: Dependency extraction returns state variables and actuator keys from the state update equation, excluding self and non-state symbols**
    - Create custom arbitrary `arbEquationWithKnownDeps` that generates state update equations with known mixes of state vars, actuator keys, constants, and transitions
    - Verify `extractDependencies` returns only state vars and actuators (excluding self), with correct `isActuator` flags
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 5.5, 5.6, 5.7**

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code is frontend-only — no backend, Lambda, or database changes needed
- The SPCChart component is intentionally generic (no state-space imports) for future reuse
