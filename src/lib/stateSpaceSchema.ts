/**
 * Nonlinear State Space Model Schema & Types
 *
 * Zod schemas and TypeScript types for nonlinear state-space models.
 * Used by StateSpacePage for validation of pasted JSON models.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 9.1, 9.2, 9.3
 */

import * as z from 'zod';
import { parse } from 'mathjs';

// --- Zod Schemas ---

export const modelMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  author: z.string(),
  description: z.string(),
});

export const constantsSchema = z.record(
  z.string(),
  z.object({
    value: z.number(),
    name: z.string(),
    unit: z.string(),
  })
);

export const stateDefinitionsSchema = z.record(
  z.string(),
  z.object({
    id: z.string(),
    name: z.string(),
    unit: z.string(),
    default_value: z.number(),
  })
);

export const inputVectorsSchema = z.object({
  u_actuators: z.record(z.string(), z.string()),
  v_shocks: z.record(z.string(), z.string()),
});

export const nonLinearTransitionsSchema = z.record(z.string(), z.string());

export const stateUpdateEquationsSchema = z.record(z.string(), z.string());

export const simulationConfigSchema = z.object({
  dt: z.number().positive(),
  total_days: z.number().positive(),
});

// --- Control Spec Schemas (SPC-style control elements) ---

export const specLimitsSchema = z.object({
  USL: z.number(),
  LSL: z.number(),
});

export const controlRuleSchema = z.object({
  condition: z.string(),
  intent: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  note: z.string().optional(),
});

export const controlElementSchema = z.object({
  target: z.number().optional(),
  target_function: z.string().optional(),
  spec_limits: specLimitsSchema.optional(),
  rules: z.array(controlRuleSchema),
});

export const reactionMechanismSchema = z.object({
  condition: z.string(),
  intent: z.string(),
  note: z.string().optional(),
});

export const controlSpecSchema = z.object({
  drum_id: z.string().optional(),
  control_elements: z.record(z.string(), controlElementSchema),
  reaction_mechanisms: z.record(z.string(), reactionMechanismSchema).optional(),
});

export const phaseIndicatorsSchema = z.record(z.string(), z.string());

// --- Control Policy & Interventions Schemas ---

export const actuatorRuleSchema = z.object({
  condition: z.string(),
  actuator: z.string(),
  value: z.number(),
  duration_steps: z.number().int().positive(),
});

export const phaseSchema = z.object({
  name: z.string(),
  entry_condition: z.string(),
  rules: z.array(actuatorRuleSchema),
  exit_threshold: z.string().nullable(),
});

export const controlPolicySchema = z.object({
  phases: z.array(phaseSchema),
  initial_phase: z.string(),
});

export const interventionEventSchema = z.object({
  time_hours: z.number().nonnegative(),
  state_key: z.string(),
  delta: z.number(),
  label: z.string(),
});

const baseNonlinearModelSchema = z.object({
  model_metadata: modelMetadataSchema,
  model_description_prompt: z.string(),
  constants: constantsSchema,
  state_definitions: stateDefinitionsSchema,
  input_vectors: inputVectorsSchema,
  non_linear_transitions: nonLinearTransitionsSchema,
  state_update_equations: stateUpdateEquationsSchema,
  simulation_config: simulationConfigSchema,
});

export const nonlinearModelSchema = baseNonlinearModelSchema.extend({
  control_policy: controlPolicySchema.optional(),
  control_spec: controlSpecSchema.optional(),
  phase_indicators: phaseIndicatorsSchema.optional(),
  interventions: z.array(interventionEventSchema).optional(),
});

// --- Inferred Types ---

export type NonlinearModel = z.infer<typeof nonlinearModelSchema>;
export type StateSpaceModel = NonlinearModel;

// --- Validation Result ---

export type ValidationResult =
  | { success: true; model: NonlinearModel }
  | { success: false; errors: string[] };

// --- Cross-Reference Validation ---

/**
 * Validates that state_update_equations keys and state_definitions keys
 * are consistent: every equation key K_next must have a corresponding K
 * in state_definitions, and every state K must have a K_next equation.
 *
 * Requirements: 2.1, 2.2, 2.3
 */
export function validateCrossReferences(model: NonlinearModel): string[] {
  const errors: string[] = [];
  const stateKeys = new Set(Object.keys(model.state_definitions));
  const equationKeys = new Set(Object.keys(model.state_update_equations));

  // Requirement 2.1 & 2.2: Every equation key K_next must have K in state_definitions
  for (const eqKey of equationKeys) {
    const stateKey = eqKey.replace(/_next$/, '');
    if (!stateKeys.has(stateKey)) {
      errors.push(
        `Orphaned equation key "${eqKey}": no corresponding "${stateKey}" in state_definitions`
      );
    }
  }

  // Requirement 2.3: Every state key K must have K_next in state_update_equations
  for (const stateKey of stateKeys) {
    const expectedEqKey = `${stateKey}_next`;
    if (!equationKeys.has(expectedEqKey)) {
      errors.push(
        `Missing equation for state "${stateKey}": expected "${expectedEqKey}" in state_update_equations`
      );
    }
  }

  return errors;
}

// --- Expression Validation ---

/** mathjs built-in functions that should not be flagged as undefined variables */
const MATHJS_BUILTINS = new Set([
  'exp', 'max', 'min', 'abs', 'sqrt', 'log',
  'sin', 'cos', 'tan', 'pow', 'ceil', 'floor', 'round',
  'pi', 'e',
]);

/**
 * Extract variable references from a mathjs expression string.
 * Parses the AST and collects all SymbolNode names, filtering out
 * mathjs built-in functions and constants.
 */
export function extractVariables(expr: string): string[] {
  const tree = parse(expr);
  const symbols: string[] = [];
  tree.traverse((node: { type: string; name?: string }) => {
    if (node.type === 'SymbolNode' && node.name && !MATHJS_BUILTINS.has(node.name)) {
      symbols.push(node.name);
    }
  });
  return symbols;
}

/**
 * Validates all expressions in non_linear_transitions and state_update_equations.
 * Checks for:
 * 1. Syntax validity (mathjs.parse)
 * 2. Variable reference resolution against the valid scope
 *
 * Scope for transitions: constants, state_definitions, u_actuators, v_shocks,
 *   previously declared transition keys, and built-ins dt/t.
 * Scope for equations: constants, state_definitions, u_actuators, v_shocks,
 *   ALL transition keys, and built-ins dt/t.
 *
 * Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 9.5
 */
export function validateExpressions(model: NonlinearModel): string[] {
  const errors: string[] = [];

  const constantKeys = Object.keys(model.constants);
  const stateKeys = Object.keys(model.state_definitions);
  const actuatorKeys = Object.keys(model.input_vectors.u_actuators);
  const shockKeys = Object.keys(model.input_vectors.v_shocks);
  const transitionKeys = Object.keys(model.non_linear_transitions);

  // Base scope shared by both transitions and equations
  const baseScope = new Set([
    ...constantKeys,
    ...stateKeys,
    ...actuatorKeys,
    ...shockKeys,
    'dt',
    't',
  ]);

  // Validate non_linear_transitions (previously declared keys only)
  const declaredTransitions = new Set<string>();
  for (const [key, expr] of Object.entries(model.non_linear_transitions)) {
    // Phase 1: Syntax check
    try {
      parse(expr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parse error';
      errors.push(`Expression "${key}": ${msg}`);
      declaredTransitions.add(key);
      continue;
    }

    // Phase 2: Variable reference check
    const scope = new Set([...baseScope, ...declaredTransitions]);
    const vars = extractVariables(expr);
    for (const v of vars) {
      if (!scope.has(v)) {
        errors.push(`Expression "${key}": undefined variable "${v}"`);
      }
    }

    declaredTransitions.add(key);
  }

  // Validate state_update_equations (all transition keys in scope)
  const equationScope = new Set([...baseScope, ...transitionKeys]);
  for (const [key, expr] of Object.entries(model.state_update_equations)) {
    // Phase 1: Syntax check
    try {
      parse(expr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parse error';
      errors.push(`Expression "${key}": ${msg}`);
      continue;
    }

    // Phase 2: Variable reference check
    const vars = extractVariables(expr);
    for (const v of vars) {
      if (!equationScope.has(v)) {
        errors.push(`Expression "${key}": undefined variable "${v}"`);
      }
    }
  }

  return errors;
}

// --- Control Policy Validation ---

/**
 * Validates the control_policy section of a NonlinearModel.
 * Checks:
 * 1. initial_phase matches a phase name
 * 2. Each rule's actuator key exists in u_actuators
 * 3. Each expression field parses with mathjs
 * 4. Each expression's variables exist in the valid scope
 *
 * Returns empty array if control_policy is absent.
 *
 * Requirements: 1.6, 1.7, 1.8, 3.1, 3.2, 3.3, 3.4
 */
export function validateControlPolicy(model: NonlinearModel): string[] {
  if (!model.control_policy) {
    return [];
  }

  const errors: string[] = [];
  const { phases, initial_phase } = model.control_policy;

  // Build valid scope for expressions
  const validScope = new Set([
    ...Object.keys(model.constants),
    ...Object.keys(model.state_definitions),
    ...Object.keys(model.input_vectors.u_actuators),
    ...Object.keys(model.input_vectors.v_shocks),
    ...Object.keys(model.non_linear_transitions),
    'dt',
    't',
  ]);

  const actuatorKeys = new Set(Object.keys(model.input_vectors.u_actuators));
  const phaseNames = new Set(phases.map((p) => p.name));

  // Check initial_phase matches a phase name
  if (!phaseNames.has(initial_phase)) {
    errors.push(
      `control_policy.initial_phase '${initial_phase}' does not match any phase name`
    );
  }

  // Helper to validate a single expression field
  const validateExpression = (phaseName: string, field: string, expr: string) => {
    // Parse check
    try {
      parse(expr);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Parse error';
      errors.push(`Phase '${phaseName}', ${field}: parse error: ${message}`);
      return;
    }

    // Variable reference check
    const vars = extractVariables(expr);
    for (const varName of vars) {
      if (!validScope.has(varName)) {
        errors.push(
          `Phase '${phaseName}', ${field}: undefined variable '${varName}'`
        );
      }
    }
  };

  for (const phase of phases) {
    // Validate entry_condition
    validateExpression(phase.name, 'entry_condition', phase.entry_condition);

    // Validate exit_threshold (if not null)
    if (phase.exit_threshold !== null) {
      validateExpression(phase.name, 'exit_threshold', phase.exit_threshold);
    }

    // Validate each rule
    for (let i = 0; i < phase.rules.length; i++) {
      const rule = phase.rules[i];

      // Check actuator key exists in u_actuators
      if (!actuatorKeys.has(rule.actuator)) {
        errors.push(
          `Phase '${phase.name}', rule ${i}: actuator '${rule.actuator}' not found in u_actuators`
        );
      }

      // Validate rule condition expression
      validateExpression(phase.name, `rule ${i} condition`, rule.condition);
    }
  }

  return errors;
}

/**
 * Validates the interventions section of a NonlinearModel.
 * Checks that each intervention's state_key exists in state_definitions.
 *
 * Returns empty array if interventions is absent.
 *
 * Requirements: 2.4
 */
export function validateInterventions(model: NonlinearModel): string[] {
  if (!model.interventions) {
    return [];
  }

  const errors: string[] = [];
  const stateKeys = new Set(Object.keys(model.state_definitions));

  for (const intervention of model.interventions) {
    if (!stateKeys.has(intervention.state_key)) {
      errors.push(
        `Intervention '${intervention.label}': state_key '${intervention.state_key}' not found in state_definitions`
      );
    }
  }

  return errors;
}


// --- Combined Validation Entry Point ---

/**
 * Detects if a parsed JSON object uses the old linear state-space format
 * (containing `state_space` with `dimensions`, `labels`, or `matrices`).
 * Returns descriptive error messages if detected.
 *
 * Requirements: 1.11
 */
function detectOldLinearFormat(parsed: unknown): string[] {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return [];
  }
  const obj = parsed as Record<string, unknown>;
  if (!('state_space' in obj)) {
    return [];
  }

  const errors: string[] = [];
  errors.push(
    'This model uses the old linear state-space format which is no longer supported. Please convert to the nonlinear format with 8 required sections: model_metadata, model_description_prompt, constants, state_definitions, input_vectors, non_linear_transitions, state_update_equations, simulation_config.'
  );

  const stateSpace = obj.state_space;
  if (typeof stateSpace === 'object' && stateSpace !== null) {
    const ss = stateSpace as Record<string, unknown>;
    if ('dimensions' in ss) {
      errors.push('Old format field detected: state_space.dimensions is not supported in the nonlinear format.');
    }
    if ('labels' in ss) {
      errors.push('Old format field detected: state_space.labels is not supported in the nonlinear format.');
    }
    if ('matrices' in ss) {
      errors.push('Old format field detected: state_space.matrices (A, B, C, D) is not supported in the nonlinear format.');
    }
  }

  return errors;
}

/**
 * Validates a JSON string as a NonlinearModel. Runs validation phases:
 * 1. Empty input check
 * 2. JSON.parse (catches SyntaxError)
 * 2b. Old linear format detection (rejects with descriptive errors)
 * 3. Zod schema validation with nonlinearModelSchema
 * 4. Cross-reference validation via validateCrossReferences
 * 5. Expression validation via validateExpressions
 * 6. Control policy validation via validateControlPolicy
 * 7. Interventions validation via validateInterventions
 *
 * Phases 1–5 short-circuit on failure. Phases 6 and 7 are independent —
 * both run even if one fails, and their errors are collected together.
 *
 * Requirements: 1.6, 1.7, 1.8, 1.11, 2.4, 3.1, 3.2, 3.3, 3.4, 9.1, 9.4
 */
export function validateStateSpaceJson(jsonString: string): ValidationResult {
  // Phase 1: Empty input
  if (!jsonString || jsonString.trim().length === 0) {
    return { success: false, errors: ['JSON input is required.'] };
  }

  // Phase 2: JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    const message = e instanceof SyntaxError ? e.message : 'Invalid JSON';
    return { success: false, errors: [message] };
  }

  // Phase 2b: Reject old linear format
  const linearErrors = detectOldLinearFormat(parsed);
  if (linearErrors.length > 0) {
    return { success: false, errors: linearErrors };
  }

  // Phase 3: Zod schema validation
  const result = nonlinearModelSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });
    return { success: false, errors };
  }

  // Phase 4: Cross-reference validation
  const crossRefErrors = validateCrossReferences(result.data);
  if (crossRefErrors.length > 0) {
    return { success: false, errors: crossRefErrors };
  }

  // Phase 5: Expression validation
  const exprErrors = validateExpressions(result.data);
  if (exprErrors.length > 0) {
    return { success: false, errors: exprErrors };
  }

  // Phase 6 & 7: Control policy and interventions validation (independent)
  const controlPolicyErrors = validateControlPolicy(result.data);
  const interventionErrors = validateInterventions(result.data);
  const phase67Errors = [...controlPolicyErrors, ...interventionErrors];
  if (phase67Errors.length > 0) {
    return { success: false, errors: phase67Errors };
  }

  return { success: true, model: result.data };
}
