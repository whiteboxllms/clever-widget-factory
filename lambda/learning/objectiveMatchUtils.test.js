/**
 * Unit tests for objectiveMatchUtils.js — per-axis match distribution
 * and axis-aware embedding source composition.
 *
 * Tests:
 *   - distributeMatchesToObjectives assigns matches by text overlap
 *   - distributeMatchesToObjectives handles empty inputs gracefully
 *   - composeAxisAwareEmbeddingSource prepends axis label correctly
 */

const {
  distributeMatchesToObjectives,
  composeAxisAwareEmbeddingSource,
} = require('./objectiveMatchUtils');

// ── distributeMatchesToObjectives ───────────────────────────────────

describe('distributeMatchesToObjectives', () => {
  it('assigns matches to the most relevant objective based on text overlap', () => {
    const objectives = [
      { id: 'obj-1', text: 'Understand cement mixing ratios' },
      { id: 'obj-2', text: 'Identify proper curing techniques' },
    ];
    const axisMatches = [
      { entity_id: 'e1', embedding_source: 'cement mixing ratio testing results', similarity: 0.85 },
      { entity_id: 'e2', embedding_source: 'curing techniques for concrete', similarity: 0.78 },
    ];

    const result = distributeMatchesToObjectives(axisMatches, objectives);

    expect(result).toBeInstanceOf(Map);
    expect(result.get('obj-1').length).toBeGreaterThanOrEqual(1);
    expect(result.get('obj-2').length).toBeGreaterThanOrEqual(1);

    // The cement match should go to the cement objective
    const cementMatches = result.get('obj-1');
    expect(cementMatches.some(m => m.embedding_source.includes('cement mixing'))).toBe(true);

    // The curing match should go to the curing objective
    const curingMatches = result.get('obj-2');
    expect(curingMatches.some(m => m.embedding_source.includes('curing techniques'))).toBe(true);
  });

  it('returns empty arrays for all objectives when axisMatches is empty', () => {
    const objectives = [
      { id: 'obj-1', text: 'Understand cement mixing ratios' },
    ];
    const result = distributeMatchesToObjectives([], objectives);
    expect(result.get('obj-1')).toEqual([]);
  });

  it('returns empty map when objectives is empty', () => {
    const result = distributeMatchesToObjectives(
      [{ entity_id: 'e1', embedding_source: 'test', similarity: 0.5 }],
      []
    );
    expect(result.size).toBe(0);
  });

  it('handles null/undefined inputs gracefully', () => {
    const objectives = [{ id: 'obj-1', text: 'test' }];
    const result1 = distributeMatchesToObjectives(null, objectives);
    expect(result1.get('obj-1')).toEqual([]);

    const result2 = distributeMatchesToObjectives(undefined, objectives);
    expect(result2.get('obj-1')).toEqual([]);
  });

  it('falls back to first objective when no text overlap exists', () => {
    const objectives = [
      { id: 'obj-1', text: 'alpha beta gamma' },
      { id: 'obj-2', text: 'delta epsilon zeta' },
    ];
    const axisMatches = [
      { entity_id: 'e1', embedding_source: 'completely unrelated words xyz', similarity: 0.6 },
    ];

    const result = distributeMatchesToObjectives(axisMatches, objectives);
    // Should fall back to first objective
    expect(result.get('obj-1').length).toBe(1);
    expect(result.get('obj-2').length).toBe(0);
  });

  it('each match includes similarity and embedding_source', () => {
    const objectives = [{ id: 'obj-1', text: 'cement work' }];
    const axisMatches = [
      { entity_id: 'e1', embedding_source: 'cement work details', similarity: 0.9 },
    ];

    const result = distributeMatchesToObjectives(axisMatches, objectives);
    const matches = result.get('obj-1');
    expect(matches[0]).toHaveProperty('similarity', 0.9);
    expect(matches[0]).toHaveProperty('embedding_source', 'cement work details');
  });
});

// ── composeAxisAwareEmbeddingSource ─────────────────────────────────

describe('composeAxisAwareEmbeddingSource', () => {
  it('prepends axis label to state text with colon separator', () => {
    const result = composeAxisAwareEmbeddingSource(
      'Cement Work',
      "For learning objective 'Understand mixing ratios'"
    );
    expect(result).toBe("Cement Work: For learning objective 'Understand mixing ratios'");
  });

  it('returns just stateText when axisLabel is empty', () => {
    expect(composeAxisAwareEmbeddingSource('', 'some text')).toBe('some text');
    expect(composeAxisAwareEmbeddingSource(null, 'some text')).toBe('some text');
  });

  it('returns just axisLabel when stateText is empty', () => {
    expect(composeAxisAwareEmbeddingSource('Cement Work', '')).toBe('Cement Work');
    expect(composeAxisAwareEmbeddingSource('Cement Work', null)).toBe('Cement Work');
  });

  it('returns empty string when both are empty', () => {
    expect(composeAxisAwareEmbeddingSource('', '')).toBe('');
    expect(composeAxisAwareEmbeddingSource(null, null)).toBe('');
  });
});
