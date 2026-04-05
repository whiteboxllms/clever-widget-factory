# Requirements Document

## Introduction

This spec replaces the existing linear A/B/C/D state-space model format with a generic nonlinear state-space simulator. The current system (completed in the state-space-loader and state-space-persistence specs) validates, displays, and persists linear models defined by dimensions, labels, and matrices (A, B, C, D). This is a breaking change — the linear format is removed entirely, replaced by a new canonical JSON format with 8 top-level sections supporting named constants, nonlinear transition expressions, and string-based state update equations evaluated via `mathjs`.

The simulator runs entirely in the browser using Forward Euler integration. The StateSpacePage is redesigned to display the new format sections, provide interactive sliders for initial conditions and actuator inputs, and render state trajectories on a Recharts line chart. No backend Lambda is needed for simulation — only the existing persistence Lambda is updated to validate the new format.

This is an intentional breaking change. Old linear-format models will fail validation. No migration path is provided.

## Glossary

- **Nonlinear_Model**: A JSON object containing 8 top-level sections: `model_metadata`, `model_description_prompt`, `constants`, `state_definitions`, `input_vectors`, `non_linear_transitions`, `state_update_equations`, and `simulation_config`
- **Model_Metadata**: The section containing `name` (string), `version` (string), `author` (string), and `description` (string). Unchanged from the persistence spec
- **Model_Description_Prompt**: A top-level string used for embeddings and semantic search. Unchanged from the persistence spec
- **Constants**: A record of named constants, each with `value` (number), `name` (string), and `unit` (string). Available in expression scope during simulation
- **State_Definitions**: A record of state variables, each with `id` (string), `name` (string), `unit` (string), and `default_value` (number). Keys are state variable names (e.g., `x1`, `x2`). The `default_value` provides initial conditions for simulation and slider defaults
- **Input_Vectors**: An object containing `u_actuators` (record of actuator name to description string) and `v_shocks` (record of shock name to description string)
- **Non_Linear_Transitions**: A record of named intermediate computations as mathjs expression strings, evaluated in declaration order. Each result is available to subsequent transitions and state update equations
- **State_Update_Equations**: A record of `x_next` expressions as mathjs expression strings. Keys must match State_Definitions keys with a `_next` suffix (e.g., `x1_next` for state `x1`)
- **Simulation_Config**: An object with `dt` (number, time step in hours) and `total_days` (number, simulation duration in days)
- **Simulation_Engine**: The browser-side Forward Euler integrator that evaluates expressions using `mathjs` compiled expressions
- **Expression_Scope**: The set of variables available during expression evaluation: all current state values, all constants, all actuator input values, all intermediate transition results, `dt`, and time variable `t`
- **Dry_Run_Validation**: A single-step evaluation of all expressions with initial conditions to catch syntax errors and undefined variable references before running the full simulation
- **Schema_Validator**: The Zod schema in `stateSpaceSchema.ts` (frontend) and `validation.js` (Lambda) that validates the Nonlinear_Model JSON structure
- **State_Space_Page**: The React page at `/actions/:actionId/state-space` that displays, validates, persists, and simulates nonlinear models
- **State_Space_Lambda**: The existing `cwf-state-space-lambda` that handles CRUD and association operations, updated for the new format

## Requirements

### Requirement 1: Nonlinear Model JSON Schema

**User Story:** As a developer, I want a well-defined JSON schema for nonlinear state-space models, so that models can be validated consistently on both frontend and backend.

#### Acceptance Criteria

1. THE Schema_Validator SHALL validate a Nonlinear_Model with exactly 8 required top-level sections: `model_metadata`, `model_description_prompt`, `constants`, `state_definitions`, `input_vectors`, `non_linear_transitions`, `state_update_equations`, and `simulation_config`
2. THE Schema_Validator SHALL validate `model_metadata` as an object with required string fields: `name`, `version`, `author`, and `description`
3. THE Schema_Validator SHALL validate `model_description_prompt` as a required string
4. THE Schema_Validator SHALL validate `constants` as a record where each value is an object with `value` (number), `name` (string), and `unit` (string)
5. THE Schema_Validator SHALL validate `state_definitions` as a record where each value is an object with `id` (string), `name` (string), `unit` (string), and `default_value` (number)
6. THE Schema_Validator SHALL validate `input_vectors` as an object with `u_actuators` (record of string to string) and `v_shocks` (record of string to string)
7. THE Schema_Validator SHALL validate `non_linear_transitions` as a record of string keys to string values (expression strings)
8. THE Schema_Validator SHALL validate `state_update_equations` as a record of string keys to string values (expression strings)
9. THE Schema_Validator SHALL validate `simulation_config` as an object with `dt` (positive number) and `total_days` (positive number)
10. THE Schema_Validator SHALL remove all linear-format validation: `dimensions`, `labels`, `matrices` (A, B, C, D), and the `state_space` top-level section
11. IF a JSON object uses the old linear format (containing `state_space` with `dimensions`/`labels`/`matrices`), THEN THE Schema_Validator SHALL reject the model with descriptive error messages

### Requirement 2: Cross-Reference Validation

**User Story:** As a developer, I want the validator to check that expression references are internally consistent, so that models with undefined variables or mismatched keys are caught before simulation.

#### Acceptance Criteria

1. THE Schema_Validator SHALL verify that each key in `state_update_equations` matches a key in `state_definitions` with a `_next` suffix (e.g., `x1_next` requires `x1` in `state_definitions`)
2. IF a `state_update_equations` key does not have a corresponding `state_definitions` key, THEN THE Schema_Validator SHALL return an error identifying the orphaned equation key
3. IF a `state_definitions` key does not have a corresponding `state_update_equations` key, THEN THE Schema_Validator SHALL return an error identifying the missing equation
4. THE Schema_Validator SHALL verify that each expression string in `non_linear_transitions` and `state_update_equations` is parseable by mathjs
5. IF an expression contains a syntax error, THEN THE Schema_Validator SHALL return an error identifying the expression key and the parse error message

### Requirement 3: Variable Reference Validation

**User Story:** As a developer, I want the validator to check that all variables referenced in expressions are defined, so that simulation does not fail due to undefined variable errors.

#### Acceptance Criteria

1. THE Schema_Validator SHALL extract all variable references from each expression in `non_linear_transitions` and `state_update_equations`
2. THE Schema_Validator SHALL verify that each referenced variable exists in one of: `constants` keys, `state_definitions` keys, `input_vectors.u_actuators` keys, `input_vectors.v_shocks` keys, previously declared `non_linear_transitions` keys (for transitions only: keys declared before the current expression), all `non_linear_transitions` keys (for state update equations), or the built-in variables `dt` and `t`
3. IF an expression references an undefined variable, THEN THE Schema_Validator SHALL return an error identifying the expression key and the undefined variable name
4. THE Schema_Validator SHALL recognize mathjs built-in functions (`exp`, `max`, `min`, `abs`, `sqrt`, `log`, `sin`, `cos`, `tan`, `pow`, `ceil`, `floor`, `round`, `pi`, `e`) as valid references and not flag them as undefined variables

### Requirement 4: Simulation Engine

**User Story:** As a user, I want to run Forward Euler simulations of nonlinear models in the browser, so that I can see how state variables evolve over time without needing a backend service.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL implement Forward Euler integration: for each time step, evaluate all Non_Linear_Transitions in declaration order, then evaluate all State_Update_Equations to compute the next state vector
2. THE Simulation_Engine SHALL use `mathjs` compiled expressions for evaluating all expression strings
3. THE Simulation_Engine SHALL construct the Expression_Scope for each time step containing: all current state values (keyed by State_Definitions keys), all Constants values (keyed by Constants keys), all actuator input values (keyed by `u_actuators` keys), all intermediate transition results (keyed by Non_Linear_Transitions keys), `dt` from Simulation_Config, and `t` as the current simulation time in hours
4. THE Simulation_Engine SHALL compute the total number of time steps as `(total_days * 24) / dt` and iterate from step 0 to the final step
5. THE Simulation_Engine SHALL record the state vector at each time step for visualization
6. THE Simulation_Engine SHALL initialize all state values from the `default_value` fields in State_Definitions, overridden by any user-adjusted slider values

### Requirement 5: Dry-Run Validation

**User Story:** As a user, I want expression errors caught before the full simulation runs, so that I get immediate feedback on broken models without waiting for a long simulation to fail mid-way.

#### Acceptance Criteria

1. WHEN the user clicks "Run Simulation", THE Simulation_Engine SHALL first perform a Dry_Run_Validation by evaluating all Non_Linear_Transitions and State_Update_Equations once using initial conditions
2. IF the Dry_Run_Validation encounters an undefined variable, syntax error, or evaluation error (e.g., division by zero producing NaN/Infinity), THEN THE Simulation_Engine SHALL abort the simulation and display the error to the user identifying the failing expression
3. WHEN the Dry_Run_Validation succeeds, THE Simulation_Engine SHALL proceed with the full Forward Euler simulation

### Requirement 6: Interactive Visualization

**User Story:** As a user, I want to see state trajectories plotted over time with interactive controls, so that I can explore how different initial conditions and inputs affect the system behavior.

#### Acceptance Criteria

1. THE State_Space_Page SHALL display a Recharts line chart with time in days on the x-axis and state values on the y-axis
2. THE State_Space_Page SHALL render one line series per state variable, each with a distinct color
3. THE State_Space_Page SHALL support toggling individual state series visibility by clicking legend items
4. THE State_Space_Page SHALL provide a toggle between raw values view and normalized view (0-100% of each state's observed min/max range during the simulation run)
5. THE State_Space_Page SHALL display a sliders panel with one slider per state variable for adjusting initial conditions, initialized from the `default_value` in State_Definitions
6. THE State_Space_Page SHALL display a sliders panel with one slider per actuator input (from `u_actuators`), with range and default determined by the actuator description where parseable, or 0-1 range by default
7. THE State_Space_Page SHALL display a "Run Simulation" button that executes the Dry_Run_Validation followed by the full Euler loop and populates the chart with results
8. WHEN the simulation completes, THE State_Space_Page SHALL update the chart with the full trajectory data (the chart is not updated during simulation, only after completion)

### Requirement 7: StateSpacePage Display Updates

**User Story:** As a user, I want the state-space page to display the new nonlinear model sections clearly, so that I can understand the model structure before running simulations.

#### Acceptance Criteria

1. THE State_Space_Page SHALL remove the matrix table display (A, B, C, D tables) and the KaTeX linear equations header (`x_{k+1} = Ax_k + Bu_k`, `y_k = Cx_k + Du_k`)
2. THE State_Space_Page SHALL remove the Dimensions & Labels card that displayed state/input/output counts and label badges
3. THE State_Space_Page SHALL display a Constants table showing each constant's key, name, value, and unit
4. THE State_Space_Page SHALL display a State Definitions table showing each state's key, id, name, unit, and default_value
5. THE State_Space_Page SHALL display the Input Vectors section showing `u_actuators` and `v_shocks` with their keys and descriptions
6. THE State_Space_Page SHALL display the Non-Linear Transitions section showing each transition key and its expression string in a monospace font
7. THE State_Space_Page SHALL display the State Update Equations section showing each equation key and its expression string in a monospace font
8. THE State_Space_Page SHALL display the Simulation Config showing `dt` and `total_days` values
9. THE State_Space_Page SHALL continue to display Model Metadata (name, version, author, description) and Model Description Prompt sections
10. THE State_Space_Page SHALL continue to use the existing persistence integration (save/load/library) with the model format change being transparent to the persistence layer (JSONB column stores the new format)

### Requirement 8: Lambda Server-Side Validation Update

**User Story:** As a developer, I want the Lambda validation updated to match the new nonlinear schema, so that invalid models are rejected at the API level.

#### Acceptance Criteria

1. THE State_Space_Lambda validation (`validation.js`) SHALL be rewritten to validate the Nonlinear_Model format, mirroring the frontend Schema_Validator
2. THE State_Space_Lambda validation SHALL perform cross-reference validation: `state_update_equations` keys match `state_definitions` keys with `_next` suffix
3. THE State_Space_Lambda validation SHALL perform expression syntax validation using mathjs parsing
4. THE State_Space_Lambda validation SHALL remove all linear-format validation (dimensions, labels, matrices)
5. IF validation fails, THEN THE State_Space_Lambda SHALL return a 400 response with all validation error messages, following the existing error response format

### Requirement 9: Frontend Schema Update

**User Story:** As a developer, I want the frontend Zod schema rewritten for the nonlinear format, so that pasted JSON is validated against the new structure before display or save.

#### Acceptance Criteria

1. THE `stateSpaceSchema.ts` file SHALL export a new Zod schema for the Nonlinear_Model format with all 8 top-level sections
2. THE `stateSpaceSchema.ts` file SHALL remove all linear-format schemas: `dimensionsSchema`, `labelsSchema`, `matrixSchema`, `matricesSchema`, `stateSpaceSchema` (the `state_space` sub-schema)
3. THE `stateSpaceSchema.ts` file SHALL export updated TypeScript types inferred from the new Zod schemas
4. THE `validateStateSpaceJson` function SHALL continue to accept a JSON string and return `{ success: true, model }` or `{ success: false, errors: string[] }`, performing JSON parse, Zod validation, and cross-reference validation in sequence
5. THE `stateSpaceSchema.ts` file SHALL export a `validateExpressions` function that checks all expression strings for mathjs parse-ability and undefined variable references

### Requirement 10: Test Updates

**User Story:** As a developer, I want the existing property tests and unit tests updated for the new format, so that the test suite validates the nonlinear schema and catches regressions.

#### Acceptance Criteria

1. THE property tests in `stateSpaceSchema.property.test.ts` SHALL be rewritten with new `fast-check` arbitraries that generate valid Nonlinear_Model objects (with constants, state_definitions, input_vectors, non_linear_transitions, state_update_equations, simulation_config)
2. THE property tests SHALL verify that all valid generated Nonlinear_Model objects pass schema validation
3. THE property tests SHALL verify that invalid models (missing sections, wrong types, mismatched equation keys, unparseable expressions) fail validation with descriptive errors
4. THE unit tests in `stateSpaceSchema.test.ts` SHALL be updated with example nonlinear models replacing the linear examples
5. FOR ALL valid Nonlinear_Model objects, serializing to JSON and parsing back SHALL produce an equivalent object (round-trip property)

### Requirement 11: Simulation Engine Expression Parsing

**User Story:** As a developer, I want the simulation engine to use standard math notation parsed by mathjs, so that model authors can write equations naturally.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL support standard mathematical operators: `+`, `-`, `*`, `/`, `^` (exponentiation), and parentheses for grouping
2. THE Simulation_Engine SHALL support mathjs built-in functions: `exp`, `max`, `min`, `abs`, `sqrt`, `log`, `sin`, `cos`, `tan`, `pow`, `ceil`, `floor`, `round`
3. THE Simulation_Engine SHALL support mathjs built-in constants: `pi`, `e`
4. THE Simulation_Engine SHALL compile each expression string once before the simulation loop begins, using `mathjs.compile()`, and reuse the compiled expression for each time step
5. IF a compiled expression evaluates to `NaN` or `Infinity` during simulation, THEN THE Simulation_Engine SHALL stop the simulation and report the failing expression key and the time step where the error occurred

