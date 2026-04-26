# Implementation Plan: Evidence-Weighted Scoring

## Overview

Correct the evidence hierarchy in all Bedrock prompts, enrich learning completion data with type-aware counts, remove the whole-profile fallback, add on-the-fly embedding generation, and bump the cache version. All changes are in `lambda/capability/` and `lambda/learning/index.js`.

## Tasks

- [x] 1. Bump cache version in `cacheUtils.js`
  - [x] 1.1 Add `PROMPT_VERSION = 'v2'` constant and append it to the hash input in `computeEvidenceHash`
    - Modify `lambda/capability/cacheUtils.js`
    - Change hash input from `sorted.join(',') + ':' + learningCompletionCount` to `sorted.join(',') + ':' + learningCompletionCount + ':' + PROMPT_VERSION`
    - _Requirements: 3.1, 3.2_

  - [ ]* 1.2 Write property test: prompt version change invalidates cached hashes
    - **Property 4: Prompt version change invalidates all cached hashes**
    - Generate random state ID arrays and completion counts, assert hash with `'v2'` differs from hash without version
    - Add to `lambda/capability/cacheUtils.test.js`
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. Enrich `fetchLearningCompletionData` to return recognition vs open-form counts
  - [x] 2.1 Extend `fetchLearningCompletionData` in `lambda/capability/index.js`
    - Query knowledge states for each completed objective and classify as recognition or open-form
    - Add `recognitionCount` (number) and `openFormCompletions` (array of `{ questionType, score }`) to each axis result
    - Use existing `determineEvidenceTypeEnriched` from `capabilityUtils.js` or direct pattern matching on state text
    - _Requirements: 1.5_

  - [ ]* 2.2 Write property test: learning completion data classifies completions by type
    - **Property 3: Learning completion data classifies completions by type with scores**
    - Generate random knowledge state texts (recognition, open-form, other). Assert `recognitionCount` + `openFormCompletions.length` ≤ total completions and each open-form entry has `questionType` and `score`
    - Extract the classification logic into a pure testable function in `capabilityUtils.js` if needed
    - Add to `lambda/capability/capabilityUtils.test.js` (new file)
    - **Validates: Requirements 1.5**

- [x] 3. Update the per-axis prompt with corrected evidence hierarchy
  - [x] 3.1 Update EVIDENCE TYPE INTERPRETATION section in `callBedrockForPerAxisCapability`
    - Change recognition entry from "Demonstrates at minimum Bloom's level 1 (Remember)" to "engaged exposure — the learner selected from options, not independent recall. Score recognition-only axes in the 0.3–0.7 range."
    - All other evidence type entries remain unchanged
    - Modify `lambda/capability/index.js`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Update LEARNING COMPLETION section in `callBedrockForPerAxisCapability`
    - Replace "tests understanding (Bloom's level 2)" language with type-aware descriptions
    - Update `learningLines` format to include recognition count, open-form completions with question type and score
    - New format: `Axis "X" (key): N of M objectives completed (R recognition, F open-form [type, score:S]).`
    - _Requirements: 1.4, 1.5_

  - [ ]* 3.3 Write property test: recognition described as engaged exposure
    - **Property 1: Recognition evidence described as engaged exposure, not independent recall**
    - Generate random skill profiles and evidence maps. Assert prompt contains "engaged exposure" and does not contain old Bloom's level 1/2 language for recognition
    - Add to `lambda/capability/capabilityUtils.test.js`
    - **Validates: Requirements 1.1**

  - [ ]* 3.4 Write property test: learning completion section distinguishes types
    - **Property 2: Learning completion section distinguishes recognition from open-form**
    - Generate random learning completion data. Assert absence of "tests understanding (Bloom's level 2)" and presence of type-distinguishing descriptions
    - Add to `lambda/capability/capabilityUtils.test.js`
    - **Validates: Requirements 1.4**

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update the learning Lambda scorer prompt
  - [x] 5.1 Add EVIDENCE WEIGHTING section to `callBedrockForCapabilityLevels` in `lambda/learning/index.js`
    - Add after the SKILL LEVEL SCALE section: recognition = engaged exposure (0.3–0.7), open-form = learner-produced reasoning, observations = real-world demonstration
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 6. Remove whole-profile fallback and add on-the-fly embedding generation
  - [x] 6.1 Add `ensurePerAxisEmbeddings` function to `lambda/capability/index.js`
    - Import `composeAxisEmbeddingSource` and `composeAxisEntityId` from `lambda/skill-profile/axisUtils.js`
    - Queue SQS messages for each axis when `skill_axis` embeddings are missing
    - Poll `unified_embeddings` with short waits (reuse the retry pattern from `handleWholeProfileCapability`)
    - Return error if embeddings don't appear after retries
    - _Requirements: 2.3_

  - [x] 6.2 Remove `handleWholeProfileCapability` and `callBedrockForCapability` functions
    - Delete both functions from `lambda/capability/index.js`
    - _Requirements: 2.1, 2.4_

  - [x] 6.3 Update `handleIndividualCapability` to always use per-axis flow
    - Remove the `hasPerAxisEmbeddings` check and branching
    - Call `ensurePerAxisEmbeddings` when `skill_axis` embeddings are missing, then proceed with `handlePerAxisCapability`
    - _Requirements: 2.1, 2.2_

  - [ ]* 6.4 Write property test: evidence tag format preserved
    - **Property 5: Evidence tag format preserved for all evidence types**
    - Generate random evidence objects with valid question types and scores. Assert tag matches expected patterns via regex
    - Add to `lambda/capability/capabilityUtils.test.js`
    - **Validates: Requirements 4.2**

- [x] 7. Refactor `handleOrganizationCapability` to use per-axis flow
  - [x] 7.1 Replace whole-profile search with per-axis evidence retrieval
    - Check for `skill_axis` embeddings; call `ensurePerAxisEmbeddings` if missing
    - Run per-axis evidence retrieval (same pattern as `handlePerAxisCapability` but without user scoping)
    - Call `callBedrockForPerAxisCapability` instead of `callBedrockForCapability`
    - Fetch learning completion data for org-level (may need to adapt or skip user-scoped learning data)
    - _Requirements: 2.1, 2.2_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Deploy all Lambdas
  - [x] 9.1 Deploy capability Lambda
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh capability cwf-capability-lambda`
    - _Requirements: 3.1_

  - [x] 9.2 Deploy learning Lambda
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh learning cwf-learning-lambda`
    - _Requirements: 1.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate the 5 correctness properties from the design document
- No database schema changes — all modifications are prompt text and code paths
