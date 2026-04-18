/**
 * Property-based tests for capability Lambda functions.
 * Uses Vitest + fast-check.
 *
 * Properties tested:
 *   Property 3 – Evidence search scoped to user and organization
 *
 * Also tests:
 *   determineEvidenceType – quiz vs observation classification
 */

const fc = require('fast-check');
const { determineEvidenceType, scopeEvidenceResults } = require('./capabilityUtils');

// ── Shared arbitraries ──────────────────────────────────────────────

const arbUserId = fc.uuid();
const arbOrgId = fc.uuid();
const arbStateText = fc.string({ minLength: 1, maxLength: 200 });

// ── Property 3: Evidence search scoped to user and organization ─────
// **Validates: Requirements 1.5, 2.6, 3.5**

describe('Property 3: Evidence search scoped to user and organization', () => {
  it('all returned results have organization_id matching the target org', () => {
    fc.assert(
      fc.property(
        arbUserId,
        arbOrgId,
        fc.array(arbUserId, { minLength: 1, maxLength: 5 }),
        fc.array(arbOrgId, { minLength: 1, maxLength: 5 }),
        fc.array(
          fc.record({
            isTargetUser: fc.boolean(),
            isTargetOrg: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (targetUserId, targetOrgId, otherUserIds, otherOrgIds, configs) => {
          const results = configs.map((config, i) => ({
            captured_by: config.isTargetUser
              ? targetUserId
              : otherUserIds[i % otherUserIds.length],
            organization_id: config.isTargetOrg
              ? targetOrgId
              : otherOrgIds[i % otherOrgIds.length]
          }));

          const scoped = scopeEvidenceResults(results, targetUserId, targetOrgId);
          return scoped.every((r) => r.organization_id === targetOrgId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all returned results have captured_by matching the target user', () => {
    fc.assert(
      fc.property(
        arbUserId,
        arbOrgId,
        fc.array(arbUserId, { minLength: 1, maxLength: 5 }),
        fc.array(arbOrgId, { minLength: 1, maxLength: 5 }),
        fc.array(
          fc.record({
            isTargetUser: fc.boolean(),
            isTargetOrg: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (targetUserId, targetOrgId, otherUserIds, otherOrgIds, configs) => {
          const results = configs.map((config, i) => ({
            captured_by: config.isTargetUser
              ? targetUserId
              : otherUserIds[i % otherUserIds.length],
            organization_id: config.isTargetOrg
              ? targetOrgId
              : otherOrgIds[i % otherOrgIds.length]
          }));

          const scoped = scopeEvidenceResults(results, targetUserId, targetOrgId);
          return scoped.every((r) => r.captured_by === targetUserId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no results from other orgs or users appear', () => {
    fc.assert(
      fc.property(
        arbUserId,
        arbOrgId,
        fc.array(arbUserId, { minLength: 1, maxLength: 5 }),
        fc.array(arbOrgId, { minLength: 1, maxLength: 5 }),
        fc.array(
          fc.record({
            isTargetUser: fc.boolean(),
            isTargetOrg: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (targetUserId, targetOrgId, otherUserIds, otherOrgIds, configs) => {
          const results = configs.map((config, i) => ({
            captured_by: config.isTargetUser
              ? targetUserId
              : otherUserIds[i % otherUserIds.length],
            organization_id: config.isTargetOrg
              ? targetOrgId
              : otherOrgIds[i % otherOrgIds.length]
          }));

          const scoped = scopeEvidenceResults(results, targetUserId, targetOrgId);

          // No result should have a different user or different org
          return scoped.every(
            (r) =>
              r.captured_by === targetUserId &&
              r.organization_id === targetOrgId
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the count matches the expected number of matching results', () => {
    fc.assert(
      fc.property(
        arbUserId,
        arbOrgId,
        fc.array(arbUserId, { minLength: 1, maxLength: 5 }),
        fc.array(arbOrgId, { minLength: 1, maxLength: 5 }),
        fc.array(
          fc.record({
            isTargetUser: fc.boolean(),
            isTargetOrg: fc.boolean()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (targetUserId, targetOrgId, otherUserIds, otherOrgIds, configs) => {
          const results = configs.map((config, i) => ({
            captured_by: config.isTargetUser
              ? targetUserId
              : otherUserIds[i % otherUserIds.length],
            organization_id: config.isTargetOrg
              ? targetOrgId
              : otherOrgIds[i % otherOrgIds.length]
          }));

          const scoped = scopeEvidenceResults(results, targetUserId, targetOrgId);

          const expectedCount = configs.filter(
            (c) => c.isTargetUser && c.isTargetOrg
          ).length;

          return scoped.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array when no results match the target user and org', () => {
    fc.assert(
      fc.property(
        arbUserId,
        arbOrgId,
        fc.array(
          fc.record({
            captured_by: arbUserId,
            organization_id: arbOrgId
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (targetUserId, targetOrgId, results) => {
          // Ensure none of the results match both target user and org
          const nonMatching = results.map((r) => ({
            captured_by: r.captured_by === targetUserId
              ? r.captured_by + '-other'
              : r.captured_by,
            organization_id: r.organization_id
          }));

          const scoped = scopeEvidenceResults(nonMatching, targetUserId, targetOrgId);
          return scoped.length === 0 ||
            scoped.every(
              (r) =>
                r.captured_by === targetUserId &&
                r.organization_id === targetOrgId
            );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── determineEvidenceType tests ─────────────────────────────────────

describe('determineEvidenceType', () => {
  it('returns "quiz" for state texts containing "which was the correct answer"', () => {
    fc.assert(
      fc.property(
        arbStateText,
        (prefix) => {
          const stateText = prefix + ' which was the correct answer';
          return determineEvidenceType(stateText) === 'quiz';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "observation" for all other texts', () => {
    fc.assert(
      fc.property(
        arbStateText.filter(
          (s) => !s.toLowerCase().includes('which was the correct answer')
        ),
        (stateText) => {
          return determineEvidenceType(stateText) === 'observation';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is case-insensitive for the correct answer marker', () => {
    fc.assert(
      fc.property(
        arbStateText,
        fc.constantFrom(
          'which was the correct answer',
          'Which Was The Correct Answer',
          'WHICH WAS THE CORRECT ANSWER',
          'Which was the Correct Answer'
        ),
        (prefix, marker) => {
          const stateText = prefix + ' ' + marker;
          return determineEvidenceType(stateText) === 'quiz';
        }
      ),
      { numRuns: 100 }
    );
  });
});
