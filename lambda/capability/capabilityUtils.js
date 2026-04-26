/**
 * Pure utility functions for capability assessment.
 * Extracted for testability — no Lambda layer dependencies.
 */

/**
 * Determine evidence type from state text.
 * Quiz completions contain "which was the correct answer" — evidence_type = "quiz".
 * Everything else is an observation — evidence_type = "observation".
 *
 * @param {string} stateText
 * @returns {'quiz' | 'observation'}
 */
function determineEvidenceType(stateText) {
  if (stateText && stateText.toLowerCase().includes('which was the correct answer')) {
    return 'quiz';
  }
  return 'observation';
}

/**
 * Valid open-form question types in Bloom's progression order.
 * @type {Set<string>}
 */
const OPEN_FORM_QUESTION_TYPES = new Set([
  'bridging',
  'self_explanation',
  'application',
  'analysis',
  'synthesis',
]);

/**
 * Enriched evidence type detection for open-form responses.
 *
 * Classifies state text into one of three categories:
 *   1. Recognition quiz — text contains "which was the correct answer"
 *   2. Open-form quiz — text matches the open-form state text format
 *      "For learning objective '...' and {question_type} question '...', I responded: '...'. Ideal answer: '...'. Evaluation: ..."
 *   3. Observation — everything else
 *
 * @param {string} stateText
 * @returns {{
 *   type: 'quiz' | 'observation',
 *   questionType: 'recognition' | 'bridging' | 'self_explanation' | 'application' | 'analysis' | 'synthesis' | null,
 *   continuousScore: number | null,
 *   evaluationStatus: 'pending' | 'sufficient' | 'insufficient' | 'error' | null
 * }}
 */
function determineEvidenceTypeEnriched(stateText) {
  // 1. Recognition pattern (existing quiz format)
  if (stateText && stateText.toLowerCase().includes('which was the correct answer')) {
    return {
      type: 'quiz',
      questionType: 'recognition',
      continuousScore: null,
      evaluationStatus: null,
    };
  }

  // 2. Open-form pattern
  if (stateText) {
    const openFormPattern =
      /^For learning objective '.+?' and (\S+) question '.+?', I responded: '.+?'\. Ideal answer: '.+?'\. Evaluation: (.+)$/s;
    const match = stateText.match(openFormPattern);

    if (match) {
      const questionType = match[1];
      const evaluationPart = match[2];

      // Only accept known open-form question types
      if (OPEN_FORM_QUESTION_TYPES.has(questionType)) {
        // Parse evaluation status and score
        if (evaluationPart === 'pending.') {
          return {
            type: 'quiz',
            questionType,
            continuousScore: null,
            evaluationStatus: 'pending',
          };
        }

        if (evaluationPart === 'error.') {
          return {
            type: 'quiz',
            questionType,
            continuousScore: null,
            evaluationStatus: 'error',
          };
        }

        // Match: sufficient (score: 2.4). Reasoning text.
        // or:   insufficient (score: 1.2). Reasoning text.
        const evalPattern = /^(sufficient|insufficient) \(score: ([\d.]+)\)\. .+\.$/s;
        const evalMatch = evaluationPart.match(evalPattern);
        if (evalMatch) {
          return {
            type: 'quiz',
            questionType,
            continuousScore: parseFloat(evalMatch[2]),
            evaluationStatus: evalMatch[1],
          };
        }

        // Open-form format matched but evaluation portion is unrecognized —
        // still classify as quiz with the detected question type
        return {
          type: 'quiz',
          questionType,
          continuousScore: null,
          evaluationStatus: null,
        };
      }
    }
  }

  // 3. Everything else is an observation
  return {
    type: 'observation',
    questionType: null,
    continuousScore: null,
    evaluationStatus: null,
  };
}

/**
 * Scope evidence results to only those matching the target user and organization.
 * This is the pure-function equivalent of the SQL WHERE clauses:
 *   WHERE organization_id = :org_id AND captured_by = :user_id
 *
 * @param {Array<{ captured_by: string, organization_id: string }>} results
 * @param {string} targetUserId
 * @param {string} targetOrgId
 * @returns {Array<{ captured_by: string, organization_id: string }>}
 */
function scopeEvidenceResults(results, targetUserId, targetOrgId) {
  return results.filter(
    (r) => r.captured_by === targetUserId && r.organization_id === targetOrgId
  );
}

module.exports = {
  determineEvidenceType,
  determineEvidenceTypeEnriched,
  scopeEvidenceResults
};
