/**
 * AI Configuration defaults and resolution utilities.
 *
 * Centralizes per-organization AI config handling so every Lambda
 * uses identical defaults and validation logic.
 */

const AI_CONFIG_DEFAULTS = {
  max_axes: 3,
  min_axes: 2,
  evidence_limit: 3,
  quiz_temperature: 0.7,
};

/**
 * Returns true if val is an integer within [min, max].
 */
function isValidInt(val, min, max) {
  return Number.isInteger(val) && val >= min && val <= max;
}

/**
 * Returns true if val is a finite number within [min, max].
 */
function isValidFloat(val, min, max) {
  return typeof val === 'number' && !isNaN(val) && val >= min && val <= max;
}

/**
 * Merges an organization's ai_config with hardcoded defaults.
 * Invalid or missing fields are replaced with defaults.
 *
 * @param {object|null|undefined} aiConfig - Raw ai_config from the DB
 * @returns {object} Resolved config with all fields guaranteed valid
 */
function resolveAiConfig(aiConfig) {
  if (!aiConfig || typeof aiConfig !== 'object') {
    return { ...AI_CONFIG_DEFAULTS };
  }

  const resolved = {
    max_axes: isValidInt(aiConfig.max_axes, 1, 6)
      ? aiConfig.max_axes
      : AI_CONFIG_DEFAULTS.max_axes,
    min_axes: isValidInt(aiConfig.min_axes, 1, 6)
      ? aiConfig.min_axes
      : AI_CONFIG_DEFAULTS.min_axes,
    evidence_limit: isValidInt(aiConfig.evidence_limit, 1, 10)
      ? aiConfig.evidence_limit
      : AI_CONFIG_DEFAULTS.evidence_limit,
    quiz_temperature: isValidFloat(aiConfig.quiz_temperature, 0.0, 1.0)
      ? aiConfig.quiz_temperature
      : AI_CONFIG_DEFAULTS.quiz_temperature,
  };

  return resolved;
}

/**
 * Fetches and resolves the AI config for an organization.
 * Falls back to defaults on any error.
 *
 * @param {object} db - Database client with a .query() method
 * @param {string} organizationId - Organization UUID
 * @returns {Promise<object>} Resolved AI config
 */
async function fetchAiConfig(db, organizationId) {
  try {
    const result = await db.query(
      `SELECT ai_config FROM organizations WHERE id = $1`,
      [organizationId]
    );
    return resolveAiConfig(result.rows?.[0]?.ai_config);
  } catch (err) {
    console.warn('Failed to fetch ai_config for org', organizationId, ':', err.message);
    return resolveAiConfig(null);
  }
}

module.exports = {
  AI_CONFIG_DEFAULTS,
  resolveAiConfig,
  isValidInt,
  isValidFloat,
  fetchAiConfig,
};
