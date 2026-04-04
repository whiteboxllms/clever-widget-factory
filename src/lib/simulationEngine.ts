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

// --- Golden Path Types (Req 11.1, 11.2) ---

export interface ActuatorTrace {
  [actuatorKey: string]: number[];
}

export interface InterventionLogEntry {
  timeStep: number;
  timeHours: number;
  stateKey: string;
  delta: number;
  label: string;
}

export interface GoldenPathResult extends SimulationResult {
  actuatorTraces: ActuatorTrace;
  phaseHistory: string[];
  interventionLog: InterventionLogEntry[];
}

export type GoldenPathOutcome =
  | { success: true; result: GoldenPathResult }
  | { success: false; error: SimulationError };

// --- Helpers ---

function isFiniteNumber(v: number): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Coerce a mathjs evaluation result to a number.
 * mathjs comparison operators (>=, <, etc.) return booleans,
 * so we convert true→1, false→0 for control policy expressions.
 */
function toNumber(v: unknown): number {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as number;
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

// --- Golden Path Simulation ---

/**
 * Run a golden path simulation with control policy evaluation and interventions.
 *
 * Extends the Forward Euler loop with:
 * - Phase-based actuator rules evaluated at each time step
 * - Duration timers per actuator (hold value for N steps)
 * - Scheduled state injections (interventions) at specific times
 * - Phase transitions based on exit_threshold expressions
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 11.1, 11.2, 11.3
 */
export function runGoldenPathSimulation(
  model: NonlinearModel,
  initialConditionOverrides?: Record<string, number>
): GoldenPathOutcome {
  const { constants, state_definitions, input_vectors, non_linear_transitions, state_update_equations, simulation_config, control_policy, interventions } = model;
  const { dt, total_days } = simulation_config;

  if (!control_policy) {
    return {
      success: false,
      error: { expressionKey: 'control_policy', timeStep: 0, message: 'No control_policy defined in model' },
    };
  }

  const { phases, initial_phase } = control_policy;

  // --- Compile transitions ---
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

  // --- Compile state update equations ---
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

  // --- Compile control policy expressions ---
  interface CompiledPhase {
    name: string;
    entryCondition: EvalFunction;
    exitThreshold: EvalFunction | null;
    rules: { condition: EvalFunction; actuator: string; value: number; durationSteps: number }[];
  }

  const compiledPhases: CompiledPhase[] = [];
  for (const phase of phases) {
    let entryCondition: EvalFunction;
    try {
      entryCondition = compile(phase.entry_condition);
    } catch (e) {
      return {
        success: false,
        error: { expressionKey: `phase:${phase.name}:entry_condition`, timeStep: 0, message: `Compilation error: ${e instanceof Error ? e.message : String(e)}` },
      };
    }

    let exitThreshold: EvalFunction | null = null;
    if (phase.exit_threshold !== null) {
      try {
        exitThreshold = compile(phase.exit_threshold);
      } catch (e) {
        return {
          success: false,
          error: { expressionKey: `phase:${phase.name}:exit_threshold`, timeStep: 0, message: `Compilation error: ${e instanceof Error ? e.message : String(e)}` },
        };
      }
    }

    const compiledRules: CompiledPhase['rules'] = [];
    for (let i = 0; i < phase.rules.length; i++) {
      const rule = phase.rules[i];
      try {
        compiledRules.push({
          condition: compile(rule.condition),
          actuator: rule.actuator,
          value: rule.value,
          durationSteps: rule.duration_steps,
        });
      } catch (e) {
        return {
          success: false,
          error: { expressionKey: `phase:${phase.name}:rule_${i}_condition`, timeStep: 0, message: `Compilation error: ${e instanceof Error ? e.message : String(e)}` },
        };
      }
    }

    compiledPhases.push({ name: phase.name, entryCondition, exitThreshold, rules: compiledRules });
  }

  // --- Initialize state ---
  const stateKeys = Object.keys(state_definitions);
  const currentState: Record<string, number> = {};
  for (const key of stateKeys) {
    currentState[key] = initialConditionOverrides?.[key] ?? state_definitions[key].default_value;
  }

  const constantValues: Record<string, number> = {};
  for (const [key, def] of Object.entries(constants)) {
    constantValues[key] = def.value;
  }

  const actuatorKeys = Object.keys(input_vectors.u_actuators);
  const actuatorValues: Record<string, number> = {};
  for (const key of actuatorKeys) {
    actuatorValues[key] = 0;
  }

  const shockValues: Record<string, number> = {};
  for (const key of Object.keys(input_vectors.v_shocks)) {
    shockValues[key] = 0;
  }

  // --- Dry-run validation (same as runSimulation) ---
  const dryRunTransitions: Record<string, number> = {};
  const dryScope = buildScope(currentState, constantValues, actuatorValues, shockValues, dryRunTransitions, dt, 0);

  for (const { key, expr } of compiledTransitions) {
    try {
      const val = expr.evaluate(dryScope) as number;
      if (!isFiniteNumber(val)) {
        return { success: false, error: { expressionKey: key, timeStep: 0, message: `Dry-run produced ${val} (expected finite number)` } };
      }
      dryRunTransitions[key] = val;
      dryScope[key] = val;
    } catch (e) {
      return { success: false, error: { expressionKey: key, timeStep: 0, message: `Dry-run error: ${e instanceof Error ? e.message : String(e)}` } };
    }
  }

  for (const { key, expr } of compiledEquations) {
    try {
      const val = expr.evaluate(dryScope) as number;
      if (!isFiniteNumber(val)) {
        return { success: false, error: { expressionKey: key, timeStep: 0, message: `Dry-run produced ${val} (expected finite number)` } };
      }
    } catch (e) {
      return { success: false, error: { expressionKey: key, timeStep: 0, message: `Dry-run error: ${e instanceof Error ? e.message : String(e)}` } };
    }
  }

  // --- Sort interventions and convert to step indices ---
  interface SteppedIntervention {
    step: number;
    stateKey: string;
    delta: number;
    label: string;
    timeHours: number;
  }

  const steppedInterventions: SteppedIntervention[] = [];
  if (interventions && interventions.length > 0) {
    for (const iv of interventions) {
      steppedInterventions.push({
        step: Math.round(iv.time_hours / dt),
        stateKey: iv.state_key,
        delta: iv.delta,
        label: iv.label,
        timeHours: iv.time_hours,
      });
    }
    steppedInterventions.sort((a, b) => a.step - b.step);
  }

  // --- Initialize phase tracking ---
  let currentPhaseIndex = compiledPhases.findIndex((p) => p.name === initial_phase);
  if (currentPhaseIndex === -1) currentPhaseIndex = 0;

  // --- Initialize duration timers per actuator ---
  const remainingSteps: Record<string, number> = {};
  const actuatorHeldValues: Record<string, number> = {};
  for (const key of actuatorKeys) {
    remainingSteps[key] = 0;
    actuatorHeldValues[key] = 0;
  }

  // --- Forward Euler loop ---
  const totalSteps = Math.floor((total_days * 24) / dt);

  const timePoints: number[] = [0];
  const stateHistory: Record<string, number[]> = {};
  for (const key of stateKeys) {
    stateHistory[key] = [currentState[key]];
  }

  const actuatorTraces: ActuatorTrace = {};
  for (const key of actuatorKeys) {
    actuatorTraces[key] = [0]; // initial actuator values at t=0
  }

  const phaseHistory: string[] = [compiledPhases[currentPhaseIndex].name];
  const interventionLog: InterventionLogEntry[] = [];

  // Pointer for sorted interventions
  let ivPointer = 0;

  for (let step = 1; step <= totalSteps; step++) {
    const t = step * dt;

    // Build scope with current actuator values
    const transitionResults: Record<string, number> = {};
    const scope = buildScope(currentState, constantValues, actuatorValues, shockValues, transitionResults, dt, t);

    // Evaluate transitions
    for (const { key, expr } of compiledTransitions) {
      try {
        const val = expr.evaluate(scope) as number;
        if (!isFiniteNumber(val)) {
          return { success: false, error: { expressionKey: key, timeStep: step, message: `Produced ${val} at time step ${step} (t=${t}h)` } };
        }
        transitionResults[key] = val;
        scope[key] = val;
      } catch (e) {
        return { success: false, error: { expressionKey: key, timeStep: step, message: `Evaluation error at step ${step}: ${e instanceof Error ? e.message : String(e)}` } };
      }
    }

    // Evaluate state update equations
    const nextState: Record<string, number> = {};
    for (const { key, stateKey, expr } of compiledEquations) {
      try {
        const val = expr.evaluate(scope) as number;
        if (!isFiniteNumber(val)) {
          return { success: false, error: { expressionKey: key, timeStep: step, message: `Produced ${val} at time step ${step} (t=${t}h)` } };
        }
        nextState[stateKey] = val;
      } catch (e) {
        return { success: false, error: { expressionKey: key, timeStep: step, message: `Evaluation error at step ${step}: ${e instanceof Error ? e.message : String(e)}` } };
      }
    }

    // Apply interventions after state update (Req 5.3)
    while (ivPointer < steppedInterventions.length && steppedInterventions[ivPointer].step <= step) {
      const iv = steppedInterventions[ivPointer];
      if (iv.step === step) {
        nextState[iv.stateKey] = (nextState[iv.stateKey] ?? 0) + iv.delta;
        interventionLog.push({
          timeStep: step,
          timeHours: iv.timeHours,
          stateKey: iv.stateKey,
          delta: iv.delta,
          label: iv.label,
        });
      }
      ivPointer++;
    }

    // Update current state
    for (const key of stateKeys) {
      currentState[key] = nextState[key];
    }

    // --- Control policy evaluation ---
    // Build a fresh scope with updated state for policy expressions
    const policyScope = buildScope(currentState, constantValues, actuatorValues, shockValues, transitionResults, dt, t);

    // Evaluate exit_threshold of current phase (Req 4.2, 4.3)
    const currentPhase = compiledPhases[currentPhaseIndex];
    if (currentPhase.exitThreshold) {
      try {
        const exitVal = toNumber(currentPhase.exitThreshold.evaluate(policyScope));
        if (!isFiniteNumber(exitVal)) {
          return {
            success: false,
            error: { expressionKey: `phase:${currentPhase.name}:exit_threshold`, timeStep: step, message: `Control policy expression produced ${exitVal}` },
          };
        }
        // Non-zero = truthy = transition to next phase
        if (exitVal !== 0 && currentPhaseIndex < compiledPhases.length - 1) {
          currentPhaseIndex++;
        }
      } catch (e) {
        return {
          success: false,
          error: { expressionKey: `phase:${currentPhase.name}:exit_threshold`, timeStep: step, message: `Evaluation error: ${e instanceof Error ? e.message : String(e)}` },
        };
      }
    }

    // Evaluate actuator rules in current phase (Req 4.4, 4.5, 4.6, 4.7)
    const activePhase = compiledPhases[currentPhaseIndex];
    for (const actuatorKey of actuatorKeys) {
      if (remainingSteps[actuatorKey] > 0) {
        // Timer active: decrement, keep held value
        remainingSteps[actuatorKey]--;
        actuatorValues[actuatorKey] = actuatorHeldValues[actuatorKey];
      } else {
        // Timer expired or not active: evaluate rules
        let ruleMatched = false;
        for (const rule of activePhase.rules) {
          if (rule.actuator !== actuatorKey) continue;
          try {
            const condVal = toNumber(rule.condition.evaluate(policyScope));
            if (!isFiniteNumber(condVal)) {
              return {
                success: false,
                error: { expressionKey: `phase:${activePhase.name}:rule_condition`, timeStep: step, message: `Control policy expression produced ${condVal}` },
              };
            }
            if (condVal !== 0) {
              // Rule matches: set actuator value and start timer
              actuatorValues[actuatorKey] = rule.value;
              actuatorHeldValues[actuatorKey] = rule.value;
              remainingSteps[actuatorKey] = rule.durationSteps - 1; // -1 because this step counts
              ruleMatched = true;
              break; // First matching rule wins
            }
          } catch (e) {
            return {
              success: false,
              error: { expressionKey: `phase:${activePhase.name}:rule_condition`, timeStep: step, message: `Evaluation error: ${e instanceof Error ? e.message : String(e)}` },
            };
          }
        }
        if (!ruleMatched) {
          // No rule matched, no timer active: default to 0
          actuatorValues[actuatorKey] = 0;
        }
      }
    }

    // Record state, actuators, phase
    for (const key of stateKeys) {
      stateHistory[key].push(currentState[key]);
    }
    for (const key of actuatorKeys) {
      actuatorTraces[key].push(actuatorValues[key]);
    }
    phaseHistory.push(compiledPhases[currentPhaseIndex].name);
    timePoints.push((step * dt) / 24);
  }

  return {
    success: true,
    result: { timePoints, stateHistory, actuatorTraces, phaseHistory, interventionLog },
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
