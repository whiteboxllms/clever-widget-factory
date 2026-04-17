# Implementation Plan: Observation-Based Training

## Overview

This plan implements the observation-driven skill assessment and transparency system for CWF. The implementation proceeds in layers: database schema first, then backend Lambdas (skill profile, capability), then embedding pipeline extensions, then frontend components, and finally integration wiring. Each step builds on the previous and ends with a checkpoint to validate before moving on.

**Languages:** Node.js (Lambda backend), TypeScript/React (frontend)
**Testing:** Vitest + fast-check (property-based tests), React Testing Library (component tests)

## Tasks

- [x] 1. Database schema migration and embedding composition update
  - [x] 1.1 Run database migration to add `expected_state` and `skill_profile` columns to the `actions` table
    - Write migration SQL: `ALTER TABLE actions ADD COLUMN IF NOT EXISTS expected_state TEXT; ALTER TABLE actions ADD COLUMN IF NOT EXISTS skill_profile JSONB;`
    - Add column comments for documentation
    - Execute via `aws lambda invoke --function-name cwf-db-migration` with the migration SQL payload
    - _Requirements: 1.1_

  - [x] 1.2 Update `composeActionEmbeddingSource` in `lambda/shared/embedding-composition.js` to include `expected_state`
    - Add `action.expected_state` to the parts array in `composeActionEmbeddingSource`
    - Also update the copy in `lambda/layers/cwf-common-nodejs/nodejs/embedding-composition.js`
    - _Requirements: 1.6_

  - [ ]* 1.3 Write property test for embedding composition including `expected_state` (Property 2)
    - **Property 2: Embedding composition includes expected state**
    - Use fast-check to generate arbitrary non-empty `expected_state` strings and verify `composeActionEmbeddingSource` output contains the `expected_state` as a substring
    - **Validates: Requirements 1.6**

  - [x] 1.4 Update `cwf-actions-lambda` to handle `expected_state` in create and update operations
    - In `lambda/actions/index.js`, ensure `expected_state` is included in the field handling for POST and PUT operations (it should flow through the existing dynamic field builder)
    - Add `expected_state` to the `embeddingRelevantFields` array so changes to S' trigger re-embedding
    - _Requirements: 1.1, 1.3, 1.5, 1.6_

  - [ ]* 1.5 Write property test for `expected_state` round-trip (Property 1)
    - **Property 1: Expected state round-trip**
    - Use fast-check to generate arbitrary string values, verify that storing and reading `expected_state` returns the identical string, and that null/undefined returns null
    - **Validates: Requirements 1.3**

- [x] 2. Checkpoint — Verify schema migration and embedding composition
  - Ensure migration ran successfully (query `SELECT expected_state, skill_profile FROM actions LIMIT 1`)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Skill Profile Lambda (`cwf-skill-profile-lambda`)
  - [x] 3.1 Create the Lambda function directory and handler scaffold
    - Create `lambda/skill-profile/index.js` with the standard Lambda handler pattern (using `/opt/nodejs/` layer imports for `authorizerContext`, `response`, `db`, `sqlUtils`)
    - Create `lambda/skill-profile/package.json` with `@aws-sdk/client-sqs` and `@aws-sdk/client-bedrock-runtime` dependencies
    - Implement route dispatch for POST `/api/skill-profiles/generate`, POST `/api/skill-profiles/approve`, DELETE `/api/skill-profiles/:actionId`
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [x] 3.2 Implement the skill profile generation endpoint (`POST /api/skill-profiles/generate`)
    - Accept `action_id` and `action_context` (title, description, expected_state, policy, asset_name, required_tools) in request body
    - Validate that at least one of title, description, or expected_state is non-empty; return 400 if all are empty
    - Call Bedrock Claude with a structured prompt that instructs the model to produce a JSON skill profile with `narrative` (string), `axes` (array of 4-6 objects with `key`, `label`, `required_level` in 0.0-1.0), and `generated_at` timestamp
    - Validate the AI response structure (4-6 axes, levels in range); retry once with a stricter prompt if malformed
    - Return the preview profile JSON (without `approved_at`/`approved_by`) — nothing is persisted
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [x] 3.3 Implement the skill profile approval endpoint (`POST /api/skill-profiles/approve`)
    - Accept `action_id`, `skill_profile` (the edited profile from preview), and `approved_by` in request body
    - Validate profile structure: 4-6 axes, each with non-empty `key` and `label`, `required_level` in [0.0, 1.0], non-empty narrative
    - Add `approved_at` (ISO timestamp) and `approved_by` to the profile JSON
    - Store the profile as JSONB in `actions.skill_profile` column via SQL UPDATE
    - Compose embedding source from narrative + axis labels, send SQS message with `entity_type: 'action_skill_profile'`, `entity_id: action.id`, `organization_id`
    - _Requirements: 2.5, 2.6, 2.8_

  - [x] 3.4 Implement the skill profile deletion endpoint (`DELETE /api/skill-profiles/:actionId`)
    - Set `actions.skill_profile = NULL` for the given action
    - Delete the corresponding `action_skill_profile` entry from `unified_embeddings`
    - _Requirements: 2.4_

  - [ ]* 3.5 Write property test for skill profile structure validity (Property 3)
    - **Property 3: Skill profile structure validity**
    - Use fast-check to generate arbitrary action contexts (with at least one non-empty field) and verify the validation function accepts profiles with 4-6 axes, non-empty keys/labels, and levels in [0.0, 1.0]
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 3.6 Write property test for profile not stored before approval (Property 4)
    - **Property 4: Profile not stored before approval**
    - Verify that after calling the generate endpoint, the action's `skill_profile` column remains null and no `action_skill_profile` embedding exists
    - **Validates: Requirements 2.5**

  - [ ]* 3.7 Write property test for approval stores profile and queues embedding (Property 5)
    - **Property 5: Approval stores profile and queues embedding**
    - Verify that after approval, the action's `skill_profile` JSONB contains the approved profile and an SQS message was sent with `entity_type: 'action_skill_profile'`
    - **Validates: Requirements 2.6**

- [x] 4. Deploy Skill Profile Lambda and add API endpoints
  - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh skill-profile cwf-skill-profile-lambda`
  - Add API Gateway endpoints:
    - `./scripts/add-api-endpoint.sh /api/skill-profiles/generate POST cwf-skill-profile-lambda`
    - `./scripts/add-api-endpoint.sh /api/skill-profiles/approve POST cwf-skill-profile-lambda`
    - `./scripts/add-api-endpoint.sh /api/skill-profiles/{actionId} DELETE cwf-skill-profile-lambda`
  - Deploy API Gateway: `aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2`
  - _Requirements: 2.1, 2.4, 2.5, 2.6_

- [x] 5. Checkpoint — Verify Skill Profile Lambda
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Capability Lambda (`cwf-capability-lambda`)
  - [x] 6.1 Create the Lambda function directory and handler scaffold
    - Create `lambda/capability/index.js` with the standard Lambda handler pattern (using `/opt/nodejs/` layer imports)
    - Create `lambda/capability/package.json` with `@aws-sdk/client-bedrock-runtime` dependency
    - Implement route dispatch for GET `/api/capability/:actionId/:userId` and GET `/api/capability/:actionId/organization`
    - _Requirements: 3.1, 6.1_

  - [x] 6.2 Implement the individual capability assessment endpoint (`GET /api/capability/:actionId/:userId`)
    - Fetch the action's `skill_profile` JSON from the `actions` table; return 404 if no approved profile exists
    - Fetch the `action_skill_profile` embedding from `unified_embeddings` for the action
    - Perform vector similarity search in `unified_embeddings` for `state` entries similar to the skill profile embedding, scoped by `organization_id`
    - Filter observations to actions where the target user is `assigned_to`, in `participants`, or is `created_by`
    - Resolve observation details from `states` + `state_photos` + `state_links`
    - Apply recency weighting: 0-30 days = 1.0, 30-90 days = 0.7, 90-180 days = 0.4, >180 days = 0.2
    - If no relevant observations found, return all axes at 0.0 with narrative "No relevant evidence found."
    - Otherwise, send evidence + skill axes to Bedrock Claude with a structured prompt to produce capability levels (0.0-1.0 per axis) + narrative
    - Return the `CapabilityProfile` response JSON
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 6.3 Implement the organization capability assessment endpoint (`GET /api/capability/:actionId/organization`)
    - Same flow as individual but without person filtering — aggregate all observations across the organization
    - Return organization-level capability profile
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 6.4 Implement shared utility functions for capability computation
    - Extract `computeRecencyWeight(capturedAt)` function for reuse and testing
    - Extract `detectGap(requirementLevel, capabilityLevel, threshold = 0.3)` function
    - Extract `buildEvidenceQuery(skillProfileEmbedding, organizationId, userFilter?)` function
    - _Requirements: 3.6, 4.5_

  - [ ]* 6.5 Write property test for recency weighting monotonicity (Property 8)
    - **Property 8: Recency weighting**
    - Use fast-check to generate pairs of timestamps and verify the more recent one always gets weight >= the older one
    - **Validates: Requirements 3.6**

  - [ ]* 6.6 Write property test for gap detection threshold (Property 10)
    - **Property 10: Gap detection threshold**
    - Use fast-check to generate pairs of (requirement, capability) levels and verify gap is detected when `requirement - capability > 0.3` and not detected otherwise
    - **Validates: Requirements 4.5**

  - [ ]* 6.7 Write property test for no evidence yields zero scores (Property 9)
    - **Property 9: No evidence yields zero scores**
    - Verify that when no observations are found, all axis levels are 0.0 and narrative indicates no evidence
    - **Validates: Requirements 3.8**

  - [ ]* 6.8 Write property test for capability axes match skill profile (Property 6)
    - **Property 6: Capability profile axes match skill profile**
    - Use fast-check to generate skill profiles with 4-6 axes and verify the capability response has exactly the same axis keys, each with level in [0.0, 1.0]
    - **Validates: Requirements 3.1, 3.4**

  - [ ]* 6.9 Write property test for multi-tenant isolation (Property 12)
    - **Property 12: Multi-tenant isolation**
    - Verify that all observations in the evidence set have `organization_id` matching the querying action's `organization_id`
    - **Validates: Requirements 5.6, 6.6**

- [x] 7. Deploy Capability Lambda and add API endpoints
  - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh capability cwf-capability-lambda`
  - Add API Gateway endpoints:
    - `./scripts/add-api-endpoint.sh /api/capability/{actionId}/{userId} GET cwf-capability-lambda`
    - `./scripts/add-api-endpoint.sh /api/capability/{actionId}/organization GET cwf-capability-lambda`
  - Deploy API Gateway: `aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2`
  - _Requirements: 3.1, 6.1_

- [x] 8. Checkpoint — Verify Capability Lambda
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. ~~Extend embedding pipeline for `action_observation` entity type~~ (Removed — using existing `state` embeddings instead)
  - [x] 9.1 ~~Update `lambda/states/index.js` to send additional `action_observation` SQS message~~ (Reverted — not needed)
    - Observations use existing `state` embeddings. The capability Lambda searches `state` entity types and filters by action linkage via `state_links` joins at query time.
    - _Requirements: 5.1, 5.2_

  - [ ]* 9.2 ~~Write property test for observation creates `action_observation` embedding (Property 11)~~ (Removed — no separate entity type)
    - **Property 11 updated:** Observation embedding serves as skill evidence via existing `state` entity type
    - **Validates: Requirements 5.1**

- [x] 10. Checkpoint — Verify embedding pipeline extension
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend: `expected_state` field in UnifiedActionDialog
  - [x] 11.1 Add `expected_state` to the `BaseAction` interface in `src/types/actions.ts`
    - Add `expected_state?: string | null;` field to the `BaseAction` interface
    - Add `expected_state: ''` to the `createMissionAction`, `createIssueAction`, `createAssetAction`, and `createExplorationAction` helper functions
    - _Requirements: 1.1, 1.2_

  - [x] 11.2 Add the `ExpectedStateField` to `src/components/UnifiedActionDialog.tsx`
    - Add a `Textarea` field with label "Where we want to get to" after the description field and before the policy field
    - Add an AI-generate button (Sparkles icon from Lucide) that calls `aiContentService` to synthesize a suggested S' from the action's title, description, and context
    - Wire the field value to the action form state and include it in the save mutation payload
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 11.3 Write component test for `ExpectedStateField`
    - Verify the field renders with the correct label
    - Verify the AI-generate button is present
    - Verify the field value is included in form submission
    - _Requirements: 1.2, 1.4_

- [x] 12. Frontend: Skill Profile Panel
  - [x] 12.1 Create `src/hooks/useSkillProfile.ts` with TanStack Query hooks
    - `useGenerateSkillProfile` mutation hook: POST to `/api/skill-profiles/generate`
    - `useApproveSkillProfile` mutation hook: POST to `/api/skill-profiles/approve`, optimistically update the action's `skill_profile` in the actions cache
    - `useDeleteSkillProfile` mutation hook: DELETE to `/api/skill-profiles/:actionId`
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

  - [x] 12.2 Create `src/components/SkillProfilePanel.tsx`
    - Implement a collapsible panel with three states:
      - **Empty**: "Generate Skill Profile" button, disabled if action has no title, description, or expected_state
      - **Preview**: Shows generated profile with editable narrative (Textarea) and editable axes (inline inputs for label and required_level). "Approve" and "Discard" buttons.
      - **Approved**: Shows stored profile with axes as a mini radar preview. "Regenerate" option.
    - Use Zod schema to validate profile structure on the frontend before sending approve request
    - Use React Hook Form for the editable preview state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 12.3 Integrate `SkillProfilePanel` into the action detail view
    - Add the panel to `UnifiedActionDialog` in the appropriate tab or section, visible when viewing an existing action
    - _Requirements: 2.4_

  - [ ]* 12.4 Write component tests for `SkillProfilePanel`
    - Test empty state renders generate button
    - Test preview state shows editable narrative and axes
    - Test approved state shows stored profile
    - Test generate button is disabled when no context fields are filled
    - _Requirements: 2.1, 2.4, 2.5_

- [x] 13. Frontend: Radar Chart and Capability Assessment
  - [x] 13.1 Install Recharts and create `src/hooks/useCapability.ts`
    - Add `recharts` as a dependency
    - `useCapabilityProfile(actionId, userId)` query hook: GET `/api/capability/:actionId/:userId`
    - `useOrganizationCapability(actionId)` query hook: GET `/api/capability/:actionId/organization`
    - _Requirements: 3.1, 6.1_

  - [x] 13.2 Create `src/components/RadarChart.tsx`
    - Use Recharts `RadarChart`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `Radar` components
    - Render action requirements polygon (dashed line, neutral color)
    - Render person polygons (solid lines, colors from `favorite_color` in `organization_members`, falling back to a palette)
    - Render organization polygon (dotted line, distinct color)
    - Implement gap highlighting: when `requirement - capability > 0.3`, fill the gap area with semi-transparent red
    - Transform API response data into Recharts-compatible format
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_

  - [x] 13.3 Create `src/components/AxisDrilldown.tsx`
    - Implement a popover/sheet that opens when clicking a radar chart axis label
    - Show the person's score and requirement level for that axis
    - List contributing observations with text excerpt, thumbnail photos (using `getThumbnailUrl`), link to source action, relevance score, and capture date
    - Show the AI's reasoning summary for the score
    - _Requirements: 4.6_

  - [x] 13.4 Create `src/components/CapabilityAssessment.tsx` container component
    - Fetch capability profiles for all involved people (assigned_to + participants) using `useCapabilityProfile`
    - Fetch organization capability using `useOrganizationCapability`
    - Compose the data and pass to `RadarChart` and `AxisDrilldown`
    - Handle loading states (30-second timeout), error states with retry button, and empty states
    - _Requirements: 3.1, 4.1, 4.7, 6.1, 6.2_

  - [x] 13.5 Integrate `CapabilityAssessment` into the action detail view
    - Add the radar chart section to `UnifiedActionDialog`, positioned near the worker assignment and participants section
    - Only render when the action has an approved skill profile
    - _Requirements: 4.7_

  - [ ]* 13.6 Write component tests for `RadarChart`
    - Test correct number of polygons rendered (requirements + N persons + organization)
    - Test gap highlighting appears when threshold exceeded
    - Test axis labels are clickable
    - Test loading and error states
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ]* 13.7 Write property test for evidence inclusion is role-agnostic (Property 7)
    - **Property 7: Evidence inclusion is role-agnostic**
    - Verify that the evidence filter query includes observations from actions where the person is assigned_to, in participants, or is created_by — all treated identically
    - **Validates: Requirements 3.3, 3.9**

  - [ ]* 13.8 Write property test for organization profile aggregates all members (Property 13)
    - **Property 13: Organization profile aggregates all members**
    - Verify that the organization evidence query is a superset of individual member queries (no person filter applied)
    - **Validates: Requirements 6.1, 6.3**

- [x] 14. Checkpoint — Verify all frontend components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. End-to-end wiring and final integration
  - [x] 15.1 Wire the `expected_state` AI generation to the existing Maxwell AI pattern
    - Add a method to `src/services/aiContentService.ts` that generates a suggested S' from action title + description + context
    - Connect the Sparkles button in `ExpectedStateField` to this service method
    - _Requirements: 1.4_

  - [x] 15.2 Redeploy `cwf-actions-lambda` with `expected_state` changes
    - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh actions cwf-actions-lambda`
    - _Requirements: 1.1, 1.6_

  - [x] 15.3 Redeploy `cwf-states-lambda` (no changes needed — states Lambda unchanged)
    - The states Lambda was reverted to its original behavior. Observations use existing `state` embeddings for capability assessment.
    - _Requirements: 5.1_

  - [x] 15.4 Redeploy the common Lambda layer with updated `embedding-composition.js`
    - Rebuild and deploy the `cwf-common-nodejs` layer so all Lambdas pick up the `expected_state` in embedding composition
    - _Requirements: 1.6_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Run `npm run test:run` to verify all unit and property tests pass
  - Verify frontend builds cleanly with `npm run build`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing embedding pipeline (SQS + `cwf-embeddings-processor`) handles the new `action_skill_profile` entity type without modification. Observation evidence uses existing `state` embeddings — no additional entity types or SQS messages needed.
- Frontend follows existing patterns: TanStack Query for data fetching, shadcn-ui + Tailwind for UI, React Hook Form + Zod for form validation
