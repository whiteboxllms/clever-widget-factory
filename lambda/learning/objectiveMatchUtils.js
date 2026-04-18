/**
 * Pure utility functions for per-axis match distribution and axis-aware embedding.
 * Extracted for testability — no Lambda layer dependencies.
 *
 * Used by handleGetObjectives to distribute per-axis similarity matches
 * to individual objectives, replacing the per-objective query approach.
 */

/**
 * Tokenize text into lowercase words for overlap scoring.
 * Strips common punctuation and splits on whitespace.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Compute a simple keyword overlap score between two texts.
 * Returns the count of shared unique tokens divided by the total
 * unique tokens in the shorter text (Jaccard-like, biased toward
 * the objective text length so short objectives still match).
 *
 * @param {string} textA
 * @param {string} textB
 * @returns {number} - score between 0 and 1
 */
function overlapScore(textA, textB) {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  // Normalize by the smaller set so short objective texts aren't penalized
  const minSize = Math.min(tokensA.size, tokensB.size);
  return shared / minSize;
}

/**
 * Distribute per-axis similarity matches to individual objectives.
 * For each match, finds the objective whose text has the highest
 * keyword overlap with the match's embedding_source text.
 *
 * If a match doesn't overlap with any objective (score = 0), it is
 * assigned to the first objective as a fallback so no evidence is lost.
 *
 * @param {Array<{ entity_id: string, embedding_source: string, similarity: number }>} axisMatches
 * @param {Array<{ id: string, text: string }>} objectives
 * @returns {Map<string, Array<{ similarity: number, embedding_source: string }>>}
 *   objectiveId → array of matches assigned to that objective
 */
function distributeMatchesToObjectives(axisMatches, objectives) {
  const result = new Map();

  // Initialize empty arrays for every objective
  for (const obj of objectives) {
    result.set(obj.id, []);
  }

  if (!axisMatches || axisMatches.length === 0 || !objectives || objectives.length === 0) {
    return result;
  }

  for (const match of axisMatches) {
    let bestObjective = null;
    let bestScore = -1;

    for (const obj of objectives) {
      const score = overlapScore(match.embedding_source, obj.text);
      if (score > bestScore) {
        bestScore = score;
        bestObjective = obj;
      }
    }

    // Fallback to first objective if no overlap found
    if (!bestObjective || bestScore === 0) {
      bestObjective = objectives[0];
    }

    result.get(bestObjective.id).push({
      similarity: match.similarity,
      embedding_source: match.embedding_source
    });
  }

  return result;
}

/**
 * Compose an axis-aware embedding source for a knowledge state.
 * Prepends the axis label to the state text so that per-axis
 * similarity searches produce better matches.
 *
 * Example:
 *   composeAxisAwareEmbeddingSource("Cement Work", "For learning objective 'Understand mixing ratios'...")
 *   → "Cement Work: For learning objective 'Understand mixing ratios'..."
 *
 * @param {string} axisLabel
 * @param {string} stateText
 * @returns {string}
 */
function composeAxisAwareEmbeddingSource(axisLabel, stateText) {
  if (!axisLabel) return stateText || '';
  if (!stateText) return axisLabel;
  return `${axisLabel}: ${stateText}`;
}

module.exports = {
  distributeMatchesToObjectives,
  composeAxisAwareEmbeddingSource
};
