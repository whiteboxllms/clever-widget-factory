/**
 * State Space Model Schema & Types
 *
 * Zod schemas and TypeScript types for discrete-time state-space models.
 * Used by StateSpacePage for validation of pasted JSON models.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11
 */

import * as z from 'zod';

// --- Zod Schemas ---

export const modelMetadataSchema = z.object({
  model_id: z.string(),
  version: z.string(),
  author: z.string(),
  description: z.string(),
});

export const dimensionsSchema = z.object({
  states: z.number().int().positive(),
  inputs: z.number().int().positive(),
  outputs: z.number().int().positive(),
});

export const labelsSchema = z.object({
  states: z.array(z.string()),
  inputs: z.array(z.string()),
  outputs: z.array(z.string()),
});

export const matrixSchema = z.array(z.array(z.number()));

export const matricesSchema = z.object({
  A: matrixSchema,
  B: matrixSchema,
  C: matrixSchema,
  D: matrixSchema,
});

export const stateSpaceSchema = z.object({
  dimensions: dimensionsSchema,
  labels: labelsSchema,
  matrices: matricesSchema,
});

export const stateSpaceModelSchema = z.object({
  model_metadata: modelMetadataSchema,
  state_space: stateSpaceSchema,
  model_description_prompt: z.string(),
});

// --- Inferred Types ---

export type ModelMetadata = z.infer<typeof modelMetadataSchema>;
export type Dimensions = z.infer<typeof dimensionsSchema>;
export type Labels = z.infer<typeof labelsSchema>;
export type Matrix = z.infer<typeof matrixSchema>;
export type Matrices = z.infer<typeof matricesSchema>;
export type StateSpace = z.infer<typeof stateSpaceSchema>;
export type StateSpaceModel = z.infer<typeof stateSpaceModelSchema>;

// --- Dimension Validation ---

/**
 * Validates that matrix dimensions and label array lengths match the declared
 * dimensions in a StateSpaceModel. Runs after Zod schema validation passes.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
 */
export function validateDimensions(model: StateSpaceModel): string[] {
  const errors: string[] = [];
  const { states: n, inputs: m, outputs: p } = model.state_space.dimensions;
  const { matrices, labels } = model.state_space;

  // Matrix dimension expectations: [name, matrix, expectedRows, expectedCols]
  const matrixChecks: [string, Matrix, number, number][] = [
    ['A', matrices.A, n, n],
    ['B', matrices.B, n, m],
    ['C', matrices.C, p, n],
    ['D', matrices.D, p, m],
  ];

  for (const [name, matrix, expectedRows, expectedCols] of matrixChecks) {
    const actualRows = matrix.length;

    // Check row count
    if (actualRows !== expectedRows) {
      // Report overall dimension mismatch using first row's col count (or 0 if empty)
      const actualCols = actualRows > 0 ? matrix[0].length : 0;
      errors.push(
        `Matrix ${name}: expected ${expectedRows}\u00d7${expectedCols}, got ${actualRows}\u00d7${actualCols}`
      );
    } else {
      // Row count matches — check column counts per row
      // First check if overall column count is wrong (using first row)
      const firstRowCols = actualRows > 0 ? matrix[0].length : 0;
      if (firstRowCols !== expectedCols) {
        errors.push(
          `Matrix ${name}: expected ${expectedRows}\u00d7${expectedCols}, got ${actualRows}\u00d7${firstRowCols}`
        );
      }
    }

    // Check for jagged arrays (rows with inconsistent column counts)
    for (let i = 0; i < actualRows; i++) {
      if (matrix[i].length !== expectedCols) {
        errors.push(
          `Matrix ${name}: row ${i} has ${matrix[i].length} columns, expected ${expectedCols} (jagged array)`
        );
      }
    }
  }

  // Label array length checks
  const labelChecks: [string, string[], number][] = [
    ['labels.states', labels.states, n],
    ['labels.inputs', labels.inputs, m],
    ['labels.outputs', labels.outputs, p],
  ];

  for (const [name, arr, expected] of labelChecks) {
    if (arr.length !== expected) {
      errors.push(`${name}: expected ${expected} items, got ${arr.length}`);
    }
  }

  return errors;
}

// --- Combined Validation Entry Point ---

export type ValidationResult =
  | { success: true; model: StateSpaceModel }
  | { success: false; errors: string[] };

/**
 * Validates a JSON string as a StateSpaceModel. Runs three phases:
 * 1. Empty input check
 * 2. JSON.parse (catches SyntaxError)
 * 3. Zod schema validation
 * 4. Dimension validation (only if schema passes)
 *
 * Requirements: 3.3, 4.1, 4.10
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

  // Phase 3: Zod schema validation
  const result = stateSpaceModelSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });
    return { success: false, errors };
  }

  // Phase 4: Dimension validation
  const dimensionErrors = validateDimensions(result.data);
  if (dimensionErrors.length > 0) {
    return { success: false, errors: dimensionErrors };
  }

  return { success: true, model: result.data };
}
