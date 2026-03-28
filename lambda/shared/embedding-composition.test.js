/**
 * Tests for embedding source composition functions
 * Run with: node --test embedding-composition.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  composePartEmbeddingSource,
  composeToolEmbeddingSource,
  composeActionEmbeddingSource,
  composeIssueEmbeddingSource,
  composePolicyEmbeddingSource,
  composeStateEmbeddingSource
} = require('./embedding-composition');

describe('composePartEmbeddingSource', () => {
  test('should compose with all fields populated', () => {
    const part = {
      name: 'Banana Wine',
      description: 'Fermented banana beverage',
      policy: 'Rich in potassium and B vitamins. May support heart health.'
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(
      result,
      'Banana Wine. Fermented banana beverage. Rich in potassium and B vitamins. May support heart health.'
    );
  });

  test('should handle missing optional fields', () => {
    const part = {
      name: 'Banana Wine',
      description: 'Fermented banana beverage'
      // policy is missing
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(result, 'Banana Wine. Fermented banana beverage');
  });

  test('should handle only name field', () => {
    const part = {
      name: 'Banana Wine'
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(result, 'Banana Wine');
  });

  test('should filter out null and undefined values', () => {
    const part = {
      name: 'Banana Wine',
      description: null,
      policy: undefined
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(result, 'Banana Wine');
  });

  test('should filter out empty strings', () => {
    const part = {
      name: 'Banana Wine',
      description: '',
      policy: 'Rich in potassium'
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(result, 'Banana Wine. Rich in potassium');
  });
});

describe('composeToolEmbeddingSource', () => {
  test('should compose with all fields populated', () => {
    const tool = {
      name: 'Hand Drill',
      description: 'Manual drilling tool with adjustable chuck'
    };

    const result = composeToolEmbeddingSource(tool);

    assert.strictEqual(result, 'Hand Drill. Manual drilling tool with adjustable chuck');
  });

  test('should handle missing description', () => {
    const tool = {
      name: 'Hand Drill'
    };

    const result = composeToolEmbeddingSource(tool);

    assert.strictEqual(result, 'Hand Drill');
  });

  test('should filter out null values', () => {
    const tool = {
      name: 'Hand Drill',
      description: null
    };

    const result = composeToolEmbeddingSource(tool);

    assert.strictEqual(result, 'Hand Drill');
  });
});

describe('composeActionEmbeddingSource', () => {
  test('should compose with all fields populated', () => {
    const action = {
      description: 'Applied compost to banana plants',
      state_text: 'Completed',
      summary_policy_text: 'Organic matter improves soil structure',
      observations: 'Plants showed improved vigor after 2 weeks'
    };

    const result = composeActionEmbeddingSource(action);

    assert.strictEqual(
      result,
      'Applied compost to banana plants. Completed. Organic matter improves soil structure. Plants showed improved vigor after 2 weeks'
    );
  });

  test('should handle missing optional fields', () => {
    const action = {
      description: 'Applied compost to banana plants',
      state_text: 'Completed'
      // summary_policy_text and observations are missing
    };

    const result = composeActionEmbeddingSource(action);

    assert.strictEqual(result, 'Applied compost to banana plants. Completed');
  });

  test('should handle only description', () => {
    const action = {
      description: 'Applied compost to banana plants'
    };

    const result = composeActionEmbeddingSource(action);

    assert.strictEqual(result, 'Applied compost to banana plants');
  });

  test('should filter out null and undefined values', () => {
    const action = {
      description: 'Applied compost',
      state_text: null,
      summary_policy_text: undefined,
      observations: 'Good results'
    };

    const result = composeActionEmbeddingSource(action);

    assert.strictEqual(result, 'Applied compost. Good results');
  });
});

describe('composeIssueEmbeddingSource', () => {
  test('should compose with all fields populated', () => {
    const issue = {
      title: 'Banana wine fermentation stopped',
      description: 'Fermentation ceased after 3 days',
      resolution_notes: 'Added more yeast and increased temperature'
    };

    const result = composeIssueEmbeddingSource(issue);

    assert.strictEqual(
      result,
      'Banana wine fermentation stopped. Fermentation ceased after 3 days. Added more yeast and increased temperature'
    );
  });

  test('should handle missing optional fields', () => {
    const issue = {
      title: 'Banana wine fermentation stopped',
      description: 'Fermentation ceased after 3 days'
      // resolution_notes is missing
    };

    const result = composeIssueEmbeddingSource(issue);

    assert.strictEqual(result, 'Banana wine fermentation stopped. Fermentation ceased after 3 days');
  });

  test('should handle only title', () => {
    const issue = {
      title: 'Banana wine fermentation stopped'
    };

    const result = composeIssueEmbeddingSource(issue);

    assert.strictEqual(result, 'Banana wine fermentation stopped');
  });

  test('should filter out null values', () => {
    const issue = {
      title: 'Issue title',
      description: null,
      resolution_notes: 'Fixed'
    };

    const result = composeIssueEmbeddingSource(issue);

    assert.strictEqual(result, 'Issue title. Fixed');
  });
});

describe('composePolicyEmbeddingSource', () => {
  test('should compose with all fields populated', () => {
    const policy = {
      title: 'Organic Pest Control',
      description_text: 'Use only natural pesticides like neem oil'
    };

    const result = composePolicyEmbeddingSource(policy);

    assert.strictEqual(result, 'Organic Pest Control. Use only natural pesticides like neem oil');
  });

  test('should handle missing description_text', () => {
    const policy = {
      title: 'Organic Pest Control'
    };

    const result = composePolicyEmbeddingSource(policy);

    assert.strictEqual(result, 'Organic Pest Control');
  });

  test('should filter out null values', () => {
    const policy = {
      title: 'Organic Pest Control',
      description_text: null
    };

    const result = composePolicyEmbeddingSource(policy);

    assert.strictEqual(result, 'Organic Pest Control');
  });

  test('should filter out empty strings', () => {
    const policy = {
      title: 'Organic Pest Control',
      description_text: ''
    };

    const result = composePolicyEmbeddingSource(policy);

    assert.strictEqual(result, 'Organic Pest Control');
  });
});

describe('composeStateEmbeddingSource', () => {
  test('should compose with all fields populated', () => {
    const state = {
      entity_names: ['Banana Plant', 'Pruning Shears'],
      state_text: 'Leaves yellowing at tips, possible nutrient deficiency',
      photo_descriptions: ['Close-up of leaf damage', 'Wide shot of plant'],
      metrics: [
        { display_name: 'Girth', value: 45, unit: 'cm' },
        { display_name: 'Height', value: 2.1, unit: 'm' }
      ]
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(
      result,
      'Banana Plant. Pruning Shears. Leaves yellowing at tips, possible nutrient deficiency. Close-up of leaf damage. Wide shot of plant. Girth: 45 cm. Height: 2.1 m'
    );
  });

  test('should compose with only state_text', () => {
    const state = {
      entity_names: [],
      state_text: 'General field observation about soil conditions',
      photo_descriptions: [],
      metrics: []
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(result, 'General field observation about soil conditions');
  });

  test('should return empty string when all fields are empty or null', () => {
    const state = {
      entity_names: [],
      state_text: null,
      photo_descriptions: [],
      metrics: []
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(result, '');
  });

  test('should return empty string for empty object', () => {
    const result = composeStateEmbeddingSource({});

    assert.strictEqual(result, '');
  });

  test('should return empty string when fields are undefined', () => {
    const state = {
      entity_names: undefined,
      state_text: undefined,
      photo_descriptions: undefined,
      metrics: undefined
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(result, '');
  });

  test('should not include photo URLs in output', () => {
    const state = {
      entity_names: ['Banana Plant'],
      state_text: 'Observation text',
      photo_descriptions: ['Close-up of leaf damage'],
      metrics: []
    };
    // photo URLs are not part of the input shape — only descriptions are passed
    const result = composeStateEmbeddingSource(state);

    assert.ok(!result.includes('https://'));
    assert.ok(!result.includes('.jpg'));
    assert.ok(!result.includes('s3.amazonaws.com'));
    assert.strictEqual(
      result,
      'Banana Plant. Observation text. Close-up of leaf damage'
    );
  });

  test('should not include entity type prefixes', () => {
    const state = {
      entity_names: ['Banana Plant', 'Hand Drill', 'Applied compost'],
      state_text: 'Observation text',
      photo_descriptions: [],
      metrics: []
    };

    const result = composeStateEmbeddingSource(state);

    // Entity names appear directly without "part:", "tool:", "action:" prefixes
    assert.ok(!result.includes('part:'));
    assert.ok(!result.includes('tool:'));
    assert.ok(!result.includes('action:'));
    assert.strictEqual(
      result,
      'Banana Plant. Hand Drill. Applied compost. Observation text'
    );
  });

  test('should format metric with unit', () => {
    const state = {
      entity_names: [],
      state_text: null,
      photo_descriptions: [],
      metrics: [{ display_name: 'Girth', value: 45, unit: 'cm' }]
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(result, 'Girth: 45 cm');
  });

  test('should format metric without unit', () => {
    const state = {
      entity_names: [],
      state_text: null,
      photo_descriptions: [],
      metrics: [{ display_name: 'Count', value: 12 }]
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(result, 'Count: 12');
  });

  test('should handle multiple entity names from different entity types', () => {
    const state = {
      entity_names: ['Banana Plant', 'Hand Drill', 'Applied compost to banana plants'],
      state_text: null,
      photo_descriptions: [],
      metrics: []
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(
      result,
      'Banana Plant. Hand Drill. Applied compost to banana plants'
    );
  });

  test('should handle mixed metrics with and without units', () => {
    const state = {
      entity_names: [],
      state_text: 'Measurement session',
      photo_descriptions: [],
      metrics: [
        { display_name: 'Girth', value: 45, unit: 'cm' },
        { display_name: 'Leaf Count', value: 8 },
        { display_name: 'Weight', value: 3.5, unit: 'kg' }
      ]
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(
      result,
      'Measurement session. Girth: 45 cm. Leaf Count: 8. Weight: 3.5 kg'
    );
  });

  test('should handle single entity name with metrics only', () => {
    const state = {
      entity_names: ['Banana Plant'],
      state_text: null,
      photo_descriptions: [],
      metrics: [{ display_name: 'Height', value: 2.1, unit: 'm' }]
    };

    const result = composeStateEmbeddingSource(state);

    assert.strictEqual(result, 'Banana Plant. Height: 2.1 m');
  });
});

describe('Edge cases', () => {
  test('should handle objects with no valid fields', () => {
    const part = {
      name: null,
      description: undefined,
      policy: ''
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(result, '');
  });

  test('should handle empty objects', () => {
    const result = composePartEmbeddingSource({});

    assert.strictEqual(result, '');
  });

  test('should handle objects with extra fields', () => {
    const part = {
      id: 'part-123',
      name: 'Banana Wine',
      description: 'Fermented beverage',
      organization_id: 'org-1',
      created_at: '2024-01-01'
    };

    const result = composePartEmbeddingSource(part);

    assert.strictEqual(result, 'Banana Wine. Fermented beverage');
  });
});
