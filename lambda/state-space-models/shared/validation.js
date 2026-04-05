'use strict';

const { z } = require('zod');
const { parse } = require('mathjs');

// --- Zod Schemas (mirrors src/lib/stateSpaceSchema.ts for nonlinear format) ---

const modelMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  author: z.string(),
  description: z.string(),
});

const constantsSchema = z.record(
  z.string(),
  z.object({
    value: z.number(),
    name: z.string(),
    unit: z.string(),
  })
);

const stateDefinitionsSchema = z.record(
  z.string(),
  z.object({
    id: z.string(),
    name: z.string(),
    unit: z.string(),
    default_value: z.number(),
  })
);

const inputVectorsSchema = z.object({
  u_actuators: z.record(z.string(), z.string()),
  v_shocks: z.record(z.string(), z.string()),
});

const nonLinearTransitionsSchema = z.record(z.string(), z.string());

const stateUpdateEquationsSchema = z.record(z.string(), z.string());

const simulationConfigSchema = z.object({
  dt: z.number().positive(),
  total_days: z.number().positive(),
});

const nonlinearModelSchema = z.object({
  model_metadata: modelMetadataSchema,
  model_description_prompt: z.string(),
  constants: constantsSchema,
  state_definitions: stateDefinitionsSchema,
  input_vectors: inputVectorsSchema,
  non_linear_transitions: nonLinearTransitionsSchema,
  state_update_equations: stateUpdateEquationsSchema,
  simulation_config: simulationConfigSchema,
});


// --- Cross-Reference Validation ---

/**
 * Validates that state_update_equations keys and state_definitions keys
 * are consistent: every equation key K_next must have a corresponding K
 * in state_definitions, and every state K must have a K_next equation.
 *
 * Requirements: 2.1, 2.2, 2.3
 */
function validateCrossReferences(model) {
  const errors = [];
  const stateKeys = new Set(Object.keys(model.state_definitions));
  const equationKeys = new Set(Object.keys(model.state_update_equations));

  // Every equation key K_next must have K in state_definitions
  for (const eqKey of equationKeys) {
    const stateKey = eqKey.replace(/_next$/, '');
    if (!stateKeys.has(stateKey)) {
      errors.push(
        `Orphaned equation key "${eqKey}": no corresponding "${stateKey}" in state_definitions`
      );
    }
  }

  // Every state key K must have K_next in state_update_equations
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

/** mathjs built-in functions/constants that should not be flagged as undefined variables */
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
function extractVariables(expr) {
  const tree = parse(expr);
  const symbols = [];
  tree.traverse((node) => {
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
 * Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 3.4
 */
function validateExpressions(model) {
  const errors = [];

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
  const declaredTransitions = new Set();
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


// --- Combined Validation Entry Point ---

/**
 * Validates a parsed JSON body as a NonlinearModel.
 * Runs Zod schema validation, then cross-reference validation,
 * then expression syntax/variable validation.
 *
 * @param {object} jsonBody - The parsed JSON object to validate
 * @returns {{ success: true, model: object } | { success: false, errors: string[] }}
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
function validateStateSpaceModel(jsonBody) {
  // Phase 1: Zod schema validation
  const result = nonlinearModelSchema.safeParse(jsonBody);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });
    return { success: false, errors };
  }

  // Phase 2: Cross-reference validation
  const crossRefErrors = validateCrossReferences(result.data);
  if (crossRefErrors.length > 0) {
    return { success: false, errors: crossRefErrors };
  }

  // Phase 3: Expression syntax and variable validation
  const exprErrors = validateExpressions(result.data);
  if (exprErrors.length > 0) {
    return { success: false, errors: exprErrors };
  }

  return { success: true, model: result.data };
}

module.exports = {
  nonlinearModelSchema,
  validateCrossReferences,
  validateExpressions,
  validateStateSpaceModel,
};
