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
  composePolicyEmbeddingSource
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
