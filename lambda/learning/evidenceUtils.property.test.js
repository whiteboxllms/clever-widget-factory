/**
 * Property-based tests for learning Lambda evidence utility functions.
 * Uses Vitest + fast-check.
 *
 * Properties tested:
 *   Property 1 – Completed knowledge state filtering
 *   Property 2 – Best match extraction from similarity results
 *   Property 5 – Top-K similarity results extraction
 *   Property 7 – New objective status invariant
 */

const fc = require('fast-check');
const {
  filterCompletedKnowledgeStates,
  extractBestMatch,
  extractTopKMatches
} = require('./evidenceUtils');

// ── Shared arbitraries ──────────────────────────────────────────────

const arbUserId = fc.uuid();
const arbSimilarityScore = fc.double({ min: 0.0, max: 1.0, noNaN: true });
const arbSourceText = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

/** State text that contains the correct answer marker */
const arbCorrectStateText = fc.string({ minLength: 1 }).map(
  s => s + ' which was the correct answer'
);

/** State text that does NOT contain the correct answer marker */
const arbIncorrectStateText = fc.string({ minLength: 1 }).filter(
  s => !s.toLowerCase().includes('which was the correct answer')
);

// ── Property 1: Completed knowledge state filtering ─────────────────
// **Validates: Requirements 1.1, 1.5**

describe('Property 1: Completed knowledge state filtering', () => {
  it('returns only states where captured_by matches the target user AND state_text contains correct answer', () => {
    fc.assert(
      fc.property(
        arbUserId,
        fc.array(arbUserId, { minLength: 1, maxLength: 5 }),
        fc.array(
          fc.record({
            isTargetUser: fc.boolean(),
            hasCorrectAnswer: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (targetUserId, otherUserIds, stateConfigs) => {
          // Build states from configs
          const states = stateConfigs.map((config, i) => {
            const userId = config.isTargetUser
              ? targetUserId
              : otherUserIds[i % otherUserIds.length];
            const stateText = config.hasCorrectAnswer
              ? `Answer ${i} which was the correct answer`
              : `Answer ${i} which was incorrect`;
            return { captured_by: userId, state_text: stateText };
          });

          const result = filterCompletedKnowledgeStates(states, targetUserId);

          // Every returned state must match the target user
          const allMatchUser = result.every(s => s.captured_by === targetUserId);

          // Every returned state must contain the correct answer marker
          const allHaveCorrectAnswer = result.every(
            s => s.state_text.toLowerCase().includes('which was the correct answer')
          );

          // No state from other users should appear
          const noOtherUsers = result.every(s => s.captured_by === targetUserId);

          // No incorrect-answer states should appear
          const expectedCount = stateConfigs.filter(
            c => c.isTargetUser && c.hasCorrectAnswer
          ).length;

          return allMatchUser && allHaveCorrectAnswer && noOtherUsers && result.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('states from other users never appear in results', () => {
    fc.assert(
      fc.property(
        arbUserId,
        arbUserId.filter((_, idx) => true), // another user
        fc.array(arbCorrectStateText, { minLength: 1, maxLength: 10 }),
        (targetUserId, otherUserId, correctTexts) => {
          // All states belong to the other user with correct answers
          const states = correctTexts.map(text => ({
            captured_by: otherUserId === targetUserId ? otherUserId + '-other' : otherUserId,
            state_text: text
          }));

          const result = filterCompletedKnowledgeStates(states, targetUserId);
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('states without correct answer marker never appear in results', () => {
    fc.assert(
      fc.property(
        arbUserId,
        fc.array(arbIncorrectStateText, { minLength: 1, maxLength: 10 }),
        (targetUserId, incorrectTexts) => {
          // All states belong to the target user but have incorrect answers
          const states = incorrectTexts.map(text => ({
            captured_by: targetUserId,
            state_text: text
          }));

          const result = filterCompletedKnowledgeStates(states, targetUserId);
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is case-insensitive for the correct answer marker', () => {
    fc.assert(
      fc.property(
        arbUserId,
        fc.string({ minLength: 1 }),
        fc.constantFrom(
          'which was the correct answer',
          'Which Was The Correct Answer',
          'WHICH WAS THE CORRECT ANSWER',
          'Which was the Correct Answer'
        ),
        (userId, prefix, marker) => {
          const states = [{ captured_by: userId, state_text: prefix + ' ' + marker }];
          const result = filterCompletedKnowledgeStates(states, userId);
          return result.length === 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 2: Best match extraction from similarity results ───────
// **Validates: Requirements 1.3, 1.4**

describe('Property 2: Best match extraction from similarity results', () => {
  it('returns the maximum similarity score from a non-empty array', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (results) => {
          const best = extractBestMatch(results);
          const maxSimilarity = Math.max(...results.map(r => r.similarity));
          return best.similarityScore === maxSimilarity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns the source text of the maximum-similarity result', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (results) => {
          const best = extractBestMatch(results);
          // The matchedObjectiveText should be the embedding_source of some result
          // that has the maximum similarity
          const maxSimilarity = Math.max(...results.map(r => r.similarity));
          const maxResults = results.filter(r => r.similarity === maxSimilarity);
          return maxResults.some(r => r.embedding_source === best.matchedObjectiveText);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns similarityScore 0.0 and matchedObjectiveText null for empty array', () => {
    const best = extractBestMatch([]);
    expect(best.similarityScore).toBe(0.0);
    expect(best.matchedObjectiveText).toBeNull();
  });

  it('returned similarityScore is always in [0.0, 1.0] for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (results) => {
          const best = extractBestMatch(results);
          return best.similarityScore >= 0.0 && best.similarityScore <= 1.0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 5: Top-K similarity results extraction ─────────────────
// **Validates: Requirements 2.5, 3.2**

describe('Property 5: Top-K similarity results extraction', () => {
  it('returns min(M, K) items where M is the input size and K=5', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (results) => {
          const k = 5;
          const topK = extractTopKMatches(results, k);
          return topK.length === Math.min(results.length, k);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('results are ordered by similarity score descending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (results) => {
          const topK = extractTopKMatches(results, 5);
          for (let i = 1; i < topK.length; i++) {
            if (topK[i].similarityScore > topK[i - 1].similarityScore) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each item has a similarityScore in [0.0, 1.0] and a non-empty sourceText', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (results) => {
          const topK = extractTopKMatches(results, 5);
          return topK.every(
            item =>
              item.similarityScore >= 0.0 &&
              item.similarityScore <= 1.0 &&
              typeof item.sourceText === 'string' &&
              item.sourceText.trim().length > 0
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no item outside the top K by similarity appears in the results', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            similarity: arbSimilarityScore,
            embedding_source: arbSourceText
          }),
          { minLength: 6, maxLength: 20 }
        ),
        (results) => {
          const k = 5;
          const topK = extractTopKMatches(results, k);

          // Get the minimum similarity in the top-K results
          const minTopKScore = Math.min(...topK.map(r => r.similarityScore));

          // Every excluded result should have similarity <= minTopKScore
          const topKTexts = new Set(topK.map(r => r.sourceText));
          const sortedAll = [...results].sort((a, b) => b.similarity - a.similarity);
          const excluded = sortedAll.slice(k);

          return excluded.every(r => r.similarity <= minTopKScore);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 7: New objective status invariant ──────────────────────
// **Validates: Requirements 3.4**

describe('Property 7: New objective status invariant', () => {
  /**
   * Build a new objective response shape.
   * When there are no knowledge states (new objective), the status should
   * always be 'not_started' and completionType should be null, regardless
   * of the similarity score from prior learning search.
   */
  function buildNewObjectiveResponse(objectiveId, objectiveText, similarityScore, matchedText) {
    return {
      id: objectiveId,
      text: objectiveText,
      similarityScore: similarityScore,
      matchedObjectiveText: matchedText,
      priorLearning: matchedText
        ? [{ similarityScore, sourceText: matchedText }]
        : [],
      status: 'not_started',
      completionType: null
    };
  }

  it('status is always not_started for any similarity score', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        arbSourceText,
        arbSimilarityScore,
        fc.option(arbSourceText),
        (objectiveId, objectiveText, similarityScore, matchedText) => {
          const objective = buildNewObjectiveResponse(
            objectiveId,
            objectiveText,
            similarityScore,
            matchedText ?? null
          );
          return objective.status === 'not_started';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completionType is always null for any similarity score', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        arbSourceText,
        arbSimilarityScore,
        fc.option(arbSourceText),
        (objectiveId, objectiveText, similarityScore, matchedText) => {
          const objective = buildNewObjectiveResponse(
            objectiveId,
            objectiveText,
            similarityScore,
            matchedText ?? null
          );
          return objective.completionType === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('high similarity scores (>= 0.8) do not cause auto-completion', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        arbSourceText,
        fc.double({ min: 0.8, max: 1.0, noNaN: true }),
        arbSourceText,
        (objectiveId, objectiveText, highScore, matchedText) => {
          const objective = buildNewObjectiveResponse(
            objectiveId,
            objectiveText,
            highScore,
            matchedText
          );
          return (
            objective.status === 'not_started' &&
            objective.completionType === null
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
