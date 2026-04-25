# Implementation Plan: Self-Directed Learning

## Overview

This plan implements the self-directed learning feature — growth intent input, concept-axis skill profile generation, teach-apply question format with learn-more links, concept-aware evaluation, structured Bloom's feedback display, and profile intent management. Tasks are ordered: database migration → shared utilities → backend Lambdas (skill-profile → learning → core) → frontend components → page integration → deployment, to enable incremental testing at each layer.

## Tasks

- [x] 1. Run database migration to add `settings` column to `organization_members`
  - Run via the `cwf-db-migration` Lambda: `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';`
  - Verify column exists with a SELECT query
  - _Requirements: 4.1, 4.2_

- [ ] 2. Create shared utility functions in the Lambda layer
  - [x] 2.1 Create `lambda/shared/bloomUtils.js` with `scoreToBloomLevel`, `bloomLevelLabel`, and `buildLearnMoreUrl`
    - `scoreToBloomLevel(score)`: maps continuous 0.0–5.0 score to integer 1–5 per defined ranges (0.0–0.9 → 1, 1.0–1.9 → 2, 2.0–2.9 → 3, 3.0–3.9 → 4, 4.0–5.0 → 5)
    - `bloomLevelLabel(level)`: maps integer 1–5 to human-readable label (Remember, Understand, Apply, Analyze, Create)
    - `buildLearnMoreUrl(conceptName, conceptAuthor)`: constructs Google search URL `https://www.google.com/search?q=` with URL-encoded concept name and optional author
    - Export all functions via `module.exports`
    - _Requirements: 6.8, 3.4_

  - [ ]* 2.2 Write property test for `scoreToBloomLevel` — score-to-level mapping
    - **Property 1: Score-to-demonstrated-level mapping**
    - Use fast-check to generate random scores in [0.0, 5.0], verify correct Bloom's level per defined ranges, result always integer in [1, 5]
    - **Validates: Requirements 6.8**

  - [ ]* 2.3 Write property test for `buildLearnMoreUrl` — URL construction
    - **Property 4: Learn-more URL construction**
    - Use fast-check to generate random concept names and optional authors (including special characters, spaces, Unicode), verify URL is valid, contains encoded query, and has no unescaped spaces
    - **Validates: Requirements 3.4**

- [x] 3. Checkpoint — Verify shared utilities
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Update Skill Profile Lambda for growth intent prompt path
  - [x] 4.1 Update `handleGenerate` in `lambda/skill-profile/index.js` to accept `growth_intent` from request body
    - Extract optional `growth_intent` field from the request body
    - Pass `growth_intent` to `buildSkillProfilePrompt`
    - _Requirements: 1.4, 2.1_

  - [x] 4.2 Add conditional growth-intent prompt path to `buildSkillProfilePrompt`
    - Extend signature: `buildSkillProfilePrompt(ctx, strict, aiConfig, growthIntent)`
    - When `growthIntent` is a non-empty string: switch to concept-axis generation prompt — frame action as "practice ground", instruct AI to generate axes shaped by growth intent using real frameworks/research, each axis a distinct concept area
    - When `growthIntent` is empty/null/undefined: use existing action-driven prompt unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Update `handleApprove` to store `growth_intent` and `growth_intent_provided` in skill profile JSONB
    - Accept `growth_intent` from request body
    - Store `growth_intent` (string or null) and `growth_intent_provided` (boolean) in the approved profile JSONB
    - _Requirements: 1.5, 1.6_

  - [ ]* 4.4 Write property test for skill profile prompt construction
    - **Property 3: Skill profile prompt construction**
    - Use fast-check to generate random action contexts and optional growth intents, verify prompt contains/excludes growth intent instructions correctly
    - **Validates: Requirements 2.1, 2.2, 2.6**

  - [ ]* 4.5 Write property test for growth intent storage round-trip
    - **Property 2: Growth intent storage round-trip**
    - Use fast-check to generate random growth intent strings (including empty, whitespace-only, Unicode), verify round-trip preserves string and `growth_intent_provided` flag is correct
    - **Validates: Requirements 1.5, 1.6, 4.5**

- [x] 5. Checkpoint — Verify Skill Profile Lambda changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update Learning Lambda for teach-apply questions and concept-aware evaluation
  - [x] 6.1 Update `handleQuizGenerate` to read `growth_intent` from skill profile JSONB and pass to quiz generation
    - Read `growth_intent` from the action's `skill_profile` JSONB
    - Pass `growthIntent` to `generateOpenFormQuizViaBedrock`
    - _Requirements: 3.1, 3.5_

  - [x] 6.2 Add conditional teach-apply prompt path to `generateOpenFormQuizViaBedrock`
    - Extend signature to accept `growthIntent` parameter
    - When `growthIntent` is present: switch to teach-then-apply format — present concept first, then ask learner to apply to action context; instruct AI to generate `conceptName` and `conceptAuthor` fields; base ideal answer on taught concept applied to action context
    - When `growthIntent` is absent: use existing prompt unchanged
    - Lenses still apply (frame the angle), Bloom's progression still applies (depth scales with level)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

  - [x] 6.3 Update `callBedrockForEvaluation` for concept-aware evaluation and structured Bloom feedback
    - Extend signature to accept `growthIntent`, `conceptName`, `conceptAuthor` parameters
    - When `growthIntent` is present with concept reference: include growth intent and concept in evaluation prompt, assess how well learner understood and applied the taught concept
    - When `growthIntent` is absent: use existing evaluation behavior unchanged
    - For ALL evaluations (growth-intent and action-driven): update prompt to request `demonstratedLevel`, `conceptDemonstrated`, `nextLevelHint` structured fields
    - Derive `demonstratedLevel` from score using `scoreToBloomLevel` as fallback if Bedrock doesn't return it
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.6, 6.7, 6.8_

  - [x] 6.4 Update `handleEvaluate` to store and return structured Bloom feedback fields
    - Store `demonstratedLevel`, `conceptDemonstrated`, `nextLevelHint` in the state text alongside existing score/reasoning
    - Return new fields via the evaluation-status endpoint
    - _Requirements: 6.1, 6.6_

  - [ ]* 6.5 Write property test for quiz prompt construction with growth intent
    - **Property 7: Quiz prompt construction with growth intent**
    - Use fast-check to generate random growth intents and action contexts, verify teach-apply instructions presence/absence
    - **Validates: Requirements 3.1, 3.2, 3.5**

  - [ ]* 6.6 Write property test for evaluation structured feedback validation
    - **Property 6: Evaluation structured feedback validation**
    - Use fast-check to generate random scores in [0.0, 5.0], verify validation produces valid `demonstratedLevel` (integer 1–5), non-empty `conceptDemonstrated`, and correct `nextLevelHint` (non-empty when level < 5, empty when level is 5)
    - **Validates: Requirements 5.6, 6.6**

- [x] 7. Checkpoint — Verify Learning Lambda changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add member settings endpoint to Core Lambda
  - [x] 8.1 Add `GET /api/members/:userId/settings` handler in `lambda/core/index.js`
    - Match path pattern `/members/{userId}/settings` with GET method
    - Read `settings` JSONB from `organization_members` for the given user ID and organization
    - Return settings object (default `{}` if null)
    - Require membership in the organization
    - _Requirements: 4.1, 4.2_

  - [x] 8.2 Add `PUT /api/members/:userId/settings` handler in `lambda/core/index.js`
    - Match path pattern `/members/{userId}/settings` with PUT method
    - Accept `settings` object in request body
    - Validate `growth_intents` is an array of strings if present
    - Write `settings` JSONB to `organization_members` for the given user ID and organization
    - Return updated settings after write
    - Require that the requesting user matches the target user ID (users can only update their own settings)
    - _Requirements: 4.1, 4.2_

  - [ ]* 8.3 Write unit tests for member settings endpoints
    - Test GET returns empty object when settings is null
    - Test GET returns stored settings when present
    - Test PUT validates growth_intents is array of strings
    - Test PUT writes and returns updated settings
    - _Requirements: 4.1, 4.2_

- [x] 9. Checkpoint — Verify all backend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Update `SkillProfilePanel` with growth intent input field
  - [x] 10.1 Add growth intent textarea to `EmptyState` in `src/components/SkillProfilePanel.tsx`
    - Add optional textarea labeled "What do you want to get better at through this work?" above the "Generate Skill Profile" button
    - Add helper text: "Optional — describe a skill or area you'd like to develop. The action becomes your practice context."
    - Ensure the "Generate Skill Profile" button remains enabled regardless of whether intent is filled
    - Style the field to be visually prominent and encouraging (warm styling, not required indicator)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 10.2 Implement auto-fill logic from profile intents and stored per-action intent
    - Create `useMemberSettings` hook in `src/hooks/useMemberSettings.ts` for reading/writing member settings
    - If `existingIntent` is present (from stored skill profile), pre-fill the field
    - Else if profile has exactly one growth intent, auto-fill with it
    - Else if profile has multiple intents, show a selectable dropdown
    - Allow learner to edit, clear, or override the auto-filled value
    - _Requirements: 1.7, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 10.3 Wire growth intent through generate and approve mutations
    - Extend `useGenerateSkillProfile` mutation payload with `growth_intent`
    - Extend `useApproveSkillProfile` mutation payload with `growth_intent`
    - Extend `SkillProfile` TypeScript interface with `growth_intent?: string` and `growth_intent_provided?: boolean`
    - _Requirements: 1.4, 1.5, 1.6_

  - [ ]* 10.4 Write unit tests for SkillProfilePanel growth intent field
    - Test renders growth intent textarea in empty state
    - Test generate button enabled when field is blank
    - Test pre-fills from stored per-action intent
    - Test auto-fills from single profile intent
    - Test shows selector for multiple profile intents
    - _Requirements: 1.1, 1.2, 1.7, 4.3_

- [x] 11. Update `OpenFormInput` with learn-more link and Bloom feedback display
  - [x] 11.1 Add learn-more link rendering to `src/components/OpenFormInput.tsx`
    - Import `buildLearnMoreUrl` utility (frontend copy or shared)
    - When `question.conceptName` is present, render it as a clickable link with external-link icon
    - Link opens Google search URL in new tab with `rel="noopener noreferrer"`
    - When `conceptName` is absent, render question text unchanged
    - _Requirements: 3.4_

  - [x] 11.2 Create `BloomFeedbackSection` component and integrate into `OpenFormInput`
    - Create inline or extracted component accepting `demonstratedLevel`, `conceptDemonstrated`, `nextLevelHint`, `score` props
    - Render horizontal Bloom's level indicator: Remember → Understand → Apply → Analyze → Create, with demonstrated level highlighted and levels above dimmed
    - Render `conceptDemonstrated` text below the indicator
    - When `demonstratedLevel < 5`: render next-level hint card ("To reach [next level]: [hint]")
    - When `demonstratedLevel === 5`: render mastery message with sparkle icon
    - Replace the current "Great depth" / "Keep developing" badge and reasoning text with this new section
    - Extend `EvaluationStatusItem` interface with `demonstratedLevel`, `conceptDemonstrated`, `nextLevelHint`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [ ]* 11.3 Write property test for Bloom feedback conditional display
    - **Property 5: Bloom feedback conditional display**
    - Use fast-check to generate random demonstrated levels in [1, 5], verify next-level hint presence for levels 1–4 and mastery message for level 5
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 11.4 Write unit tests for OpenFormInput learn-more link and Bloom feedback
    - Test renders concept name as clickable learn-more link when present
    - Test renders Bloom feedback section instead of old badge
    - Test Bloom level indicator highlights correct level
    - Test concept demonstrated text is displayed
    - Test mastery message shown at level 5
    - Test Bloom feedback applies to non-growth-intent evaluations
    - _Requirements: 3.4, 6.1, 6.2, 6.3, 6.5, 6.7_

- [x] 12. Checkpoint — Verify frontend component changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Create `ProfileIntentsSection` component and integrate into profile settings
  - [x] 13.1 Create `src/components/ProfileIntentsSection.tsx`
    - Accept `userId` and `organizationId` props
    - Use `useMemberSettings` hook to fetch and `useUpdateMemberSettings` mutation to update
    - List saved growth intents with edit/delete buttons
    - "Add growth intent" input with save button
    - Optimistic updates via TanStack Query cache
    - Follow the pattern of other settings sections (e.g., `OrganizationValuesSection`)
    - _Requirements: 4.1, 4.2_

  - [x] 13.2 Integrate `ProfileIntentsSection` into the user profile/settings page
    - Import and render `ProfileIntentsSection` in the appropriate settings page
    - Pass `userId` and `organizationId` as props
    - _Requirements: 4.1_

  - [ ]* 13.3 Write unit tests for `ProfileIntentsSection`
    - Test renders list of saved intents
    - Test add new intent flow
    - Test edit existing intent
    - Test delete intent
    - _Requirements: 4.1, 4.2_

- [x] 14. Checkpoint — Verify all frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Deploy all changes
  - [x] 15.1 Deploy updated cwf-common-nodejs Lambda layer with new `bloomUtils.js`
    - Add `lambda/shared/bloomUtils.js` to the layer package alongside existing shared modules
    - Publish new layer version
    - _Requirements: 6.8, 3.4_

  - [x] 15.2 Deploy modified Lambdas using `deploy-lambda-with-layer.sh`
    - Deploy `lambda/skill-profile` → `cwf-skill-profile-lambda`
    - Deploy `lambda/learning` → `cwf-learning-lambda`
    - Deploy `lambda/core` → `cwf-core-lambda`
    - _Requirements: all_

  - [x] 15.3 Add API Gateway routes for member settings endpoints
    - `GET /api/members/{userId}/settings` → `cwf-core-lambda`
    - `PUT /api/members/{userId}/settings` → `cwf-core-lambda`
    - Deploy API Gateway changes
    - _Requirements: 4.1, 4.2_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Backend tasks (1–9) come before frontend (10–14) and deploy (15) to enable incremental testing
- Only one schema change: `ALTER TABLE organization_members ADD COLUMN settings JSONB DEFAULT '{}'`
- Growth intent flows through existing `/api/skill-profiles/generate` and `/api/skill-profiles/approve` endpoints — no new skill profile API routes
- Profile intents use a new lightweight `GET/PUT /api/members/:userId/settings` endpoint on the core Lambda
- Structured Bloom's feedback applies universally to ALL open-form evaluations, not just growth-intent-driven ones
- Property tests validate universal correctness properties from the design document
- `bloomUtils.js` is added to the Lambda layer so both backend and frontend can reference the same utility functions
