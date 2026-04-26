/**
 * Lens selection, gap boost, and values lens builder utilities.
 *
 * Pure functions extracted from index.js for testability (no Lambda layer
 * dependencies). Used by the Learning Lambda for quiz lens selection.
 */

const VALUES_LENS_DEFAULT_WEIGHT = 0.3;

// ---------------------------------------------------------------------------
// Slugify
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

// ---------------------------------------------------------------------------
// buildValuesLenses
// ---------------------------------------------------------------------------

/**
 * Build values lenses from strategic_attributes.
 * Each attribute becomes a lens with key, label, description, weight, and source.
 *
 * @param {string[]|null|undefined} strategicAttributes - e.g. ["organic", "quality", "teamwork"]
 * @param {object} valuesLensWeights - Weight/enabled overrides from lens_config (key → { weight, enabled })
 * @returns {Array<{key: string, label: string, description: string, weight: number, source: string}>}
 */
function buildValuesLenses(strategicAttributes, valuesLensWeights) {
  if (!Array.isArray(strategicAttributes) || strategicAttributes.length === 0) {
    return [];
  }

  const overrides = valuesLensWeights && typeof valuesLensWeights === 'object' ? valuesLensWeights : {};

  return strategicAttributes
    .filter((attr) => typeof attr === 'string' && attr.length > 0)
    .map((attr) => {
      const key = `values_${slugify(attr)}`;
      const override = overrides[key];
      const weight = override && typeof override.weight === 'number' ? override.weight : VALUES_LENS_DEFAULT_WEIGHT;
      return {
        key,
        label: attr,
        description: `How does this practice align with or reinforce the organization value: ${attr}?`,
        weight,
        source: 'values',
      };
    });
}

// ---------------------------------------------------------------------------
// applyGapBoost
// ---------------------------------------------------------------------------

/**
 * Apply gap boost rules to lens weights.
 * Finds the highest-threshold rule that the gap meets or exceeds,
 * then multiplies the specified lens weights by the rule's multiplier.
 *
 * @param {Array<{key: string, weight: number}>} lensPool - Mutable lens pool
 * @param {number} capabilityGap - Gap value for the target axis
 * @param {Array<{threshold: number, lens_keys: string[], multiplier: number}>} rules - Gap boost rules
 * @returns {Array} Modified lens pool with boosted weights
 */
function applyGapBoost(lensPool, capabilityGap, rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return lensPool;
  }

  // Sort rules by threshold descending to find highest matching first
  const sorted = [...rules].sort((a, b) => b.threshold - a.threshold);

  // Find first rule where capabilityGap >= rule.threshold
  const matchingRule = sorted.find((rule) => capabilityGap >= rule.threshold);

  if (!matchingRule) {
    return lensPool;
  }

  const boostedKeys = new Set(matchingRule.lens_keys);

  for (const lens of lensPool) {
    if (boostedKeys.has(lens.key)) {
      lens.weight = lens.weight * matchingRule.multiplier;
    }
  }

  return lensPool;
}

// ---------------------------------------------------------------------------
// selectLenses
// ---------------------------------------------------------------------------

/**
 * Select 2–3 lenses from the pool using weighted random sampling without replacement.
 * When gap data is available, applies gap boost before sampling.
 *
 * @param {Array<{key: string, label: string, description: string, weight: number, source: string}>} lensPool - Enabled lenses with weights
 * @param {number|null} capabilityGap - Gap for the target axis (null if unavailable)
 * @param {Array} gapBoostRules - Admin-configured gap boost rules
 * @returns {Array<{key: string, label: string, description: string, source: string}>} Selected lenses (2–3)
 */
function selectLenses(lensPool, capabilityGap, gapBoostRules) {
  // Work on a shallow copy so we don't mutate the caller's array
  let pool = lensPool
    .filter((lens) => lens.weight > 0)
    .map((lens) => ({ ...lens }));

  // Apply gap boost when gap data is available
  if (capabilityGap != null && Array.isArray(gapBoostRules) && gapBoostRules.length > 0) {
    pool = applyGapBoost(pool, capabilityGap, gapBoostRules);
  }

  // If fewer than 2 enabled lenses, select all available
  if (pool.length < 2) {
    return pool.map(({ key, label, description, source }) => ({ key, label, description, source }));
  }

  // Determine selection count: randomly 2 or 3, capped by pool size
  const count = Math.min(pool.length, 2 + (Math.random() < 0.5 ? 1 : 0));

  const selected = [];

  for (let i = 0; i < count; i++) {
    // Compute total weight of remaining pool
    let totalWeight = 0;
    for (const lens of pool) {
      totalWeight += lens.weight;
    }

    // Pick a random value in [0, totalWeight)
    const rand = Math.random() * totalWeight;

    // Find the lens whose cumulative range contains the value
    let cumulative = 0;
    let pickedIndex = 0;
    for (let j = 0; j < pool.length; j++) {
      cumulative += pool[j].weight;
      if (rand < cumulative) {
        pickedIndex = j;
        break;
      }
    }

    // Add selected lens and remove from pool
    const picked = pool[pickedIndex];
    selected.push({ key: picked.key, label: picked.label, description: picked.description, source: picked.source });
    pool.splice(pickedIndex, 1);
  }

  return selected;
}

// ---------------------------------------------------------------------------
// buildLensPromptBlock
// ---------------------------------------------------------------------------

/**
 * Build the lens instructions block for the quiz prompt.
 * Returns a text block with numbered lens descriptions and framing guidance.
 * Returns empty string when given an empty array.
 *
 * @param {Array<{key: string, label: string, description: string, source: string}>} selectedLenses
 * @returns {string} Prompt text block
 */
function buildLensPromptBlock(selectedLenses) {
  if (!Array.isArray(selectedLenses) || selectedLenses.length === 0) {
    return '';
  }

  const numberedLenses = selectedLenses
    .map((lens, i) => `  ${i + 1}. ${lens.label}: ${lens.description}`)
    .join('\n');

  return `QUESTION FRAMING LENSES (use these angles to diversify question perspectives):\n${numberedLenses}\n\nFrame at least one question through each lens above. These are framing suggestions, not rigid constraints — the learning objective remains the primary focus.`;
}

// ---------------------------------------------------------------------------
// buildAssetContextBlock
// ---------------------------------------------------------------------------

/**
 * Build the related assets context block for the quiz prompt.
 * Returns a text block with numbered asset descriptions including entity type.
 * Returns empty string when given an empty array.
 *
 * @param {Array<{entity_type: string, entity_id: string, description: string}>} assets
 * @returns {string} Prompt text block
 */
function buildAssetContextBlock(assets) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return '';
  }

  const numberedAssets = assets
    .map((asset, i) => `  ${i + 1}. [${asset.entity_type}] ${asset.description}`)
    .join('\n');

  return `RELATED ASSETS (use for compare/contrast or scenario-based questions):\n${numberedAssets}`;
}

module.exports = {
  slugify,
  buildValuesLenses,
  applyGapBoost,
  selectLenses,
  buildLensPromptBlock,
  buildAssetContextBlock,
  VALUES_LENS_DEFAULT_WEIGHT,
};
