/**
 * Bloom's Progression Utility Functions
 *
 * Pure functions for question type taxonomy, progression level derivation,
 * and continuous Bloom's scoring. These power the progressive quiz system
 * that extends Recognition questions through the full Bloom's taxonomy.
 *
 * Bloom's taxonomy levels:
 *   1 = Remember, 2 = Understand, 3 = Apply, 4 = Analyze, 5 = Create
 */

// --- Types ---

/** Question types in Bloom's progression order */
export type QuestionType =
  | 'recognition'
  | 'bridging'
  | 'self_explanation'
  | 'application'
  | 'analysis'
  | 'synthesis';

// --- Constants ---

/** Mapping from question type to Bloom's taxonomy level */
const BLOOM_LEVEL_MAP: Record<QuestionType, number> = {
  recognition: 1,
  bridging: 1,
  self_explanation: 2,
  application: 3,
  analysis: 4,
  synthesis: 5,
};

/** All valid question types */
export const VALID_QUESTION_TYPES: QuestionType[] = [
  'recognition',
  'bridging',
  'self_explanation',
  'application',
  'analysis',
  'synthesis',
];

// --- Taxonomy Functions ---

/**
 * Map a question type to its Bloom's taxonomy level.
 *
 * - recognition → 1 (Remember)
 * - bridging → 1 (Remember)
 * - self_explanation → 2 (Understand)
 * - application → 3 (Apply)
 * - analysis → 4 (Analyze)
 * - synthesis → 5 (Create)
 *
 * Returns 0 for any invalid question type string.
 */
export function questionTypeToBloomLevel(questionType: QuestionType): number {
  return BLOOM_LEVEL_MAP[questionType] ?? 0;
}

/**
 * Classify a question type as open-form or closed-form.
 *
 * Recognition questions are closed-form (multiple-choice with a single correct answer).
 * All other question types are open-form (free-text response evaluated by AI).
 *
 * Returns `false` for recognition, `true` for all other valid types.
 */
export function isOpenFormQuestion(questionType: QuestionType): boolean {
  return questionType !== 'recognition';
}

// --- Progression Constants ---

/**
 * Open-form question types in progression order.
 * After Recognition is complete, the learner progresses through these types.
 */
const OPEN_FORM_PROGRESSION: QuestionType[] = [
  'bridging',
  'self_explanation',
  'application',
  'analysis',
  'synthesis',
];

/**
 * Score thresholds for advancing past each open-form question type.
 *
 * A sufficient evaluation with a continuous score at or above the threshold
 * for the current level advances the learner to the next question type.
 *
 * - bridging: any sufficient evaluation completes it (no score threshold)
 * - self_explanation: score ≥ 2.0 → advance to application
 * - application: score ≥ 3.0 → advance to analysis
 * - analysis: score ≥ 4.0 → advance to synthesis
 * - synthesis: no advancement beyond (terminal level)
 */
const ADVANCEMENT_THRESHOLDS: Partial<Record<QuestionType, number>> = {
  self_explanation: 2.0,
  application: 3.0,
  analysis: 4.0,
};

// --- Progression Functions ---

import type { ParsedOpenFormState } from '@/lib/learningUtils';

/**
 * Derive the current progression level for an axis from open-form knowledge states.
 *
 * Examines stored knowledge states to determine the current question type
 * and Bloom's level. Never skips levels. Treats `pending` and `error`
 * evaluations as incomplete — they don't count toward level completion.
 *
 * The `recognitionComplete` parameter is determined by the caller (Lambda
 * checks if all Recognition objectives are answered correctly). Recognition
 * states use a different format (parsed by `parseKnowledgeStateText`, not
 * `parseOpenFormStateText`), so this function only receives open-form states.
 *
 * Progression logic:
 * 1. If recognition is not complete → return recognition (Level 1)
 * 2. If recognition is complete but no sufficient bridging → return bridging (Level 1)
 * 3. If bridging is sufficient, check each subsequent level in order:
 *    - A level is complete when at least one sufficient evaluation exists
 *      with a continuous score at or above the next level's threshold
 *    - If the current level is not complete → return that level
 * 4. If all levels are complete → return synthesis (Level 5)
 */
export function deriveProgressionLevel(
  knowledgeStates: ParsedOpenFormState[],
  recognitionComplete: boolean
): { currentLevel: QuestionType; bloomLevel: number } {
  // Step 1: If recognition is not complete, stay at recognition
  if (!recognitionComplete) {
    return { currentLevel: 'recognition', bloomLevel: 1 };
  }

  // Step 2: Check if bridging is complete
  if (!hasSufficientForType(knowledgeStates, 'bridging')) {
    return { currentLevel: 'bridging', bloomLevel: 1 };
  }

  // Step 3: Walk through open-form progression after bridging
  // Check self_explanation → application → analysis → synthesis
  for (let i = 1; i < OPEN_FORM_PROGRESSION.length; i++) {
    const currentType = OPEN_FORM_PROGRESSION[i];
    const previousType = OPEN_FORM_PROGRESSION[i - 1];

    // Check if the previous level's score meets the threshold for advancement
    if (!isLevelComplete(knowledgeStates, previousType)) {
      return {
        currentLevel: previousType,
        bloomLevel: questionTypeToBloomLevel(previousType),
      };
    }

    // Check if the current level has any sufficient evaluation
    if (!hasSufficientForType(knowledgeStates, currentType)) {
      return {
        currentLevel: currentType,
        bloomLevel: questionTypeToBloomLevel(currentType),
      };
    }
  }

  // All levels complete — stay at synthesis (terminal level)
  return { currentLevel: 'synthesis', bloomLevel: 5 };
}

/**
 * Check if bridging is complete for an axis.
 *
 * Returns `true` if at least one knowledge state with `questionType = 'bridging'`
 * and `evaluationStatus = 'sufficient'` exists. Returns `false` if no such state
 * exists or if the only bridging states have `pending` or `error` status.
 *
 * The `axisKey` parameter is accepted for API consistency — the caller is
 * expected to pre-filter states by axis before calling this function.
 */
export function isBridgingComplete(
  knowledgeStates: ParsedOpenFormState[],
  _axisKey: string
): boolean {
  return hasSufficientForType(knowledgeStates, 'bridging');
}

// --- Internal Helpers ---

/**
 * Check if at least one sufficient evaluation exists for a given question type.
 * Only states with `evaluationStatus = 'sufficient'` count — `pending` and
 * `error` states are treated as incomplete.
 */
function hasSufficientForType(
  knowledgeStates: ParsedOpenFormState[],
  questionType: QuestionType
): boolean {
  return knowledgeStates.some(
    (state) =>
      state.questionType === questionType &&
      state.evaluationStatus === 'sufficient'
  );
}

/**
 * Check if a level is complete — meaning it has a sufficient evaluation
 * with a continuous score at or above the advancement threshold for that type.
 *
 * For bridging: any sufficient evaluation completes the level (no score threshold).
 * For self_explanation/application/analysis: the continuous score must meet the threshold.
 * For synthesis: any sufficient evaluation completes it (terminal level, no advancement).
 */
function isLevelComplete(
  knowledgeStates: ParsedOpenFormState[],
  questionType: QuestionType
): boolean {
  const threshold = ADVANCEMENT_THRESHOLDS[questionType];

  // For types without a threshold (bridging, synthesis), any sufficient evaluation completes it
  if (threshold === undefined) {
    return hasSufficientForType(knowledgeStates, questionType);
  }

  // For types with a threshold, check if any sufficient evaluation meets the score
  return knowledgeStates.some(
    (state) =>
      state.questionType === questionType &&
      state.evaluationStatus === 'sufficient' &&
      state.continuousScore !== null &&
      state.continuousScore >= threshold
  );
}

// --- Continuous Score Functions ---

/**
 * Compute the continuous Bloom's score for an axis from all knowledge states.
 *
 * The score is a value in [0.0, 5.0] derived from three sources, taking the
 * maximum across all of them:
 *
 * 1. **Recognition score**: `correctRecognitionCount / totalRecognitionObjectives`,
 *    capped at 1.0. If there are no recognition objectives, this component is 0.
 *
 * 2. **Bridging score**: 1.0 if at least one sufficient bridging state exists,
 *    otherwise 0.
 *
 * 3. **Open-form max score**: The maximum `continuousScore` from all evaluated
 *    (sufficient or insufficient, but NOT pending or error) knowledge states.
 *
 * The `axisKey` parameter is accepted for API consistency — the caller
 * pre-filters states by axis before calling this function.
 */
export function computeContinuousScore(
  knowledgeStates: ParsedOpenFormState[],
  _axisKey: string,
  totalRecognitionObjectives: number,
  correctRecognitionCount: number
): number {
  // 1. Recognition score: proportion of correct first-attempt answers, capped at 1.0
  const recognitionScore =
    totalRecognitionObjectives > 0
      ? Math.min(1.0, correctRecognitionCount / totalRecognitionObjectives)
      : 0;

  // 2. Bridging score: 1.0 if bridging is complete
  const bridgingScore = hasSufficientForType(knowledgeStates, 'bridging')
    ? 1.0
    : 0;

  // 3. Open-form max: highest continuous score from evaluated (non-pending, non-error) states
  let openFormMax = 0;
  for (const state of knowledgeStates) {
    if (
      state.continuousScore !== null &&
      state.evaluationStatus !== 'pending' &&
      state.evaluationStatus !== 'error'
    ) {
      openFormMax = Math.max(openFormMax, state.continuousScore);
    }
  }

  // Return the maximum of all computed scores, clamped to [0.0, 5.0]
  return Math.min(5.0, Math.max(recognitionScore, bridgingScore, openFormMax));
}

// --- Growth Label Functions ---

/**
 * Map a continuous Bloom's score to a growth-oriented label.
 *
 * The six ranges are mutually exclusive and exhaustive over [0.0, 5.0]:
 *   [0.0, 1.0)  → "Building foundations"
 *   [1.0, 2.0)  → "Developing recall"
 *   [2.0, 3.0)  → "Deepening understanding"
 *   [3.0, 4.0)  → "Applying knowledge"
 *   [4.0, 5.0)  → "Analyzing and evaluating"
 *   5.0          → "Creating and teaching"
 */
export function scoreToGrowthLabel(score: number): string {
  if (score >= 5.0) return 'Creating and teaching';
  if (score >= 4.0) return 'Analyzing and evaluating';
  if (score >= 3.0) return 'Applying knowledge';
  if (score >= 2.0) return 'Deepening understanding';
  if (score >= 1.0) return 'Developing recall';
  return 'Building foundations';
}
