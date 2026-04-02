import { describe, it, expect } from 'vitest';
import { validateDimensions, validateStateSpaceJson, StateSpaceModel } from './stateSpaceSchema';

/** Helper to build a minimal valid StateSpaceModel with given dimensions */
function makeModel(
  n: number,
  m: number,
  p: number,
  overrides?: {
    A?: number[][];
    B?: number[][];
    C?: number[][];
    D?: number[][];
    stateLabels?: string[];
    inputLabels?: string[];
    outputLabels?: string[];
  }
): StateSpaceModel {
  const zeros = (rows: number, cols: number) =>
    Array.from({ length: rows }, () => Array(cols).fill(0));
  const labels = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => `${prefix}${i}`);

  return {
    model_metadata: {
      model_id: 'test',
      version: '1.0',
      author: 'test',
      description: 'test',
    },
    state_space: {
      dimensions: { states: n, inputs: m, outputs: p },
      labels: {
        states: overrides?.stateLabels ?? labels('s', n),
        inputs: overrides?.inputLabels ?? labels('u', m),
        outputs: overrides?.outputLabels ?? labels('y', p),
      },
      matrices: {
        A: overrides?.A ?? zeros(n, n),
        B: overrides?.B ?? zeros(n, m),
        C: overrides?.C ?? zeros(p, n),
        D: overrides?.D ?? zeros(p, m),
      },
    },
    model_description_prompt: 'Test model description prompt',
  };
}

describe('validateDimensions', () => {
  it('returns empty array for a correctly dimensioned model', () => {
    const model = makeModel(3, 2, 2);
    expect(validateDimensions(model)).toEqual([]);
  });

  it('returns empty array for minimal 1×1 model', () => {
    const model = makeModel(1, 1, 1);
    expect(validateDimensions(model)).toEqual([]);
  });

  // Req 5.1: Matrix A must be n×n
  it('detects wrong column count in Matrix A', () => {
    const model = makeModel(4, 2, 2, {
      A: Array.from({ length: 4 }, () => [0, 0, 0]), // 4×3 instead of 4×4
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('Matrix A') && e.includes('4×4') && e.includes('4×3'))).toBe(true);
  });

  it('detects wrong row count in Matrix A', () => {
    const model = makeModel(4, 2, 2, {
      A: Array.from({ length: 3 }, () => [0, 0, 0, 0]), // 3×4 instead of 4×4
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('Matrix A') && e.includes('4×4') && e.includes('3×4'))).toBe(true);
  });

  // Req 5.2: Matrix B must be n×m
  it('detects wrong dimensions in Matrix B', () => {
    const model = makeModel(3, 2, 2, {
      B: Array.from({ length: 3 }, () => [0, 0, 0]), // 3×3 instead of 3×2
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('Matrix B') && e.includes('3×2') && e.includes('3×3'))).toBe(true);
  });

  // Req 5.3: Matrix C must be p×n
  it('detects wrong dimensions in Matrix C', () => {
    const model = makeModel(3, 2, 2, {
      C: Array.from({ length: 2 }, () => [0, 0]), // 2×2 instead of 2×3
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('Matrix C') && e.includes('2×3') && e.includes('2×2'))).toBe(true);
  });

  // Req 5.4: Matrix D must be p×m
  it('detects wrong dimensions in Matrix D', () => {
    const model = makeModel(3, 2, 2, {
      D: [[0], [0]], // 2×1 instead of 2×2
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('Matrix D') && e.includes('2×2') && e.includes('2×1'))).toBe(true);
  });

  // Req 5.5, 5.6, 5.7: Label array lengths
  it('detects wrong state label count', () => {
    const model = makeModel(4, 2, 2, {
      stateLabels: ['s0', 's1', 's2'], // 3 instead of 4
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('labels.states') && e.includes('4') && e.includes('3'))).toBe(true);
  });

  it('detects wrong input label count', () => {
    const model = makeModel(3, 2, 2, {
      inputLabels: ['u0'], // 1 instead of 2
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('labels.inputs') && e.includes('2') && e.includes('1'))).toBe(true);
  });

  it('detects wrong output label count', () => {
    const model = makeModel(3, 2, 3, {
      outputLabels: ['y0', 'y1'], // 2 instead of 3
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('labels.outputs') && e.includes('3') && e.includes('2'))).toBe(true);
  });

  // Req 5.9: Jagged arrays
  it('detects jagged array in Matrix A', () => {
    const model = makeModel(3, 2, 2, {
      A: [
        [0, 0, 0],
        [0, 0],    // row 1 has 2 cols instead of 3
        [0, 0, 0],
      ],
    });
    const errors = validateDimensions(model);
    expect(errors.some((e) => e.includes('Matrix A') && e.includes('row 1') && e.includes('jagged'))).toBe(true);
  });

  // Req 5.8: Error messages include expected vs actual
  it('error messages include expected and actual sizes', () => {
    const model = makeModel(4, 2, 2, {
      A: Array.from({ length: 4 }, () => [0, 0, 0]), // 4×3 instead of 4×4
    });
    const errors = validateDimensions(model);
    expect(errors[0]).toContain('expected');
    expect(errors[0]).toContain('4×4');
    expect(errors[0]).toContain('4×3');
  });

  it('reports multiple errors at once', () => {
    const model = makeModel(3, 2, 2, {
      A: [[0, 0], [0, 0], [0, 0]],       // 3×2 instead of 3×3
      B: [[0], [0], [0]],                  // 3×1 instead of 3×2
      stateLabels: ['s0', 's1'],            // 2 instead of 3
      outputLabels: ['y0'],                 // 1 instead of 2
    });
    const errors = validateDimensions(model);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});


describe('validateStateSpaceJson', () => {
  // Helper: build a valid JSON string from a model
  const validJsonString = () => JSON.stringify(makeModel(2, 1, 1), null, 2);

  // Req 3.3: Empty input
  it('returns error for empty string', () => {
    const result = validateStateSpaceJson('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(['JSON input is required.']);
    }
  });

  it('returns error for whitespace-only string', () => {
    const result = validateStateSpaceJson('   \n\t  ');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(['JSON input is required.']);
    }
  });

  // Req 4.1: Invalid JSON parse error
  it('returns parse error for invalid JSON', () => {
    const result = validateStateSpaceJson('{ not valid json }');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toBeTruthy();
    }
  });

  // Req 4.10: Zod errors as readable list with paths
  it('returns Zod errors with paths for structurally invalid JSON', () => {
    const result = validateStateSpaceJson('{"model_metadata": 42}');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      // Should include path info
      expect(result.errors.some((e) => e.includes('model_metadata'))).toBe(true);
    }
  });

  it('returns multiple Zod errors at once', () => {
    const result = validateStateSpaceJson('{}');
    expect(result.success).toBe(false);
    if (!result.success) {
      // Missing all three top-level sections
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });

  // Dimension errors propagated
  it('returns dimension errors for mismatched matrices', () => {
    const model = makeModel(2, 1, 1);
    model.state_space.matrices.A = [[0], [0]]; // 2×1 instead of 2×2
    const result = validateStateSpaceJson(JSON.stringify(model));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('Matrix A'))).toBe(true);
    }
  });

  // Success case
  it('returns success with parsed model for valid input', () => {
    const result = validateStateSpaceJson(validJsonString());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.model.model_metadata.model_id).toBe('test');
      expect(result.model.state_space.dimensions.states).toBe(2);
    }
  });
});
