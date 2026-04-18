# Implementation Plan: Capability Profile Caching

## Overview

Add a caching layer to the capability assessment system by storing computed profiles as states in the existing `states` table. Implementation proceeds in layers: pure utility functions first (testable without infrastructure), then Capability Lambda cache-first read path, then Skill-Profile Lambda cache invalidation, then Learning Lambda per-axis similarity optimization, then knowledge state embedding enrichment, and finally deployment wiring.

## Tasks

- [x] 1. Create `cacheUtils.js` — pure cache utility functions
  - [x] 1.1 Create `lambda/capability/cacheUtils.js` with state text composition and parsing
    - Implement `composeCapabilityProfileStateText(actionId, userId, evidenceHash, profile)` — composes `[capability_profile] action=<actionId> user=<userId> hash=<hash> computed_at=<ISO8601> | <profileJSON>` format
    - Implement `parseCapabilityProfileStateText(stateText)` — parses state text back to `{ actionId, userId, evidenceHash, computedAt, profile }`; returns `null` if format doesn't match
    - Implement `computeEvidenceHash(evidenceStateIds, learningCompletionCount)` — computes SHA-256 hash from sorted state IDs + completion count, truncated to 16 hex chars
    - Implement `determineCacheAction(cachedState, currentHash)` — returns `'hit'`, `'stale'`, or `'miss'` based on cached state and current evidence hash
    - Export all functions via `module.exports`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.5_

  - [ ]* 1.2 Write unit tests for `cacheUtils.js`
    - Create `lambda/capability/cacheUtils.test.js`
    - Test `composeCapabilityProfileStateText` produces correct format with `[capability_profile]` prefix
    - Test `parseCapabilityProfileStateText` round-trips with compose; returns `null` for non-matching text
    - Test `computeEvidenceHash` is deterministic (same inputs → same hash), order-independent (sorted internally), and returns 16 hex chars
    - Test `determineCacheAction` returns `'hit'` when hashes match, `'stale'` when they differ, `'miss'` when cachedState is null
    - _Requirements: 1.1, 2.1, 2.5_

- [x] 2. Create `objectiveMatchUtils.js` — per-axis match distribution functions
  - [x] 2.1 Create `lambda/learning/objectiveMatchUtils.js` with match distribution and embedding source composition
    - Implement `distributeMatchesToObjectives(axisMatches, objectives)` — distributes per-axis similarity matches to individual objectives by text overlap scoring; returns `Map<objectiveId, Array<{ similarity, embedding_source }>>`
    - Implement `composeAxisAwareEmbeddingSource(axisLabel, stateText)` — prepends axis label to state text for improved axis-level matching (e.g., `"Cement Work: For learning objective 'Understand mixing ratios'..."`)
    - Export all functions via `module.exports`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.2 Write unit tests for `objectiveMatchUtils.js`
    - Create `lambda/learning/objectiveMatchUtils.test.js`
    - Test `distributeMatchesToObjectives` assigns matches to the most relevant objective based on text overlap
    - Test `distributeMatchesToObjectives` handles empty matches and empty objectives gracefully
    - Test `composeAxisAwareEmbeddingSource` prepends axis label correctly
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Checkpoint — Ensure all utility function tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement cache-first read path in Capability Lambda
  - [x] 4.1 Add evidence hash computation queries to `lambda/capability/index.js`
    - Implement `fetchEvidenceStateIds(db, userId, orgId)` — queries `states` table for state IDs captured by the user, excluding `[capability_profile]` and `[learning_objective]` prefixed states, ordered by ID
    - Implement `fetchLearningCompletionCount(db, actionId, userId, orgId)` — counts completed learning objectives (states with "which was the correct answer" linked to learning objectives for the action)
    - Both functions use lightweight SQL queries (no vector searches)
    - _Requirements: 2.5_

  - [x] 4.2 Add cache lookup and store functions to `lambda/capability/index.js`
    - Implement `lookupCachedProfile(db, actionId, userId, orgId)` — queries `states` + `state_links` for existing `[capability_profile]` state matching `captured_by = userId` and `entity_type = 'capability_profile'`, `entity_id = actionId`
    - Implement `storeCachedProfile(db, actionId, userId, orgId, stateText)` — INSERTs new state + state_link with `entity_type = 'capability_profile'`
    - Implement `updateCachedProfile(db, existingStateId, stateText)` — UPDATEs existing state's `state_text` and `updated_at`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 4.3 Integrate cache-first logic into `handleIndividualCapability` in `lambda/capability/index.js`
    - At the top of the function (after fetching skill profile), call `lookupCachedProfile` to check for cached state
    - Compute current evidence hash via `fetchEvidenceStateIds` + `fetchLearningCompletionCount` + `computeEvidenceHash`
    - Use `determineCacheAction` to decide: `'hit'` → parse and return cached profile immediately; `'stale'` → recompute via Bedrock, update existing state, return fresh result; `'miss'` → compute via Bedrock (existing flow), store as new state, return result
    - Import `composeCapabilityProfileStateText`, `parseCapabilityProfileStateText`, `computeEvidenceHash`, `determineCacheAction` from `./cacheUtils`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3_

  - [x] 4.4 Integrate cache-first logic into `handleOrganizationCapability` in `lambda/capability/index.js`
    - Same cache-first pattern as individual profiles
    - Use `captured_by = 'organization'` sentinel value for the organization profile state
    - For evidence hash: use all states in the organization (no user filter) and sum learning completions across all users
    - Link to action via `state_links` with `entity_type = 'capability_profile'`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.5 Write unit tests for cache-first read path
    - Create or extend `lambda/capability/index.test.js`
    - Test cache hit path: returns cached profile without Bedrock call
    - Test stale cache path: recomputes and updates existing state
    - Test cache miss path: computes and stores new state
    - Test organization profile uses `'organization'` sentinel for `captured_by`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2_

- [x] 5. Checkpoint — Ensure Capability Lambda tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement cache invalidation in Skill-Profile Lambda
  - [x] 6.1 Add capability profile cache deletion to `handleDelete` in `lambda/skill-profile/index.js`
    - After setting `skill_profile = NULL` on the action, query `state_links` for all states with `entity_type = 'capability_profile'` and `entity_id = actionId`
    - DELETE those states from `states` table (CASCADE handles `state_links` cleanup)
    - DELETE corresponding entries from `unified_embeddings` where `entity_type = 'state'` and `entity_id` matches the deleted state IDs
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 6.2 Add capability profile cache deletion to `handleApprove` in `lambda/skill-profile/index.js`
    - Before storing the new approved profile, delete any existing `capability_profile` states linked to the action (same logic as handleDelete)
    - This ensures the next capability read triggers a fresh computation against the new axes
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 6.3 Write unit tests for cache invalidation
    - Create or extend `lambda/skill-profile/index.test.js`
    - Test `handleDelete` removes capability_profile states and their embeddings
    - Test `handleApprove` removes existing capability_profile states before storing new profile
    - Test organization profile states are also invalidated alongside individual profiles
    - _Requirements: 3.1, 3.2, 3.3, 4.4_

- [x] 7. Checkpoint — Ensure Skill-Profile Lambda tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Optimize Learning Lambda — per-axis similarity search
  - [x] 8.1 Replace per-objective similarity queries with per-axis queries in `handleGetObjectives` in `lambda/learning/index.js`
    - Instead of running one vector similarity query per `objectiveId` (current loop at step 8 in `handleGetObjectives`), run one query per axis using the existing `skill_axis` embedding (`entity_type='skill_axis'` in `unified_embeddings`)
    - For each axis, query: `SELECT ... FROM unified_embeddings WHERE entity_type='skill_axis' AND entity_id = '<actionId>:<axisKey>' ... ORDER BY similarity DESC LIMIT 10`
    - Use `distributeMatchesToObjectives` from `objectiveMatchUtils.js` to assign per-axis matches to individual objectives by text comparison
    - Fall back to per-objective queries if no `skill_axis` embeddings exist for the action (backward compatibility)
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ]* 8.2 Write unit tests for per-axis similarity optimization
    - Test that per-axis query count is proportional to number of axes (4-6), not objectives (15-25)
    - Test fallback to per-objective queries when no skill_axis embeddings exist
    - Test `distributeMatchesToObjectives` correctly assigns matches to objectives
    - _Requirements: 6.1, 6.4_

- [x] 9. Enrich knowledge state embedding source with axis labels
  - [x] 9.1 Update knowledge state embedding source in `handleQuizGenerate` and quiz answer storage in `lambda/learning/index.js`
    - When knowledge states are saved (quiz answers, open-form responses), use `composeAxisAwareEmbeddingSource(axisLabel, stateText)` to prepend the axis label to the embedding source before queuing via SQS
    - Import `composeAxisAwareEmbeddingSource` from `./objectiveMatchUtils`
    - This improves axis-level matching for the per-axis similarity search
    - _Requirements: 6.3_

  - [ ]* 9.2 Write unit tests for axis-aware embedding source
    - Test that embedding source includes axis label prefix
    - Test that the original state text is preserved after the axis label
    - _Requirements: 6.3_

- [x] 10. Checkpoint — Ensure all Lambda tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Deploy Lambda changes and API Gateway
  - [x] 11.1 Deploy updated `cwf-capability-lambda`
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh capability cwf-capability-lambda`
    - Verify the Lambda deploys successfully with the cache-first read path
    - _Requirements: 2.1, 4.1_

  - [x] 11.2 Deploy updated `cwf-skill-profile-lambda`
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh skill-profile cwf-skill-profile-lambda`
    - Verify the Lambda deploys successfully with the cache invalidation logic
    - _Requirements: 3.1, 3.2_

  - [x] 11.3 Deploy updated `cwf-learning-lambda`
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh learning cwf-learning-lambda`
    - Verify the Lambda deploys successfully with the per-axis similarity optimization and axis-aware embedding source
    - _Requirements: 6.1, 6.3_

  - [x] 11.4 Deploy API Gateway changes
    - No new endpoints are needed — all changes are within existing Lambda handlers
    - Run `aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2` to deploy any gateway changes
    - _Requirements: 5.1, 5.3_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No new database tables or columns are needed — all data uses the existing `states`, `state_links`, and `unified_embeddings` tables
- Pure utility functions (tasks 1–2) are implemented first because they are testable without infrastructure and form the foundation for Lambda work
- The frontend requires no changes — the same `GET /api/capability/:actionId/:userId` endpoint is called, but it now returns faster when cached (Requirement 5.3)
- Lambda functions use JavaScript (existing pattern)
- The `[capability_profile]` prefix follows the same convention as `[learning_objective]` and other state text prefixes
- Cache invalidation cascades through `state_links` and `unified_embeddings` following existing cleanup patterns
- The per-axis similarity optimization in the Learning Lambda reduces queries from O(objectives) to O(axes), typically from 15-25 down to 4-6
