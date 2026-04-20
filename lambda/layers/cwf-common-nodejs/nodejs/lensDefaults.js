/**
 * Lens configuration defaults and resolution utilities.
 *
 * Centralizes system lens definitions, config resolution, and lens pool
 * building so every Lambda and the frontend use identical defaults.
 */

const { isValidFloat } = require('./aiConfigDefaults');

// ---------------------------------------------------------------------------
// System Lens Definitions
// ---------------------------------------------------------------------------

const SYSTEM_LENSES = [
  {
    key: 'failure_analysis',
    label: 'Failure Analysis',
    description: 'What could go wrong if this practice is done incorrectly or skipped?',
    defaultWeight: 0.5,
  },
  {
    key: 'underlying_science',
    label: 'Underlying Science',
    description: 'What physics, chemistry, or biology principles explain why this practice works?',
    defaultWeight: 0.5,
  },
  {
    key: 'cross_asset_comparison',
    label: 'Cross-Asset Comparison',
    description: 'How does this compare or contrast with related farm work, tools, or processes?',
    defaultWeight: 0.5,
  },
  {
    key: 'practical_tradeoffs',
    label: 'Practical Tradeoffs',
    description: 'What are the time, cost, and effort tradeoffs of different approaches?',
    defaultWeight: 0.5,
  },
  {
    key: 'root_cause_reasoning',
    label: 'Root Cause Reasoning',
    description: 'Why does this happen at a fundamental level? What is the root cause?',
    defaultWeight: 0.5,
  },
  {
    key: 'scenario_response',
    label: 'Scenario Response',
    description: 'Here is a situation — describe what you would do and why.',
    defaultWeight: 0.5,
  },
];

// ---------------------------------------------------------------------------
// Config Defaults & Constants
// ---------------------------------------------------------------------------

const LENS_CONFIG_DEFAULTS = {
  system_lens_weights: {},
  custom_lenses: [],
  values_lens_weights: {},
  gap_boost_rules: [],
};

const VALUES_LENS_DEFAULT_WEIGHT = 0.3;
const MAX_CUSTOM_LENSES = 20;
const MAX_GAP_BOOST_RULES = 10;

// ---------------------------------------------------------------------------
// Resolution Utilities
// ---------------------------------------------------------------------------

/**
 * Clamp a weight to [0.0, 1.0], returning the fallback when invalid.
 */
function clampWeight(val, fallback) {
  return isValidFloat(val, 0.0, 1.0) ? val : fallback;
}

/**
 * Resolve a single system lens weight override entry.
 * Returns a valid { weight, enabled } object or the default.
 */
function resolveWeightEntry(entry, defaultWeight) {
  if (!entry || typeof entry !== 'object') {
    return { weight: defaultWeight, enabled: true };
  }
  return {
    weight: clampWeight(entry.weight, defaultWeight),
    enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
  };
}

/**
 * Validate and sanitize a single custom lens object.
 * Returns null if the lens is irrecoverably invalid.
 */
function resolveCustomLens(lens) {
  if (!lens || typeof lens !== 'object') return null;

  const key = typeof lens.key === 'string' && lens.key.length > 0 ? lens.key : null;
  if (!key) return null;

  let label = typeof lens.label === 'string' ? lens.label : '';
  if (label.length < 1) label = key;
  if (label.length > 100) label = label.slice(0, 100);

  let description = typeof lens.description === 'string' ? lens.description : '';
  if (description.length < 1) description = label;
  if (description.length > 500) description = description.slice(0, 500);

  return {
    key,
    label,
    description,
    weight: clampWeight(lens.weight, 0.5),
    enabled: typeof lens.enabled === 'boolean' ? lens.enabled : true,
  };
}

/**
 * Merges a raw lens_config from ai_config JSONB with defaults.
 * Invalid or missing fields are replaced with defaults.
 * Enforces max custom lenses (20) and max gap boost rules (10).
 *
 * @param {object|null|undefined} lensConfig - Raw lens_config from the DB
 * @returns {object} Resolved lens config with all fields guaranteed valid
 */
function resolveLensConfig(lensConfig) {
  if (!lensConfig || typeof lensConfig !== 'object') {
    return { ...LENS_CONFIG_DEFAULTS };
  }

  // --- system_lens_weights ---
  const rawSystemWeights = lensConfig.system_lens_weights;
  const systemLensWeights = {};
  if (rawSystemWeights && typeof rawSystemWeights === 'object') {
    for (const lens of SYSTEM_LENSES) {
      if (rawSystemWeights[lens.key] !== undefined) {
        systemLensWeights[lens.key] = resolveWeightEntry(
          rawSystemWeights[lens.key],
          lens.defaultWeight
        );
      }
    }
  }

  // --- custom_lenses ---
  let customLenses = [];
  if (Array.isArray(lensConfig.custom_lenses)) {
    const seenLabels = new Set();
    for (const raw of lensConfig.custom_lenses) {
      if (customLenses.length >= MAX_CUSTOM_LENSES) break;
      const resolved = resolveCustomLens(raw);
      if (!resolved) continue;
      const lowerLabel = resolved.label.toLowerCase();
      if (seenLabels.has(lowerLabel)) continue; // skip duplicates
      seenLabels.add(lowerLabel);
      customLenses.push(resolved);
    }
  }

  // --- values_lens_weights ---
  const rawValuesWeights = lensConfig.values_lens_weights;
  const valuesLensWeights = {};
  if (rawValuesWeights && typeof rawValuesWeights === 'object') {
    for (const [key, entry] of Object.entries(rawValuesWeights)) {
      if (typeof key === 'string' && key.length > 0) {
        valuesLensWeights[key] = resolveWeightEntry(entry, VALUES_LENS_DEFAULT_WEIGHT);
      }
    }
  }

  // --- gap_boost_rules ---
  let gapBoostRules = [];
  if (Array.isArray(lensConfig.gap_boost_rules)) {
    for (const rule of lensConfig.gap_boost_rules) {
      if (gapBoostRules.length >= MAX_GAP_BOOST_RULES) break;
      if (!rule || typeof rule !== 'object') continue;
      const threshold = isValidFloat(rule.threshold, 0.5, Infinity) ? rule.threshold : null;
      if (threshold === null) continue;
      const multiplier = isValidFloat(rule.multiplier, 1.1, 3.0) ? rule.multiplier : null;
      if (multiplier === null) continue;
      const lensKeys = Array.isArray(rule.lens_keys)
        ? rule.lens_keys.filter((k) => typeof k === 'string' && k.length > 0)
        : [];
      if (lensKeys.length === 0) continue;
      gapBoostRules.push({
        id: typeof rule.id === 'string' ? rule.id : `rule-${gapBoostRules.length + 1}`,
        threshold,
        lens_keys: lensKeys,
        multiplier,
      });
    }
  }

  return {
    system_lens_weights: systemLensWeights,
    custom_lenses: customLenses,
    values_lens_weights: valuesLensWeights,
    gap_boost_rules: gapBoostRules,
  };
}

// ---------------------------------------------------------------------------
// Lens Pool Builder
// ---------------------------------------------------------------------------

/**
 * Slugify a string for use as a lens key.
 * Lowercases, replaces non-alphanumeric runs with underscores, trims underscores.
 */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Build the complete lens pool (system + values + custom) with resolved weights.
 * Only enabled lenses with weight > 0 are included.
 *
 * @param {object} resolvedLensConfig - Output of resolveLensConfig
 * @param {string[]} strategicAttributes - Organization's strategic_attributes array
 * @returns {Array<{key: string, label: string, description: string, weight: number, source: string}>}
 */
function buildLensPool(resolvedLensConfig, strategicAttributes) {
  const pool = [];

  // --- System lenses ---
  for (const lens of SYSTEM_LENSES) {
    const override = resolvedLensConfig.system_lens_weights[lens.key];
    const weight = override ? override.weight : lens.defaultWeight;
    const enabled = override ? override.enabled : true;
    if (!enabled || weight <= 0) continue;
    pool.push({
      key: lens.key,
      label: lens.label,
      description: lens.description,
      weight,
      source: 'system',
    });
  }

  // --- Values lenses (from strategic attributes) ---
  if (Array.isArray(strategicAttributes)) {
    for (const attr of strategicAttributes) {
      if (typeof attr !== 'string' || attr.length === 0) continue;
      const key = `values_${slugify(attr)}`;
      const override = resolvedLensConfig.values_lens_weights[key];
      const weight = override ? override.weight : VALUES_LENS_DEFAULT_WEIGHT;
      const enabled = override ? override.enabled : true;
      if (!enabled || weight <= 0) continue;
      pool.push({
        key,
        label: attr,
        description: `How does this practice align with or reinforce the organization value: ${attr}?`,
        weight,
        source: 'values',
      });
    }
  }

  // --- Custom lenses ---
  for (const lens of resolvedLensConfig.custom_lenses) {
    if (!lens.enabled || lens.weight <= 0) continue;
    pool.push({
      key: lens.key,
      label: lens.label,
      description: lens.description,
      weight: lens.weight,
      source: 'custom',
    });
  }

  return pool;
}

module.exports = {
  SYSTEM_LENSES,
  LENS_CONFIG_DEFAULTS,
  VALUES_LENS_DEFAULT_WEIGHT,
  MAX_CUSTOM_LENSES,
  MAX_GAP_BOOST_RULES,
  resolveLensConfig,
  buildLensPool,
};
