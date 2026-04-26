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

/**
 * Compose a unified_embeddings entity_id for a skill axis.
 * Format: '{action_id}:{axis_key}'
 * @param {string} actionId
 * @param {string} axisKey
 * @returns {string}
 */
function composeAxisEntityId(actionId, axisKey) {
  return `${actionId}:${axisKey}`;
}

/**
 * Parse a skill axis entity_id back into its components.
 * @param {string} entityId - Format: '{action_id}:{axis_key}'
 * @returns {{ actionId: string, axisKey: string }}
 */
function parseAxisEntityId(entityId) {
  const colonIndex = entityId.indexOf(':');
  return {
    actionId: entityId.substring(0, colonIndex),
    axisKey: entityId.substring(colonIndex + 1)
  };
}

module.exports = {
  composeAxisEmbeddingSource,
  composeAxisEntityId,
  parseAxisEntityId
};
