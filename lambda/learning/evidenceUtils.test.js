/**
 * Unit tests for learning Lambda evidence utility functions.
 * Tests filterCompletedKnowledgeStates, extractBestMatch, and extractTopKMatches.
 *
 * These pure functions are extracted to evidenceUtils.js for testability
 * (no Lambda layer dependencies).
 */

const {
  filterCompletedKnowledgeStates,
  extractBestMatch,
  extractTopKMatches
} = require('./evidenceUtils');

describe('filterCompletedKnowledgeStates', () => {
  it('returns only states captured by the target user with correct answer', () => {
    const states = [
      { captured_by: 'user-1', state_text: 'Answered "B" which was the correct answer for objective X' },
      { captured_by: 'user-2', state_text: 'Answered "A" which was the correct answer for objective Y' },
      { captured_by: 'user-1', state_text: 'Answered "C" which was incorrect' }
    ];
    const result = filterCompletedKnowledgeStates(states, 'user-1');
    expect(result).toHaveLength(1);
    expect(result[0].captured_by).toBe('user-1');
    expect(result[0].state_text).toContain('which was the correct answer');
  });

  it('returns empty array when no states match', () => {
    const states = [
      { captured_by: 'user-2', state_text: 'Answered "B" which was the correct answer' },
      { captured_by: 'user-1', state_text: 'Answered "C" which was incorrect' }
    ];
    const result = filterCompletedKnowledgeStates(states, 'user-1');
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(filterCompletedKnowledgeStates([], 'user-1')).toEqual([]);
  });

  it('is case-insensitive for correct answer matching', () => {
    const states = [
      { captured_by: 'user-1', state_text: 'Answered "B" Which Was The Correct Answer for objective X' }
    ];
    const result = filterCompletedKnowledgeStates(states, 'user-1');
    expect(result).toHaveLength(1);
  });

  it('handles null or missing state_text gracefully', () => {
    const states = [
      { captured_by: 'user-1', state_text: null },
      { captured_by: 'user-1', state_text: undefined },
      { captured_by: 'user-1', state_text: 'Answered "A" which was the correct answer' }
    ];
    const result = filterCompletedKnowledgeStates(states, 'user-1');
    expect(result).toHaveLength(1);
  });

  it('returns multiple matching states for the same user', () => {
    const states = [
      { captured_by: 'user-1', state_text: 'Answered "A" which was the correct answer for obj 1' },
      { captured_by: 'user-1', state_text: 'Answered "B" which was the correct answer for obj 2' },
      { captured_by: 'user-1', state_text: 'Answered "C" which was the correct answer for obj 3' }
    ];
    const result = filterCompletedKnowledgeStates(states, 'user-1');
    expect(result).toHaveLength(3);
  });
});

describe('extractBestMatch', () => {
  it('returns the highest similarity result', () => {
    const results = [
      { similarity: 0.72, embedding_source: 'Water chemistry ratios' },
      { similarity: 0.87, embedding_source: 'Water-cement ratio testing' },
      { similarity: 0.65, embedding_source: 'Hydration and cement curing' }
    ];
    const best = extractBestMatch(results);
    expect(best.similarityScore).toBe(0.87);
    expect(best.matchedObjectiveText).toBe('Water-cement ratio testing');
  });

  it('returns zero score and null text for empty array', () => {
    const best = extractBestMatch([]);
    expect(best.similarityScore).toBe(0.0);
    expect(best.matchedObjectiveText).toBeNull();
  });

  it('returns zero score and null text for null/undefined input', () => {
    expect(extractBestMatch(null)).toEqual({ similarityScore: 0.0, matchedObjectiveText: null });
    expect(extractBestMatch(undefined)).toEqual({ similarityScore: 0.0, matchedObjectiveText: null });
  });

  it('handles single result', () => {
    const results = [{ similarity: 0.55, embedding_source: 'Single match' }];
    const best = extractBestMatch(results);
    expect(best.similarityScore).toBe(0.55);
    expect(best.matchedObjectiveText).toBe('Single match');
  });

  it('handles tied similarity scores (returns first encountered)', () => {
    const results = [
      { similarity: 0.80, embedding_source: 'First match' },
      { similarity: 0.80, embedding_source: 'Second match' }
    ];
    const best = extractBestMatch(results);
    expect(best.similarityScore).toBe(0.80);
    // First encountered with max similarity
    expect(best.matchedObjectiveText).toBe('First match');
  });
});

describe('extractTopKMatches', () => {
  it('returns top 5 results ordered by similarity descending', () => {
    const results = [
      { similarity: 0.50, embedding_source: 'Match 5' },
      { similarity: 0.87, embedding_source: 'Match 1' },
      { similarity: 0.72, embedding_source: 'Match 3' },
      { similarity: 0.65, embedding_source: 'Match 4' },
      { similarity: 0.80, embedding_source: 'Match 2' },
      { similarity: 0.40, embedding_source: 'Match 6 (excluded)' }
    ];
    const topK = extractTopKMatches(results, 5);
    expect(topK).toHaveLength(5);
    expect(topK[0]).toEqual({ similarityScore: 0.87, sourceText: 'Match 1' });
    expect(topK[1]).toEqual({ similarityScore: 0.80, sourceText: 'Match 2' });
    expect(topK[2]).toEqual({ similarityScore: 0.72, sourceText: 'Match 3' });
    expect(topK[3]).toEqual({ similarityScore: 0.65, sourceText: 'Match 4' });
    expect(topK[4]).toEqual({ similarityScore: 0.50, sourceText: 'Match 5' });
  });

  it('returns all results when fewer than K', () => {
    const results = [
      { similarity: 0.87, embedding_source: 'Match 1' },
      { similarity: 0.72, embedding_source: 'Match 2' }
    ];
    const topK = extractTopKMatches(results, 5);
    expect(topK).toHaveLength(2);
    expect(topK[0].similarityScore).toBe(0.87);
    expect(topK[1].similarityScore).toBe(0.72);
  });

  it('returns empty array for empty input', () => {
    expect(extractTopKMatches([], 5)).toEqual([]);
  });

  it('returns empty array for null/undefined input', () => {
    expect(extractTopKMatches(null, 5)).toEqual([]);
    expect(extractTopKMatches(undefined, 5)).toEqual([]);
  });

  it('defaults to k=5', () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      similarity: (10 - i) / 10,
      embedding_source: `Match ${i + 1}`
    }));
    const topK = extractTopKMatches(results);
    expect(topK).toHaveLength(5);
    expect(topK[0].similarityScore).toBe(1.0);
    expect(topK[4].similarityScore).toBe(0.6);
  });

  it('does not mutate the input array', () => {
    const results = [
      { similarity: 0.50, embedding_source: 'B' },
      { similarity: 0.87, embedding_source: 'A' }
    ];
    const originalOrder = [...results];
    extractTopKMatches(results, 5);
    expect(results[0].similarity).toBe(originalOrder[0].similarity);
    expect(results[1].similarity).toBe(originalOrder[1].similarity);
  });

  it('handles custom k value', () => {
    const results = [
      { similarity: 0.90, embedding_source: 'A' },
      { similarity: 0.80, embedding_source: 'B' },
      { similarity: 0.70, embedding_source: 'C' }
    ];
    const topK = extractTopKMatches(results, 2);
    expect(topK).toHaveLength(2);
    expect(topK[0].similarityScore).toBe(0.90);
    expect(topK[1].similarityScore).toBe(0.80);
  });
});
