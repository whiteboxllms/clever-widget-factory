# Implementation Plan: Bloom's Progression Questions

## Overview

Extend the existing quiz system from single-type multiple-choice (Recognition) questions to a progressive ladder of question types mapped to Bloom's taxonomy levels. Implementation proceeds in layers: pure utility functions first (testable without infrastructure), then Lambda extensions, then frontend components, and finally deployment wiring.

## Tasks

- [ ] 1. Create `progressionUtils.ts` — pure progression utility functions
  - [x] 1.1 Create `src/lib/progressionUtils.ts` with question type taxonomy functions
    - Define `QuestionType` type: `'recognition' | 'bridging' | 'self_explanation' | 'application' | 'analysis' | 'synthesis'`
    - Implement `questionTypeToBloomLevel(questionType)` — maps each type to its Bloom's level (1, 1, 2, 3, 4, 5); returns 0 for invalid types
    - Implement `isOpenFormQuestion(questionType)` — returns `false` for `recognition`, `true` for all others
    - _Requirements: 1.1, 1.3_

  - [ ]* 1.2 Write property test for question type taxonomy mapping
    - **Property 1: Question type taxonomy mapping**
    - **Validates: Requirements 1.1, 1.3**
    - Create `src/lib/progressionUtils.test.ts`
    - Use fast-check to verify `questionTypeToBloomLevel` returns correct level for each valid type and 0 for invalid strings
    - Verify `isOpenFormQuestion` returns `false` for recognition and `true` for all other types
    - Verify consistency: every type maps to exactly one level and one form classification

  - [x] 1.3 Implement progression level derivation and bridging functions in `src/lib/progressionUtils.ts`
    - Implement `deriveProgressionLevel(knowledgeStates, axisKey)` — examines stored knowledge states to determine the current question type and Bloom's level; never skips levels; treats `pending`/`error` evaluations as incomplete
    - Implement `isBridgingComplete(knowledgeStates, axisKey)` — returns `true` if at least one bridging state with `sufficient` evaluation exists for the axis
    - Import `ParsedOpenFormState` type from `learningUtils.ts` (created in task 2.1)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 7.7, 7.9_

  - [ ]* 1.4 Write property test for progression level derivation
    - **Property 2: Progression level derivation from knowledge states**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 7.7, 7.9**
    - Use fast-check to generate sets of knowledge states with varying question types, evaluation statuses, and scores
    - Verify returned question type is at most 1 level above the highest sufficient level
    - Verify no levels are skipped; pending/error states don't count as completing a level

  - [ ]* 1.5 Write property test for bridging question scoped to axis
    - **Property 3: Bridging question scoped to axis**
    - **Validates: Requirements 2.7**
    - Use fast-check to verify `isBridgingComplete` returns `true` only when a sufficient bridging state exists for the given axis key
    - Verify `pending` and `error` bridging states return `false`

  - [x] 1.6 Implement continuous score and growth label functions in `src/lib/progressionUtils.ts`
    - Implement `computeContinuousScore(knowledgeStates, axisKey, totalRecognitionObjectives, correctRecognitionCount)` — returns a value in [0.0, 5.0] derived from all knowledge states on the axis
    - Implement `scoreToGrowthLabel(score)` — maps continuous score to one of six growth-oriented labels per Requirement 10.4
    - _Requirements: 8.2, 8.3, 10.4_

  - [ ]* 1.7 Write property test for continuous Bloom's score derivation
    - **Property 8: Continuous Bloom's score derivation**
    - **Validates: Requirements 8.2, 8.3**
    - Use fast-check to verify score is in [0.0, 5.0], proportional during Recognition phase, at least 1.0 after bridging, and monotonically non-decreasing with new sufficient evaluations

  - [ ]* 1.8 Write property test for growth-oriented label mapping
    - **Property 9: Growth-oriented label mapping**
    - **Validates: Requirements 10.4**
    - Use fast-check to verify `scoreToGrowthLabel` returns exactly one of six labels for any score in [0.0, 5.0]
    - Verify the six ranges are mutually exclusive and exhaustive

- [ ] 2. Extend `learningUtils.ts` — open-form state text functions
  - [x] 2.1 Add open-form state text types and functions to `src/lib/learningUtils.ts`
    - Define `ParsedOpenFormState` interface with fields: `objectiveText`, `questionType`, `questionText`, `responseText`, `idealAnswer`, `evaluationStatus`, `continuousScore`, `reasoning`
    - Implement `composeOpenFormStateText(objectiveText, questionType, questionText, responseText, idealAnswer)` — composes natural language state text with `pending` evaluation status
    - Implement `parseOpenFormStateText(stateText)` — parses open-form state text back to `ParsedOpenFormState`; returns `null` for non-matching formats
    - Implement `appendEvaluationToStateText(stateText, evaluation)` — updates state text with score, sufficiency, and reasoning
    - Implement `appendEvaluationErrorToStateText(stateText)` — updates state text with `error` status
    - _Requirements: 3.4, 3.8, 5.1, 5.2, 5.4, 7.1, 7.4, 7.5_

  - [ ]* 2.2 Write property test for open-form knowledge state round-trip
    - **Property 4: Open-form knowledge state round-trip**
    - **Validates: Requirements 3.4, 3.8, 5.1, 5.2, 5.4, 7.1**
    - Use fast-check to generate valid open-form response data and verify compose → parse recovers original fields
    - Verify initial evaluation status is `'pending'` and continuous score is `null`

  - [ ]* 2.3 Write property test for knowledge state evaluation update
    - **Property 5: Knowledge state evaluation update**
    - **Validates: Requirements 3.6, 7.4, 7.5**
    - Use fast-check to verify `appendEvaluationToStateText` preserves original fields and sets correct evaluation status/score
    - Verify `appendEvaluationErrorToStateText` sets `error` status while preserving all other fields

- [x] 3. Checkpoint — Ensure all utility function tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Extend `capabilityUtils.js` — enriched evidence type classification
  - [x] 4.1 Add `determineEvidenceTypeEnriched` function to `lambda/capability/capabilityUtils.js`
    - Implement `determineEvidenceTypeEnriched(stateText)` — returns `{ type, questionType, continuousScore, evaluationStatus }` for open-form patterns, `{ type: 'quiz', questionType: 'recognition' }` for Recognition patterns, and `{ type: 'observation' }` for everything else
    - Ensure backward compatibility: existing `determineEvidenceType` remains unchanged
    - Export the new function alongside the existing one
    - _Requirements: 5.7, 9.4, 9.6_

  - [ ]* 4.2 Write property test for extended evidence type classification
    - **Property 7: Extended evidence type classification**
    - **Validates: Requirements 5.7, 9.4, 9.6**
    - Create `lambda/capability/capabilityUtils.test.js` (or extend existing)
    - Use fast-check to verify correct classification for Recognition, each open-form type, pending/error states, and observation text
    - Verify backward compatibility with existing Recognition state texts

- [ ] 5. Extend Learning Lambda — progressive quiz generation
  - [x] 5.1 Add progression derivation to `handleQuizGenerate` in `lambda/learning/index.js`
    - Before generating questions, fetch existing knowledge states for the user on the requested axis
    - Implement server-side `deriveProgressionLevel` logic (mirrors `progressionUtils.ts` but in JS) to determine question type per objective
    - For Recognition objectives: use existing multiple-choice generation flow unchanged
    - For open-form objectives: build extended Bedrock prompt that generates question prompt + ideal reference answer
    - Extend the response to include `questionType`, `bloomLevel`, and `idealAnswer` fields per question
    - _Requirements: 1.1, 1.6, 2.1, 3.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 5.2 Write property test for open-form questions include ideal answer
    - **Property 6: Open-form questions include ideal answer**
    - **Validates: Requirements 3.1, 6.6**
    - Use fast-check to generate quiz response structures and verify every open-form question has non-null, non-empty `idealAnswer`, and every Recognition question has `null` idealAnswer with `options` + `correctIndex` present

- [ ] 6. Add async evaluation endpoint to Learning Lambda
  - [x] 6.1 Add `POST /api/learning/:actionId/quiz/evaluate` handler in `lambda/learning/index.js`
    - Add route matching in the handler's dispatch logic for `quiz/evaluate`
    - Implement `handleEvaluate(actionId, body, organizationId)`:
      - Accept `{ stateId, responseText, idealAnswer, questionType, objectiveText, questionText }`
      - Return `202 Accepted` immediately
      - Call Bedrock asynchronously to evaluate response vs ideal answer, producing `{ score, sufficient, reasoning }`
      - Update the knowledge state's `state_text` via `appendEvaluationToStateText` logic (server-side equivalent)
      - Re-queue embedding generation via SQS for the updated state text
    - Handle evaluation errors: mark state as `error`, log failure
    - _Requirements: 3.5, 3.6, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. Add evaluation status endpoint to Learning Lambda
  - [x] 7.1 Add `GET /api/learning/:actionId/:userId/evaluation-status` handler in `lambda/learning/index.js`
    - Add route matching in the handler's dispatch logic for `evaluation-status`
    - Implement `handleEvaluationStatus(actionId, userId, organizationId, queryParams)`:
      - Accept `stateIds` query parameter (comma-separated UUIDs)
      - Fetch knowledge states by IDs, scoped to organization
      - Parse each state's `state_text` to extract evaluation status, score, sufficiency, and reasoning
      - Return `{ evaluations: [{ stateId, status, score?, sufficient?, reasoning? }] }`
    - _Requirements: 7.6_

- [ ] 8. Extend objectives endpoint with continuous scores
  - [x] 8.1 Extend `handleGetObjectives` in `lambda/learning/index.js` to include `continuousScore` and `progressionLevel` per axis
    - After building the axis response, compute continuous score from knowledge states using server-side `computeContinuousScore` logic
    - Derive progression level per axis from knowledge states
    - Add `continuousScore` (decimal) and `progressionLevel` (question type string) to each axis in the response
    - _Requirements: 8.1, 8.2_

- [x] 9. Checkpoint — Ensure all Lambda tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Extend capability Lambda — open-form evidence in Bedrock prompt
  - [x] 10.1 Extend `handlePerAxisCapability` in `lambda/capability/index.js` to use enriched evidence types
    - Replace `determineEvidenceType(stateText)` call with `determineEvidenceTypeEnriched(stateText)` in the per-axis evidence loop
    - Include `questionType`, `continuousScore`, and `evaluationStatus` in each evidence match object
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6_

  - [x] 10.2 Extend `callBedrockForPerAxisCapability` prompt in `lambda/capability/index.js`
    - Add the extended `EVIDENCE TYPE INTERPRETATION` section to the Bedrock prompt (recognition, bridging, self_explanation, application, analysis, synthesis, observation, pending)
    - Include question type and continuous score in each evidence line item
    - _Requirements: 9.3_

- [ ] 11. Extend `useLearning.ts` hook — new types and mutation hooks
  - [x] 11.1 Extend types and add new hooks in `src/hooks/useLearning.ts`
    - Extend `QuizQuestion` interface with `questionType`, `bloomLevel`, and `idealAnswer` fields
    - Extend `LearningAxis` interface with `continuousScore` and `progressionLevel` fields
    - Add `useQuizEvaluation()` mutation hook for `POST /api/learning/:actionId/quiz/evaluate`
    - Add `useEvaluationStatus(actionId, userId, stateIds)` query hook for `GET /api/learning/:actionId/:userId/evaluation-status`
    - _Requirements: 3.1, 7.6, 8.1_

- [ ] 12. Create `OpenFormInput` component
  - [x] 12.1 Create `src/components/OpenFormInput.tsx`
    - Implement `OpenFormInput` component with props: `question`, `onSubmit`, `onNext`, `idealAnswer`, `evaluationResult`, `isSubmitted`, `isSaving`
    - Render question prompt with Bloom's level context badge
    - Render photo above question text when present
    - Render multi-line textarea with soft guidance ("A few sentences is enough")
    - Submit button → reveals ideal answer in a visually distinct card ("Here's a strong example")
    - Show evaluation result inline (sufficiency badge + reasoning) when available
    - "Next" button to proceed after ideal answer reveal
    - Use growth-oriented language: no "fail" or "incorrect" — use "Keep developing" for insufficient responses
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 10.3, 10.5_

  - [ ]* 12.2 Write component tests for `OpenFormInput`
    - Create `src/components/OpenFormInput.test.tsx`
    - Test: renders textarea for open-form questions
    - Test: reveals ideal answer panel after submission with "Here's a strong example" framing
    - Test: shows "Next" button after ideal answer reveal (no waiting for evaluation)
    - Test: displays evaluation result inline when available
    - Test: no "fail" or "incorrect" language for insufficient responses
    - _Requirements: 4.1, 4.3, 4.4, 10.3, 10.5_

- [ ] 13. Extend `QuizPage` — open-form question flow
  - [x] 13.1 Extend `src/pages/QuizPage.tsx` to handle open-form questions
    - Check `currentQuestion.questionType` to render either `QuestionView` (Recognition) or `OpenFormInput` (open-form)
    - On open-form submission: save knowledge state immediately via `POST /api/states` with open-form state text format, reveal ideal answer, fire-and-forget evaluation call via `useQuizEvaluation`
    - Display growth milestone messages when transitioning to a new question type (e.g., "You're ready to explain your understanding")
    - Poll for evaluation results via `useEvaluationStatus` when quiz completes or when returning to objectives view
    - Extend quiz state machine with `open_form_input → ideal_answer_reveal → (next question)` states
    - _Requirements: 1.4, 3.2, 3.3, 3.4, 4.6, 5.1, 5.2, 7.1, 10.1, 10.2_

  - [ ]* 13.2 Write component tests for extended `QuizPage`
    - Extend `src/pages/QuizPage.test.tsx` (or create if not exists)
    - Test: renders `QuestionView` for Recognition questions, `OpenFormInput` for open-form
    - Test: shows growth milestone message when transitioning to new question type
    - Test: evaluation polling updates component when evaluation completes
    - _Requirements: 1.4, 10.1, 10.2_

- [ ] 14. Extend `GrowthChecklist` (CapabilityAssessment) — continuous scores
  - [x] 14.1 Extend `src/components/CapabilityAssessment.tsx` to display continuous Bloom's scores
    - Import `scoreToGrowthLabel` from `progressionUtils.ts`
    - Display continuous Bloom's score per axis (e.g., "2.4") instead of integer
    - Show growth-oriented label alongside score (e.g., "2.4 — Deepening understanding")
    - Pass continuous scores to `SkillRadialChart` for granular polygon rendering
    - _Requirements: 8.1, 8.4, 10.4_

  - [ ]* 14.2 Write component tests for extended `GrowthChecklist`
    - Test: displays continuous scores with growth labels
    - Test: passes continuous (decimal) values to radar chart
    - _Requirements: 8.1, 10.4_

- [ ] 15. Extend `SkillRadialChart` and `AxisDrilldown` — continuous score display
  - [x] 15.1 Update `src/components/RadialChart.tsx` to accept continuous (decimal) capability levels
    - The chart already uses floating-point math for polygon rendering — verify decimal values render correctly
    - Update hover tooltip to display decimal score (e.g., "2.4 / 3") instead of rounded integer
    - _Requirements: 8.4_

  - [x] 15.2 Extend `src/components/AxisDrilldown.tsx` with continuous score and progression level
    - Display continuous score with growth label (import `scoreToGrowthLabel`)
    - Show progression level indicator (e.g., "Currently working on: Self-Explanation questions")
    - _Requirements: 8.5_

  - [ ]* 15.3 Write component tests for extended `AxisDrilldown`
    - Test: shows continuous score and progression level
    - Test: displays growth-oriented label
    - _Requirements: 8.5, 10.4_

- [x] 16. Checkpoint — Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Deploy Lambda changes and API Gateway endpoints
  - [x] 17.1 Deploy updated `cwf-learning-lambda`
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh learning cwf-learning-lambda`
    - Verify the Lambda deploys successfully with the new evaluate and evaluation-status handlers
    - _Requirements: 3.5, 7.1, 7.6_

  - [x] 17.2 Deploy updated `cwf-capability-lambda`
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh capability cwf-capability-lambda`
    - Verify the Lambda deploys successfully with the enriched evidence type classification
    - _Requirements: 9.1, 9.3_

  - [x] 17.3 Deploy API Gateway changes
    - The learning Lambda already has GET and POST routes registered — the new `evaluate` and `evaluation-status` endpoints use path-based routing within the existing Lambda
    - Run `aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2` to deploy any gateway changes
    - _Requirements: 7.6_

- [x] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Pure utility functions (tasks 1–2) are implemented first because they are testable without infrastructure and form the foundation for Lambda and frontend work
- The existing `determineEvidenceType` function in `capabilityUtils.js` is preserved for backward compatibility — the new `determineEvidenceTypeEnriched` function is added alongside it
- Lambda functions use JavaScript (existing pattern); frontend uses TypeScript (existing pattern)
- No new database tables or columns are needed — all data uses the existing `states`, `state_links`, and `unified_embeddings` tables
