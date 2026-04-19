/**
 * Pure utility functions for capability profile caching.
 * No infrastructure dependencies — uses only Node.js crypto.
 */

const crypto = require('crypto');

/**
 * Prompt version identifier included in evidence hash computation.
 * Bump this value whenever Bedrock prompts change to force recomputation
 * of all cached capability profiles on next access.
 */
const PROMPT_VERSION = 'v3';

/**
 * Compose a capability profile state_text in the canonical format.
 *
 * Format:
 *   [capability_profile] action=<actionId> user=<userId> hash=<evidenceHash> computed_at=<ISO8601> | <profileJSON>
 *
 * @param {string} actionId
 * @param {string} userId - user ID or 'organization'
 * @param {string} evidenceHash - 16-char hex hash of evidence inputs
 * @param {Object} profile - the full capability profile object
 * @returns {string}
 */
function composeCapabilityProfileStateText(actionId, userId, evidenceHash, profile) {
  const computedAt = new Date().toISOString();
  const profileJSON = JSON.stringify(profile);
  return `[capability_profile] action=${actionId} user=${userId} hash=${evidenceHash} computed_at=${computedAt} | ${profileJSON}`;
}

/**
 * Parse a capability profile state_text back to its components.
 * Returns null if the format doesn't match.
 *
 * @param {string} stateText
 * @returns {{ actionId: string, userId: string, evidenceHash: string, computedAt: string, profile: Object } | null}
 */
function parseCapabilityProfileStateText(stateText) {
  if (!stateText || typeof stateText !== 'string') {
    return null;
  }

  const pattern = /^\[capability_profile\] action=(\S+) user=(\S+) hash=(\S+) computed_at=(\S+) \| (.+)$/s;
  const match = stateText.match(pattern);

  if (!match) {
    return null;
  }

  try {
    const profile = JSON.parse(match[5]);
    return {
      actionId: match[1],
      userId: match[2],
      evidenceHash: match[3],
      computedAt: match[4],
      profile,
    };
  } catch {
    return null;
  }
}

/**
 * Compute a deterministic evidence hash from the current evidence set.
 *
 * Hash = sha256(sortedStateIds.join(',') + ':' + completionCount) truncated to 16 hex chars.
 *
 * @param {string[]} evidenceStateIds - state IDs used as evidence
 * @param {number} learningCompletionCount - count of completed learning objectives
 * @returns {string} - 16-char hex hash
 */
function computeEvidenceHash(evidenceStateIds, learningCompletionCount) {
  const sorted = [...evidenceStateIds].sort();
  const input = sorted.join(',') + ':' + learningCompletionCount + ':' + PROMPT_VERSION;
  const fullHash = crypto.createHash('sha256').update(input).digest('hex');
  return fullHash.substring(0, 16);
}

/**
 * Determine the cache action based on cached state and current evidence.
 *
 * @param {{ evidenceHash: string } | null} cachedState - parsed cached state or null
 * @param {string} currentHash - current evidence hash
 * @returns {'hit' | 'stale' | 'miss'}
 */
function determineCacheAction(cachedState, currentHash) {
  if (!cachedState) {
    return 'miss';
  }
  if (cachedState.evidenceHash === currentHash) {
    return 'hit';
  }
  return 'stale';
}

module.exports = {
  composeCapabilityProfileStateText,
  parseCapabilityProfileStateText,
  computeEvidenceHash,
  determineCacheAction,
};
