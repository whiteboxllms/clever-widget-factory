/**
 * Pure utility functions for semantic evidence tagging.
 * Extracted for testability — no Lambda layer dependencies.
 */

/**
 * Filter knowledge states to only those captured by the target user
 * with a correct answer indicator in the state text.
 *
 * @param {Array<{ captured_by: string, state_text: string }>} states
 * @param {string} userId
 * @returns {Array<{ captured_by: string, state_text: string }>}
 */
function filterCompletedKnowledgeStates(states, userId) {
  return states.filter(
    (s) =>
      s.captured_by === userId &&
      s.state_text &&
      s.state_text.toLowerCase().includes('which was the correct answer')
  );
}

/**
 * Extract the best (highest similarity) match from a set of similarity results.
 *
 * @param {Array<{ similarity: number, embedding_source: string }>} similarityResults
 * @returns {{ similarityScore: number, matchedObjectiveText: string | null }}
 */
function extractBestMatch(similarityResults) {
  if (!similarityResults || similarityResults.length === 0) {
    return { similarityScore: 0.0, matchedObjectiveText: null };
  }

  let best = similarityResults[0];
  for (let i = 1; i < similarityResults.length; i++) {
    if (similarityResults[i].similarity > best.similarity) {
      best = similarityResults[i];
    }
  }

  return {
    similarityScore: best.similarity,
    matchedObjectiveText: best.embedding_source
  };
}

/**
 * Extract the top K results ordered by similarity descending.
 *
 * @param {Array<{ similarity: number, embedding_source: string }>} similarityResults
 * @param {number} [k=5]
 * @returns {Array<{ similarityScore: number, sourceText: string }>}
 */
function extractTopKMatches(similarityResults, k = 5) {
  if (!similarityResults || similarityResults.length === 0) {
    return [];
  }

  // Sort descending by similarity (copy to avoid mutating input)
  const sorted = [...similarityResults].sort((a, b) => b.similarity - a.similarity);

  return sorted.slice(0, k).map((r) => ({
    similarityScore: r.similarity,
    sourceText: r.embedding_source
  }));
}

module.exports = {
  filterCompletedKnowledgeStates,
  extractBestMatch,
  extractTopKMatches
};
