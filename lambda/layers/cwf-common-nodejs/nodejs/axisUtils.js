/**
 * Pure utility functions for skill axis embedding operations.
 * Extracted for testability — no Lambda layer dependencies.
 */

/**
 * Compose the embedding source text for a single skill axis.
 * Joins the axis label, optional description, and optional narrative with '. ' separator.
 * @param {{ label: string, description?: string }} axis
 * @param {string} [narrative]
 * @returns {string}
 */
function composeAxisEmbeddingSource(axis, narrative) {
  const parts = [axis.label];
  if (axis.description) parts.push(axis.description);
  if (narrative) parts.push(narrative);
  return parts.join('. ');
}

module.exports = {
  composeAxisEmbeddingSource
};
