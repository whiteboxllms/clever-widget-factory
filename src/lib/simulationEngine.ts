/**
 * Nonlinear State-Space Simulation Engine
 *
 * Forward Euler integration using mathjs compiled expressions.
 * Runs entirely in the browser — no backend needed.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { compile, type EvalFunction } from 'mathjs';
import type { NonlinearModel } from './stateSpaceSchema';

// --- Types ---

export interface SimulationResult {
  timePoints: number[];                    // time in days
  stateHistory: Record<string, number[]>;  // stateKey -> values at each time point
}

export interface SimulationError {
  expressionKey: string;
  timeStep: number;
  message: string;
}

export type SimulationOutcome =
  | { success: true; result: SimulationResult }
  | { success: false; error: SimulationError };

// --- Helpers ---

function isFiniteNumber(v: number): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Build the evaluation scope for a given time step.
 */
function buildScope(
  states: Record<string, number>,
  constants: Record<string, number>,
  actuators: Record<string, number>,
  shocks: Record<string, number>,
  transitions: Record<string, number>,
  dt: number,
  t: number
): Record<string, number> {
  return { ...states, ...constants, ...actuators, ...shocks, ...transitions, dt, t };
}

// --- Main ---

/**
 * Run a Forward Euler simulation of a nonlinear state-space model.
 *
 * 1. Compiles all expressions once via mathjs.compile()
 * 2. Performs dry-run validation with initial conditions
 * 3. Runs the Forward Euler loop, recording state at each step
 *
 * @param model - A validated NonlinearModel
 * @param initialConditionOverrides - Optional overrides for state default_values
 * @param actuatorOverrides - Optional actuator input values (default 0)
 */
export function runSimulation(
  model: NonlinearModel,
  initialConditionOverrides?: Record<string, number>,
  actuatorOverrides?: Record<string, number>
): SimulationOutcome {
  const { constants, state_definitions, input_vectors, non_linear_transitions, state_update_equations, simulation_config } = model;
  const { dt, total_days } = simulation_config;

  // --- Compile expressions once (Req 11.4) ---
  const compiledTransitions: { key: string; expr: EvalFunction }[] = [];
  for (const [key, exprStr] of Object.entries(non_linear_transitions)) {
    try {
      compiledTransitions.push({ key, expr: compile(exprStr) });
    } catch (e) {
      return {
        success: false,
        error: { expressionKey: key, timeStep: 0, message: `Compilation error: ${e instanceof Error ? e.message : String(e)}` },
      };
    }
  }

  const compiledEquations: { key: string; stateKey: string; expr: EvalFunction }[] = [];
  for (const [key, exprStr] of Object.entries(state_update_equations)) {
    try {
      compiledEquations.push({ key, stateKey: key.replace(/_next$/, ''), expr: compile(exprStr) });
    } catch (e) {
      return {
        success: false,
        error: { expressionKey: key, timeStep: 0, message: `Compilation error: ${e instanceof Error ? e.message : String(e)}` },
      };
    }
  }

  // --- Initialize state values (Req 4.6) ---
  const stateKeys = Object.keys(state_definitions);
  const currentState: Record<string, number> = {};
  for (const key of stateKeys) {
    currentState[key] = initialConditionOverrides?.[key] ?? state_definitions[key].default_value;
  }

  // --- Initialize constant values ---
  const constantValues: Record<string, number> = {};
  for (const [key, def] of Object.entries(constants)) {
    constantValues[key] = def.value;
  }

  // --- Initialize actuator values (default 0) ---
  const actuatorValues: Record<string, number> = {};
  for (const key of Object.keys(input_vectors.u_actuators)) {
    actuatorValues[key] = actuatorOverrides?.[key] ?? 0;
  }

  // --- Initialize shock values (default 0) ---
  const shockValues: Record<string, number> = {};
  for (const key of Object.keys(input_vectors.v_shocks)) {
    shockValues[key] = 0;
  }

  // --- Dry-run validation (Req 5.1, 5.2, 5.3) ---
  const dryRunTransitions: Record<string, number> = {};
  const dryScope = buildScope(currentState, constantValues, actuatorValues, shockValues, dryRunTransitions, dt, 0);

  for (const { key, expr } of compiledTransitions) {
    try {
      const val = expr.evaluate(dryScope) as number;
      if (!isFiniteNumber(val)) {
        return {
          success: false,
          error: { expressionKey: key, timeStep: 0, message: `Dry-run produced ${val} (expected finite number)` },
        };
      }
      dryRunTransitions[key] = val;
      dryScope[key] = val;
    } catch (e) {
      return {
        success: false,
        error: { expressionKey: key, timeStep: 0, message: `Dry-run error: ${e instanceof Error ? e.message : String(e)}` },
      };
    }
  }

  for (const { key, expr } of compiledEquations) {
    try {
      const val = expr.evaluate(dryScope) as number;
      if (!isFiniteNumber(val)) {
        return {
          success: false,
          error: { expressionKey: key, timeStep: 0, message: `Dry-run produced ${val} (expected finite number)` },
        };
      }
    } catch (e) {
      return {
        success: false,
        error: { expressionKey: key, timeStep: 0, message: `Dry-run error: ${e instanceof Error ? e.message : String(e)}` },
      };
    }
  }

  // --- Forward Euler loop (Req 4.1, 4.2, 4.3, 4.4, 4.5) ---
  const totalSteps = Math.floor((total_days * 24) / dt);

  // Initialize result arrays with initial state at t=0
  const timePoints: number[] = [0];
  const stateHistory: Record<string, number[]> = {};
  for (const key of stateKeys) {
    stateHistory[key] = [currentState[key]];
  }

  for (let step = 1; step <= totalSteps; step++) {
    const t = step * dt; // time in hours

    // Build scope for this step
    const transitionResults: Record<string, number> = {};
    const scope = buildScope(currentState, constantValues, actuatorValues, shockValues, transitionResults, dt, t);

    // Evaluate transitions in declaration order (Req 4.1)
    for (const { key, expr } of compiledTransitions) {
      try {
        const val = expr.evaluate(scope) as number;
        if (!isFiniteNumber(val)) {
          return {
            success: false,
            error: { expressionKey: key, timeStep: step, message: `Produced ${val} at time step ${step} (t=${t}h)` },
          };
        }
        transitionResults[key] = val;
        scope[key] = val;
      } catch (e) {
        return {
          success: false,
          error: { expressionKey: key, timeStep: step, message: `Evaluation error at step ${step}: ${e instanceof Error ? e.message : String(e)}` },
        };
      }
    }

    // Evaluate state update equations (Req 4.1)
    const nextState: Record<string, number> = {};
    for (const { key, stateKey, expr } of compiledEquations) {
      try {
        const val = expr.evaluate(scope) as number;
        if (!isFiniteNumber(val)) {
          return {
            success: false,
            error: { expressionKey: key, timeStep: step, message: `Produced ${val} at time step ${step} (t=${t}h)` },
          };
        }
        nextState[stateKey] = val;
      } catch (e) {
        return {
          success: false,
          error: { expressionKey: key, timeStep: step, message: `Evaluation error at step ${step}: ${e instanceof Error ? e.message : String(e)}` },
        };
      }
    }

    // Update current state and record
    for (const key of stateKeys) {
      currentState[key] = nextState[key];
      stateHistory[key].push(nextState[key]);
    }

    // Record time in days (Req 4.4)
    timePoints.push((step * dt) / 24);
  }

  return {
    success: true,
    result: { timePoints, stateHistory },
  };
}

/**
 * Normalize a simulation result so each state's values are mapped to [0, 100]
 * based on observed min/max during the run.
 *
 * If min equals max for a state (constant value), all values map to 50.
 *
 * Requirements: 6.4
 */
export function normalizeTrajectory(result: SimulationResult): SimulationResult {
  const normalizedHistory: Record<string, number[]> = {};

  for (const [key, values] of Object.entries(result.stateHistory)) {
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (min === max) {
      normalizedHistory[key] = values.map(() => 50);
    } else {
      const range = max - min;
      normalizedHistory[key] = values.map((v) => ((v - min) / range) * 100);
    }
  }

  return {
    timePoints: result.timePoints,
    stateHistory: normalizedHistory,
  };
}
