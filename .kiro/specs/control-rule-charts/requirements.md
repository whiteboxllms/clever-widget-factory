# Requirements Document

## Introduction

This feature adds SPC-style control charts to the StateSpacePage, driven by the control policy rules already defined in the NonlinearModel. The system parses the control policy phases, extracts the unique state variables referenced in rule conditions and exit thresholds, and generates one dedicated chart per variable. Each chart shows the variable's predicted trajectory from the golden path simulation with horizontal threshold reference lines from the control rules. A "Show Independent Variables" toggle overlays the driving state variables and actuator traces on the same chart using a dual Y-axis layout. The charts appear above the main state trajectories chart. The chart component uses a generic props interface so it can be reused in a future SPC module.

## Glossary

- **Control_Policy**: The `control_policy` section of a NonlinearModel, containing phases with entry conditions, actuator rules, and exit thresholds expressed as mathjs expressions.
- **Control_Rule_Variable**: A state variable key (e.g., `x1`, `x8`) referenced in a control policy rule condition or exit threshold expression. This is the "controlled variable" or "dependent variable" for a chart.
- **Independent_Variable**: A state variable or actuator key that drives the controlled variable — identified by parsing the controlled variable's state update equation to find which variables it references.
- **Threshold_Line**: A horizontal reference line on a chart representing a numeric boundary extracted from a control policy expression (e.g., `1.0` from `x8 < 1.0`, `45` from `x1 >= 45`).
- **Variable_Extractor**: The logic that parses control policy expressions and identifies which state variable keys appear in rule conditions and exit thresholds.
- **Dependency_Extractor**: The logic that parses a state update equation (e.g., `x8_next`) to identify which state variables, transition variables, and actuator keys it references — these become the independent variables for that chart.
- **SPC_Chart**: A generic, reusable chart component that renders a single variable's time series with horizontal threshold lines, phase band shading, and optional independent variable overlays.
- **Phase_Band**: A colored background region on a chart indicating which control policy phase is active during that time interval.
- **Golden_Path_Result**: The extended simulation result from `runGoldenPathSimulation`, containing `timePoints`, `stateHistory`, `phaseHistory`, `actuatorTraces`, and `interventionLog`.
- **State_Definition**: An entry in the model's `state_definitions` record, containing `id`, `name`, `unit`, and `default_value` for a state variable.

## Requirements

### Requirement 1: Control Rule Variable Extraction

**User Story:** As a composting operator, I want the system to automatically identify which state variables are monitored by the control policy, so that I see dedicated charts for each controlled variable without manual configuration.

#### Acceptance Criteria

1. WHEN a NonlinearModel with a control_policy is loaded, THE Variable_Extractor SHALL parse all phase rule conditions and exit thresholds to identify unique state variable keys referenced in those expressions.
2. THE Variable_Extractor SHALL extract state variable keys from simple comparison expressions (e.g., `x8` from `x8 < 1.0`, `x1` from `x1 >= 45`).
3. THE Variable_Extractor SHALL extract state variable keys from compound expressions containing arithmetic (e.g., `x7` from `x7 / (x2 + x3 + x4 + x5 + x6 + x7 + x10) < 0.45`).
4. THE Variable_Extractor SHALL return a deduplicated set of state variable keys, regardless of how many times a variable appears across phases and rules.
5. THE Variable_Extractor SHALL extract variables from both rule `condition` fields and phase `exit_threshold` fields (when exit_threshold is not null).
6. IF a control_policy contains no phases or no rules, THEN THE Variable_Extractor SHALL return an empty set.
7. THE Variable_Extractor SHALL only return keys that exist in the model's `state_definitions` record, filtering out constants, transition variables, and actuator keys.

### Requirement 2: Threshold Value Extraction

**User Story:** As a composting operator, I want to see the numeric threshold boundaries from the control rules drawn as horizontal lines on each chart, so that I can visually assess how close the simulation trajectory is to triggering a rule or phase transition.

#### Acceptance Criteria

1. WHEN a control policy expression contains a comparison of a state variable against a numeric literal (e.g., `x8 < 1.0`), THE Variable_Extractor SHALL extract the numeric value `1.0` as a threshold for variable `x8`.
2. THE Variable_Extractor SHALL extract thresholds from both rule conditions and exit thresholds across all phases.
3. THE Variable_Extractor SHALL associate each threshold with the phase name it originates from, so that threshold lines can be labeled by phase.
4. WHEN multiple phases define thresholds for the same variable, THE Variable_Extractor SHALL collect all thresholds so they appear simultaneously on the chart.
5. WHEN a control policy expression uses a compound left-hand side (e.g., `x7 / (x2 + x3 + ...) < 0.45`), THE Variable_Extractor SHALL extract the threshold value `0.45` and associate it with the primary variable (`x7`).
6. IF a control policy expression does not contain a simple numeric comparison (e.g., compares two variables), THEN THE Variable_Extractor SHALL skip threshold extraction for that expression without error.

### Requirement 3: Individual Control Charts with Thresholds

**User Story:** As a composting operator, I want to see one chart per controlled variable showing the predicted trajectory and threshold lines, so that I can monitor each critical variable independently against its control boundaries.

#### Acceptance Criteria

1. WHEN a golden path simulation completes and the model has a control_policy, THE StateSpacePage SHALL render one SPC_Chart per extracted Control_Rule_Variable, positioned above the main state trajectories chart.
2. THE SPC_Chart SHALL display the variable's predicted trajectory as a line on the right Y-axis using the `timePoints` and `stateHistory` data from the Golden_Path_Result.
3. THE SPC_Chart SHALL display horizontal Threshold_Lines for all thresholds associated with that variable, drawn across the full time axis on the right Y-axis.
4. THE SPC_Chart SHALL label each Threshold_Line with the phase name and threshold value (e.g., "phase_a: 1.0").
5. THE SPC_Chart SHALL display Phase_Bands as background shading using the same phase history and color scheme as the main state trajectories chart.
6. THE SPC_Chart SHALL use the State_Definition's `name` and `unit` fields for the chart title (e.g., "Max Temperature (°C)").
7. WHILE no golden path simulation result is available, THE StateSpacePage SHALL not render any SPC_Charts.
8. THE SPC_Chart SHALL use a linear Y-axis scale for the controlled variable (right Y-axis).

### Requirement 4: Generic SPC Chart Component Interface

**User Story:** As a developer, I want the SPC chart component to accept a generic props interface decoupled from the state-space model types, so that the component can be reused in a future SPC module with different data sources.

#### Acceptance Criteria

1. THE SPC_Chart SHALL accept props through a generic interface containing: `label` (string), `unit` (string), `timePoints` (number array), `values` (number array), `thresholds` (array of objects with `value`, `label`, and optional `color`), `phaseBands` (array of objects with `startTime`, `endTime`, `label`, and `colorIndex`), and `independentVariables` (optional array of objects with `key`, `label`, `values` number array, and optional `color`).
2. THE SPC_Chart SHALL not import or reference `NonlinearModel`, `GoldenPathResult`, or any state-space-specific types in its own module.
3. THE SPC_Chart SHALL render correctly when the `thresholds` array is empty (trajectory line only, no horizontal reference lines).
4. THE SPC_Chart SHALL render correctly when the `phaseBands` array is empty (no background shading).
5. THE SPC_Chart SHALL render correctly when `independentVariables` is omitted or empty (no IV overlay, no toggle button).
6. THE SPC_Chart SHALL use Recharts components (LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea) consistent with the existing chart patterns in StateSpacePage.

### Requirement 5: Independent Variable Overlay

**User Story:** As a composting operator, I want to toggle the display of independent variables (the states and actuators driving the controlled variable) on the same chart, so that I can see how changes in driving variables correlate with the controlled variable's trajectory.

#### Acceptance Criteria

1. THE SPC_Chart SHALL include a "Show Independent Variables" toggle button when `independentVariables` is provided and non-empty.
2. WHEN the toggle is off (default), THE SPC_Chart SHALL display only the controlled variable's trajectory and threshold lines.
3. WHEN the toggle is on, THE SPC_Chart SHALL overlay the independent variable traces on the same chart using a left Y-axis with a logarithmic scale.
4. THE independent variable lines SHALL be visually subdued compared to the controlled variable — thinner line width and lower opacity — so the controlled variable remains prominent.
5. THE Dependency_Extractor SHALL parse the controlled variable's state update equation (e.g., `x8_next`) to identify which state variables and actuator keys it references.
6. THE Dependency_Extractor SHALL include actuator keys (e.g., `u_fan`) as independent variables when they appear in the state update equation, using the `actuatorTraces` from the Golden_Path_Result for their time series data.
7. THE Dependency_Extractor SHALL include state variable keys referenced in the state update equation, using the `stateHistory` from the Golden_Path_Result for their time series data.
8. THE SPC_Chart SHALL display a legend identifying each independent variable line when the toggle is on.
9. THE left Y-axis (log scale for IVs) SHALL only be visible when the toggle is on.
