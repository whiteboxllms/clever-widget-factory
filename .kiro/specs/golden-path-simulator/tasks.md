# Implementation Plan: Golden Path Simulator

## Overview

This plan extends the existing nonlinear state-space simulator with closed-loop control policy execution and scheduled interventions. The work proceeds in layers: schema extensions first, then simulation engine, then page UI, then tests. Each task builds on the previous — no orphaned code. All changes are browser-side only (no Lambda/database changes needed).

## Tasks

- [x] 1. Extend schema with control policy and interventions Zod schemas
  - [x] 1.1 Add Zod schemas for control policy and interventions in `src/lib/stateSpaceSchema.ts`
    - Define `actuatorRuleSchema`: `condition` (string), `actuator` (string), `value` (number), `duration_steps` (positive integer)
    - Define `phaseSchema`: `name` (string), `entry_condition` (string), `rules` (array of actuatorRuleSchema), `exit_threshold` (string or null)
    - Define `controlPolicySchema`: `phases` (array of phaseSchema), `initial_phase` (string)
    - Define `interventionEventSchema`: `time_hours` (non-negative number), `state_key` (string), `delta` (number), `label` (string)
    - Extend `nonlinearModelSchema` with `.extend()` adding optional `control_policy` and `interventions` fields
    - Update the `NonlinearModel` type export (inferred from extended schema)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5, 2.6, 9.1_

  - [x] 1.2 Implement `validateControlPolicy` function in `src/lib/stateSpaceSchema.ts`
    - If `control_policy` is present, verify `initial_phase` matches a phase `name`
    - Verify each rule's `actuator` key exists in `input_vectors.u_actuators`
    - Parse each expression field (`entry_condition`, `exit_threshold`, rule `condition`) with mathjs
    - Extract variables from each expression and verify they exist in the valid scope (constants, state_definitions, u_actuators, v_shocks, non_linear_transitions, `dt`, `t`)
    - Return error strings identifying the phase name, field, and issue
    - _Requirements: 1.6, 1.7, 1.8, 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Implement `validateInterventions` function in `src/lib/stateSpaceSchema.ts`
    - If `interventions` is present, verify each `state_key` exists in `state_definitions`
    - Return error strings identifying the intervention label and invalid key
    - _Requirements: 2.4_

  - [x] 1.4 Update `validateStateSpaceJson` to include Phase 6 and Phase 7
    - After existing Phase 5 (expression validation), add Phase 6: `validateControlPolicy`
    - Add Phase 7: `validateInterventions`
    - Phases 6 and 7 are independent — both run even if one fails
    - Collect all errors from both phases
    - _Requirements: 1.6, 1.7, 1.8, 2.4, 3.1, 3.2, 3.3, 3.4, 9.1_

- [x] 2. Checkpoint — Verify schema extensions compile and existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create golden path simulation engine
  - [x] 3.1 Add golden path types to `src/lib/simulationEngine.ts`
    - Define `ActuatorTrace` interface: `{ [actuatorKey: string]: number[] }`
    - Define `InterventionLogEntry` interface: `{ timeStep, timeHours, stateKey, delta, label }`
    - Define `GoldenPathResult` extending `SimulationResult` with `actuatorTraces`, `phaseHistory`, `interventionLog`
    - Define `GoldenPathOutcome` discriminated union type
    - _Requirements: 11.1, 11.2_

  - [x] 3.2 Implement `runGoldenPathSimulation` function in `src/lib/simulationEngine.ts`
    - Compile all transitions, equations, AND control policy expressions once via mathjs.compile()
    - Perform dry-run validation (same as existing `runSimulation`)
    - Sort interventions by `time_hours` and convert to step indices
    - Implement Forward Euler loop with control policy evaluation:
      - Build scope, evaluate transitions, evaluate state update equations (same as existing)
      - Apply interventions after state update (add delta to nextState at matching step)
      - Evaluate current phase's `exit_threshold` — transition to next phase if non-zero
      - Evaluate actuator rules in current phase: manage duration timers per actuator
      - Default actuator to 0 when no rule matches and no timer active
      - Record actuator values, phase name, and intervention events at each step
    - Check for NaN/Infinity in control policy expressions — halt with error identifying phase, field, and step
    - Return `GoldenPathResult` on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 11.1, 11.2, 11.3_

- [x] 4. Checkpoint — Verify simulation engine compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add golden path UI to StateSpacePage
  - [x] 5.1 Add golden path toggle and button to `src/pages/StateSpacePage.tsx`
    - Add `goldenPathMode` boolean state and `gpResult: GoldenPathResult | null` state
    - Show "Run Golden Path" button only when `model.control_policy` exists
    - Hide button when model has no `control_policy`
    - Disable actuator sliders when `goldenPathMode` is true
    - Allow initial condition sliders in both modes
    - Restore actuator sliders when toggling golden path mode off
    - Call `runGoldenPathSimulation` when "Run Golden Path" is clicked
    - Display golden path simulation errors in the existing destructive Card
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.2, 9.3_

  - [x] 5.2 Add chart annotations for phases and interventions in `src/pages/StateSpacePage.tsx`
    - Import `ReferenceLine` and `ReferenceArea` from Recharts
    - Render phase transition points as vertical dashed `ReferenceLine` markers on the chart
    - Render intervention events as vertical solid colored `ReferenceLine` markers (visually distinct from phase transitions)
    - Optionally render phase bands as `ReferenceArea` background shading
    - Extend tooltip to show active phase, actuator states, and triggering rule when hovering
    - Display intervention label, time, state_key, and delta in marker tooltip
    - Hide intervention markers when model has no `interventions`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 9.4_

  - [x] 5.3 Add actuator trace visualization to `src/pages/StateSpacePage.tsx`
    - Display actuator state traces (on/off over time) as additional series on the chart or as a separate panel below the main chart
    - Each actuator key from `u_actuators` gets its own trace line
    - _Requirements: 7.1_

- [x] 6. Checkpoint — Verify page renders with golden path mode
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Write schema unit tests for golden path extensions
  - [x] 7.1 Add golden path unit tests to `src/lib/stateSpaceSchema.test.ts`
    - Test: validate the full Sapi-an composting model with `control_policy` and `interventions` passes validation
    - Test: reject `control_policy` with `initial_phase` not matching any phase name
    - Test: reject actuator rule referencing non-existent actuator key
    - Test: reject intervention with `state_key` not in `state_definitions`
    - Test: accept model with empty `interventions` array
    - Test: accept model with `control_policy` but no `interventions`
    - Test: reject control_policy expression with undefined variable (verify error message includes phase name)
    - Test: accept model without `control_policy` or `interventions` (backward compat)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 9.1_

- [x] 8. Write simulation engine unit tests for golden path
  - [x] 8.1 Add golden path unit tests to `src/lib/simulationEngine.test.ts`
    - Test: run the Sapi-an composting model with golden path and verify phase transitions occur (temperature rises through 45°C and 55°C thresholds)
    - Test: verify intervention at t=48h adds delta to the correct state variable
    - Test: verify actuator trace shows fan on/off pattern matching oxygen-based rules
    - Test: verify simulation stops when a control policy expression produces NaN
    - Test: verify `runSimulation` (not golden path) still works for models with `control_policy` present (it ignores the section)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 9.2, 11.1, 11.2, 11.3_

- [x] 9. Checkpoint — Ensure all unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Write schema property tests for golden path extensions
  - [x] 10.1 Add golden path arbitraries to `src/lib/stateSpaceSchema.property.test.ts`
    - Implement `arbActuatorRule(actuatorKeys, scopeVars)` arbitrary
    - Implement `arbPhase(name, actuatorKeys, scopeVars, isFinal)` arbitrary
    - Implement `arbControlPolicy(actuatorKeys, scopeVars)` arbitrary
    - Implement `arbInterventionEvent(stateKeys)` arbitrary
    - Implement `arbValidExtendedModel()` that generates a valid NonlinearModel with control_policy and interventions
    - Implement `arbInvalidControlPolicyCrossRef()` for models with invalid actuator/phase references
    - Implement `arbInvalidControlPolicyExpressions()` for models with undefined variables in expressions
    - Use boolean expression templates from the design for condition generation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [ ]* 10.2 Write property test for Property 1: Schema validates extended models with optional sections
    - **Property 1: Schema validates extended models with optional sections**
    - Generate valid models with/without optional sections → pass. Generate malformed optional sections → fail.
    - Test file: `src/lib/stateSpaceSchema.property.test.ts`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5, 9.1**

  - [ ]* 10.3 Write property test for Property 2: Cross-reference validation for control policy and interventions
    - **Property 2: Cross-reference validation for control policy and interventions**
    - Generate models with valid cross-refs → pass. Generate models with invalid actuator/phase/state refs → fail with errors identifying the invalid key.
    - Test file: `src/lib/stateSpaceSchema.property.test.ts`
    - **Validates: Requirements 1.6, 1.7, 2.4**

  - [ ]* 10.4 Write property test for Property 3: Control policy expression parseability and variable resolution
    - **Property 3: Control policy expression parseability and variable resolution**
    - Generate models with valid boolean expressions → pass. Generate models with undefined variables → fail with phase/field/variable in error.
    - Test file: `src/lib/stateSpaceSchema.property.test.ts`
    - **Validates: Requirements 1.8, 3.2, 3.3, 3.4**

  - [ ]* 10.5 Write property test for Property 4: JSON round-trip for extended models
    - **Property 4: JSON round-trip for extended models**
    - Generate valid extended models → stringify → parse → deep equal. Re-validate round-tripped model → same result.
    - Test file: `src/lib/stateSpaceSchema.property.test.ts`
    - **Validates: Requirements 10.1, 10.2, 10.3, 9.5**

- [ ] 11. Write simulation engine property tests for golden path
  - [ ]* 11.1 Write property test for Property 5: Golden path result structure completeness
    - **Property 5: Golden path result structure completeness**
    - Generate valid models with control_policy → run GP simulation → verify all arrays same length (`Math.floor((total_days * 24) / dt) + 1`), `phaseHistory[0]` = `initial_phase`, all actuator keys present in `actuatorTraces`.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.1, 4.8, 11.1, 11.2**

  - [ ]* 11.2 Write property test for Property 6: Phase transition on exit threshold
    - **Property 6: Phase transition on exit threshold**
    - Generate 2-phase models where exit_threshold is immediately true → verify phase transition in `phaseHistory`.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.3**

  - [ ]* 11.3 Write property test for Property 7: Actuator duration timer holds for exactly duration_steps
    - **Property 7: Actuator duration timer holds for exactly duration_steps**
    - Generate models with always-true rule conditions and known `duration_steps` → verify actuator holds for exactly N steps.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.5, 4.6**

  - [ ]* 11.4 Write property test for Property 8: Default actuator value is zero when no rule matches
    - **Property 8: Default actuator value is zero when no rule matches**
    - Generate models with always-false rule conditions → verify all actuator traces are 0 at every time step.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 4.7**

  - [ ]* 11.5 Write property test for Property 9: Intervention application at correct time step with correct delta
    - **Property 9: Intervention application at correct time step with correct delta**
    - Generate models with interventions → verify `interventionLog` entries at correct steps with correct deltas.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [ ]* 11.6 Write property test for Property 10: Control policy expression NaN/Infinity halts simulation
    - **Property 10: Control policy expression NaN/Infinity halts simulation**
    - Generate models with division-by-zero control policy expressions → verify simulation stops with error identifying phase, field, and step.
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 11.3**

  - [ ]* 11.7 Write property test for Property 11: Backward compatibility — existing simulation unchanged
    - **Property 11: Backward compatibility — existing simulation unchanged**
    - Generate models without `control_policy` → run existing `runSimulation` → verify success (unchanged behavior).
    - Test file: `src/lib/simulationEngine.property.test.ts`
    - **Validates: Requirements 9.2**

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–11)
- Unit tests validate specific examples and edge cases (Sapi-an composting fixture)
- All changes are browser-side only — no Lambda, database, or API changes needed
- The existing JSONB persistence stores the new optional sections transparently
