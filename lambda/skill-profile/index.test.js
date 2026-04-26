/**
 * Unit tests for skill-profile Lambda utility functions
 * Tests composeAxisEmbeddingSource, composeAxisEntityId, and parseAxisEntityId
 * 
 * These pure functions are extracted to axisUtils.js for testability
 * (no Lambda layer dependencies).
 */

const {
  composeAxisEmbeddingSource,
  composeAxisEntityId,
  parseAxisEntityId
} = require('./axisUtils');

describe('composeAxisEmbeddingSource', () => {
  it('returns label only when no description or narrative', () => {
    const axis = { label: 'Water Chemistry Testing' };
    expect(composeAxisEmbeddingSource(axis)).toBe('Water Chemistry Testing');
  });

  it('returns label + description when description is provided', () => {
    const axis = { label: 'Water Chemistry Testing', description: 'Testing water quality parameters' };
    expect(composeAxisEmbeddingSource(axis)).toBe('Water Chemistry Testing. Testing water quality parameters');
  });

  it('returns label + narrative when narrative is provided but no description', () => {
    const axis = { label: 'Water Chemistry Testing' };
    const narrative = 'This action requires understanding of water chemistry.';
    expect(composeAxisEmbeddingSource(axis, narrative)).toBe(
      'Water Chemistry Testing. This action requires understanding of water chemistry.'
    );
  });

  it('returns label + description + narrative when all are provided', () => {
    const axis = { label: 'Water Chemistry Testing', description: 'Testing water quality parameters' };
    const narrative = 'This action requires understanding of water chemistry.';
    expect(composeAxisEmbeddingSource(axis, narrative)).toBe(
      'Water Chemistry Testing. Testing water quality parameters. This action requires understanding of water chemistry.'
    );
  });

  it('skips empty description', () => {
    const axis = { label: 'Safety Protocols', description: '' };
    const narrative = 'Safety is critical.';
    expect(composeAxisEmbeddingSource(axis, narrative)).toBe('Safety Protocols. Safety is critical.');
  });

  it('skips empty narrative', () => {
    const axis = { label: 'Safety Protocols', description: 'Following safety rules' };
    expect(composeAxisEmbeddingSource(axis, '')).toBe('Safety Protocols. Following safety rules');
  });

  it('skips null/undefined description and narrative', () => {
    const axis = { label: 'Regulatory Navigation', description: null };
    expect(composeAxisEmbeddingSource(axis, undefined)).toBe('Regulatory Navigation');
  });
});

describe('composeAxisEntityId', () => {
  it('composes entity ID from action ID and axis key', () => {
    expect(composeAxisEntityId('a1b2c3d4', 'water_chemistry')).toBe('a1b2c3d4:water_chemistry');
  });

  it('handles UUID-format action IDs', () => {
    const actionId = '550e8400-e29b-41d4-a716-446655440000';
    expect(composeAxisEntityId(actionId, 'safety_protocols')).toBe(
      '550e8400-e29b-41d4-a716-446655440000:safety_protocols'
    );
  });

  it('handles axis keys with underscores', () => {
    expect(composeAxisEntityId('abc123', 'water_quality_testing_methodology')).toBe(
      'abc123:water_quality_testing_methodology'
    );
  });
});

describe('parseAxisEntityId', () => {
  it('parses entity ID back into action ID and axis key', () => {
    const result = parseAxisEntityId('a1b2c3d4:water_chemistry');
    expect(result).toEqual({ actionId: 'a1b2c3d4', axisKey: 'water_chemistry' });
  });

  it('handles UUID-format action IDs', () => {
    const result = parseAxisEntityId('550e8400-e29b-41d4-a716-446655440000:safety_protocols');
    expect(result).toEqual({
      actionId: '550e8400-e29b-41d4-a716-446655440000',
      axisKey: 'safety_protocols'
    });
  });

  it('handles axis keys with underscores', () => {
    const result = parseAxisEntityId('abc123:water_quality_testing_methodology');
    expect(result).toEqual({
      actionId: 'abc123',
      axisKey: 'water_quality_testing_methodology'
    });
  });

  it('round-trips with composeAxisEntityId', () => {
    const actionId = '550e8400-e29b-41d4-a716-446655440000';
    const axisKey = 'regulatory_navigation';
    const entityId = composeAxisEntityId(actionId, axisKey);
    const parsed = parseAxisEntityId(entityId);
    expect(parsed.actionId).toBe(actionId);
    expect(parsed.axisKey).toBe(axisKey);
  });
});
