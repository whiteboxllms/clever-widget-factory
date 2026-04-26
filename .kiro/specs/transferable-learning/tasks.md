# Tasks: Transferable Learning

## Task 1: Add skill_axis entity type to embeddings processor

- [x] 1.1 Add `'skill_axis'` to the `validTypes` array in `lambda/embeddings-processor/index.js`
- [x] 1.2 Deploy the updated embeddings processor Lambda
- [x] 1.3 Verify the processor accepts and processes `skill_axis` SQS messages (manual test with a test message)

## Task 2: Implement per-axis embedding generation on skill profile approval

- [x] 2.1 Create `composeAxisEmbeddingSource(axis, narrative)` function in `lambda/skill-profile/index.js` that composes embedding source from axis label, optional description, and narrative
- [x] 2.2 Create `composeAxisEntityId(actionId, axisKey)` and `parseAxisEntityId(entityId)` utility functions in `lambda/skill-profile/index.js`
- [x] 2.3 Update `handleApprove` in `lambda/skill-profile/index.js` to delete existing `skill_axis` embeddings for the action (`DELETE FROM unified_embeddings WHERE entity_type='skill_axis' AND entity_id LIKE '{action_id}:%'`)
- [x] 2.4 Update `handleApprove` to generate and await SQS messages for each axis embedding with `entity_type='skill_axis'` and `entity_id='{action_id}:{axis_key}'`
- [x] 2.5 Ensure existing `action_skill_profile` embedding generation is retained for backward compatibility
- [x] 2.6 Deploy the updated skill-profile Lambda
- [x] 2.7 Write property test for axis embedding source composition (Property 8)
- [x] 2.8 Write property test for axis entity ID round-trip (Property 9)
- [x] 2.9 Write property test for per-axis embedding message generation (Property 4)

## Task 3: Implement semantic evidence tagging in learning Lambda

- [x] 3.1 Create `filterCompletedKnowledgeStates(states, userId)` pure function that filters to states captured by the target user with "correct answer" in state_text
- [x] 3.2 Create `extractBestMatch(similarityResults)` pure function that returns `{ similarityScore, matchedObjectiveText }` from the highest-similarity result
- [x] 3.3 Create `extractTopKMatches(similarityResults, k=5)` pure function that returns the top K results ordered by similarity descending with `{ similarityScore, sourceText }`
- [x] 3.4 Update `handleGetObjectives` in `lambda/learning/index.js` to perform vector similarity search per objective against user's completed knowledge states
- [x] 3.5 Update the objective response shape to include `similarityScore`, `matchedObjectiveText`, and `priorLearning[]` instead of `evidenceTag`
- [x] 3.6 Remove the `tagObjectiveEvidence` function and `fetchEvidenceObjectiveIds` function (replaced by semantic search)
- [x] 3.7 Deploy the updated learning Lambda
- [x] 3.8 Write property test for completed knowledge state filtering (Property 1)
- [x] 3.9 Write property test for best match extraction (Property 2)
- [x] 3.10 Write property test for top-K similarity results extraction (Property 5)
- [x] 3.11 Write property test for new objective status invariant (Property 7)

## Task 4: Implement per-axis evidence retrieval in capability Lambda

- [x] 4.1 Update `handleIndividualCapability` in `lambda/capability/index.js` to fetch `skill_axis` embeddings for each axis from `unified_embeddings`
- [x] 4.2 Replace the single whole-profile vector search with per-axis vector searches against user's states
- [x] 4.3 Collect top 5 matches per axis with similarity scores, source text, and evidence type (quiz vs observation)
- [x] 4.4 Update the Bedrock prompt to include per-axis evidence with evidence type labels and request per-axis narratives
- [x] 4.5 Update the response shape to include per-axis `evidence` array with `similarity_score`, `evidence_type`, and `axis_narrative`
- [x] 4.6 Add fallback: if no `skill_axis` embeddings exist, fall back to existing `action_skill_profile` whole-profile search
- [x] 4.7 Deploy the updated capability Lambda
- [x] 4.8 Write property test for evidence search scoping (Property 3)

## Task 5: Implement similarity threshold classification utility

- [x] 5.1 Create `classifySimilarity(score)` pure function in `src/lib/learningUtils.ts` that returns `'likely_covered'` (≥0.8), `'related_learning'` (≥0.5), or `'new_material'` (<0.5)
- [x] 5.2 Export similarity threshold constants from `src/lib/learningUtils.ts`
- [x] 5.3 Write property test for similarity threshold classification (Property 6)

## Task 6: Update frontend types and hooks

- [x] 6.1 Update `LearningObjective` interface in `src/hooks/useLearning.ts` to replace `evidenceTag` with `similarityScore`, `matchedObjectiveText`, and `priorLearning[]`
- [x] 6.2 Add `PriorLearningMatch` interface to `src/hooks/useLearning.ts`
- [x] 6.3 Update capability profile types to include per-axis `evidence` array with `similarity_score`, `evidence_type`, and `axis_narrative`

## Task 7: Update ObjectivesView component for prior learning display

- [x] 7.1 Update `ObjectivesView` (in the QuizPage flow) to use `similarityScore` and `classifySimilarity` for required/optional classification instead of `evidenceTag`
- [x] 7.2 Display "Likely covered" indicator with matched text for objectives with `similarityScore >= 0.8`
- [x] 7.3 Display "Related learning found" indicator for objectives with `0.5 <= similarityScore < 0.8`
- [x] 7.4 Add expandable section showing `priorLearning` matches for each objective
- [x] 7.5 Write component tests for the three similarity threshold displays

## Task 8: Update CapabilityAssessment component for per-axis evidence

- [x] 8.1 Update `AxisDrilldown` component to display per-axis evidence matches with similarity scores and evidence type badges
- [x] 8.2 Display `axis_narrative` from Bedrock in the `AxisDrilldown` sheet
- [x] 8.3 Add graceful degradation: handle missing `similarityScore`, `priorLearning`, and `axis_narrative` fields
- [x] 8.4 Write component tests for per-axis evidence display and graceful degradation
