/**
 * Control Rule Chart Utilities
 *
 * Pure utility functions for extracting variables, thresholds, and dependencies
 * from control policy expressions and state update equations.
 * No React or Recharts dependencies.
 *
 * Requirements: 1.1–1.7, 2.1–2.6, 5.5–5.7
 */

import { parse } from 'mathjs';
import { extractVariables } from './stateSpaceSchema';
import type { NonlinearModel } from './stateSpaceSchema';

/** A threshold extracted from a control policy expression */
export interface ExtractedThreshold {
  value: number;
  label: string;       // e.g., "phase_a: 1.0"
  phaseName: string;
}

/** A dependency (independent variable) for a controlled variable */
export interface ExtractedDependency {
  key: string;         // e.g., "u_fan", "x2"
  isActuator: boolean; // true if key is in u_actuators
}

/**
 * Parse all control policy expressions and return the unique set of
 * state variable keys referenced in rule conditions and exit thresholds.
 * Only returns keys that exist in state_definitions.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */
export function extractControlRuleVariables(
  controlPolicy: NonlinearModel['control_policy'],
  stateDefinitions: NonlinearModel['state_definitions']
): Set<string> {
  if (!controlPolicy || !controlPolicy.phases || controlPolicy.phases.length === 0) {
    return new Set();
  }

  const stateKeys = new Set(Object.keys(stateDefinitions));
  const allVars = new Set<string>();

  for (const phase of controlPolicy.phases) {
    // Collect expressions from rule conditions
    for (const rule of phase.rules) {
      try {
        const vars = extractVariables(rule.condition);
        for (const v of vars) {
          allVars.add(v);
        }
      } catch {
        // Skip expressions that fail to parse
      }
    }

    // Collect expressions from exit thresholds
    if (phase.exit_threshold !== null && phase.exit_threshold !== undefined) {
      try {
        const vars = extractVariables(phase.exit_threshold);
        for (const v of vars) {
          allVars.add(v);
        }
      } catch {
        // Skip expressions that fail to parse
      }
    }
  }

  // Filter to only keys present in state_definitions
  const result = new Set<string>();
  for (const v of allVars) {
    if (stateKeys.has(v)) {
      result.add(v);
    }
  }

  return result;
}

/** Comparison operators that indicate a threshold expression */
const COMPARISON_OPS = new Set(['<', '>', '<=', '>=', '==']);

/**
 * Recursively find the first SymbolNode name in an AST subtree.
 * Used to identify the primary state variable in compound expressions
 * like `x7 / (x2 + x3 + ...) < 0.45` → returns "x7".
 */
function findFirstSymbol(node: { type: string; name?: string; args?: unknown[]; content?: unknown }): string | null {
  if (node.type === 'SymbolNode' && node.name) {
    return node.name;
  }
  if (node.type === 'OperatorNode' && Array.isArray(node.args)) {
    for (const arg of node.args) {
      const found = findFirstSymbol(arg as { type: string; name?: string; args?: unknown[]; content?: unknown });
      if (found) return found;
    }
  }
  if (node.type === 'ParenthesisNode' && node.content) {
    return findFirstSymbol(node.content as { type: string; name?: string; args?: unknown[]; content?: unknown });
  }
  if (node.type === 'FunctionNode' && Array.isArray(node.args)) {
    for (const arg of node.args) {
      const found = findFirstSymbol(arg as { type: string; name?: string; args?: unknown[]; content?: unknown });
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract a threshold from a single expression string for a given variable key.
 * Returns the threshold if the expression is a comparison with a numeric literal
 * and the primary variable matches variableKey. Returns null otherwise.
 */
function extractThresholdFromExpression(
  expr: string,
  phaseName: string,
  variableKey: string
): ExtractedThreshold | null {
  let tree;
  try {
    tree = parse(expr);
  } catch {
    return null;
  }

  // The top-level node should be an OperatorNode with a comparison operator
  const node = tree as unknown as {
    type: string;
    op?: string;
    args?: Array<{ type: string; value?: number; name?: string; args?: unknown[]; content?: unknown }>;
  };

  if (node.type !== 'OperatorNode' || !node.op || !COMPARISON_OPS.has(node.op)) {
    return null;
  }

  if (!node.args || node.args.length !== 2) {
    return null;
  }

  const [left, right] = node.args;

  let constantValue: number | null = null;
  let variableSide: { type: string; name?: string; args?: unknown[]; content?: unknown } | null = null;

  if (right.type === 'ConstantNode' && typeof right.value === 'number') {
    constantValue = right.value;
    variableSide = left;
  } else if (left.type === 'ConstantNode' && typeof left.value === 'number') {
    constantValue = left.value;
    variableSide = right;
  }

  // Skip if neither side is a ConstantNode (variable-vs-variable comparison)
  if (constantValue === null || variableSide === null) {
    return null;
  }

  // Find the primary variable (first SymbolNode) on the variable side
  const primaryVar = findFirstSymbol(variableSide);

  if (primaryVar !== variableKey) {
    return null;
  }

  return {
    value: constantValue,
    label: `${phaseName}: ${constantValue}`,
    phaseName,
  };
}

/**
 * Extract numeric threshold values from control policy expressions
 * for a specific variable key. Inspects comparison OperatorNodes
 * in the mathjs AST.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export function extractThresholds(
  controlPolicy: NonlinearModel['control_policy'],
  variableKey: string
): ExtractedThreshold[] {
  if (!controlPolicy || !controlPolicy.phases || controlPolicy.phases.length === 0) {
    return [];
  }

  const thresholds: ExtractedThreshold[] = [];

  for (const phase of controlPolicy.phases) {
    // Check rule conditions
    for (const rule of phase.rules) {
      const threshold = extractThresholdFromExpression(rule.condition, phase.name, variableKey);
      if (threshold) {
        thresholds.push(threshold);
      }
    }

    // Check exit thresholds
    if (phase.exit_threshold !== null && phase.exit_threshold !== undefined) {
      const threshold = extractThresholdFromExpression(phase.exit_threshold, phase.name, variableKey);
      if (threshold) {
        thresholds.push(threshold);
      }
    }
  }

  return thresholds;
}


/**
 * Parse the state update equation for a variable to find which
 * state variables and actuator keys it references (its independent variables).
 * Excludes the variable itself, constants, transition keys, shocks, and built-ins (dt, t).
 *
 * Requirements: 5.5, 5.6, 5.7
 */
export function extractDependencies(
  model: NonlinearModel,
  variableKey: string
): ExtractedDependency[] {
  const equationKey = `${variableKey}_next`;
  const equation = model.state_update_equations[equationKey];

  if (!equation) {
    return [];
  }

  let symbols: string[];
  try {
    symbols = extractVariables(equation);
  } catch {
    return [];
  }

  const stateKeys = new Set(Object.keys(model.state_definitions));
  const actuatorKeys = new Set(Object.keys(model.input_vectors.u_actuators));

  // Built-ins to exclude
  const builtIns = new Set(['dt', 't']);

  const seen = new Set<string>();
  const dependencies: ExtractedDependency[] = [];

  for (const sym of symbols) {
    // Skip self, built-ins, and duplicates
    if (sym === variableKey || builtIns.has(sym) || seen.has(sym)) {
      continue;
    }

    const isState = stateKeys.has(sym);
    const isActuator = actuatorKeys.has(sym);

    // Only keep keys that are state variables or actuators
    if (isState || isActuator) {
      seen.add(sym);
      dependencies.push({ key: sym, isActuator });
    }
  }

  return dependencies;
}
