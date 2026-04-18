/**
 * Property-based tests for skill-profile Lambda utility functions.
 * Uses Vitest + fast-check.
 *
 * Properties tested:
 *   Property 8 – Axis embedding source composition
 *   Property 9 – Axis entity ID round-trip
 *   Property 4 – Per-axis embedding message generation
 */

const fc = require('fast-check');
const {
  composeAxisEmbeddingSource,
  composeAxisEntityId,
  parseAxisEntityId
} = require('./axisUtils');

// ── Shared arbitraries ──────────────────────────────────────────────

const arbLabel = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const arbDescription = fc.option(fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0));
const arbNarrative = fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0));
const arbUuid = fc.uuid();
const arbAxisKey = fc.stringMatching(/^[a-z][a-z0-9_]{2,30}$/);

// ── Property 8: Axis embedding source composition ───────────────────
// **Validates: Requirements 4.2**

describe('Property 8: Axis embedding source composition', () => {
  it('composed source always contains the label', () => {
    fc.assert(
      fc.property(arbLabel, arbDescription, arbNarrative, (label, description, narrative) => {
        const axis = { label, description: description ?? undefined };
        const source = composeAxisEmbeddingSource(axis, narrative ?? undefined);
        return source.includes(label);
      }),
      { numRuns: 100 }
    );
  });

  it('composed source contains the description when description is non-empty', () => {
    fc.assert(
      fc.property(
        arbLabel,
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        arbNarrative,
        (label, description, narrative) => {
          const axis = { label, description };
          const source = composeAxisEmbeddingSource(axis, narrative ?? undefined);
          return source.includes(description);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('composed source contains the narrative when narrative is non-empty', () => {
    fc.assert(
      fc.property(
        arbLabel,
        arbDescription,
        fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
        (label, description, narrative) => {
          const axis = { label, description: description ?? undefined };
          const source = composeAxisEmbeddingSource(axis, narrative);
          return source.includes(narrative);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('composed source is never empty', () => {
    fc.assert(
      fc.property(arbLabel, arbDescription, arbNarrative, (label, description, narrative) => {
        const axis = { label, description: description ?? undefined };
        const source = composeAxisEmbeddingSource(axis, narrative ?? undefined);
        return source.length > 0;
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 9: Axis entity ID round-trip ───────────────────────────
// **Validates: Requirements 4.1**

describe('Property 9: Axis entity ID round-trip', () => {
  it('composing then parsing recovers the original actionId and axisKey', () => {
    fc.assert(
      fc.property(arbUuid, arbAxisKey, (actionId, axisKey) => {
        const entityId = composeAxisEntityId(actionId, axisKey);
        const parsed = parseAxisEntityId(entityId);
        return parsed.actionId === actionId && parsed.axisKey === axisKey;
      }),
      { numRuns: 100 }
    );
  });

  it('the colon separator appears exactly once in the composed entity ID', () => {
    fc.assert(
      fc.property(arbUuid, arbAxisKey, (actionId, axisKey) => {
        const entityId = composeAxisEntityId(actionId, axisKey);
        const colonCount = (entityId.match(/:/g) || []).length;
        // UUID contains hyphens but no colons; axis keys are snake_case (no colons).
        // The only colon is the separator we insert.
        return colonCount === 1;
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 4: Per-axis embedding message generation ───────────────
// **Validates: Requirements 2.1, 4.1**
//
// We test the property by generating a valid skill profile with N axes
// (4 ≤ N ≤ 6), then building the expected SQS message bodies using the
// pure utility functions and verifying the constraints.

/**
 * Build the array of SQS message bodies for axis embeddings.
 * This mirrors what handleApprove does, using the pure utilities.
 */
function buildAxisEmbeddingMessages(actionId, organizationId, approvedProfile) {
  return Object.entries(approvedProfile.axes).map(([axisKey, axis]) => ({
    entity_type: 'skill_axis',
    entity_id: composeAxisEntityId(actionId, axisKey),
    embedding_source: composeAxisEmbeddingSource(axis, approvedProfile.narrative),
    organization_id: organizationId
  }));
}

/** Arbitrary: a single axis object */
const arbAxis = fc.record({
  label: arbLabel,
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0))
    .map(d => d ?? undefined),
  required_level: fc.integer({ min: 1, max: 6 })
});

/** Arbitrary: a skill profile with 4–6 unique axis keys */
const arbProfile = fc.integer({ min: 4, max: 6 }).chain(n =>
  fc.tuple(
    fc.uniqueArray(arbAxisKey, { minLength: n, maxLength: n }),
    fc.array(arbAxis, { minLength: n, maxLength: n }),
    fc.option(fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0))
      .map(n => n ?? undefined)
  ).map(([keys, axes, narrative]) => {
    const axesObj = {};
    keys.forEach((key, i) => { axesObj[key] = axes[i]; });
    return { axes: axesObj, narrative };
  })
);

describe('Property 4: Per-axis embedding message generation', () => {
  it('produces exactly N messages with entity_type skill_axis, one per axis', () => {
    fc.assert(
      fc.property(arbUuid, arbUuid, arbProfile, (actionId, organizationId, profile) => {
        const messages = buildAxisEmbeddingMessages(actionId, organizationId, profile);
        const axisCount = Object.keys(profile.axes).length;

        // Exactly N messages
        if (messages.length !== axisCount) return false;

        // All have entity_type 'skill_axis'
        if (!messages.every(m => m.entity_type === 'skill_axis')) return false;

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('each message entity_id follows {action_id}:{axis_key} format', () => {
    fc.assert(
      fc.property(arbUuid, arbUuid, arbProfile, (actionId, organizationId, profile) => {
        const messages = buildAxisEmbeddingMessages(actionId, organizationId, profile);
        const axisKeys = Object.keys(profile.axes);

        return messages.every(m => {
          const parsed = parseAxisEntityId(m.entity_id);
          return parsed.actionId === actionId && axisKeys.includes(parsed.axisKey);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('no two messages share the same entity_id', () => {
    fc.assert(
      fc.property(arbUuid, arbUuid, arbProfile, (actionId, organizationId, profile) => {
        const messages = buildAxisEmbeddingMessages(actionId, organizationId, profile);
        const ids = messages.map(m => m.entity_id);
        return new Set(ids).size === ids.length;
      }),
      { numRuns: 100 }
    );
  });
});
