/**
 * Tests for lensDefaults shared utility
 * Run with: node --test lensDefaults.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  SYSTEM_LENSES,
  LENS_CONFIG_DEFAULTS,
  VALUES_LENS_DEFAULT_WEIGHT,
  MAX_CUSTOM_LENSES,
  MAX_GAP_BOOST_RULES,
  resolveLensConfig,
  buildLensPool,
} = require('./lensDefaults');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('SYSTEM_LENSES', () => {
  test('should have exactly 6 lenses', () => {
    assert.strictEqual(SYSTEM_LENSES.length, 6);
  });

  test('should have the expected keys', () => {
    const keys = SYSTEM_LENSES.map((l) => l.key);
    assert.deepStrictEqual(keys, [
      'failure_analysis',
      'underlying_science',
      'cross_asset_comparison',
      'practical_tradeoffs',
      'root_cause_reasoning',
      'scenario_response',
    ]);
  });

  test('each lens should have key, label, description, and defaultWeight 0.5', () => {
    for (const lens of SYSTEM_LENSES) {
      assert.strictEqual(typeof lens.key, 'string');
      assert.ok(lens.key.length > 0);
      assert.strictEqual(typeof lens.label, 'string');
      assert.ok(lens.label.length > 0);
      assert.strictEqual(typeof lens.description, 'string');
      assert.ok(lens.description.length > 0);
      assert.strictEqual(lens.defaultWeight, 0.5);
    }
  });
});

describe('LENS_CONFIG_DEFAULTS', () => {
  test('should have correct default structure', () => {
    assert.deepStrictEqual(LENS_CONFIG_DEFAULTS, {
      system_lens_weights: {},
      custom_lenses: [],
      values_lens_weights: {},
      gap_boost_rules: [],
    });
  });
});

describe('Constants', () => {
  test('VALUES_LENS_DEFAULT_WEIGHT should be 0.3', () => {
    assert.strictEqual(VALUES_LENS_DEFAULT_WEIGHT, 0.3);
  });

  test('MAX_CUSTOM_LENSES should be 20', () => {
    assert.strictEqual(MAX_CUSTOM_LENSES, 20);
  });

  test('MAX_GAP_BOOST_RULES should be 10', () => {
    assert.strictEqual(MAX_GAP_BOOST_RULES, 10);
  });
});

// ---------------------------------------------------------------------------
// resolveLensConfig
// ---------------------------------------------------------------------------

describe('resolveLensConfig', () => {
  test('should return defaults for null input', () => {
    assert.deepStrictEqual(resolveLensConfig(null), LENS_CONFIG_DEFAULTS);
  });

  test('should return defaults for undefined input', () => {
    assert.deepStrictEqual(resolveLensConfig(undefined), LENS_CONFIG_DEFAULTS);
  });

  test('should return defaults for non-object input', () => {
    assert.deepStrictEqual(resolveLensConfig('string'), LENS_CONFIG_DEFAULTS);
    assert.deepStrictEqual(resolveLensConfig(42), LENS_CONFIG_DEFAULTS);
  });

  test('should return defaults for empty object', () => {
    assert.deepStrictEqual(resolveLensConfig({}), LENS_CONFIG_DEFAULTS);
  });

  test('should resolve valid system lens weight overrides', () => {
    const result = resolveLensConfig({
      system_lens_weights: {
        failure_analysis: { weight: 0.8, enabled: true },
        underlying_science: { weight: 0.0, enabled: false },
      },
    });
    assert.deepStrictEqual(result.system_lens_weights.failure_analysis, {
      weight: 0.8,
      enabled: true,
    });
    assert.deepStrictEqual(result.system_lens_weights.underlying_science, {
      weight: 0.0,
      enabled: false,
    });
  });

  test('should ignore unknown system lens keys', () => {
    const result = resolveLensConfig({
      system_lens_weights: {
        unknown_lens: { weight: 0.5, enabled: true },
      },
    });
    assert.strictEqual(result.system_lens_weights.unknown_lens, undefined);
  });

  test('should clamp out-of-range system lens weights to defaults', () => {
    const result = resolveLensConfig({
      system_lens_weights: {
        failure_analysis: { weight: 2.0, enabled: true },
      },
    });
    assert.strictEqual(result.system_lens_weights.failure_analysis.weight, 0.5);
  });

  test('should resolve valid custom lenses', () => {
    const result = resolveLensConfig({
      custom_lenses: [
        {
          key: 'custom_soil',
          label: 'Soil Health',
          description: 'How does this affect soil health?',
          weight: 0.6,
          enabled: true,
        },
      ],
    });
    assert.strictEqual(result.custom_lenses.length, 1);
    assert.strictEqual(result.custom_lenses[0].key, 'custom_soil');
    assert.strictEqual(result.custom_lenses[0].label, 'Soil Health');
    assert.strictEqual(result.custom_lenses[0].weight, 0.6);
  });

  test('should enforce max 20 custom lenses', () => {
    const lenses = Array.from({ length: 25 }, (_, i) => ({
      key: `custom_${i}`,
      label: `Lens ${i}`,
      description: `Description ${i}`,
      weight: 0.5,
      enabled: true,
    }));
    const result = resolveLensConfig({ custom_lenses: lenses });
    assert.strictEqual(result.custom_lenses.length, 20);
  });

  test('should skip custom lenses with duplicate labels (case-insensitive)', () => {
    const result = resolveLensConfig({
      custom_lenses: [
        { key: 'a', label: 'Soil Health', description: 'desc a', weight: 0.5, enabled: true },
        { key: 'b', label: 'soil health', description: 'desc b', weight: 0.6, enabled: true },
      ],
    });
    assert.strictEqual(result.custom_lenses.length, 1);
    assert.strictEqual(result.custom_lenses[0].key, 'a');
  });

  test('should skip custom lenses without a key', () => {
    const result = resolveLensConfig({
      custom_lenses: [
        { label: 'No Key', description: 'desc', weight: 0.5, enabled: true },
      ],
    });
    assert.strictEqual(result.custom_lenses.length, 0);
  });

  test('should truncate custom lens labels over 100 chars', () => {
    const result = resolveLensConfig({
      custom_lenses: [
        { key: 'long', label: 'A'.repeat(150), description: 'desc', weight: 0.5, enabled: true },
      ],
    });
    assert.strictEqual(result.custom_lenses[0].label.length, 100);
  });

  test('should truncate custom lens descriptions over 500 chars', () => {
    const result = resolveLensConfig({
      custom_lenses: [
        { key: 'long', label: 'Label', description: 'B'.repeat(600), weight: 0.5, enabled: true },
      ],
    });
    assert.strictEqual(result.custom_lenses[0].description.length, 500);
  });

  test('should clamp out-of-range custom lens weights', () => {
    const result = resolveLensConfig({
      custom_lenses: [
        { key: 'bad', label: 'Bad Weight', description: 'desc', weight: 5.0, enabled: true },
      ],
    });
    assert.strictEqual(result.custom_lenses[0].weight, 0.5);
  });

  test('should resolve valid values lens weight overrides', () => {
    const result = resolveLensConfig({
      values_lens_weights: {
        values_organic: { weight: 0.4, enabled: true },
      },
    });
    assert.deepStrictEqual(result.values_lens_weights.values_organic, {
      weight: 0.4,
      enabled: true,
    });
  });

  test('should resolve valid gap boost rules', () => {
    const result = resolveLensConfig({
      gap_boost_rules: [
        {
          id: 'rule-1',
          threshold: 1.5,
          lens_keys: ['failure_analysis'],
          multiplier: 2.0,
        },
      ],
    });
    assert.strictEqual(result.gap_boost_rules.length, 1);
    assert.strictEqual(result.gap_boost_rules[0].threshold, 1.5);
    assert.strictEqual(result.gap_boost_rules[0].multiplier, 2.0);
  });

  test('should enforce max 10 gap boost rules', () => {
    const rules = Array.from({ length: 15 }, (_, i) => ({
      id: `rule-${i}`,
      threshold: 0.5 + i * 0.1,
      lens_keys: ['failure_analysis'],
      multiplier: 1.5,
    }));
    const result = resolveLensConfig({ gap_boost_rules: rules });
    assert.strictEqual(result.gap_boost_rules.length, 10);
  });

  test('should skip gap boost rules with invalid threshold', () => {
    const result = resolveLensConfig({
      gap_boost_rules: [
        { id: 'bad', threshold: 0.1, lens_keys: ['failure_analysis'], multiplier: 2.0 },
      ],
    });
    assert.strictEqual(result.gap_boost_rules.length, 0);
  });

  test('should skip gap boost rules with invalid multiplier', () => {
    const result = resolveLensConfig({
      gap_boost_rules: [
        { id: 'bad', threshold: 1.0, lens_keys: ['failure_analysis'], multiplier: 0.5 },
      ],
    });
    assert.strictEqual(result.gap_boost_rules.length, 0);
  });

  test('should skip gap boost rules with empty lens_keys', () => {
    const result = resolveLensConfig({
      gap_boost_rules: [
        { id: 'bad', threshold: 1.0, lens_keys: [], multiplier: 2.0 },
      ],
    });
    assert.strictEqual(result.gap_boost_rules.length, 0);
  });
});

// ---------------------------------------------------------------------------
// buildLensPool
// ---------------------------------------------------------------------------

describe('buildLensPool', () => {
  test('should include all 6 system lenses with default config', () => {
    const config = resolveLensConfig(null);
    const pool = buildLensPool(config, []);
    const systemLenses = pool.filter((l) => l.source === 'system');
    assert.strictEqual(systemLenses.length, 6);
    for (const lens of systemLenses) {
      assert.strictEqual(lens.weight, 0.5);
      assert.strictEqual(lens.source, 'system');
    }
  });

  test('should exclude disabled system lenses', () => {
    const config = resolveLensConfig({
      system_lens_weights: {
        failure_analysis: { weight: 0.5, enabled: false },
      },
    });
    const pool = buildLensPool(config, []);
    const keys = pool.map((l) => l.key);
    assert.ok(!keys.includes('failure_analysis'));
    assert.strictEqual(pool.filter((l) => l.source === 'system').length, 5);
  });

  test('should exclude system lenses with weight 0', () => {
    const config = resolveLensConfig({
      system_lens_weights: {
        failure_analysis: { weight: 0.0, enabled: true },
      },
    });
    const pool = buildLensPool(config, []);
    const keys = pool.map((l) => l.key);
    assert.ok(!keys.includes('failure_analysis'));
  });

  test('should apply system lens weight overrides', () => {
    const config = resolveLensConfig({
      system_lens_weights: {
        failure_analysis: { weight: 0.9, enabled: true },
      },
    });
    const pool = buildLensPool(config, []);
    const fa = pool.find((l) => l.key === 'failure_analysis');
    assert.strictEqual(fa.weight, 0.9);
  });

  test('should create values lenses from strategic attributes', () => {
    const config = resolveLensConfig(null);
    const pool = buildLensPool(config, ['organic', 'quality']);
    const valuesLenses = pool.filter((l) => l.source === 'values');
    assert.strictEqual(valuesLenses.length, 2);
    assert.strictEqual(valuesLenses[0].key, 'values_organic');
    assert.strictEqual(valuesLenses[0].label, 'organic');
    assert.strictEqual(valuesLenses[0].weight, 0.3);
    assert.ok(valuesLenses[0].description.includes('organic'));
    assert.strictEqual(valuesLenses[1].key, 'values_quality');
  });

  test('should skip values lenses when strategicAttributes is null', () => {
    const config = resolveLensConfig(null);
    const pool = buildLensPool(config, null);
    const valuesLenses = pool.filter((l) => l.source === 'values');
    assert.strictEqual(valuesLenses.length, 0);
  });

  test('should skip values lenses when strategicAttributes is empty', () => {
    const config = resolveLensConfig(null);
    const pool = buildLensPool(config, []);
    const valuesLenses = pool.filter((l) => l.source === 'values');
    assert.strictEqual(valuesLenses.length, 0);
  });

  test('should apply values lens weight overrides', () => {
    const config = resolveLensConfig({
      values_lens_weights: {
        values_organic: { weight: 0.8, enabled: true },
      },
    });
    const pool = buildLensPool(config, ['organic']);
    const organic = pool.find((l) => l.key === 'values_organic');
    assert.strictEqual(organic.weight, 0.8);
  });

  test('should exclude disabled values lenses', () => {
    const config = resolveLensConfig({
      values_lens_weights: {
        values_organic: { weight: 0.3, enabled: false },
      },
    });
    const pool = buildLensPool(config, ['organic']);
    const keys = pool.map((l) => l.key);
    assert.ok(!keys.includes('values_organic'));
  });

  test('should include enabled custom lenses', () => {
    const config = resolveLensConfig({
      custom_lenses: [
        {
          key: 'custom_soil',
          label: 'Soil Health',
          description: 'How does this affect soil health?',
          weight: 0.6,
          enabled: true,
        },
      ],
    });
    const pool = buildLensPool(config, []);
    const custom = pool.filter((l) => l.source === 'custom');
    assert.strictEqual(custom.length, 1);
    assert.strictEqual(custom[0].key, 'custom_soil');
    assert.strictEqual(custom[0].weight, 0.6);
  });

  test('should exclude disabled custom lenses', () => {
    const config = resolveLensConfig({
      custom_lenses: [
        {
          key: 'custom_soil',
          label: 'Soil Health',
          description: 'desc',
          weight: 0.6,
          enabled: false,
        },
      ],
    });
    const pool = buildLensPool(config, []);
    const custom = pool.filter((l) => l.source === 'custom');
    assert.strictEqual(custom.length, 0);
  });

  test('should combine system, values, and custom lenses', () => {
    const config = resolveLensConfig({
      custom_lenses: [
        {
          key: 'custom_soil',
          label: 'Soil Health',
          description: 'desc',
          weight: 0.6,
          enabled: true,
        },
      ],
    });
    const pool = buildLensPool(config, ['organic']);
    const sources = new Set(pool.map((l) => l.source));
    assert.ok(sources.has('system'));
    assert.ok(sources.has('values'));
    assert.ok(sources.has('custom'));
  });

  test('each pool entry should have key, label, description, weight, source', () => {
    const config = resolveLensConfig(null);
    const pool = buildLensPool(config, ['organic']);
    for (const lens of pool) {
      assert.strictEqual(typeof lens.key, 'string');
      assert.strictEqual(typeof lens.label, 'string');
      assert.strictEqual(typeof lens.description, 'string');
      assert.strictEqual(typeof lens.weight, 'number');
      assert.ok(['system', 'values', 'custom'].includes(lens.source));
    }
  });
});
