/**
 * Unit tests for lens selection, gap boost, and values lens builder functions.
 * Tests selectLenses, applyGapBoost, and buildValuesLenses.
 *
 * These functions are extracted to lensUtils.js for testability
 * (no Lambda layer dependencies).
 */

const { selectLenses, applyGapBoost, buildValuesLenses, buildLensPromptBlock, buildAssetContextBlock } = require('./lensUtils');

// ---------------------------------------------------------------------------
// buildValuesLenses
// ---------------------------------------------------------------------------

describe('buildValuesLenses', () => {
  it('returns empty array when strategicAttributes is null', () => {
    expect(buildValuesLenses(null, {})).toEqual([]);
  });

  it('returns empty array when strategicAttributes is empty', () => {
    expect(buildValuesLenses([], {})).toEqual([]);
  });

  it('returns empty array when strategicAttributes is undefined', () => {
    expect(buildValuesLenses(undefined, {})).toEqual([]);
  });

  it('creates one lens per attribute with correct fields', () => {
    const result = buildValuesLenses(['organic', 'teamwork'], {});
    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      key: 'values_organic',
      label: 'organic',
      description: 'How does this practice align with or reinforce the organization value: organic?',
      weight: 0.3,
      source: 'values',
    });

    expect(result[1]).toEqual({
      key: 'values_teamwork',
      label: 'teamwork',
      description: 'How does this practice align with or reinforce the organization value: teamwork?',
      weight: 0.3,
      source: 'values',
    });
  });

  it('applies weight overrides from valuesLensWeights', () => {
    const overrides = {
      values_organic: { weight: 0.8, enabled: true },
    };
    const result = buildValuesLenses(['organic', 'quality'], overrides);
    expect(result[0].weight).toBe(0.8);
    expect(result[1].weight).toBe(0.3); // default
  });

  it('slugifies attribute names with special characters', () => {
    const result = buildValuesLenses(['Soil Health & Safety'], {});
    expect(result[0].key).toBe('values_soil_health_safety');
    expect(result[0].label).toBe('Soil Health & Safety');
  });

  it('filters out non-string and empty attributes', () => {
    const result = buildValuesLenses(['organic', '', null, 42, 'quality'], {});
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('values_organic');
    expect(result[1].key).toBe('values_quality');
  });
});

// ---------------------------------------------------------------------------
// applyGapBoost
// ---------------------------------------------------------------------------

describe('applyGapBoost', () => {
  const baseLensPool = () => [
    { key: 'failure_analysis', weight: 0.5, label: 'FA', description: 'FA desc', source: 'system' },
    { key: 'root_cause_reasoning', weight: 0.5, label: 'RC', description: 'RC desc', source: 'system' },
    { key: 'scenario_response', weight: 0.5, label: 'SR', description: 'SR desc', source: 'system' },
  ];

  it('returns pool unchanged when rules array is empty', () => {
    const pool = baseLensPool();
    const result = applyGapBoost(pool, 2.0, []);
    expect(result[0].weight).toBe(0.5);
    expect(result[1].weight).toBe(0.5);
    expect(result[2].weight).toBe(0.5);
  });

  it('returns pool unchanged when rules is null', () => {
    const pool = baseLensPool();
    const result = applyGapBoost(pool, 2.0, null);
    expect(result[0].weight).toBe(0.5);
  });

  it('returns pool unchanged when no rules match the gap', () => {
    const pool = baseLensPool();
    const rules = [
      { threshold: 3.0, lens_keys: ['failure_analysis'], multiplier: 2.0 },
    ];
    const result = applyGapBoost(pool, 2.0, rules);
    expect(result[0].weight).toBe(0.5); // not boosted
  });

  it('applies the highest matching threshold rule', () => {
    const pool = baseLensPool();
    const rules = [
      { threshold: 0.5, lens_keys: ['failure_analysis'], multiplier: 1.5 },
      { threshold: 1.5, lens_keys: ['root_cause_reasoning'], multiplier: 2.0 },
      { threshold: 3.0, lens_keys: ['scenario_response'], multiplier: 3.0 },
    ];
    // Gap is 2.0, so threshold 1.5 is the highest that matches
    const result = applyGapBoost(pool, 2.0, rules);
    expect(result[0].weight).toBe(0.5);  // failure_analysis not in rule 1.5
    expect(result[1].weight).toBe(1.0);  // root_cause_reasoning: 0.5 * 2.0
    expect(result[2].weight).toBe(0.5);  // scenario_response not in rule 1.5
  });

  it('boosts multiple lenses in the same rule', () => {
    const pool = baseLensPool();
    const rules = [
      { threshold: 1.0, lens_keys: ['failure_analysis', 'root_cause_reasoning'], multiplier: 2.0 },
    ];
    const result = applyGapBoost(pool, 1.5, rules);
    expect(result[0].weight).toBe(1.0);  // 0.5 * 2.0
    expect(result[1].weight).toBe(1.0);  // 0.5 * 2.0
    expect(result[2].weight).toBe(0.5);  // not boosted
  });
});

// ---------------------------------------------------------------------------
// selectLenses
// ---------------------------------------------------------------------------

describe('selectLenses', () => {
  const makeLens = (key, weight = 0.5) => ({
    key,
    label: key,
    description: `${key} description`,
    weight,
    source: 'system',
  });

  it('returns 0 lenses when pool is empty', () => {
    const result = selectLenses([], null, []);
    expect(result).toEqual([]);
  });

  it('returns 1 lens when pool has exactly 1 enabled lens', () => {
    const pool = [makeLens('a')];
    const result = selectLenses(pool, null, []);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('a');
  });

  it('returns 2 or 3 lenses when pool has >= 2 enabled lenses', () => {
    const pool = [makeLens('a'), makeLens('b'), makeLens('c'), makeLens('d'), makeLens('e')];
    const result = selectLenses(pool, null, []);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('excludes lenses with weight 0', () => {
    const pool = [makeLens('a', 0), makeLens('b', 0), makeLens('c', 0.5)];
    const result = selectLenses(pool, null, []);
    // Only 1 lens with weight > 0, so returns all available (1)
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('c');
  });

  it('returns unique lenses (no duplicates)', () => {
    const pool = [makeLens('a'), makeLens('b'), makeLens('c'), makeLens('d')];
    const result = selectLenses(pool, null, []);
    const keys = result.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not mutate the input pool', () => {
    const pool = [makeLens('a'), makeLens('b'), makeLens('c')];
    const originalLength = pool.length;
    const originalWeights = pool.map((l) => l.weight);
    selectLenses(pool, null, []);
    expect(pool).toHaveLength(originalLength);
    expect(pool.map((l) => l.weight)).toEqual(originalWeights);
  });

  it('selected lenses do not include weight field', () => {
    const pool = [makeLens('a'), makeLens('b'), makeLens('c')];
    const result = selectLenses(pool, null, []);
    for (const lens of result) {
      expect(lens).toHaveProperty('key');
      expect(lens).toHaveProperty('label');
      expect(lens).toHaveProperty('description');
      expect(lens).toHaveProperty('source');
      expect(lens).not.toHaveProperty('weight');
    }
  });

  it('applies gap boost when capabilityGap is provided', () => {
    // Create a pool where one lens has very low weight, but gap boost makes it dominant
    const pool = [
      makeLens('a', 0.01),
      makeLens('b', 0.01),
      makeLens('c', 0.01),
    ];
    const rules = [
      { threshold: 1.0, lens_keys: ['a'], multiplier: 3.0 },
    ];
    // Run many times to verify 'a' is selected more often due to boost
    let aCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = selectLenses(pool, 2.0, rules);
      if (result.some((l) => l.key === 'a')) aCount++;
    }
    // With 3x boost, 'a' should be selected most of the time
    expect(aCount).toBeGreaterThan(25);
  });
});


// ---------------------------------------------------------------------------
// buildLensPromptBlock
// ---------------------------------------------------------------------------

describe('buildLensPromptBlock', () => {
  it('returns empty string when given empty array', () => {
    expect(buildLensPromptBlock([])).toBe('');
  });

  it('returns empty string when given null', () => {
    expect(buildLensPromptBlock(null)).toBe('');
  });

  it('returns empty string when given undefined', () => {
    expect(buildLensPromptBlock(undefined)).toBe('');
  });

  it('builds correct block with numbered lenses and framing guidance', () => {
    const lenses = [
      { key: 'failure_analysis', label: 'Failure Analysis', description: 'What could go wrong if this practice is done incorrectly or skipped?', source: 'system' },
      { key: 'underlying_science', label: 'Underlying Science', description: 'What physics, chemistry, or biology principles explain why this practice works?', source: 'system' },
    ];
    const result = buildLensPromptBlock(lenses);

    expect(result).toContain('QUESTION FRAMING LENSES (use these angles to diversify question perspectives):');
    expect(result).toContain('  1. Failure Analysis: What could go wrong if this practice is done incorrectly or skipped?');
    expect(result).toContain('  2. Underlying Science: What physics, chemistry, or biology principles explain why this practice works?');
    expect(result).toContain('Frame at least one question through each lens above. These are framing suggestions, not rigid constraints — the learning objective remains the primary focus.');
  });

  it('includes every lens description in the output', () => {
    const lenses = [
      { key: 'a', label: 'Lens A', description: 'Description A', source: 'system' },
      { key: 'b', label: 'Lens B', description: 'Description B', source: 'custom' },
      { key: 'c', label: 'Lens C', description: 'Description C', source: 'values' },
    ];
    const result = buildLensPromptBlock(lenses);

    expect(result).toContain('Description A');
    expect(result).toContain('Description B');
    expect(result).toContain('Description C');
  });

  it('numbers lenses sequentially starting from 1', () => {
    const lenses = [
      { key: 'a', label: 'A', description: 'Desc A', source: 'system' },
      { key: 'b', label: 'B', description: 'Desc B', source: 'system' },
      { key: 'c', label: 'C', description: 'Desc C', source: 'system' },
    ];
    const result = buildLensPromptBlock(lenses);

    expect(result).toContain('  1. A: Desc A');
    expect(result).toContain('  2. B: Desc B');
    expect(result).toContain('  3. C: Desc C');
  });

  it('works with a single lens', () => {
    const lenses = [
      { key: 'solo', label: 'Solo Lens', description: 'Only one lens here', source: 'custom' },
    ];
    const result = buildLensPromptBlock(lenses);

    expect(result).toContain('  1. Solo Lens: Only one lens here');
    expect(result).toContain('Frame at least one question through each lens above.');
  });
});

// ---------------------------------------------------------------------------
// buildAssetContextBlock
// ---------------------------------------------------------------------------

describe('buildAssetContextBlock', () => {
  it('returns empty string when given empty array', () => {
    expect(buildAssetContextBlock([])).toBe('');
  });

  it('returns empty string when given null', () => {
    expect(buildAssetContextBlock(null)).toBe('');
  });

  it('returns empty string when given undefined', () => {
    expect(buildAssetContextBlock(undefined)).toBe('');
  });

  it('builds correct block with numbered assets and entity types', () => {
    const assets = [
      { entity_type: 'tool', entity_id: '1', description: 'Pruning Shears: Manual cutting tool for trimming branches and vines' },
      { entity_type: 'part', entity_id: '2', description: 'Organic Neem Oil: Natural pesticide derived from neem tree seeds' },
      { entity_type: 'action', entity_id: '3', description: 'Compost Application: Spreading decomposed organic matter on garden beds' },
    ];
    const result = buildAssetContextBlock(assets);

    expect(result).toContain('RELATED ASSETS (use for compare/contrast or scenario-based questions):');
    expect(result).toContain('  1. [tool] Pruning Shears: Manual cutting tool for trimming branches and vines');
    expect(result).toContain('  2. [part] Organic Neem Oil: Natural pesticide derived from neem tree seeds');
    expect(result).toContain('  3. [action] Compost Application: Spreading decomposed organic matter on garden beds');
  });

  it('includes every asset description in the output', () => {
    const assets = [
      { entity_type: 'tool', entity_id: '1', description: 'Unique tool description' },
      { entity_type: 'policy', entity_id: '2', description: 'Unique policy description' },
    ];
    const result = buildAssetContextBlock(assets);

    expect(result).toContain('Unique tool description');
    expect(result).toContain('Unique policy description');
  });

  it('numbers assets sequentially starting from 1', () => {
    const assets = [
      { entity_type: 'tool', entity_id: '1', description: 'Tool A' },
      { entity_type: 'part', entity_id: '2', description: 'Part B' },
    ];
    const result = buildAssetContextBlock(assets);

    expect(result).toContain('  1. [tool] Tool A');
    expect(result).toContain('  2. [part] Part B');
  });

  it('works with a single asset', () => {
    const assets = [
      { entity_type: 'policy', entity_id: '1', description: 'Safety policy for equipment use' },
    ];
    const result = buildAssetContextBlock(assets);

    expect(result).toContain('RELATED ASSETS');
    expect(result).toContain('  1. [policy] Safety policy for equipment use');
  });

  it('includes entity_type in brackets for each asset', () => {
    const assets = [
      { entity_type: 'action', entity_id: '1', description: 'Some action' },
      { entity_type: 'tool', entity_id: '2', description: 'Some tool' },
      { entity_type: 'part', entity_id: '3', description: 'Some part' },
      { entity_type: 'policy', entity_id: '4', description: 'Some policy' },
    ];
    const result = buildAssetContextBlock(assets);

    expect(result).toContain('[action]');
    expect(result).toContain('[tool]');
    expect(result).toContain('[part]');
    expect(result).toContain('[policy]');
  });
});
