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
  scopeEvidenceResults
};
