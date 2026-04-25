/**
 * Bloom's taxonomy utility functions.
 *
 * Pure helpers for mapping evaluation scores to Bloom's levels,
 * producing human-readable labels, and building learn-more URLs.
 */

// ---------------------------------------------------------------------------
// Bloom's Level Mapping
// ---------------------------------------------------------------------------

/**
 * Map a continuous 0.0–5.0 evaluation score to a Bloom's taxonomy level (1–5).
 *
 * Ranges:
 *   0.0–0.9 → 1 (Remember)
 *   1.0–1.9 → 2 (Understand)
 *   2.0–2.9 → 3 (Apply)
 *   3.0–3.9 → 4 (Analyze)
 *   4.0–5.0 → 5 (Create)
 *
 * @param {number} score - Continuous score in [0.0, 5.0]
 * @returns {number} Integer Bloom's level in [1, 5]
 */
function scoreToBloomLevel(score) {
  if (score >= 4.0) return 5;
  if (score >= 3.0) return 4;
  if (score >= 2.0) return 3;
  if (score >= 1.0) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Bloom's Level Labels
// ---------------------------------------------------------------------------

const BLOOM_LABELS = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Create',
};

/**
 * Return the human-readable label for a Bloom's taxonomy level.
 *
 * @param {number} level - Integer Bloom's level (1–5)
 * @returns {string} Label string, or 'Unknown' for out-of-range values
 */
function bloomLevelLabel(level) {
  return BLOOM_LABELS[level] ?? 'Unknown';
}

// ---------------------------------------------------------------------------
// Learn-More URL
// ---------------------------------------------------------------------------

/**
 * Build a Google search URL for a concept reference.
 *
 * When `conceptAuthor` is provided the query includes both name and author;
 * otherwise only the concept name is used.
 *
 * @param {string} conceptName - Name of the concept or framework
 * @param {string|null} [conceptAuthor] - Optional author / researcher name
 * @returns {string} Fully-encoded Google search URL
 */
function buildLearnMoreUrl(conceptName, conceptAuthor) {
  const query = conceptAuthor
    ? `${conceptName} ${conceptAuthor}`
    : conceptName;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

module.exports = {
  scoreToBloomLevel,
  bloomLevelLabel,
  buildLearnMoreUrl,
};
