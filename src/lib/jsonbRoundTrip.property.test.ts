/**
 * Property Test: JSONB Round-Trip
 *
 * Feature: state-space-persistence, Property 3: Model JSONB round-trip
 *
 * Validates: Requirements 1.3, 10.1, 10.2
 *
 * For any valid StateSpaceModel, serializing to JSON and parsing back
 * must produce a deep-equal object, including numeric precision in matrices.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// --- Custom Arbitraries ---

/** Generates a non-empty trimmed string (1–30 chars). */
function arbNonEmptyString(): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);
}

/** Generates valid model_metadata. */
function arbValidModelMetadata() {
  return fc.record({
    name: arbNonEmptyString(),
    version: arbNonEmptyString(),
    author: arbNonEmptyString(),
    description: arbNonEmptyString(),
  });
}

/**
 * Generates a finite double that survives JSON round-trip.
 * Excludes NaN, Infinity, and -0 (JSON.stringify(-0) === "0", losing the sign).
 */
function arbFiniteDouble(): fc.Arbitrary<number> {
  return fc
    .double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
    .map((v) => (Object.is(v, -0) ? 0 : v));
}

/** Generates a matrix of the given dimensions filled with random finite numbers. */
function arbMatrix(rows: number, cols: number): fc.Arbitrary<number[][]> {
  return fc.array(
    fc.array(arbFiniteDouble(), {
      minLength: cols,
      maxLength: cols,
    }),
    { minLength: rows, maxLength: rows }
  );
}

/** Generates a valid state_space with matching dimensions, labels, and matrices. */
function arbValidStateSpace() {
  return fc
    .record({
      n: fc.integer({ min: 1, max: 8 }),
      m: fc.integer({ min: 1, max: 8 }),
      p: fc.integer({ min: 1, max: 8 }),
    })
    .chain(({ n, m, p }) =>
      fc.record({
        dimensions: fc.constant({ states: n, inputs: m, outputs: p }),
        labels: fc.record({
          states: fc.array(arbNonEmptyString(), { minLength: n, maxLength: n }),
          inputs: fc.array(arbNonEmptyString(), { minLength: m, maxLength: m }),
          outputs: fc.array(arbNonEmptyString(), { minLength: p, maxLength: p }),
        }),
        matrices: fc.record({
          A: arbMatrix(n, n),
          B: arbMatrix(n, m),
          C: arbMatrix(p, n),
          D: arbMatrix(p, m),
        }),
      })
    );
}

/** Composes a full valid StateSpaceModel. */
function arbValidStateSpaceModel() {
  return fc.record({
    model_metadata: arbValidModelMetadata(),
    state_space: arbValidStateSpace(),
    model_description_prompt: arbNonEmptyString(),
  });
}

// --- Property Test ---

describe('Feature: state-space-persistence, Property 3: Model JSONB round-trip', () => {
  it('JSON.parse(JSON.stringify(model)) deep-equals the original for any valid model', () => {
    /**
     * Validates: Requirements 1.3, 10.1, 10.2
     *
     * This property ensures that the JSON serialization round-trip preserves
     * all data including numeric precision in matrices — the same round-trip
     * that occurs when storing model_definition as JSONB in PostgreSQL.
     */
    fc.assert(
      fc.property(arbValidStateSpaceModel(), (model) => {
        const serialized = JSON.stringify(model);
        const roundTripped = JSON.parse(serialized);

        // Verify structural deep equality (value-level, not prototype-level)
        expect(roundTripped).toEqual(model);

        // Verify numeric precision is preserved in all matrices
        const { A, B, C, D } = model.state_space.matrices;
        const rt = roundTripped.state_space.matrices;
        for (const [name, original, parsed] of [
          ['A', A, rt.A],
          ['B', B, rt.B],
          ['C', C, rt.C],
          ['D', D, rt.D],
        ] as const) {
          for (let r = 0; r < original.length; r++) {
            for (let c = 0; c < original[r].length; c++) {
              expect(parsed[r][c]).toBe(original[r][c]);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
