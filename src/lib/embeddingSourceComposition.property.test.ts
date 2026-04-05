/**
 * Property Test: Embedding Source Composition
 *
 * Feature: state-space-persistence, Property 8: Embedding source composition completeness
 *
 * Validates: Requirements 8.3
 *
 * Tests that the embedding source composition function correctly joins all non-empty
 * fields with '. ' and excludes empty/whitespace-only fields.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// --- Composition function (mirrors lambda/state-space-models/index.js) ---

function composeEmbeddingSource(
  name: string | null | undefined,
  description: string | null | undefined,
  modelDescriptionPrompt: string | null | undefined
): string {
  return [name, description, modelDescriptionPrompt]
    .filter((s) => s && s.trim())
    .join('. ');
}

// --- Custom Arbitraries ---

/** Generates a non-empty trimmed string (1–50 chars). */
function arbNonEmptyString(): fc.Arbitrary<string> {
  return fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
}

/** Generates an "empty-ish" value: empty string, whitespace-only, null, or undefined. */
function arbEmptyish(): fc.Arbitrary<string | null | undefined> {
  return fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.constant('\t'),
    fc.constant('\n'),
    fc.constant(null as null),
    fc.constant(undefined as undefined)
  );
}

/** Generates a field that is either a non-empty string or an empty-ish value. */
function arbField(): fc.Arbitrary<string | null | undefined> {
  return fc.oneof(arbNonEmptyString(), arbEmptyish());
}

// --- Helper ---

function isNonEmpty(s: string | null | undefined): s is string {
  return s != null && s.trim().length > 0;
}

// --- Property Tests ---

describe('Feature: state-space-persistence, Property 8: Embedding source composition completeness', () => {
  it('composed source contains all non-empty fields joined by ". "', () => {
    fc.assert(
      fc.property(arbField(), arbField(), arbField(), (name, description, prompt) => {
        /** Validates: Requirements 8.3 */
        const result = composeEmbeddingSource(name, description, prompt);
        const nonEmptyFields = [name, description, prompt].filter(isNonEmpty);

        // Every non-empty field must appear in the result
        for (const field of nonEmptyFields) {
          expect(result).toContain(field);
        }

        // Result must equal the non-empty fields joined by '. '
        const expected = nonEmptyFields.join('. ');
        expect(result).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('all non-empty fields produce a non-empty result equal to name. desc. prompt', () => {
    fc.assert(
      fc.property(arbNonEmptyString(), arbNonEmptyString(), arbNonEmptyString(), (name, desc, prompt) => {
        /** Validates: Requirements 8.3 */
        const result = composeEmbeddingSource(name, desc, prompt);
        expect(result.length).toBeGreaterThan(0);
        // When all three fields are non-empty, result must be exactly their join
        const expected = [name, desc, prompt].join('. ');
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('all empty fields produce an empty result', () => {
    fc.assert(
      fc.property(arbEmptyish(), arbEmptyish(), arbEmptyish(), (name, desc, prompt) => {
        /** Validates: Requirements 8.3 */
        const result = composeEmbeddingSource(name, desc, prompt);
        expect(result).toBe('');
      }),
      { numRuns: 100 }
    );
  });
});
