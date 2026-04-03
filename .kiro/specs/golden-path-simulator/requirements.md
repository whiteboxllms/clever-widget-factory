# Requirements Document

## Introduction

This feature adds a closed-loop control policy system to the existing nonlinear state-space simulator. Currently, the simulator runs Forward Euler integration with static actuator inputs set via sliders. The golden path simulator introduces two new optional JSON sections to the model format: `control_policy` (phase-based rules that dynamically set actuator values based on state conditions at each time step) and `interventions` (scheduled state injections at specific simulation times).

When "golden path" mode is active, the control policy replaces the static slider values for actuators. The policy is organized into phases with temperature-based thresholds for phase transitions. Scheduled interventions inject material (e.g., greens, moisture) into state variables at specific times. This is a browser-side-only change — no Lambda modifications are needed. The new sections are optional in the schema, so existing models without them continue to work.

The composting domain drives the design: Phase A (mesophilic ignition below 45°C), Phase B (thermophilic handover from 45°C to 55°C), and Phase C (lignin breach above 55°C) each have distinct actuator rules for fan and motor timing. Since dt=0.05 hours (3 minutes), multi-minute actuator runs (5-minute fan, 10-minute motor) are modeled as consecutive time steps of u=1 followed by u=0.

## Glossary

- **Control_Policy**: An optional top-level JSON section defining phase-based rules for dynamically setting actuator values during simulation. Contains an ordered list of phases, each with entry conditions, actuator rules, and exit thresholds
- **Phase**: A named segment of the control policy with an entry condition (state-based), a set of actuator rules evaluated each time step, and an exit threshold that triggers transition to the next phase
- **Actuator_Rule**: A conditional expression within a phase that sets an actuator value (0 or 1) based on current state conditions. Rules specify a condition, the target actuator key, the value to set, and a duration in time steps
- **Phase_Threshold**: A state-based condition that, when met, causes the control policy to transition from the current phase to the next phase
- **Interventions**: An optional top-level JSON section defining scheduled state injections — discrete additions to state variables at specific simulation times
- **Intervention_Event**: A single scheduled injection specifying a time (in hours), a target state variable key, an additive delta value, and a descriptive label
- **Golden_Path_Mode**: A simulation mode where the Control_Policy dynamically sets actuator values and Interventions inject state changes, replacing the static slider-based actuator inputs
- **Actuator_Duration**: The number of consecutive time steps an actuator remains at its set value (e.g., 5 minutes at dt=3 minutes ≈ 2 time steps of u=1)
- **Moisture_Fraction**: The ratio x7/total_mass used in Phase C moisture checks, compared against a threshold (e.g., 0.45)
- **Simulation_Engine**: The existing browser-side Forward Euler integrator in `simulationEngine.ts`
- **State_Space_Page**: The existing React page at `/actions/:actionId/state-space` that displays, validates, and simulates nonlinear models
- **Schema_Validator**: The Zod schema in `stateSpaceSchema.ts` that validates the NonlinearModel JSON structure
- **NonlinearModel**: The existing validated model type with 8 required sections, now extended with 2 optional sections

## Requirements

### Requirement 1: Control Policy Schema

**User Story:** As a model author, I want to define a phase-based control policy in the model JSON, so that actuator values are set dynamically based on state conditions during simulation.

#### Acceptance Criteria

1. THE Schema_Validator SHALL accept an optional `control_policy` section in the NonlinearModel JSON
2. THE Schema_Validator SHALL validate `control_policy` as an object containing `phases` (an ordered array of Phase objects) and `initial_phase` (a string matching one of the phase names)
3. THE Schema_Validator SHALL validate each Phase object as containing: `name` (string), `entry_condition` (a mathjs boolean expression string referencing state variables), `rules` (an array of Actuator_Rule objects), and `exit_threshold` (a mathjs boolean expression string or null for the final phase)
4. THE Schema_Validator SHALL validate each Actuator_Rule as containing: `condition` (a mathjs boolean expression string), `actuator` (a string matching a key in `input_vectors.u_actuators`), `value` (number, 0 or 1), and `duration_steps` (positive integer, the number of consecutive time steps to hold the actuator at the set value)
5. IF a model omits the `control_policy` section, THEN THE Schema_Validator SHALL accept the model without error (backward compatible)
6. THE Schema_Validator SHALL verify that each `actuator` referenced in Actuator_Rules exists in `input_vectors.u_actuators`
7. THE Schema_Validator SHALL verify that each `initial_phase` value matches a `name` in the `phases` array
8. THE Schema_Validator SHALL verify that all expression strings in `entry_condition`, `exit_threshold`, and `condition` fields are parseable by mathjs

### Requirement 2: Interventions Schema

**User Story:** As a model author, I want to define scheduled state injections in the model JSON, so that material additions (greens, moisture) happen at specific times during simulation.

#### Acceptance Criteria

1. THE Schema_Validator SHALL accept an optional `interventions` section in the NonlinearModel JSON
2. THE Schema_Validator SHALL validate `interventions` as an array of Intervention_Event objects
3. THE Schema_Validator SHALL validate each Intervention_Event as containing: `time_hours` (non-negative number), `state_key` (string), `delta` (number, the additive change to the state variable), and `label` (string, a human-readable description)
4. THE Schema_Validator SHALL verify that each `state_key` in an Intervention_Event exists in `state_definitions`
5. IF a model omits the `interventions` section, THEN THE Schema_Validator SHALL accept the model without error (backward compatible)
6. THE Schema_Validator SHALL accept an empty `interventions` array as valid

### Requirement 3: Control Policy Expression Validation

**User Story:** As a developer, I want the validator to check that all expressions in the control policy reference valid variables, so that simulation does not fail due to undefined references.

#### Acceptance Criteria

1. THE Schema_Validator SHALL extract variable references from all expression strings in `control_policy` (entry_condition, exit_threshold, and rule condition fields)
2. THE Schema_Validator SHALL verify that each referenced variable exists in one of: `constants` keys, `state_definitions` keys, `input_vectors.u_actuators` keys, `input_vectors.v_shocks` keys, `non_linear_transitions` keys, or the built-in variables `dt` and `t`
3. IF a control policy expression references an undefined variable, THEN THE Schema_Validator SHALL return an error identifying the phase name, the field (entry_condition/exit_threshold/rule condition), and the undefined variable name
4. THE Schema_Validator SHALL recognize mathjs built-in functions and constants as valid references in control policy expressions

### Requirement 4: Simulation Engine Control Policy Execution

**User Story:** As a user, I want the simulation engine to execute the control policy at each time step, so that actuator values are set dynamically based on the current state.

#### Acceptance Criteria

1. WHEN golden path mode is active and a `control_policy` is defined, THE Simulation_Engine SHALL start in the phase specified by `initial_phase`
2. THE Simulation_Engine SHALL evaluate the current phase's `exit_threshold` expression at each time step using the current state scope
3. WHEN the `exit_threshold` evaluates to true (non-zero), THE Simulation_Engine SHALL transition to the next phase in the `phases` array
4. THE Simulation_Engine SHALL evaluate each Actuator_Rule's `condition` expression in the current phase at each time step
5. WHEN an Actuator_Rule's condition evaluates to true, THE Simulation_Engine SHALL set the specified actuator to the rule's `value` for `duration_steps` consecutive time steps
6. WHILE an actuator is held at a value due to a duration timer, THE Simulation_Engine SHALL ignore new rule evaluations for that actuator until the duration expires
7. WHEN no rule condition is met and no duration timer is active for an actuator, THE Simulation_Engine SHALL set the actuator to 0 (off)
8. THE Simulation_Engine SHALL record the actuator values and active phase at each time step for visualization

### Requirement 5: Simulation Engine Intervention Execution

**User Story:** As a user, I want scheduled interventions to inject state changes at the correct simulation times, so that material additions are reflected in the trajectory.

#### Acceptance Criteria

1. WHEN golden path mode is active and `interventions` are defined, THE Simulation_Engine SHALL apply each Intervention_Event at the time step closest to `time_hours`
2. THE Simulation_Engine SHALL apply an intervention by adding the `delta` value to the current value of the specified `state_key`
3. THE Simulation_Engine SHALL apply interventions after the state update equations are evaluated for that time step (so the injection takes effect in the next step's scope)
4. THE Simulation_Engine SHALL record each applied intervention (time, state_key, delta, label) for visualization
5. IF multiple interventions are scheduled at the same time step, THEN THE Simulation_Engine SHALL apply all of them in the order they appear in the `interventions` array

### Requirement 6: Golden Path Mode Toggle

**User Story:** As a user, I want a toggle to switch between static slider mode and golden path mode, so that I can compare manual actuator settings against the control policy trajectory.

#### Acceptance Criteria

1. THE State_Space_Page SHALL display a "Run Golden Path" button (or toggle) when the loaded model contains a `control_policy` section
2. WHEN golden path mode is active, THE State_Space_Page SHALL disable the actuator input sliders (since the control policy sets actuator values)
3. WHEN golden path mode is inactive, THE State_Space_Page SHALL use the static slider values for actuator inputs (existing behavior)
4. THE State_Space_Page SHALL allow the user to adjust initial condition sliders in both modes
5. WHEN the user toggles golden path mode off, THE State_Space_Page SHALL restore the actuator sliders to their previous values

### Requirement 7: Actuator Decision Visualization

**User Story:** As a user, I want to see when and why the control policy turned actuators on or off, so that I can understand the control logic during the simulation.

#### Acceptance Criteria

1. WHEN a golden path simulation completes, THE State_Space_Page SHALL display actuator state traces (on/off over time) as additional series on the chart or as a separate panel below the main chart
2. THE State_Space_Page SHALL display the active phase name at each time point, visible via tooltip or a phase indicator band on the chart
3. THE State_Space_Page SHALL display phase transition points as vertical markers or annotations on the chart timeline
4. WHEN the user hovers over a time point on the chart, THE tooltip SHALL show the active phase, actuator states, and which rule triggered each actuator decision

### Requirement 8: Intervention Event Visualization

**User Story:** As a user, I want to see intervention events marked on the chart, so that I can correlate material additions with state trajectory changes.

#### Acceptance Criteria

1. WHEN a golden path simulation completes with interventions, THE State_Space_Page SHALL display intervention events as vertical markers or annotations on the chart timeline
2. THE State_Space_Page SHALL display each intervention's label, time, target state variable, and delta value in the marker tooltip
3. THE State_Space_Page SHALL visually distinguish intervention markers from phase transition markers

### Requirement 9: Backward Compatibility

**User Story:** As a developer, I want existing models without control_policy or interventions to continue working, so that the new feature does not break the existing system.

#### Acceptance Criteria

1. THE Schema_Validator SHALL accept models that omit both `control_policy` and `interventions` sections without error
2. THE Simulation_Engine SHALL run in static slider mode when no `control_policy` is present, preserving existing behavior
3. THE State_Space_Page SHALL hide the "Run Golden Path" button when the loaded model has no `control_policy` section
4. THE State_Space_Page SHALL hide intervention markers when the loaded model has no `interventions` section
5. THE existing JSONB persistence layer SHALL store and retrieve models with the new optional sections without any Lambda or database changes

### Requirement 10: Control Policy and Intervention Round-Trip

**User Story:** As a developer, I want the new JSON sections to survive serialization and persistence, so that saved models retain their control policy and interventions.

#### Acceptance Criteria

1. FOR ALL valid NonlinearModel objects with `control_policy` and `interventions`, serializing to JSON and parsing back SHALL produce an equivalent object (round-trip property)
2. THE Schema_Validator SHALL produce identical validation results for a model before and after a JSON round-trip
3. THE existing persistence layer (JSONB column) SHALL store and retrieve `control_policy` and `interventions` sections without data loss

### Requirement 11: Golden Path Simulation Result

**User Story:** As a user, I want the golden path simulation to produce a complete result including state trajectories, actuator traces, phase history, and intervention log, so that I have full visibility into the simulation.

#### Acceptance Criteria

1. WHEN a golden path simulation completes, THE Simulation_Engine SHALL return a result containing: state trajectories (same as existing), actuator value traces (value at each time step per actuator), phase history (active phase name at each time step), and an intervention log (list of applied interventions with time step and label)
2. THE Simulation_Engine SHALL return the golden path result in a structure compatible with the existing `SimulationResult` type, extended with additional fields for actuator traces, phase history, and intervention log
3. IF a control policy expression evaluates to NaN or Infinity, THEN THE Simulation_Engine SHALL stop the simulation and report the failing expression, the phase name, and the time step
