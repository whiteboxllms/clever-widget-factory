/**
 * Progression Model — pure function module for computing Bloom's progression.
 *
 * Computes a Profile_Axis's current bloom_level from its progression_history,
 * factoring in recency, consistency, and frequency of demonstrated levels.
 * Informed by learning science: spaced repetition, forgetting curve, and
 * habit formation research (Lally's ~66-day finding).
 *
 * No database dependencies — all functions are pure.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROGRESSION_CONFIG = {
  // Recency: half-life in days — demonstrations older than this get half weight
  recencyHalfLifeDays: 14,

  // Consistency: minimum number of demonstrations at a level to consider it "consistent"
  consistencyThreshold: 3,

  // Consistency: minimum time span (days) over which demonstrations must be distributed
  consistencyTimeSpanDays: 21,

  // Decay: days without demonstration before level starts decaying
  decayOnsetDays: 30,

  // Decay: rate of decay per day after onset (level units per day)
  decayRatePerDay: 0.05,

  // Tapering: minimum bloom level to consider tapering
  taperingMinLevel: 3,

  // Tapering: minimum demonstrations at or above taperingMinLevel
  taperingMinDemonstrations: 5,

  // Tapering: minimum time span (days) of sustained mastery for tapering
  taperingTimeSpanDays: 42, // ~6 weeks, informed by Lally's ~66 day habit formation

  // Tapering: reinforcement probability when tapering is active (0.0 = never, 1.0 = always)
  taperingReinforcementProbability: 0.3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the number of days between two dates.
 * @param {Date} a
 * @param {Date} b
 * @returns {number} Absolute difference in days
 */
function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(a.getTime() - b.getTime()) / msPerDay;
}

/**
 * Compute exponential decay weight based on half-life.
 * @param {number} ageDays - Age of the event in days
 * @param {number} halfLifeDays - Half-life in days
 * @returns {number} Weight in (0, 1]
 */
function recencyWeight(ageDays, halfLifeDays) {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

// ---------------------------------------------------------------------------
// computeBloomLevel
// ---------------------------------------------------------------------------

/**
 * Compute the current bloom_level for a profile axis from its progression history.
 *
 * Algorithm (configurable via PROGRESSION_CONFIG):
 * 1. If no history, return 0
 * 2. Apply recency weighting: recent demonstrations count more than old ones
 *    (exponential half-life decay)
 * 3. Compute weighted average of demonstrated levels
 * 4. Apply consistency bonus: sustained demonstrations over time increase confidence
 * 5. Apply decay: if no recent demonstrations, level decays toward 0
 * 6. Clamp result to [0, 5] integer
 *
 * @param {Array<{demonstrated_level: number, timestamp: string}>} history
 * @param {object} [config] - Optional config overrides
 * @returns {number} Computed bloom_level (0–5, integer)
 */
function computeBloomLevel(history, config = PROGRESSION_CONFIG) {
  // 1. Empty history → 0
  if (!history || history.length === 0) {
    return 0;
  }

  const now = new Date();

  // 2. Apply recency weighting and compute weighted average
  let weightedSum = 0;
  let totalWeight = 0;

  for (const event of history) {
    const eventDate = new Date(event.timestamp);
    const ageDays = daysBetween(now, eventDate);
    const weight = recencyWeight(ageDays, config.recencyHalfLifeDays);

    weightedSum += event.demonstrated_level * weight;
    totalWeight += weight;
  }

  // 3. Weighted average
  let level = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // 4. Consistency bonus: if the learner has demonstrated at a similar level
  //    consistently over a sufficient time span, boost confidence.
  //    We look at the peak demonstrated level and count how many events
  //    are at or above (peak - 1) within the consistency time span.
  const peakLevel = Math.max(...history.map(e => e.demonstrated_level));
  const consistencyFloor = Math.max(peakLevel - 1, 1);

  const sortedTimestamps = history
    .filter(e => e.demonstrated_level >= consistencyFloor)
    .map(e => new Date(e.timestamp).getTime())
    .sort((a, b) => a - b);

  if (sortedTimestamps.length >= config.consistencyThreshold) {
    const spanDays = (sortedTimestamps[sortedTimestamps.length - 1] - sortedTimestamps[0]) / (1000 * 60 * 60 * 24);
    if (spanDays >= config.consistencyTimeSpanDays) {
      // Bonus: up to +0.5 levels, scaled by how many consistent demonstrations
      // beyond the threshold
      const extraDemos = sortedTimestamps.length - config.consistencyThreshold;
      const bonus = Math.min(0.5, extraDemos * 0.1);
      level += bonus;
    }
  }

  // 5. Decay: if no recent demonstrations, level decays toward 0
  const mostRecentTimestamp = Math.max(...history.map(e => new Date(e.timestamp).getTime()));
  const daysSinceLastDemo = daysBetween(now, new Date(mostRecentTimestamp));

  if (daysSinceLastDemo > config.decayOnsetDays) {
    const decayDays = daysSinceLastDemo - config.decayOnsetDays;
    const decayAmount = decayDays * config.decayRatePerDay;
    level = Math.max(0, level - decayAmount);
  }

  // 6. Clamp to [0, 5] integer
  return Math.max(0, Math.min(5, Math.round(level)));
}

// ---------------------------------------------------------------------------
// computeTaperingDecision
// ---------------------------------------------------------------------------

/**
 * Determine whether reinforcement should be tapered for this axis.
 * Tapering occurs only when the progression history shows repeated,
 * time-distributed evidence of mastery.
 *
 * Conditions (all must be met):
 * - currentBloomLevel >= taperingMinLevel
 * - At least taperingMinDemonstrations events at or above taperingMinLevel
 * - Those high-level events span at least taperingTimeSpanDays
 *
 * @param {Array<{demonstrated_level: number, timestamp: string}>} history
 * @param {number} currentBloomLevel - Current computed bloom level
 * @param {object} [config] - Optional config overrides
 * @returns {{ shouldTaper: boolean, reinforcementProbability: number }}
 */
function computeTaperingDecision(history, currentBloomLevel, config = PROGRESSION_CONFIG) {
  const defaultResult = { shouldTaper: false, reinforcementProbability: 1.0 };

  // Must meet minimum bloom level
  if (currentBloomLevel < config.taperingMinLevel) {
    return defaultResult;
  }

  if (!history || history.length === 0) {
    return defaultResult;
  }

  // Filter to high-level events (at or above taperingMinLevel)
  const highLevelEvents = history.filter(
    e => e.demonstrated_level >= config.taperingMinLevel
  );

  // Must have enough high-level demonstrations
  if (highLevelEvents.length < config.taperingMinDemonstrations) {
    return defaultResult;
  }

  // High-level events must span sufficient time
  const timestamps = highLevelEvents
    .map(e => new Date(e.timestamp).getTime())
    .sort((a, b) => a - b);

  const spanDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 60 * 60 * 24);

  if (spanDays < config.taperingTimeSpanDays) {
    return defaultResult;
  }

  // All conditions met — taper reinforcement
  return {
    shouldTaper: true,
    reinforcementProbability: config.taperingReinforcementProbability,
  };
}

module.exports = {
  computeBloomLevel,
  computeTaperingDecision,
  PROGRESSION_CONFIG,
};
