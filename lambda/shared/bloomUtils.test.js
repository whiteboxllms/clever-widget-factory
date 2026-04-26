/**
 * Tests for bloomUtils shared utility
 * Run with: node --test bloomUtils.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  scoreToBloomLevel,
  bloomLevelLabel,
  buildLearnMoreUrl,
} = require('./bloomUtils');

// ---------------------------------------------------------------------------
// scoreToBloomLevel
// ---------------------------------------------------------------------------

describe('scoreToBloomLevel', () => {
  test('should map 0.0–0.9 to level 1 (Remember)', () => {
    assert.strictEqual(scoreToBloomLevel(0.0), 1);
    assert.strictEqual(scoreToBloomLevel(0.5), 1);
    assert.strictEqual(scoreToBloomLevel(0.9), 1);
  });

  test('should map 1.0–1.9 to level 2 (Understand)', () => {
    assert.strictEqual(scoreToBloomLevel(1.0), 2);
    assert.strictEqual(scoreToBloomLevel(1.5), 2);
    assert.strictEqual(scoreToBloomLevel(1.9), 2);
  });

  test('should map 2.0–2.9 to level 3 (Apply)', () => {
    assert.strictEqual(scoreToBloomLevel(2.0), 3);
    assert.strictEqual(scoreToBloomLevel(2.5), 3);
    assert.strictEqual(scoreToBloomLevel(2.9), 3);
  });

  test('should map 3.0–3.9 to level 4 (Analyze)', () => {
    assert.strictEqual(scoreToBloomLevel(3.0), 4);
    assert.strictEqual(scoreToBloomLevel(3.5), 4);
    assert.strictEqual(scoreToBloomLevel(3.9), 4);
  });

  test('should map 4.0–5.0 to level 5 (Create)', () => {
    assert.strictEqual(scoreToBloomLevel(4.0), 5);
    assert.strictEqual(scoreToBloomLevel(4.5), 5);
    assert.strictEqual(scoreToBloomLevel(5.0), 5);
  });

  test('should handle exact boundary values', () => {
    assert.strictEqual(scoreToBloomLevel(0.0), 1);
    assert.strictEqual(scoreToBloomLevel(1.0), 2);
    assert.strictEqual(scoreToBloomLevel(2.0), 3);
    assert.strictEqual(scoreToBloomLevel(3.0), 4);
    assert.strictEqual(scoreToBloomLevel(4.0), 5);
  });
});

// ---------------------------------------------------------------------------
// bloomLevelLabel
// ---------------------------------------------------------------------------

describe('bloomLevelLabel', () => {
  test('should return correct labels for levels 1–5', () => {
    assert.strictEqual(bloomLevelLabel(1), 'Remember');
    assert.strictEqual(bloomLevelLabel(2), 'Understand');
    assert.strictEqual(bloomLevelLabel(3), 'Apply');
    assert.strictEqual(bloomLevelLabel(4), 'Analyze');
    assert.strictEqual(bloomLevelLabel(5), 'Create');
  });

  test('should return Unknown for out-of-range levels', () => {
    assert.strictEqual(bloomLevelLabel(0), 'Unknown');
    assert.strictEqual(bloomLevelLabel(6), 'Unknown');
    assert.strictEqual(bloomLevelLabel(-1), 'Unknown');
  });
});

// ---------------------------------------------------------------------------
// buildLearnMoreUrl
// ---------------------------------------------------------------------------

describe('buildLearnMoreUrl', () => {
  test('should build URL with concept name only', () => {
    const url = buildLearnMoreUrl('Trust Equation', null);
    assert.strictEqual(url, 'https://www.google.com/search?q=Trust%20Equation');
  });

  test('should build URL with concept name and author', () => {
    const url = buildLearnMoreUrl('Trust Equation', 'Maister');
    assert.strictEqual(url, 'https://www.google.com/search?q=Trust%20Equation%20Maister');
  });

  test('should encode special characters in concept name', () => {
    const url = buildLearnMoreUrl('Kübler-Ross Model', null);
    assert.ok(url.startsWith('https://www.google.com/search?q='));
    assert.ok(!url.includes(' '));
    assert.ok(url.includes(encodeURIComponent('Kübler-Ross Model')));
  });

  test('should handle empty author as name-only', () => {
    const url = buildLearnMoreUrl('Active Listening', '');
    assert.strictEqual(url, 'https://www.google.com/search?q=Active%20Listening');
  });

  test('should handle undefined author as name-only', () => {
    const url = buildLearnMoreUrl('Active Listening', undefined);
    assert.strictEqual(url, 'https://www.google.com/search?q=Active%20Listening');
  });
});
