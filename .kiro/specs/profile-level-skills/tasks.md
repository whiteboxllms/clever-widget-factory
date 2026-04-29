# Implementation Plan: Profile-Level Skills

## Overview

This plan implements profile-level skills — structured learning skills stored as state records that preserve the learner's original narrative, generate AI concept axes once at creation, track Bloom's progression across actions, and integrate into quiz generation as Profile_Skill_Lens context. Tasks are ordered: pure utility functions (Progression_Model + state text helpers) → backend API endpoints (skill-profile lambda) → quiz integration (learning lambda) → frontend components → page integration, to enable incremental testing at each layer.

## Tasks

- [ ] 1. Create Progression_Model pure function module
  - [ ] 1.1 Create `lambda/learning/progressionModel.js` with `computeBloomLevel` and `computeTaperingDecision`
    - Export `PROGRESSION_CONFIG` with all configurable parameters: `recencyHalfLifeDays` (14), `consistencyThreshold` (3), `consistencyTimeSpanDays` (21), `decayOnsetDays` (30), `decayRatePerDay` (0.05), `taperingMinLevel` (3), `taperingMinDemonstrations` (5), `taperingTimeSpanDays` (42), `taperingReinforcementProbability` (0.3)
    - Implement `computeBloomLevel(history, config)`: return 0 for empty history; apply recency weighting (half-life decay), compute weighted average, apply consistency bonus for sustained demonstrations, apply decay for insufficient recent reinforcement, clamp to [0, 5] integer
    - Implement `computeTaperingDecision(history, currentBloomLevel, config)`: return `{ shouldTaper, reinforcementProbability }`; tapering only when bloom_level >= taperingMinLevel AND >= taperingMinDemonstrations high-level events AND those events span >= taperingTimeSpanDays
    - No database dependencies — pure functions only
    - _Requirements: 3.3, 3.4, 3.5, 3.9, 3.10_

  - [ ]* 1.2 Write property test for `computeBloomLevel` — recency, consistency, and decay
    - **Property 4: Bloom level computation reflects recency, consistency, and decay**
    - Use fast-check to generate random progression histories; verify: (a) output always in [0, 5], (b) all-recent demonstrations at level N produce bloom_level >= N-1, (c) all-old demonstrations produce bloom_level < peak, (d) empty history returns 0
    - Add test to `lambda/learning/progressionModel.property.test.js`
    - **Validates: Requirements 3.3, 3.5**

  - [ ]* 1.3 Write property test for `computeTaperingDecision` — sustained mastery evidence
    - **Property 5: Tapering requires sustained mastery evidence**
    - Use fast-check to generate random histories; verify: tapering only when bloom_level >= taperingMinLevel AND >= taperingMinDemonstrations high-level events AND events span >= taperingTimeSpanDays; fewer events or short time span never triggers tapering
    - Add test to `lambda/learning/progressionModel.property.test.js`
    - **Validates: Requirements 3.9**

  - [ ]* 1.4 Write unit tests for `computeBloomLevel` and `computeTaperingDecision` edge cases
    - Test empty history returns bloom_level 0
    - Test single recent high demonstration returns appropriate level
    - Test bloom_level below taperingMinLevel returns shouldTaper=false
    - Test PROGRESSION_CONFIG has all required fields with valid ranges
    - Add test to `lambda/learning/progressionModel.test.js`
    - _Requirements: 3.3, 3.9, 3.10_

- [ ] 2. Create profile skill state text utility functions
  - [ ] 2.1 Add `composeProfileSkillStateText` and `parseProfileSkillStateText` to `lambda/skill-profile/index.js`
    - `composeProfileSkillStateText(profileSkillData, userId)`: returns `[profile_skill] user={userId} | {JSON.stringify(profileSkillData)}`
    - `parseProfileSkillStateText(stateText)`: parses the `[profile_skill] user={userId} | {json}` format, returns parsed object or null for non-matching strings
    - Follow the existing `composeLearningObjectiveStateText` / `parseLearningObjectiveStateText` pattern from `lambda/learning/index.js`
    - Export both functions for testing
    - _Requirements: 1.6, 3.7_

  - [ ]* 2.2 Write property test for profile skill state_text round trip
    - **Property 1: Profile skill state_text round trip**
    - Use fast-check to generate random userId (non-empty, no whitespace), original_narrative (non-empty), ai_interpretation (with fields or null), axes array (each with key, label, description, bloom_level in [0,5], progression_history), and active boolean; compose then parse and verify all fields match
    - Add test to `lambda/skill-profile/profileSkill.property.test.js`
    - **Validates: Requirements 1.2, 1.6, 3.7**

- [ ] 3. Checkpoint — Verify pure functions and utilities
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add profile skill API endpoints to Skill-Profile Lambda
  - [ ] 4.1 Add `GET /api/profile-skills` handler in `lambda/skill-profile/index.js`
    - Extract userId from authorizer context
    - Query states table joined with state_links: `WHERE sl.entity_type = 'profile_skill_owner' AND sl.entity_id = userId AND s.organization_id = organizationId AND s.state_text LIKE '[profile_skill]%'` ordered by `captured_at DESC`
    - Parse each state_text with `parseProfileSkillStateText`, attach state `id` and `captured_at`
    - Return array of parsed profile skill objects
    - _Requirements: 1.1, 1.7, 4.1, 4.4_

  - [ ] 4.2 Add `POST /api/profile-skills/generate` handler in `lambda/skill-profile/index.js`
    - Accept `{ narrative }` from request body, validate non-empty
    - Build a new Bedrock prompt for profile skill generation: extract concept_label, source_attribution, learning_direction, and 3-5 concept axes with key, label, description
    - Call Bedrock, parse response, validate structure
    - Retry once with stricter prompt if malformed (same pattern as existing `handleGenerate`)
    - Return `{ ai_interpretation, axes }` preview — nothing persisted
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ] 4.3 Add `POST /api/profile-skills/approve` handler in `lambda/skill-profile/index.js`
    - Accept `{ narrative, ai_interpretation, axes }` from request body
    - Extract userId from authorizer context
    - Build profile skill JSON: `original_narrative`, `ai_interpretation` (or null), `axes` (each with bloom_level: 0, progression_history: []), `active: true`, `created_at`
    - Compose state_text with `composeProfileSkillStateText`
    - INSERT into states table with `captured_by = userId`, `organization_id`
    - INSERT into state_links with `entity_type = 'profile_skill_owner'`, `entity_id = userId`
    - Queue embedding via SQS (entity_type: 'state', composed from narrative + concept label + axis labels)
    - Return created profile skill with state ID
    - _Requirements: 1.2, 1.3, 1.6, 1.8, 5.2_

  - [ ] 4.4 Add `PUT /api/profile-skills/:id/toggle` handler in `lambda/skill-profile/index.js`
    - Extract state ID from path
    - Fetch state, verify ownership via state_links (profile_skill_owner → userId)
    - Parse state_text, toggle `active` flag
    - Update state_text with toggled value
    - Return updated profile skill
    - _Requirements: 5.1, 5.3, 5.4_

  - [ ] 4.5 Add `DELETE /api/profile-skills/:id` handler in `lambda/skill-profile/index.js`
    - Extract state ID from path
    - Verify ownership via state_links
    - DELETE from states (CASCADE handles state_links)
    - DELETE from unified_embeddings where entity_type = 'state' and entity_id = stateId
    - Return `{ deleted: true }`
    - _Requirements: 6.2_

  - [ ] 4.6 Wire new routes in the lambda handler's routing logic
    - Add route matching for `GET /api/profile-skills`, `POST /api/profile-skills/generate`, `POST /api/profile-skills/approve`, `PUT /api/profile-skills/:id/toggle`, `DELETE /api/profile-skills/:id`
    - Ensure no conflicts with existing `/api/skill-profiles/*` routes
    - _Requirements: 1.1_

- [ ] 5. Checkpoint — Verify profile skill API endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add quiz generation integration in Learning Lambda
  - [ ] 6.1 Add `fetchActiveProfileSkills` helper in `lambda/learning/index.js`
    - Query states joined with state_links: `WHERE sl.entity_type = 'profile_skill_owner' AND sl.entity_id = userId AND s.state_text LIKE '[profile_skill]%'`
    - Parse each state_text, filter for `active === true`
    - Return array of parsed active profile skills
    - _Requirements: 2.1, 5.3_

  - [ ] 6.2 Add `buildProfileSkillPromptBlock` function in `lambda/learning/index.js`
    - Accept array of active profile skills
    - Return empty string for empty array
    - Build structured prompt section: for each skill include concept_label, original_narrative (truncated to 300 chars), source_attribution, learning_direction, and axes with labels, descriptions, and current bloom_levels
    - Include instruction to frame questions at depth appropriate to learner's current Bloom's level per axis
    - _Requirements: 2.2, 2.3, 2.6, 2.7_

  - [ ]* 6.3 Write property test for `buildProfileSkillPromptBlock` — completeness
    - **Property 2: Profile_Skill_Lens prompt block completeness**
    - Use fast-check to generate arrays of profile skills; verify output contains each skill's concept_label, narrative prefix, each axis label, and bloom_level; empty array returns empty string
    - Add test to `lambda/learning/profileSkillLens.property.test.js`
    - **Validates: Requirements 2.2, 2.6, 2.4**

  - [ ] 6.4 Integrate profile skill context into `handleQuizGenerate`
    - After existing lens selection and before calling `generateQuizViaBedrock` / `generateOpenFormQuizViaBedrock`
    - Call `fetchActiveProfileSkills(db, userIdSafe, orgIdSafe)`
    - Import `computeTaperingDecision` from `./progressionModel.js`
    - Filter profile skills: include skill if at least one axis is not fully tapered (or passes reinforcement probability check)
    - Call `buildProfileSkillPromptBlock(activeProfileSkills)` to build the context block
    - Pass `profileSkillBlock` to quiz generation functions alongside existing `lensBlock` and `assetBlock`
    - _Requirements: 2.1, 2.3, 2.5, 2.7, 2.8, 3.9_

  - [ ] 6.5 Update `generateQuizViaBedrock` and `generateOpenFormQuizViaBedrock` to accept and include `profileSkillBlock`
    - Add `profileSkillBlock` parameter to both functions
    - Insert the profile skill block as a separate section in the Bedrock prompt, after the lens block
    - When `profileSkillBlock` is empty, prompt is unchanged (existing behavior preserved)
    - _Requirements: 2.3, 2.4, 2.7_

- [ ] 7. Checkpoint — Verify quiz generation integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add progression update after quiz evaluation in Learning Lambda
  - [ ] 8.1 Add `updateProfileSkillProgression` function in `lambda/learning/index.js`
    - Accept `db, userId, organizationId, actionId, knowledgeStateId, demonstratedLevel`
    - Fetch active profile skills for the user (reuse `fetchActiveProfileSkills` query pattern)
    - For each active profile skill: create progression event `{ demonstrated_level, action_id, state_id, timestamp }`
    - Append event to each axis's `progression_history`
    - Recompute each axis's `bloom_level` via `computeBloomLevel` from `./progressionModel.js`
    - Update the state record with the new serialized JSON
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8, 3.11_

  - [ ] 8.2 Call `updateProfileSkillProgression` from `handleEvaluate` after successful evaluation
    - After evaluation is stored and before returning 202
    - Extract `demonstratedLevel` from evaluation result (use `scoreToBloomLevel` as fallback)
    - Extract userId from the state's linked learning objective or request body
    - Call `updateProfileSkillProgression` wrapped in try/catch — log errors but don't fail the evaluation
    - _Requirements: 3.1, 3.6_

  - [ ]* 8.3 Write property test for progression update independence across skills
    - **Property 3: Progression update independence across skills**
    - Use fast-check to generate sets of profile skills with axes; simulate appending progression events; verify each skill's axes get exactly one new event and events on one skill don't affect another
    - Add test to `lambda/learning/profileSkillProgression.property.test.js`
    - **Validates: Requirements 3.1, 3.8**

- [ ] 9. Checkpoint — Verify progression update integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Create frontend hooks for profile skills
  - [ ] 10.1 Create `src/hooks/useProfileSkills.ts` with TanStack Query hooks
    - `useProfileSkills(userId)`: GET `/profile-skills`, returns array of profile skills, enabled when userId is truthy
    - `useGenerateProfileSkill()`: POST `/profile-skills/generate` mutation
    - `useApproveProfileSkill()`: POST `/profile-skills/approve` mutation, invalidates profile skills query on success
    - `useToggleProfileSkill()`: PUT `/profile-skills/:id/toggle` mutation with optimistic toggle of `active` status in cache
    - `useDeleteProfileSkill()`: DELETE `/profile-skills/:id` mutation with optimistic removal from cache
    - Add `profileSkillsQueryKey` to `src/lib/queryKeys.ts`
    - Follow the pattern of existing `useSkillProfile.ts` hooks
    - _Requirements: 1.1, 5.1, 5.3, 6.2_

  - [ ]* 10.2 Write property test for active status filtering
    - **Property 6: Active status filtering**
    - Use fast-check to generate arrays of profile skills with mixed active/inactive; verify filtering returns exactly those with active === true; toggling and re-filtering includes/excludes correctly while preserving all other fields
    - Add test to `src/hooks/__tests__/useProfileSkills.property.test.ts`
    - **Validates: Requirements 5.3, 5.4**

- [ ] 11. Create ProfileSkillsSection component and subcomponents
  - [ ] 11.1 Create `src/components/ProfileSkillsSection.tsx` with ProfileSkillCard and CreateProfileSkillDialog
    - Accept `userId` and `organizationId` props
    - Use `useProfileSkills(userId)` hook to fetch profile skills
    - Render list of ProfileSkillCards, each showing: original_narrative (prominent), AI interpretation (concept_label, source_attribution, learning_direction), axes with bloom level indicators
    - "Create Profile Skill" button opens CreateProfileSkillDialog with textarea for narrative
    - CreateProfileSkillDialog: on submit calls generate endpoint for preview, then approve to store
    - Each ProfileSkillCard has toggle switch for active/inactive and delete button with confirmation
    - Handle loading, empty, and error states
    - _Requirements: 1.1, 1.2, 1.7, 4.4, 5.1_

  - [ ] 11.2 Create ProfileAxisDisplay subcomponent for bloom level visualization
    - Render axis label, description, and current bloom_level as visual indicator (level label or progress bar)
    - When `bloom_level === 0`: display "Not yet demonstrated"
    - When axis has `progression_history` entries: display most recent demonstration date (max timestamp)
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 11.3 Write property test for most recent demonstration date extraction
    - **Property 7: Most recent demonstration date extraction**
    - Use fast-check to generate axes with random progression_history arrays; verify most recent date equals max timestamp; empty history returns null
    - Add test to `src/components/__tests__/ProfileAxisDisplay.property.test.ts`
    - **Validates: Requirements 4.3**

  - [ ]* 11.4 Write unit tests for ProfileSkillsSection and subcomponents
    - Test ProfileSkillsSection renders on profile settings page
    - Test ProfileSkillCard displays original narrative prominently
    - Test ProfileSkillCard displays axes with bloom level indicators
    - Test axis with bloom_level 0 shows "Not yet demonstrated"
    - Test axis with progression_history shows most recent date
    - Test create dialog calls generate then approve endpoints
    - Test toggle switch calls toggle endpoint and updates UI
    - Test delete button with confirmation calls delete endpoint
    - Test profile skill with null ai_interpretation renders with narrative only and retry button
    - Test new profile skill defaults to active=true
    - _Requirements: 1.1, 1.7, 1.8, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.2_

- [ ] 12. Replace ProfileIntentsSection with ProfileSkillsSection on profile settings page
  - [ ] 12.1 Update `src/pages/Organization.tsx` to render ProfileSkillsSection
    - Replace `import { ProfileIntentsSection }` with `import { ProfileSkillsSection }`
    - Replace `<ProfileIntentsSection userId={user.userId} organizationId={targetOrganization.id} />` with `<ProfileSkillsSection userId={user.userId} organizationId={targetOrganization.id} />`
    - _Requirements: 1.1, 4.4_

- [ ] 13. Checkpoint — Verify all frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Deploy all changes
  - [ ] 14.1 Deploy modified Lambdas using `deploy-lambda-with-layer.sh`
    - Deploy `lambda/skill-profile` → `cwf-skill-profile-lambda`
    - Deploy `lambda/learning` → `cwf-learning-lambda`
    - _Requirements: all_

  - [ ] 14.2 Add API Gateway routes for profile skill endpoints
    - `GET /api/profile-skills` → `cwf-skill-profile-lambda`
    - `POST /api/profile-skills/generate` → `cwf-skill-profile-lambda`
    - `POST /api/profile-skills/approve` → `cwf-skill-profile-lambda`
    - `PUT /api/profile-skills/{id}/toggle` → `cwf-skill-profile-lambda`
    - `DELETE /api/profile-skills/{id}` → `cwf-skill-profile-lambda`
    - Deploy API Gateway changes
    - _Requirements: 1.1_

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Progression_Model (`lambda/learning/progressionModel.js`) is a pure function module with no database dependencies — fully testable in isolation
- Profile skills are stored in the existing `states` table with `[profile_skill]` prefix — no new database tables or migrations needed
- `state_links` with `entity_type = 'profile_skill_owner'` enables efficient per-user queries
- Profile skill endpoints are added to the existing `lambda/skill-profile/index.js` — no new Lambda function
- Quiz integration is additive: when no active profile skills exist, quiz generation is completely unchanged
- `fast-check` is already in `lambda/learning/package.json` devDependencies; add to `lambda/skill-profile/package.json` for property tests there
- Property tests validate the seven correctness properties from the design document
- Profile skills are immutable after creation (Req 6.1) — no edit endpoints exist by design
