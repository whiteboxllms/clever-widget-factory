/**
 * Tests for aiConfigDefaults shared utility
 * Run with: node --test aiConfigDefaults.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  AI_CONFIG_DEFAULTS,
  resolveAiConfig,
  isValidInt,
  isValidFloat,
  fetchAiConfig,
} = require('./aiConfigDefaults');

describe('AI_CONFIG_DEFAULTS', () => {
  test('should have correct default values', () => {
    assert.deepStrictEqual(AI_CONFIG_DEFAULTS, {
      max_axes: 3,
      min_axes: 2,
      evidence_limit: 3,
      quiz_temperature: 0.7,
    });
  });
});

describe('isValidInt', () => {
  test('should accept integers within range', () => {
    assert.strictEqual(isValidInt(1, 1, 6), true);
    assert.strictEqual(isValidInt(3, 1, 6), true);
    assert.strictEqual(isValidInt(6, 1, 6), true);
  });

  test('should reject integers outside range', () => {
    assert.strictEqual(isValidInt(0, 1, 6), false);
    assert.strictEqual(isValidInt(7, 1, 6), false);
  });

  test('should reject non-integer numbers', () => {
    assert.strictEqual(isValidInt(3.5, 1, 6), false);
    assert.strictEqual(isValidInt(1.1, 1, 6), false);
  });

  test('should reject non-number types', () => {
    assert.strictEqual(isValidInt('3', 1, 6), false);
    assert.strictEqual(isValidInt(null, 1, 6), false);
    assert.strictEqual(isValidInt(undefined, 1, 6), false);
    assert.strictEqual(isValidInt(NaN, 1, 6), false);
  });
});

describe('isValidFloat', () => {
  test('should accept numbers within range', () => {
    assert.strictEqual(isValidFloat(0.0, 0.0, 1.0), true);
    assert.strictEqual(isValidFloat(0.5, 0.0, 1.0), true);
    assert.strictEqual(isValidFloat(1.0, 0.0, 1.0), true);
  });

  test('should reject numbers outside range', () => {
    assert.strictEqual(isValidFloat(-0.1, 0.0, 1.0), false);
    assert.strictEqual(isValidFloat(1.1, 0.0, 1.0), false);
  });

  test('should reject NaN and non-number types', () => {
    assert.strictEqual(isValidFloat(NaN, 0.0, 1.0), false);
    assert.strictEqual(isValidFloat('0.5', 0.0, 1.0), false);
    assert.strictEqual(isValidFloat(null, 0.0, 1.0), false);
    assert.strictEqual(isValidFloat(undefined, 0.0, 1.0), false);
  });
});

describe('resolveAiConfig', () => {
  test('should return defaults for null input', () => {
    assert.deepStrictEqual(resolveAiConfig(null), AI_CONFIG_DEFAULTS);
  });

  test('should return defaults for undefined input', () => {
    assert.deepStrictEqual(resolveAiConfig(undefined), AI_CONFIG_DEFAULTS);
  });

  test('should return defaults for non-object input', () => {
    assert.deepStrictEqual(resolveAiConfig('string'), AI_CONFIG_DEFAULTS);
    assert.deepStrictEqual(resolveAiConfig(42), AI_CONFIG_DEFAULTS);
  });

  test('should return defaults for empty object', () => {
    assert.deepStrictEqual(resolveAiConfig({}), AI_CONFIG_DEFAULTS);
  });

  test('should merge partial config with defaults', () => {
    const result = resolveAiConfig({ max_axes: 5 });
    assert.strictEqual(result.max_axes, 5);
    assert.strictEqual(result.min_axes, AI_CONFIG_DEFAULTS.min_axes);
    assert.strictEqual(result.evidence_limit, AI_CONFIG_DEFAULTS.evidence_limit);
    assert.strictEqual(result.quiz_temperature, AI_CONFIG_DEFAULTS.quiz_temperature);
  });

  test('should accept fully valid config', () => {
    const config = { max_axes: 4, min_axes: 3, evidence_limit: 7, quiz_temperature: 0.5 };
    assert.deepStrictEqual(resolveAiConfig(config), config);
  });

  test('should replace out-of-range values with defaults', () => {
    const result = resolveAiConfig({
      max_axes: 99,
      min_axes: -1,
      evidence_limit: 0,
      quiz_temperature: 2.0,
    });
    assert.deepStrictEqual(result, AI_CONFIG_DEFAULTS);
  });

  test('should replace non-integer axis values with defaults', () => {
    const result = resolveAiConfig({ max_axes: 3.5, min_axes: 2.5 });
    assert.strictEqual(result.max_axes, AI_CONFIG_DEFAULTS.max_axes);
    assert.strictEqual(result.min_axes, AI_CONFIG_DEFAULTS.min_axes);
  });
});

describe('fetchAiConfig', () => {
  test('should return resolved config from DB result', async () => {
    const mockDb = {
      query: async (sql, params) => {
        assert.strictEqual(params[0], 'org-123');
        return { rows: [{ ai_config: { max_axes: 5, min_axes: 3, evidence_limit: 8, quiz_temperature: 0.4 } }] };
      },
    };
    const result = await fetchAiConfig(mockDb, 'org-123');
    assert.deepStrictEqual(result, { max_axes: 5, min_axes: 3, evidence_limit: 8, quiz_temperature: 0.4 });
  });

  test('should return defaults when ai_config is null in DB', async () => {
    const mockDb = {
      query: async () => ({ rows: [{ ai_config: null }] }),
    };
    const result = await fetchAiConfig(mockDb, 'org-1');
    assert.deepStrictEqual(result, AI_CONFIG_DEFAULTS);
  });

  test('should return defaults when no rows returned', async () => {
    const mockDb = {
      query: async () => ({ rows: [] }),
    };
    const result = await fetchAiConfig(mockDb, 'org-1');
    assert.deepStrictEqual(result, AI_CONFIG_DEFAULTS);
  });

  test('should return defaults and log warning on DB error', async () => {
    const mockDb = {
      query: async () => { throw new Error('connection failed'); },
    };
    const result = await fetchAiConfig(mockDb, 'org-1');
    assert.deepStrictEqual(result, AI_CONFIG_DEFAULTS);
  });

  test('should use parameterized query with organization ID', async () => {
    let capturedSql, capturedParams;
    const mockDb = {
      query: async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      },
    };
    await fetchAiConfig(mockDb, 'org-abc');
    assert.ok(capturedSql.includes('SELECT ai_config FROM organizations WHERE id = $1'));
    assert.deepStrictEqual(capturedParams, ['org-abc']);
  });
});
