# Implementation Plan: Growth Learning Module

## Overview

This plan implements the Growth Learning Module that extends the deployed observation-based training system. The implementation proceeds in layers: pure utility functions first (gap computation, quiz evaluation, learning progress, self-assessment comparison), then the backend Lambda (cwf-learning-lambda with objectives, quiz generation, and verification endpoints), then frontend components (GrowthChecklist reframing, QuizPage, ObjectivesView, observation form extension), and finally integration wiring. Each step builds on the previous and ends with a checkpoint.

**Languages:** Node.js (Lambda backend), TypeScript/React (frontend)
**Testing:** Vitest + fast-check (property-based tests), React Testing Library (component tests)

## Tasks

- [ ] 1. Implement gap computation and severity pure functions
  - [ ] 1.1 Create `src/lib/learningUtils.ts` with gap computation functions
    - Implement `computeGapItems(skillProfile, capabilityProfile)` that returns a `GapItem[]` for every axis where `currentLevel < requiredLevel`
    - Implement `classifyGapSeverity(requiredLevel, currentLevel)` returning `'needs_learning'` (currentLevel < 2 and < required), `'partial_readiness'` (currentLevel >= 2 but < required), or `'met'` (currentLevel >= required)
    - Implement `sortGapsBySeverity(gaps)` ordering by `distanceBelowUnderstand` (max(0, 2 - currentLevel)) descending, stable sort
    - Implement `computeGapSummary(skillProfile, capabilityProfile)` returning `{ total, gaps }`
    - Export TypeScript interfaces: `GapItem`, gap severity type
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5_

  - [ ]* 1.2 Write property test for gap computation (Property 1)
    - **Property 1: Gap computation produces correct checklist items**
    - Use fast-check to generate arbitrary skill profiles (4-6 axes, levels 0-5) and capability profiles on the same axes, verify `computeGapItems` returns a gap item for every axis where currentLevel < requiredLevel with correct labels and levels, and an empty array when all axes are met
    - **Validates: Requirements 1.2, 1.4, 1.5, 2.1**

  - [ ]* 1.3 Write property test for gap severity classification (Property 2)
    - **Property 2: Gap severity classification**
    - Use fast-check to generate pairs of (requiredLevel, currentLevel) integers in [0, 5], verify `classifyGapSeverity` returns `'needs_learning'` when currentLevel < 2 and < required, `'partial_readiness'` when currentLevel >= 2 and < required, `'met'` when currentLevel >= required
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 1.4 Write property test for gap ordering by severity (Property 3)
    - **Property 3: Gap ordering by severity**
    - Use fast-check to generate lists of gap items, verify `sortGapsBySeverity` returns items ordered such that each item's `distanceBelowUnderstand` is >= the next item's, with stable relative order for ties
    - **Validates: Requirements 2.5**

- [ ] 2. Implement quiz evaluation and learning progress pure functions
  - [ ] 2.1 Add quiz evaluation functions to `src/lib/learningUtils.ts`
    - Implement `getIncompleteObjectives(objectiveIds, answers)` returning objective IDs that lack a correct first-attempt answer
    - Implement `isQuizComplete(objectiveIds, answers)` returning true iff every objective has a correct first-attempt answer
    - Implement `computeQuizSummary(answers)` returning `{ totalQuestions, correctFirstAttempt }`
    - Export TypeScript interface: `QuizAnswer`
    - _Requirements: 4.5, 4.6, 4.8, 6.6_

  - [ ] 2.2 Add learning progress functions to `src/lib/learningUtils.ts`
    - Implement `deriveObjectiveStatus(objectiveId, knowledgeStates)` returning `{ status, completionType }` — `'completed'/'quiz'` for correct first-attempt, `'completed'/'demonstrated'` for demonstration states, `'in_progress'` for any states but no correct first-attempt, `'not_started'` for no states
    - Implement `isAxisComplete(objectives)` returning true iff all objectives have `'completed'` status
    - Implement `isAllLearningComplete(axisObjectives)` returning true iff `isAxisComplete` is true for every axis
    - Implement `computeAxisProgress(objectives)` returning `{ completed, total }`
    - Export TypeScript interfaces: `ObjectiveStatus`, `CompletionType`, `ObjectiveProgress`
    - _Requirements: 4.9, 7.1, 7.2, 7.3, 7.4_

  - [ ] 2.3 Add self-assessment comparison function to `src/lib/learningUtils.ts`
    - Implement `compareAssessments(selfAssessedIds, aiEvaluatedIds)` returning `{ confirmed, unconfirmed, aiDetected }` — confirmed = intersection, unconfirmed = self - ai, aiDetected = ai - self
    - Export TypeScript interface: `VerificationResult`
    - _Requirements: 9.4_

  - [ ]* 2.4 Write property test for quiz completion evaluation (Property 8)
    - **Property 8: Quiz completion evaluation**
    - Use fast-check to generate sets of objective IDs and sequences of quiz answers, verify `isQuizComplete` returns true iff every objective has a correct first-attempt answer, and `getIncompleteObjectives` returns exactly the IDs lacking such an answer
    - **Validates: Requirements 4.6, 4.8**

  - [ ]* 2.5 Write property test for first answer is scored response (Property 7)
    - **Property 7: First answer is the scored response**
    - Use fast-check to generate sequences of answer selections on a single question, verify only the first selection has `wasFirstAttempt = true` and all subsequent have `wasFirstAttempt = false`
    - **Validates: Requirements 4.5, 6.6**

  - [ ]* 2.6 Write property test for objective status transitions (Property 9)
    - **Property 9: Objective status transitions on correct answer**
    - Use fast-check to generate knowledge state sequences, verify correct first-attempt → `'completed'/'quiz'`, demonstration state → `'completed'/'demonstrated'`, wrong answers only → `'in_progress'`, no states → `'not_started'`
    - **Validates: Requirements 4.9**

  - [ ]* 2.7 Write property test for learning progress derivation (Property 12)
    - **Property 12: Learning progress derivation**
    - Use fast-check to generate sets of objectives across multiple axes with knowledge states, verify `computeAxisProgress` completed count matches objectives with `'completed'` status, `isAxisComplete` returns true iff all completed, `isAllLearningComplete` returns true iff all axes complete
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 9.6**

  - [ ]* 2.8 Write property test for self-assessment vs AI comparison (Property 13)
    - **Property 13: Self-assessment vs AI comparison**
    - Use fast-check to generate two sets of objective IDs, verify `compareAssessments` produces confirmed = intersection, unconfirmed = self - ai, aiDetected = ai - self, all three disjoint, union equals union of inputs
    - **Validates: Requirements 9.4**

- [ ] 3. Checkpoint — Verify pure functions and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement learning objective state_text format utilities
  - [ ] 4.1 Add state_text format parsing and composition functions to `src/lib/learningUtils.ts`
    - Implement `composeLearningObjectiveStateText(axisKey, actionId, userId, objectiveText)` producing the `[learning_objective] axis=<key> action=<id> user=<id> | <text>` format
    - Implement `parseLearningObjectiveStateText(stateText)` extracting `{ axisKey, actionId, userId, objectiveText }` from the formatted string
    - Implement `composeKnowledgeStateText(objectiveText, questionText, selectedAnswer, wasCorrect)` producing the natural language format
    - Implement `parseKnowledgeStateText(stateText)` extracting `{ objectiveText, questionText, selectedAnswer, wasCorrect }`
    - _Requirements: 5.1, 5.2_

  - [ ]* 4.2 Write property test for learning data round-trip storage (Property 10)
    - **Property 10: Learning data round-trip storage**
    - Use fast-check to generate arbitrary objective texts, axis keys, action IDs, user IDs, verify compose → parse round-trip preserves all fields. Similarly for knowledge state text compose → parse round-trip.
    - **Validates: Requirements 5.1, 5.2**

- [ ] 5. Create `cwf-learning-lambda` — scaffold and objectives endpoint
  - [ ] 5.1 Create the Lambda function directory and handler scaffold
    - Create `lambda/learning/index.js` with the standard Lambda handler pattern (using `/opt/nodejs/` layer imports for `authorizerContext`, `response`, `db`, `sqlUtils`)
    - Create `lambda/learning/package.json` with `@aws-sdk/client-bedrock-runtime` dependency
    - Implement route dispatch for:
      - GET `/api/learning/:actionId/:userId/objectives`
      - POST `/api/learning/:actionId/quiz/generate`
      - POST `/api/learning/:actionId/verify`
    - _Requirements: 3.1, 3.5.1, 4.1, 9.3_

  - [ ] 5.2 Implement the learning objectives endpoint (`GET /api/learning/:actionId/:userId/objectives`)
    - Fetch action's `skill_profile` from `actions` table; return 404 if no approved profile
    - Fetch user's capability profile by calling the capability Lambda's logic (or querying directly) to get current levels per axis
    - Check for existing learning objective states: query `states` joined with `state_links` where `entity_type = 'action'` and `entity_id = actionId`, filtering `state_text LIKE '[learning_objective]%'` for the target user
    - For each gap axis without existing objectives, generate 3-6 objectives via Bedrock Sonnet using action context (title, description, expected_state, skill_profile) and evidence
    - Store each generated objective as a state via direct DB insert with `state_links` to the action (`entity_type = 'action'`)
    - Queue embedding for each new objective state via SQS (existing pipeline)
    - Tag each objective with evidence level: `no_evidence`, `some_evidence`, or `previously_correct` based on knowledge states and capability evidence
    - Return objectives grouped by axis with status and completion type
    - _Requirements: 3.5.1, 3.5.2, 3.5.3, 3.5.4, 3.5.9, 5.1, 5.5_

  - [ ]* 5.3 Write property test for objective evidence tagging (Property 4)
    - **Property 4: Objective evidence tagging**
    - Use fast-check to generate objectives with varying knowledge states and evidence, verify tagging produces exactly one of `no_evidence`, `some_evidence`, `previously_correct` per objective, and the categories are mutually exclusive and exhaustive
    - **Validates: Requirements 3.5.4**

  - [ ]* 5.4 Write property test for learning objectives grouped by axis (Property 6)
    - **Property 6: Learning objectives grouped by axis**
    - Use fast-check to generate sets of objectives with axis associations, verify grouping produces groups where every objective in a group shares the same axisKey, every objective appears in exactly one group, and the union of all groups equals the input set
    - **Validates: Requirements 3.5.9**

- [ ] 6. Implement quiz generation endpoint in `cwf-learning-lambda`
  - [ ] 6.1 Implement the quiz generation endpoint (`POST /api/learning/:actionId/quiz/generate`)
    - Accept `userId`, `axisKey`, `objectiveIds`, and `previousAnswers[]` in request body
    - Validate at least one objective ID is provided; return 400 if empty
    - Fetch action context (title, description, expected_state, skill_profile)
    - Fetch evidence observations (photos + text) from capability assessment for this axis
    - Fetch organization tool inventory
    - Fetch existing knowledge states for this user/axis
    - Build structured prompt for Bedrock Sonnet including: action context with expected_state as primary driver, evidence observation photos and text, required tools and available tools, previous wrong answers with misconceptions, learning objectives to cover
    - Call Bedrock Sonnet (`anthropic.claude-sonnet-4-20250514-v1:0`) to generate at least one question per objective
    - Validate response structure: each question has id, objectiveId, type, text, options (4), correctIndex, explanations
    - Return questions (not stored — questions are ephemeral)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 8.7, 8.8_

  - [ ]* 6.2 Write property test for every quiz question maps to a learning objective (Property 5)
    - **Property 5: Every quiz question maps to a learning objective**
    - Use fast-check to generate quiz generation responses with varying objective IDs, verify every question has a non-null objectiveId matching one of the requested objectiveIds, and no question references an objective not in the request
    - **Validates: Requirements 3.5.7**

- [ ] 7. Implement observation verification endpoint in `cwf-learning-lambda`
  - [ ] 7.1 Implement the verification endpoint (`POST /api/learning/:actionId/verify`)
    - Accept `observationId`, `selfAssessedObjectiveIds[]`, and `userId` in request body
    - Fetch observation from `states` table (text + photos via `state_photos`)
    - Fetch learning objectives for this action
    - Call Bedrock Sonnet to evaluate which objectives the observation demonstrates
    - Compare self-assessment vs AI evaluation using `compareAssessments` logic
    - For each confirmed objective, create a demonstration knowledge state via DB insert with `state_links` to the learning objective (`entity_type = 'learning_objective'`)
    - Queue embedding for each new demonstration state via SQS
    - Return `{ confirmed[], unconfirmed[], aiDetected[] }`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 8. Deploy `cwf-learning-lambda` and add API endpoints
  - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh learning cwf-learning-lambda`
  - Add API Gateway endpoints:
    - `./scripts/add-api-endpoint.sh /api/learning GET cwf-learning-lambda`
    - `./scripts/add-api-endpoint.sh /api/learning POST cwf-learning-lambda`
  - Deploy API Gateway: `aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2`
  - _Requirements: 3.5.1, 4.1, 9.3_

- [ ] 9. Checkpoint — Verify Lambda deployment and endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Frontend: TanStack Query hooks for learning data
  - [ ] 10.1 Create `src/hooks/useLearning.ts` with TanStack Query hooks
    - `useLearningObjectives(actionId, userId)` — query hook for `GET /api/learning/:actionId/:userId/objectives`, enabled when both IDs are provided and action has approved skill profile
    - `useQuizGeneration()` — mutation hook for `POST /api/learning/:actionId/quiz/generate`
    - `useObservationVerification()` — mutation hook for `POST /api/learning/:actionId/verify`
    - Add `learningObjectivesQueryKey` to `src/lib/queryKeys.ts`
    - _Requirements: 3.5.1, 4.1, 8.3, 9.3_

- [ ] 11. Frontend: GrowthChecklist component (reframed CapabilityAssessment)
  - [ ] 11.1 Extend `src/components/CapabilityAssessment.tsx` to render as GrowthChecklist
    - Change heading from "Capability Assessment" to "Growth Checklist"
    - Add gap checklist below the radar chart showing each gap axis as a checklist item with axis label, current level, required level, and severity indicator
    - Add per-person gap summary count ("3 of 5 skills need attention")
    - Add "All requirements met" confirmation when no gaps exist
    - Import and use `computeGapItems`, `sortGapsBySeverity`, `computeGapSummary` from `src/lib/learningUtils.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 11.2 Add learning objectives display and progress indicators to GrowthChecklist
    - Fetch learning objectives using `useLearningObjectives` hook
    - Display objectives grouped by axis with status indicators (not started, in progress, completed)
    - Show per-axis progress summary ("2 of 4 objectives completed")
    - Show checkmark on axis when all objectives completed
    - Show summary when all learning across all axes is complete
    - Add "Start Learning" button per gap axis (navigates to quiz route)
    - Add "Review Learning" button when objectives already exist
    - Import and use `computeAxisProgress`, `isAxisComplete`, `isAllLearningComplete` from `src/lib/learningUtils.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 11.3 Write component tests for GrowthChecklist
    - Test renders "Growth Checklist" heading
    - Test renders gap checklist items when gaps exist
    - Test renders "All requirements met" when no gaps
    - Test renders gap summary count
    - Test renders learning objectives grouped by axis with progress
    - Test "Start Learning" button appears for gap axes
    - Test "Review Learning" button appears when objectives exist
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.3, 7.1_

- [ ] 12. Frontend: Extend AxisDrilldown with Start Learning button
  - [ ] 12.1 Add "Start Learning" / "Review Learning" button to `src/components/AxisDrilldown.tsx`
    - Add a "Start Learning" button at the bottom of the drilldown sheet for gap axes
    - Button navigates to `/actions/:actionId/quiz/:axisKey` using React Router
    - Show "Review Learning" instead when learning objectives already exist for this axis
    - Only show buttons when action has approved skill profile and capability profile is computed
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.2_

  - [ ]* 12.2 Write component tests for AxisDrilldown learning button
    - Test "Start Learning" button renders for gap axes
    - Test "Review Learning" renders when objectives exist
    - Test button not rendered when no approved skill profile
    - _Requirements: 3.1, 3.4, 3.5_

- [ ] 13. Checkpoint — Verify GrowthChecklist and AxisDrilldown
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Frontend: QuizPage and ObjectivesView
  - [ ] 14.1 Create `src/components/ObjectivesView.tsx`
    - Display learning objectives before quiz starts
    - Show required objectives (no_evidence / some_evidence) prominently with labels
    - Show optional review objectives (previously_correct) as toggleable
    - "Start Quiz" button enabled when at least one objective is selected
    - Track which objectives the user selected (required + optional)
    - _Requirements: 3.5.4, 3.5.5, 3.5.6, 3.5.8_

  - [ ] 14.2 Create `src/pages/QuizPage.tsx` with full-page quiz experience
    - Register route at `/actions/:actionId/quiz/:axisKey` in `App.tsx` wrapped in `ProtectedRoute`
    - Implement quiz states: objectives selection → quiz in progress → answer feedback → round complete → quiz complete
    - Display one question at a time with action title + axis as context header
    - Show photo large above question text when `photoUrl` is present
    - On answer selection: first selection is scored (`wasFirstAttempt = true`), subsequent are exploratory
    - Wrong answer: show explanation immediately, allow exploring other options
    - Correct answer: show explanation, enable "Next" button. Allow clicking other options to explore explanations before clicking "Next"
    - On "Next": create knowledge state via `POST /api/states` with `state_text` in natural language format and `links: [{ entity_type: 'learning_objective', entity_id: objectiveStateId }]`
    - After round: evaluate completion using `isQuizComplete` and `getIncompleteObjectives`
    - If incomplete: call `useQuizGeneration` mutation with updated `previousAnswers` for failed objectives
    - If complete: show summary with correct-first-attempt count and link back to action detail
    - Optimistically update learning objectives cache on answer recording
    - 30-second timeout on quiz generation with retry button
    - Confirmation dialog on navigation away if answers are unsaved
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.5, 8.6, 8.7_

  - [ ]* 14.3 Write component tests for QuizPage
    - Test renders one question at a time
    - Test "Next" button appears only after correct answer
    - Test immediate feedback on wrong answer with explanation
    - Test completion summary when all objectives met
    - Test quiz route is navigable via direct URL
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.7_

  - [ ]* 14.4 Write component tests for ObjectivesView
    - Test renders required vs optional objectives
    - Test allows toggling optional objectives
    - Test "Start Quiz" button disabled when no objectives selected
    - _Requirements: 3.5.5, 3.5.6_

- [ ] 15. Checkpoint — Verify QuizPage and ObjectivesView
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Frontend: Extend observation form with demonstration checklist
  - [ ] 16.1 Extend `StatesInline` / observation form with demonstration checklist
    - When action has incomplete learning objectives, display a "Demonstrate Skills" checklist alongside the observation form
    - Person checks off objectives they believe this observation demonstrates
    - After observation save, trigger verification via `useObservationVerification` mutation (`POST /api/learning/:actionId/verify`) with observation ID and self-assessed objective IDs
    - Display verification results: confirmed ✓, unconfirmed ✗, AI-detected 🔍
    - Update learning objectives cache after verification completes
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 16.2 Write component tests for observation demonstration checklist
    - Test demonstration checklist renders when action has learning objectives
    - Test checklist not rendered when no learning objectives
    - Test verification results display (confirmed, unconfirmed, AI-detected)
    - _Requirements: 9.1, 9.4_

- [ ] 17. Checkpoint — Verify observation form extension
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Integration wiring and final verification
  - [ ] 18.1 Wire route configuration in `App.tsx`
    - Add `/actions/:actionId/quiz/:axisKey` route with `ProtectedRoute` wrapper and `QuizPage` component
    - Ensure route supports direct URL navigation (bookmarkable)
    - _Requirements: 8.6_

  - [ ] 18.2 Verify end-to-end data flow
    - Verify learning objectives are created as states with correct `state_links` to action
    - Verify knowledge states are created with correct `state_links` to learning objectives
    - Verify demonstration states are created on observation verification
    - Verify all new states are auto-embedded via existing SQS pipeline
    - Verify multi-tenant isolation: learning data scoped by organization_id
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.5_

  - [ ]* 18.3 Write property test for multi-tenant isolation (Property 11)
    - **Property 11: Multi-tenant isolation for learning data**
    - Verify that all learning data queries (objectives and knowledge states) only return states where organization_id matches the querying user's organization
    - **Validates: Requirements 5.5**

- [ ] 19. Final checkpoint — Ensure all tests pass
  - Run `npm run test:run` to verify all unit and property tests pass
  - Verify frontend builds cleanly with `npm run build`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- No new database tables — all learning data uses existing `states`, `state_links`, and `unified_embeddings` tables
- The existing embedding pipeline (SQS + `cwf-embeddings-processor`) handles learning objectives and knowledge states automatically as `state` entity types
- Frontend follows existing patterns: TanStack Query for data fetching, shadcn-ui + Tailwind for UI, React Router v7 for routing
- The radar chart rendering (`SkillRadarChart`) and capability assessment computation remain unchanged — only UI chrome is added around them
- Quiz questions are ephemeral (not stored) — regenerated fresh each time using stored knowledge states as context
- Claude Sonnet is used for all AI generation in the learning Lambda (objectives, quiz questions, verification)
