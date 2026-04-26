# Implementation Plan: Scoring Context Reduction

## Overview

This plan implements configurable AI parameters (max axes, evidence limit, quiz temperature) per organization, narrows evidence retrieval to learning-objective-linked states, and provides a UI for managing these settings. Tasks are ordered backend-first (shared utility → database → Lambdas), then frontend, then deployment, to enable incremental testing at each layer.

## Tasks

- [x] 1. Create shared `resolveAiConfig` and `fetchAiConfig` utilities in the Lambda layer
  - [x] 1.1 Create `lambda/shared/aiConfigDefaults.js` with `AI_CONFIG_DEFAULTS`, `resolveAiConfig`, `isValidInt`, `isValidFloat`, and `fetchAiConfig`
    - `AI_CONFIG_DEFAULTS`: `{ max_axes: 3, min_axes: 2, evidence_limit: 3, quiz_temperature: 0.7 }`
    - `resolveAiConfig(aiConfig)`: merges input with defaults, validates each field against bounds (max_axes 1-6, min_axes 1-6, evidence_limit 1-10, quiz_temperature 0.0-1.0), replaces invalid values with defaults
    - `fetchAiConfig(db, organizationId)`: queries `SELECT ai_config FROM organizations WHERE id = $1`, calls `resolveAiConfig` on the result, catches errors and returns defaults with a warning log
    - Export all functions via `module.exports`
    - _Requirements: 1.7, 4.8, 5.10, 5.11_

  - [ ]* 1.2 Write property test for `resolveAiConfig` — config resolution always produces valid defaults
    - **Property 3: Config resolution always produces valid defaults**
    - Use fast-check to generate arbitrary inputs (null, undefined, empty objects, partial objects with random field values)
    - Assert returned config has `max_axes` in [1, 6], `min_axes` in [1, 6] with `min_axes <= max_axes`, `evidence_limit` in [1, 10], `quiz_temperature` in [0.0, 1.0]
    - **Validates: Requirements 1.7, 3.6, 4.8**

  - [ ]* 1.3 Write property test for AI config field validation bounds
    - **Property 5: AI config field validation enforces correct bounds**
    - Use fast-check to generate random numbers, verify `isValidInt` and `isValidFloat` accept/reject correctly for each field's bounds
    - **Validates: Requirements 4.9, 5.7, 5.8, 5.9**

- [x] 2. Run database migration to add `ai_config` column
  - Run via the `cwf-db-migration` Lambda: `ALTER TABLE organizations ADD COLUMN ai_config JSONB DEFAULT NULL;`
  - Verify column exists with a SELECT query
  - _Requirements: 5.6_

- [x] 3. Update Skill Profile Lambda to use configurable axis range
  - [x] 3.1 Update `lambda/skill-profile/index.js` to import and use `fetchAiConfig` and `resolveAiConfig`
    - Add `const { fetchAiConfig, resolveAiConfig } = require('/opt/nodejs/aiConfigDefaults');` at the top
    - In `handleGenerate`: fetch `aiConfig` using `fetchAiConfig(db, organizationId)` at the start, pass it to `buildSkillProfilePrompt(ctx, false, aiConfig)` and `isValidSkillProfile(profile, aiConfig)`
    - In `handleApprove`: fetch `aiConfig` and pass it to `isValidSkillProfile(skill_profile, aiConfig)`
    - _Requirements: 1.1, 1.7, 2.4_

  - [x] 3.2 Update `buildSkillProfilePrompt` to accept `aiConfig` parameter and use configured axis range
    - Change signature to `buildSkillProfilePrompt(ctx, strict = false, aiConfig = null)`
    - If `aiConfig` is null, call `resolveAiConfig(null)` to get defaults
    - Replace hardcoded `"4 to 6 axes"` with `"${aiConfig.min_axes} to ${aiConfig.max_axes} axes"` in the prompt
    - Replace strict clause `"EXACTLY 4 to 6 axes"` with `"EXACTLY ${aiConfig.min_axes} to ${aiConfig.max_axes} axes"`
    - _Requirements: 1.2, 1.3_

  - [x] 3.3 Update `isValidSkillProfile` to accept `aiConfig` parameter and validate against configured range
    - Change signature to `isValidSkillProfile(profile, aiConfig = null)`
    - If `aiConfig` is null, call `resolveAiConfig(null)` to get defaults
    - Replace `profile.axes.length < 4 || profile.axes.length > 6` with `profile.axes.length < aiConfig.min_axes || profile.axes.length > aiConfig.max_axes`
    - _Requirements: 1.4, 1.6, 2.1, 2.3_

  - [ ]* 3.4 Write property test for prompt construction using configured axis range
    - **Property 1: Prompt construction uses configured axis range**
    - Use fast-check to generate valid AI configs, verify `buildSkillProfilePrompt` output contains configured min/max values and does NOT contain "4 to 6"
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 3.5 Write property test for validator accepting profiles within configured range
    - **Property 2: Validator accepts profiles within configured range and rejects outside**
    - Use fast-check to generate random profiles and configs, verify `isValidSkillProfile` returns true iff axis count is within range AND all axes have valid fields
    - **Validates: Requirements 1.4, 2.1**

  - [ ]* 3.6 Write property test for per-axis field validation independent of count
    - **Property 4: Per-axis field validation is independent of axis count**
    - Use fast-check to generate profiles with valid/invalid axis fields, verify validation result depends on field validity regardless of count
    - **Validates: Requirements 2.3**

- [x] 4. Checkpoint — Verify shared utility and skill profile Lambda changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Capability Lambda for evidence filtering and configurable temperature
  - [x] 5.1 Update `lambda/capability/index.js` to import and use `fetchAiConfig`
    - Add `const { fetchAiConfig } = require('/opt/nodejs/aiConfigDefaults');` at the top
    - In `handleIndividualCapability`: fetch `aiConfig` after getting the DB client, pass it to `handlePerAxisCapability`
    - In `handleOrganizationCapability`: fetch `aiConfig` after getting the DB client, use it in the per-axis evidence loop
    - _Requirements: 5.10_

  - [x] 5.2 Update `handlePerAxisCapability` evidence query with `state_links` JOIN and parameterized LIMIT
    - Add `INNER JOIN state_links sl ON sl.state_id = s.id AND sl.entity_type = 'learning_objective'` to the per-axis vector search query
    - Replace `LIMIT 5` with `LIMIT ${aiConfig.evidence_limit}` (parameterized from config)
    - Accept `aiConfig` as a parameter in the function signature
    - _Requirements: 3.1, 3.3, 3.5, 3.9_

  - [x] 5.3 Update `handleOrganizationCapability` evidence query with same `state_links` JOIN and parameterized LIMIT
    - Apply the same `INNER JOIN state_links` filter to the org-level per-axis vector search query
    - Replace `LIMIT 5` with `LIMIT ${aiConfig.evidence_limit}`
    - _Requirements: 3.2, 3.4_

  - [x] 5.4 Update `callBedrockForPerAxisCapability` to use configurable temperature
    - Accept `aiConfig` as a parameter
    - Replace hardcoded `temperature: 0.3` with `temperature: aiConfig.quiz_temperature`
    - Thread `aiConfig` from `handlePerAxisCapability` and `handleOrganizationCapability` through to this function
    - _Requirements: 4.4, 4.7_

  - [x] 5.5 Bump `PROMPT_VERSION` in `lambda/capability/cacheUtils.js` from `'v2'` to `'v3'`
    - This forces recomputation of all cached capability profiles after the evidence query changes
    - _Requirements: 3.10_

  - [ ]* 5.6 Write property test for zero capability profile structure
    - **Property 6: Zero capability profile has correct structure**
    - Use fast-check to generate random skill profiles, verify `buildZeroCapabilityProfile` returns a profile where every axis has `level: 0`, `evidence_count: 0`, empty `evidence` array, and `total_evidence_count` is 0
    - **Validates: Requirements 3.8**

  - [ ]* 5.7 Write property test for evidence hash determinism
    - **Property 7: Evidence hash is deterministic**
    - Use fast-check to generate random state ID arrays and completion counts, verify `computeEvidenceHash` produces the same hash for the same inputs and different hashes for different inputs
    - **Validates: Requirements 3.10**

- [x] 6. Update Learning Lambda for configurable temperature
  - [x] 6.1 Update `lambda/learning/index.js` to import and use `fetchAiConfig`
    - Add `const { fetchAiConfig } = require('/opt/nodejs/aiConfigDefaults');` at the top
    - Fetch `aiConfig` once per request in the handler, thread it to the relevant functions
    - _Requirements: 5.10_

  - [x] 6.2 Update `callBedrockForCapabilityLevels` temperature from 0.3 to configurable
    - Accept `aiConfig` as a parameter
    - Replace `temperature: 0.3` with `temperature: aiConfig.quiz_temperature`
    - _Requirements: 4.1_

  - [x] 6.3 Update `callBedrockForEvaluation` temperature from 0.3 to configurable
    - Accept `aiConfig` as a parameter
    - Replace `temperature: 0.3` with `temperature: aiConfig.quiz_temperature`
    - _Requirements: 4.2_

  - [x] 6.4 Update `evaluateObservationViaBedrock` temperature from 0.3 to configurable
    - Accept `aiConfig` as a parameter
    - Replace `temperature: 0.3` with `temperature: aiConfig.quiz_temperature`
    - _Requirements: 4.3_

  - [ ]* 6.5 Write unit tests verifying unchanged functions still use temperature 0.7
    - Verify `generateObjectivesViaBedrock`, `generateQuizViaBedrock`, `generateOpenFormQuizViaBedrock` still use `temperature: 0.7` and are NOT affected by `aiConfig.quiz_temperature`
    - _Requirements: 4.5_

- [x] 7. Checkpoint — Verify all backend Lambda changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add GET/PUT `/api/organizations/:id/ai-config` endpoints to Core Lambda
  - [x] 8.1 Add `GET /api/organizations/:id/ai-config` handler in `lambda/core/index.js`
    - Match path pattern `/organizations/{id}/ai-config` with GET method
    - Read `ai_config` from the organizations table for the given org ID
    - Return resolved config (merged with defaults via `resolveAiConfig`)
    - Require `organizations:read` permission (or membership in the org)
    - _Requirements: 5.5, 5.10_

  - [x] 8.2 Add `PUT /api/organizations/:id/ai-config` handler in `lambda/core/index.js`
    - Match path pattern `/organizations/{id}/ai-config` with PUT method
    - Validate input fields: `max_axes` integer 1-6, `min_axes` integer 1-6, `evidence_limit` integer 1-10, `quiz_temperature` float 0.0-1.0
    - Return 400 with validation error message for invalid values
    - Write validated `ai_config` JSONB to the organizations table
    - Return resolved config after write
    - Require `organizations:update` permission (leadership/admin)
    - _Requirements: 5.4, 5.7, 5.8, 5.9_

  - [ ]* 8.3 Write unit tests for GET/PUT ai-config endpoints
    - Test GET returns defaults when `ai_config` is null
    - Test GET returns merged config when partial `ai_config` exists
    - Test PUT validates bounds and rejects invalid values with 400
    - Test PUT writes and returns resolved config
    - _Requirements: 5.4, 5.5_

- [x] 9. Build frontend `AiConfigCard` component and integrate into Organization page
  - [x] 9.1 Create `src/components/AiConfigCard.tsx`
    - Three input fields: max axes (integer input 1-6), evidence limit (integer input 1-10), quiz temperature (decimal input 0.0-1.0)
    - Use React Hook Form + Zod for validation matching backend bounds
    - Read config on mount via `GET /api/organizations/:id/ai-config` using TanStack Query
    - Save via `PUT /api/organizations/:id/ai-config` with optimistic update
    - Show defaults when no config exists
    - Include a Save button and loading/error states
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.7, 5.8, 5.9_

  - [x] 9.2 Add `<AiConfigCard>` to `src/pages/Organization.tsx`
    - Render after the AI Scoring Prompts card, inside the existing `isAdmin` gate
    - Pass `organizationId` as a prop
    - _Requirements: 5.1, 5.3_

  - [x] 9.3 Update `src/components/SkillProfilePanel.tsx` Zod schema to use dynamic axis range from ai_config
    - Accept ai_config (or min/max axes) as a prop or read from a shared TanStack Query
    - Replace hardcoded `.min(4).max(6)` in `skillProfileFormSchema` with dynamic values from the org's ai_config (default min 2, max 3)
    - _Requirements: 1.5_

  - [ ]* 9.4 Write unit tests for `AiConfigCard` component
    - Test renders three fields with correct defaults
    - Test is hidden for non-admin users (not rendered when `isAdmin` is false)
    - Test Zod schema accepts/rejects at configured boundaries
    - _Requirements: 5.2, 5.3, 5.7, 5.8, 5.9_

- [x] 10. Checkpoint — Verify frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Deploy all changes
  - [x] 11.1 Deploy updated cwf-common-nodejs Lambda layer with new `aiConfigDefaults.js`
    - Add `lambda/shared/aiConfigDefaults.js` to the layer package
    - Publish new layer version
    - _Requirements: 1.7, 5.10_

  - [x] 11.2 Deploy modified Lambdas using `deploy-lambda-with-layer.sh`
    - Deploy `lambda/skill-profile` → `cwf-skill-profile-lambda`
    - Deploy `lambda/capability` → `cwf-capability-lambda`
    - Deploy `lambda/learning` → `cwf-learning-lambda`
    - Deploy `lambda/core` → `cwf-core-lambda`
    - _Requirements: all_

  - [x] 11.3 Add API Gateway routes for ai-config endpoints
    - `GET /api/organizations/{id}/ai-config` → `cwf-core-lambda`
    - `PUT /api/organizations/{id}/ai-config` → `cwf-core-lambda`
    - Deploy API Gateway changes
    - _Requirements: 5.4, 5.5_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Backend tasks (1-8) come before frontend (9) and deploy (11) to enable incremental testing
- Property tests validate universal correctness properties from the design document
- The `PROMPT_VERSION` bump in task 5.5 forces cache invalidation for all existing capability profiles
- Existing approved profiles with more axes than the new max are preserved — backward compatibility is maintained during scoring (Requirement 1.6)
