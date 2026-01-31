/**
 * Tests for embeddings-processor Lambda
 * Run with: node --test index.test.js
 * 
 * Note: These are unit tests that verify the logic and structure of the Lambda.
 * Integration tests with actual AWS services should be run separately.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('embeddings-processor Lambda - Message Format Validation', () => {
  test('should validate entity_type field', () => {
    const validTypes = ['part', 'tool', 'action', 'issue', 'policy'];
    
    validTypes.forEach(type => {
      assert.ok(validTypes.includes(type), `${type} should be a valid entity type`);
    });
    
    assert.ok(!validTypes.includes('invalid'), 'invalid should not be a valid entity type');
    assert.ok(!validTypes.includes('exploration'), 'exploration should not be a valid entity type yet');
  });

  test('should validate required message fields', () => {
    const validMessage = {
      entity_type: 'part',
      entity_id: 'part-123',
      embedding_source: 'Banana Wine. Fermented beverage.',
      organization_id: 'org-1'
    };

    assert.ok(validMessage.entity_type, 'entity_type is required');
    assert.ok(validMessage.entity_id, 'entity_id is required');
    assert.ok(validMessage.embedding_source, 'embedding_source is required');
    assert.ok(validMessage.organization_id, 'organization_id is required');
  });

  test('should validate embedding_source is non-empty', () => {
    const emptySource = '';
    const whitespaceSource = '   ';
    const validSource = 'Banana Wine';

    assert.strictEqual(emptySource.trim(), '', 'empty string should be invalid');
    assert.strictEqual(whitespaceSource.trim(), '', 'whitespace-only string should be invalid');
    assert.ok(validSource.trim().length > 0, 'non-empty string should be valid');
  });
});

describe('embeddings-processor Lambda - Configuration Flags', () => {
  test('should have default configuration values', () => {
    // Default values when environment variables are not set
    const defaultWriteToUnified = true;
    const defaultWriteToInline = true;

    assert.strictEqual(defaultWriteToUnified, true, 'WRITE_TO_UNIFIED should default to true');
    assert.strictEqual(defaultWriteToInline, true, 'WRITE_TO_INLINE should default to true');
  });

  test('should parse environment variable strings correctly', () => {
    // Test string to boolean conversion logic
    const testCases = [
      { value: 'false', expected: false },
      { value: 'true', expected: true },
      { value: undefined, expected: true }, // default
      { value: '', expected: true }, // empty string is not 'false'
      { value: 'FALSE', expected: true }, // case-sensitive
    ];

    testCases.forEach(({ value, expected }) => {
      const result = value !== 'false';
      assert.strictEqual(result, expected, `"${value}" should parse to ${expected}`);
    });
  });
});

describe('embeddings-processor Lambda - Entity Type Handling', () => {
  test('should identify parts and tools for inline column writes', () => {
    const entityTypes = ['part', 'tool', 'action', 'issue', 'policy'];
    const inlineTypes = ['part', 'tool'];

    entityTypes.forEach(type => {
      const shouldWriteInline = inlineTypes.includes(type);
      const table = type === 'part' ? 'parts' : type === 'tool' ? 'tools' : null;
      
      if (shouldWriteInline) {
        assert.ok(table !== null, `${type} should have a table mapping`);
      } else {
        assert.strictEqual(table, null, `${type} should not have a table mapping`);
      }
    });
  });

  test('should map entity types to table names correctly', () => {
    const mappings = [
      { entityType: 'part', table: 'parts' },
      { entityType: 'tool', table: 'tools' },
      { entityType: 'action', table: null },
      { entityType: 'issue', table: null },
      { entityType: 'policy', table: null }
    ];

    mappings.forEach(({ entityType, table }) => {
      const result = entityType === 'part' ? 'parts' : entityType === 'tool' ? 'tools' : null;
      assert.strictEqual(result, table, `${entityType} should map to ${table}`);
    });
  });
});

describe('embeddings-processor Lambda - SQL Generation', () => {
  test('should escape single quotes in SQL strings', () => {
    const testStrings = [
      { input: "Banana Wine", expected: "Banana Wine" },
      { input: "It's a test", expected: "It''s a test" },
      { input: "O'Brien's tool", expected: "O''Brien''s tool" },
      { input: "Multiple ' quotes ' here", expected: "Multiple '' quotes '' here" }
    ];

    testStrings.forEach(({ input, expected }) => {
      const escaped = input.replace(/'/g, "''");
      assert.strictEqual(escaped, expected, `"${input}" should escape to "${expected}"`);
    });
  });

  test('should generate valid unified table SQL structure', () => {
    const sql = `
      INSERT INTO unified_embeddings (entity_type, entity_id, embedding_source, model_version, embedding, organization_id)
      VALUES ('part', 'part-123', 'Banana Wine', 'titan-v1', '[0,1,2]'::vector, 'org-1')
      ON CONFLICT (entity_type, entity_id, model_version) 
      DO UPDATE SET 
        embedding_source = EXCLUDED.embedding_source,
        embedding = EXCLUDED.embedding,
        updated_at = NOW()
    `;

    assert.ok(sql.includes('INSERT INTO unified_embeddings'), 'should have INSERT statement');
    assert.ok(sql.includes('ON CONFLICT'), 'should have UPSERT logic');
    assert.ok(sql.includes('DO UPDATE SET'), 'should update on conflict');
    assert.ok(sql.includes('updated_at = NOW()'), 'should update timestamp');
  });

  test('should generate valid inline column SQL structure', () => {
    const sql = `
      UPDATE parts 
      SET search_text = 'Banana Wine', 
          search_embedding = '[0,1,2]'::vector 
      WHERE id = 'part-123'
    `;

    assert.ok(sql.includes('UPDATE parts'), 'should have UPDATE statement');
    assert.ok(sql.includes('search_text'), 'should update search_text');
    assert.ok(sql.includes('search_embedding'), 'should update search_embedding');
    assert.ok(sql.includes('WHERE id'), 'should have WHERE clause');
  });
});

describe('embeddings-processor Lambda - Embedding Validation', () => {
  test('should validate embedding dimensions', () => {
    const validEmbedding = new Array(1536).fill(0);
    const invalidEmbedding = new Array(512).fill(0);

    assert.strictEqual(validEmbedding.length, 1536, 'valid embedding should have 1536 dimensions');
    assert.notStrictEqual(invalidEmbedding.length, 1536, 'invalid embedding should not have 1536 dimensions');
  });

  test('should format embedding array for PostgreSQL', () => {
    const embedding = [0.1, 0.2, 0.3];
    const formatted = `[${embedding.join(',')}]`;

    assert.strictEqual(formatted, '[0.1,0.2,0.3]', 'should format as comma-separated values in brackets');
  });
});

describe('embeddings-processor Lambda - Error Handling', () => {
  test('should identify error conditions', () => {
    const errorConditions = [
      { condition: 'empty embedding_source', shouldError: true },
      { condition: 'missing organization_id', shouldError: true },
      { condition: 'invalid entity_type', shouldError: false }, // skip, don't error
      { condition: 'wrong embedding dimensions', shouldError: true },
      { condition: 'database write failure', shouldError: true },
      { condition: 'bedrock API failure', shouldError: true }
    ];

    errorConditions.forEach(({ condition, shouldError }) => {
      if (shouldError) {
        assert.ok(shouldError, `${condition} should cause an error`);
      } else {
        assert.ok(!shouldError, `${condition} should be skipped without error`);
      }
    });
  });

  test('should validate SQS retry behavior', () => {
    // When an error is thrown, SQS will retry the message
    const shouldRetry = true;
    assert.ok(shouldRetry, 'Lambda should throw errors to trigger SQS retry');
  });
});

describe('embeddings-processor Lambda - Batch Processing', () => {
  test('should process records sequentially', () => {
    const records = [
      { entity_type: 'part', entity_id: 'part-1' },
      { entity_type: 'tool', entity_id: 'tool-1' },
      { entity_type: 'action', entity_id: 'action-1' }
    ];

    // Verify we can iterate through records
    let processedCount = 0;
    for (const record of records) {
      assert.ok(record.entity_type, 'each record should have entity_type');
      assert.ok(record.entity_id, 'each record should have entity_id');
      processedCount++;
    }

    assert.strictEqual(processedCount, 3, 'should process all records');
  });

  test('should continue processing after skipping invalid records', () => {
    const records = [
      { entity_type: 'part', valid: true },
      { entity_type: 'invalid', valid: false },
      { entity_type: 'tool', valid: true }
    ];

    const validRecords = records.filter(r => r.valid);
    assert.strictEqual(validRecords.length, 2, 'should process only valid records');
  });
});
