/**
 * Property Test: Nonlinear Schema Validation Arbitraries
 *
 * Feature: nonlinear-state-space-simulator
 *
 * Validates: Requirements 10.1
 *
 * Custom fast-check arbitraries for generating valid and invalid NonlinearModel objects.
 * Uses template-based expression generation with scope variable substitution
 * to ensure syntactic validity.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateStateSpaceJson } from './stateSpaceSchema';

// --- Expression Templates ---

/**
 * Template-based expression generation strategy from the design doc.
 * K1, K2 = constants/numeric placeholders, V1, V2 = scope variables.
 * Substituting real scope variables ensures syntactic validity.
 */
const EXPRESSION_TEMPLATES = [
  { template: 'K1 * V1 + K2', vars: ['V1'], consts: ['K1', 'K2'] },
  { template: 'V1 + V2 * dt', vars: ['V1', 'V2'], consts: [] },
  { template: 'max(V1, 0)', vars: ['V1'], consts: [] },
  { template: 'V1 * (1 - V1 / K1)', vars: ['V1'], consts: ['K1'] },
  { template: 'V1', vars: ['V1'], consts: [] },
  { template: 'V1 + K1', vars: ['V1'], consts: ['K1'] },
];

// --- Helper: pick random element from array ---

function arbPickFrom(arr: string[]): fc.Arbitrary<string> {
  return fc.integer({ min: 0, max: arr.length - 1 }).map((i) => arr[i]);
}

// --- Custom Arbitraries ---

/** Generates valid identifier strings (alphanumeric, starting with letter, like x1, alpha, k_rate). */
function arbIdentifier(): fc.Arbitrary<string> {
  const prefixes = ['x', 'y', 'z', 'k', 'alpha', 'beta', 'rate', 'val', 'param', 'state'];
  const suffixes = ['', '_1', '_2', '_rate', '_max', '_min'];
  return fc
    .record({
      prefix: fc.constantFrom(...prefixes),
      suffix: fc.constantFrom(...suffixes),
      num: fc.constantFrom('', '1', '2', '3'),
    })
    .map(({ prefix, suffix, num }) => `${prefix}${num}${suffix}`);
}

/** Generates N unique identifiers. */
function arbUniqueIdentifiers(n: number): fc.Arbitrary<string[]> {
  return fc
    .uniqueArray(arbIdentifier(), { minLength: n, maxLength: n })
    .filter((arr) => arr.length === n);
}

/** Generates valid model_metadata. */
function arbValidModelMetadata() {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    version: fc.constantFrom('1.0.0', '2.0.0', '3.0.0', '0.1.0'),
    author: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    description: fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
  });
}

/** Generates valid constants record with 0-4 entries. */
function arbConstants(keys: string[]): fc.Arbitrary<Record<string, { value: number; name: string; unit: string }>> {
  if (keys.length === 0) return fc.constant({});
  return fc.tuple(
    ...keys.map((key) =>
      fc.record({
        value: fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true }),
        name: fc.constant(`Constant ${key}`),
        unit: fc.constantFrom('kg', 'm', '1/hr', 'J', 'ratio'),
      }).map((val) => [key, val] as const)
    )
  ).map((entries) => Object.fromEntries(entries));
}

/** Generates valid state_definitions record with 1-5 entries using unique keys. */
function arbStateDefinitions(
  keys: string[]
): fc.Arbitrary<Record<string, { id: string; name: string; unit: string; default_value: number }>> {
  return fc.tuple(
    ...keys.map((key) =>
      fc.record({
        id: fc.constant(`id_${key}`),
        name: fc.constant(`State ${key}`),
        unit: fc.constantFrom('kg', '°C', 'm³', 'ratio', 'kg/m³'),
        default_value: fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
      }).map((val) => [key, val] as const)
    )
  ).map((entries) => Object.fromEntries(entries));
}

/** Generates valid input_vectors with 0-2 actuators and 0-2 shocks. */
function arbInputVectors(
  actuatorKeys: string[],
  shockKeys: string[]
): fc.Arbitrary<{ u_actuators: Record<string, string>; v_shocks: Record<string, string> }> {
  return fc.constant({
    u_actuators: Object.fromEntries(actuatorKeys.map((k) => [k, `Actuator ${k} [0,1]`])),
    v_shocks: Object.fromEntries(shockKeys.map((k) => [k, `Shock ${k}`])),
  });
}

/**
 * Generates a valid mathjs expression from templates, substituting scope variables.
 * Ensures the expression only references in-scope variables.
 */
function arbExpression(scopeVars: string[]): fc.Arbitrary<string> {
  // If scope is empty or too small, just return a numeric constant
  if (scopeVars.length === 0) {
    return fc.constantFrom('1', '0.5', '42');
  }

  return fc
    .integer({ min: 0, max: EXPRESSION_TEMPLATES.length - 1 })
    .chain((templateIdx) => {
      const tmpl = EXPRESSION_TEMPLATES[templateIdx];
      const neededVars = tmpl.vars.length;

      // If we don't have enough scope vars for this template, use a simpler one
      if (scopeVars.length < neededVars) {
        // Fall back to "V1" template (just a variable reference)
        return arbPickFrom(scopeVars);
      }

      // Build substitution map
      return fc
        .tuple(
          // Pick scope vars for V1, V2, etc.
          ...tmpl.vars.map(() => arbPickFrom(scopeVars)),
          // Pick numeric constants for K1, K2, etc.
          ...tmpl.consts.map(() =>
            fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }).map((n) =>
              Number(n.toFixed(2)).toString()
            )
          )
        )
        .map((picks) => {
          let expr = tmpl.template;
          const varPicks = picks.slice(0, tmpl.vars.length);
          const constPicks = picks.slice(tmpl.vars.length);

          tmpl.vars.forEach((placeholder, i) => {
            expr = expr.replace(new RegExp(placeholder, 'g'), varPicks[i] as string);
          });
          tmpl.consts.forEach((placeholder, i) => {
            expr = expr.replace(new RegExp(placeholder, 'g'), constPicks[i] as string);
          });

          return expr;
        });
    });
}

/**
 * Generates 0-3 non_linear_transitions using template expressions.
 * Each transition can reference scope vars + previously declared transition keys.
 */
function arbTransitions(
  transitionKeys: string[],
  baseScope: string[]
): fc.Arbitrary<Record<string, string>> {
  if (transitionKeys.length === 0) return fc.constant({});

  // Build transitions sequentially: each can reference previous ones
  return fc
    .tuple(
      ...transitionKeys.map((_, i) => {
        const availableScope = [...baseScope, ...transitionKeys.slice(0, i)];
        return arbExpression(availableScope);
      })
    )
    .map((exprs) => Object.fromEntries(transitionKeys.map((k, i) => [k, exprs[i]])));
}

/**
 * Generates state_update_equations matching state_definitions keys.
 * Each equation key is `stateKey_next` and can reference all scope vars + all transition keys.
 */
function arbStateUpdateEquations(
  stateKeys: string[],
  fullScope: string[]
): fc.Arbitrary<Record<string, string>> {
  return fc
    .tuple(...stateKeys.map(() => arbExpression(fullScope)))
    .map((exprs) =>
      Object.fromEntries(stateKeys.map((k, i) => [`${k}_next`, exprs[i]]))
    );
}

/** Generates valid simulation_config with positive dt and total_days. */
function arbSimulationConfig(): fc.Arbitrary<{ dt: number; total_days: number }> {
  return fc.record({
    dt: fc.double({ min: 0.01, max: 2, noNaN: true, noDefaultInfinity: true }),
    total_days: fc.double({ min: 0.1, max: 30, noNaN: true, noDefaultInfinity: true }),
  });
}

/**
 * Composes a full valid NonlinearModel by:
 * 1. Generating unique keys for states, constants, actuators, shocks, transitions
 * 2. Building scope from all keys
 * 3. Generating expressions that only reference in-scope variables
 */
function arbValidNonlinearModel() {
  return fc
    .record({
      numStates: fc.integer({ min: 1, max: 5 }),
      numConstants: fc.integer({ min: 0, max: 4 }),
      numActuators: fc.integer({ min: 0, max: 2 }),
      numShocks: fc.integer({ min: 0, max: 2 }),
      numTransitions: fc.integer({ min: 0, max: 3 }),
    })
    .chain(({ numStates, numConstants, numActuators, numShocks, numTransitions }) => {
      const totalKeys = numStates + numConstants + numActuators + numShocks + numTransitions;
      return arbUniqueIdentifiers(totalKeys).chain((allKeys) => {
        let idx = 0;
        const stateKeys = allKeys.slice(idx, (idx += numStates));
        const constantKeys = allKeys.slice(idx, (idx += numConstants));
        const actuatorKeys = allKeys.slice(idx, (idx += numActuators));
        const shockKeys = allKeys.slice(idx, (idx += numShocks));
        const transitionKeys = allKeys.slice(idx, (idx += numTransitions));

        // Base scope: states + constants + actuators + shocks + builtins
        const baseScope = [...stateKeys, ...constantKeys, ...actuatorKeys, ...shockKeys, 'dt', 't'];
        // Full scope includes all transition keys
        const fullScope = [...baseScope, ...transitionKeys];

        return fc.record({
          model_metadata: arbValidModelMetadata(),
          model_description_prompt: fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          constants: arbConstants(constantKeys),
          state_definitions: arbStateDefinitions(stateKeys),
          input_vectors: arbInputVectors(actuatorKeys, shockKeys),
          non_linear_transitions: arbTransitions(transitionKeys, baseScope),
          state_update_equations: arbStateUpdateEquations(stateKeys, fullScope),
          simulation_config: arbSimulationConfig(),
        });
      });
    });
}

/**
 * Generates invalid models via corruption strategies:
 * - Missing sections
 * - Wrong types
 * - Old format fields (state_space with dimensions/matrices)
 * - Mismatched equation keys
 */
function arbInvalidNonlinearModel(): fc.Arbitrary<unknown> {
  return fc.oneof(
    // Strategy 1: Missing model_metadata
    arbValidNonlinearModel().map(({ model_metadata, ...rest }) => rest),

    // Strategy 2: Missing state_definitions
    arbValidNonlinearModel().map(({ state_definitions, ...rest }) => rest),

    // Strategy 3: Missing simulation_config
    arbValidNonlinearModel().map(({ simulation_config, ...rest }) => rest),

    // Strategy 4: Missing state_update_equations
    arbValidNonlinearModel().map(({ state_update_equations, ...rest }) => rest),

    // Strategy 5: Wrong type for model_metadata (number instead of object)
    arbValidNonlinearModel().map((model) => ({
      ...model,
      model_metadata: 42,
    })),

    // Strategy 6: Wrong type for constants (array instead of record)
    arbValidNonlinearModel().map((model) => ({
      ...model,
      constants: [1, 2, 3],
    })),

    // Strategy 7: Old linear format with state_space.dimensions.matrices
    arbValidNonlinearModel().map((model) => ({
      ...model,
      state_space: {
        dimensions: { states: 2, inputs: 1, outputs: 1 },
        labels: { states: ['x1', 'x2'], inputs: ['u1'], outputs: ['y1'] },
        matrices: {
          A: [[1, 0], [0, 1]],
          B: [[1], [0]],
          C: [[1, 0]],
          D: [[0]],
        },
      },
    })),

    // Strategy 8: Empty object
    fc.constant({}),

    // Strategy 9: Negative dt
    arbValidNonlinearModel().map((model) => ({
      ...model,
      simulation_config: { dt: -1, total_days: model.simulation_config.total_days },
    })),

    // Strategy 10: Negative total_days
    arbValidNonlinearModel().map((model) => ({
      ...model,
      simulation_config: { dt: model.simulation_config.dt, total_days: -5 },
    }))
  );
}

// --- Golden Path Expression Templates ---

/**
 * Boolean expression templates for control policy conditions.
 * These generate comparison expressions suitable for entry_condition,
 * exit_threshold, and rule condition fields.
 */
const BOOLEAN_EXPRESSION_TEMPLATES = [
  { template: 'V1 < K1', vars: ['V1'], consts: ['K1'] },
  { template: 'V1 >= K1', vars: ['V1'], consts: ['K1'] },
  { template: 'V1 > K1', vars: ['V1'], consts: ['K1'] },
  { template: 'V1 <= K1', vars: ['V1'], consts: ['K1'] },
  { template: 'V1 / V2 < K1', vars: ['V1', 'V2'], consts: ['K1'] },
];

/**
 * Generates a valid boolean expression from templates, substituting scope variables.
 * Used for control policy conditions (entry_condition, exit_threshold, rule condition).
 */
function arbBooleanExpression(scopeVars: string[]): fc.Arbitrary<string> {
  if (scopeVars.length === 0) {
    return fc.constantFrom('1 < 2', '0 >= 0');
  }

  return fc
    .integer({ min: 0, max: BOOLEAN_EXPRESSION_TEMPLATES.length - 1 })
    .chain((templateIdx) => {
      const tmpl = BOOLEAN_EXPRESSION_TEMPLATES[templateIdx];
      const neededVars = tmpl.vars.length;

      // If not enough scope vars, fall back to simpler template
      if (scopeVars.length < neededVars) {
        return fc
          .double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true })
          .map((k) => `${scopeVars[0]} < ${Number(k.toFixed(2))}`);
      }

      return fc
        .tuple(
          ...tmpl.vars.map(() => arbPickFrom(scopeVars)),
          ...tmpl.consts.map(() =>
            fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }).map((n) =>
              Number(n.toFixed(2)).toString()
            )
          )
        )
        .map((picks) => {
          let expr = tmpl.template;
          const varPicks = picks.slice(0, tmpl.vars.length);
          const constPicks = picks.slice(tmpl.vars.length);

          tmpl.vars.forEach((placeholder, i) => {
            expr = expr.replace(new RegExp(placeholder, 'g'), varPicks[i] as string);
          });
          tmpl.consts.forEach((placeholder, i) => {
            expr = expr.replace(new RegExp(placeholder, 'g'), constPicks[i] as string);
          });

          return expr;
        });
    });
}

// --- Golden Path Arbitraries ---

/**
 * Generates a valid ActuatorRule referencing a known actuator key.
 * Condition is a boolean expression using scope variables.
 * Value is 0 or 1, duration_steps is 1-10.
 */
function arbActuatorRule(actuatorKeys: string[], scopeVars: string[]): fc.Arbitrary<{
  condition: string;
  actuator: string;
  value: number;
  duration_steps: number;
}> {
  return fc.record({
    condition: arbBooleanExpression(scopeVars),
    actuator: arbPickFrom(actuatorKeys),
    value: fc.constantFrom(0, 1),
    duration_steps: fc.integer({ min: 1, max: 10 }),
  });
}

/**
 * Generates a valid Phase with rules referencing known actuators and scope.
 * If isFinal is true, exit_threshold is null (final phase has no exit).
 * Rules array has 1-3 entries.
 */
function arbPhase(
  name: string,
  actuatorKeys: string[],
  scopeVars: string[],
  isFinal: boolean
): fc.Arbitrary<{
  name: string;
  entry_condition: string;
  rules: { condition: string; actuator: string; value: number; duration_steps: number }[];
  exit_threshold: string | null;
}> {
  return fc.record({
    name: fc.constant(name),
    entry_condition: arbBooleanExpression(scopeVars),
    rules: fc.array(arbActuatorRule(actuatorKeys, scopeVars), { minLength: 1, maxLength: 3 }),
    exit_threshold: isFinal
      ? fc.constant(null)
      : arbBooleanExpression(scopeVars),
  });
}

/**
 * Generates a valid ControlPolicy with 1-3 phases.
 * The last phase is always final (exit_threshold: null).
 * initial_phase matches the first phase's name.
 */
function arbControlPolicy(
  actuatorKeys: string[],
  scopeVars: string[]
): fc.Arbitrary<{
  phases: { name: string; entry_condition: string; rules: { condition: string; actuator: string; value: number; duration_steps: number }[]; exit_threshold: string | null }[];
  initial_phase: string;
}> {
  return fc.integer({ min: 1, max: 3 }).chain((numPhases) => {
    const phaseNames = Array.from({ length: numPhases }, (_, i) => `phase_${i}`);
    const phaseArbs = phaseNames.map((name, i) =>
      arbPhase(name, actuatorKeys, scopeVars, i === numPhases - 1)
    );

    return fc.tuple(...phaseArbs).map((phases) => ({
      phases,
      initial_phase: phaseNames[0],
    }));
  });
}

/**
 * Generates a valid InterventionEvent referencing a known state key.
 * time_hours: 0-336, delta: -100 to 100, label: descriptive string.
 */
function arbInterventionEvent(stateKeys: string[]): fc.Arbitrary<{
  time_hours: number;
  state_key: string;
  delta: number;
  label: string;
}> {
  return fc.record({
    time_hours: fc.double({ min: 0, max: 336, noNaN: true, noDefaultInfinity: true }),
    state_key: arbPickFrom(stateKeys),
    delta: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
    label: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  });
}

/**
 * Generates a valid NonlinearModel with control_policy and interventions.
 * Builds on arbValidNonlinearModel() and adds the optional golden path sections.
 * Requires at least 1 actuator for control_policy rules.
 */
function arbValidExtendedModel() {
  return fc
    .record({
      numStates: fc.integer({ min: 1, max: 5 }),
      numConstants: fc.integer({ min: 0, max: 4 }),
      numActuators: fc.integer({ min: 1, max: 2 }), // At least 1 actuator for control policy
      numShocks: fc.integer({ min: 0, max: 2 }),
      numTransitions: fc.integer({ min: 0, max: 3 }),
      numInterventions: fc.integer({ min: 0, max: 4 }),
    })
    .chain(({ numStates, numConstants, numActuators, numShocks, numTransitions, numInterventions }) => {
      const totalKeys = numStates + numConstants + numActuators + numShocks + numTransitions;
      return arbUniqueIdentifiers(totalKeys).chain((allKeys) => {
        let idx = 0;
        const stateKeys = allKeys.slice(idx, (idx += numStates));
        const constantKeys = allKeys.slice(idx, (idx += numConstants));
        const actuatorKeys = allKeys.slice(idx, (idx += numActuators));
        const shockKeys = allKeys.slice(idx, (idx += numShocks));
        const transitionKeys = allKeys.slice(idx, (idx += numTransitions));

        const baseScope = [...stateKeys, ...constantKeys, ...actuatorKeys, ...shockKeys, 'dt', 't'];
        const fullScope = [...baseScope, ...transitionKeys];

        return fc.record({
          model_metadata: arbValidModelMetadata(),
          model_description_prompt: fc
            .string({ minLength: 1, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          constants: arbConstants(constantKeys),
          state_definitions: arbStateDefinitions(stateKeys),
          input_vectors: arbInputVectors(actuatorKeys, shockKeys),
          non_linear_transitions: arbTransitions(transitionKeys, baseScope),
          state_update_equations: arbStateUpdateEquations(stateKeys, fullScope),
          simulation_config: arbSimulationConfig(),
          control_policy: arbControlPolicy(actuatorKeys, fullScope),
          interventions: fc.array(arbInterventionEvent(stateKeys), {
            minLength: numInterventions,
            maxLength: numInterventions,
          }),
        });
      });
    });
}

/**
 * Generates models with invalid control_policy cross-references.
 * Strategy 1: actuator key in a rule doesn't exist in u_actuators.
 * Strategy 2: initial_phase doesn't match any phase name.
 */
function arbInvalidControlPolicyCrossRef() {
  return fc.oneof(
    // Strategy 1: Invalid actuator key in rule
    arbValidExtendedModel().map((model) => {
      const phases = model.control_policy.phases.map((phase, pi) => {
        if (pi === 0 && phase.rules.length > 0) {
          const rules = [...phase.rules];
          rules[0] = { ...rules[0], actuator: 'nonexistent_actuator_xyz' };
          return { ...phase, rules };
        }
        return phase;
      });
      return {
        ...model,
        control_policy: { ...model.control_policy, phases },
      };
    }),
    // Strategy 2: Invalid initial_phase
    arbValidExtendedModel().map((model) => ({
      ...model,
      control_policy: {
        ...model.control_policy,
        initial_phase: 'nonexistent_phase_xyz',
      },
    }))
  );
}

/**
 * Generates models with undefined variables in control policy expressions.
 * Injects an undefined variable into entry_condition, exit_threshold, or rule condition.
 */
function arbInvalidControlPolicyExpressions() {
  return fc.oneof(
    // Strategy 1: Undefined variable in entry_condition
    arbValidExtendedModel().map((model) => {
      const phases = model.control_policy.phases.map((phase, pi) => {
        if (pi === 0) {
          return { ...phase, entry_condition: 'undefined_var_abc < 10' };
        }
        return phase;
      });
      return {
        ...model,
        control_policy: { ...model.control_policy, phases },
      };
    }),
    // Strategy 2: Undefined variable in exit_threshold
    arbValidExtendedModel().map((model) => {
      // Find a non-final phase (one with exit_threshold !== null)
      const phases = model.control_policy.phases.map((phase) => {
        if (phase.exit_threshold !== null) {
          return { ...phase, exit_threshold: 'undefined_var_xyz >= 5' };
        }
        return phase;
      });
      return {
        ...model,
        control_policy: { ...model.control_policy, phases },
      };
    }),
    // Strategy 3: Undefined variable in rule condition
    arbValidExtendedModel().map((model) => {
      const phases = model.control_policy.phases.map((phase, pi) => {
        if (pi === 0 && phase.rules.length > 0) {
          const rules = [...phase.rules];
          rules[0] = { ...rules[0], condition: 'undefined_var_qrs > 0' };
          return { ...phase, rules };
        }
        return phase;
      });
      return {
        ...model,
        control_policy: { ...model.control_policy, phases },
      };
    })
  );
}

// --- Smoke Test ---

describe('Feature: nonlinear-state-space-simulator, Arbitraries smoke test', () => {
  /**
   * Validates: Requirements 10.1
   *
   * Smoke test: generate 10 valid nonlinear models and verify they pass validateStateSpaceJson.
   */
  it('arbValidNonlinearModel generates models that pass validation', () => {
    fc.assert(
      fc.property(arbValidNonlinearModel(), (model) => {
        const result = validateStateSpaceJson(JSON.stringify(model));
        if (!result.success) {
          // Provide helpful failure message
          throw new Error(
            `Valid model failed validation:\n${result.errors.join('\n')}\nModel keys: ${JSON.stringify(Object.keys(model))}`
          );
        }
        expect(result.success).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('arbInvalidNonlinearModel generates models that fail validation', () => {
    fc.assert(
      fc.property(arbInvalidNonlinearModel(), (model) => {
        const result = validateStateSpaceJson(JSON.stringify(model));
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 10 }
    );
  });
});
