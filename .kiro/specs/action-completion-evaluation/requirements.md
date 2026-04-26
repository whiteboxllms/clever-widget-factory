# Requirements Document

## Introduction

The Action Completion Evaluation feature adds a holistic assessment system that triggers when a person completes an action. Rather than evaluating against an external standard, the system assesses the person against their own policy, learning plan, and growth intent — reflecting the emergent intelligence principle that intelligence emerges when agents pursue their own goals.

When an action transitions to `completed` status, the system gathers all available evidence: the action's policy, the person's learning data (quiz scores, Bloom's levels across skill axes, capability profiles), their implementation updates/observations, and their learning takeaways. An AI evaluator produces a structured completion evaluation covering five dimensions:

1. **Policy Alignment** — how well the person's work aligned with their own plan
2. **Skill Demonstration** — what Bloom's levels they demonstrated across their skill axes
3. **Evidence Quality** — to what degree was the work documented
4. **Delta from Desired State** — the gap (or surplus) between observed outcomes and the expected state (S')
5. **Advantage** — estimated value impact of the person's actions, computed from observations and contextual data (asset counts, prices, historical baselines)

The evaluation also analyzes deviations from the person's policy — classifying each as intentional (a conscious choice with reasoning) or unintentional (an oversight) — so the person can reflect on where they adapted deliberately versus where they drifted.

The evaluation is stored as a structured record linked to the action and surfaced in the UI as a completion report — not just a number, but actionable feedback that helps the person understand where they demonstrated skill, where they fell short, and what to focus on next.

The feature integrates with the existing `action_scores` table for persistence and reuses the existing Bedrock AI infrastructure for evaluation. No new Lambda functions are required — the evaluation logic is added to the existing Learning Lambda as a new endpoint.

## Glossary

- **Completion_Evaluation**: A structured assessment generated when an action transitions to `completed` status, covering policy alignment, skill demonstration, evidence quality, delta from desired state, and advantage. Stored as a record in the `action_scores` table with `source_type = 'completion_evaluation'`.
- **Completion_Evaluator**: The AI evaluation function in the Learning Lambda that receives action context, policy, learning data, observations, and contextual data, and produces a structured Completion_Evaluation via Bedrock.
- **Policy_Alignment_Score**: A 0.0–5.0 continuous score reflecting how well the person's work aligned with their own action policy. 0 = minimal alignment, 5 = exemplary alignment with evidence of deep understanding.
- **Skill_Demonstration_Score**: A 0.0–5.0 continuous score reflecting the Bloom's levels the person demonstrated across skill axes during the action. Based on the delta between starting and ending capability levels.
- **Evidence_Quality_Score**: A 0.0–5.0 continuous score reflecting to what degree the person's work was documented through implementation updates and observations.
- **Delta_Score**: A 0.0–5.0 continuous score reflecting the gap or surplus between observed outcomes and the action's expected state (S'). 0 = significant gap from S', 5 = met or exceeded S'.
- **Advantage_Score**: A 0.0–5.0 continuous score reflecting the estimated value impact of the person's actions. Computed from observations, contextual data (asset counts, inventory prices, historical baselines), and organizational values. Where possible, includes a monetary estimate.
- **Advantage_Estimate**: A structured monetary or quantitative estimate of the value created by the person's actions, including the basis for the estimate (e.g., "yield increase of 50kg × ₱10/kg = ₱500"). Stored alongside the Advantage_Score when computable.
- **Overall_Score**: A weighted composite of the five dimension scores, on the 0.0–5.0 scale.
- **Deviation_Analysis**: A structured list of identified departures from the action's policy. Each deviation includes a description and the reason for the departure if one was documented in the observations. Deviations without documented reasons are flagged for the person to provide context during the Reflect & Update flow.
- **Deviation**: A single identified departure from the action's policy, with a description and the reason extracted from observations (or flagged as needing input if no reason was documented).
- **Axis_Summary**: A per-axis summary showing the person's starting Bloom's level, ending Bloom's level, and a narrative of what skill was demonstrated.
- **Completion_Report**: The UI component that displays the Completion_Evaluation results to the person, including scores, axis summaries, deviation analysis, advantage estimate, strengths, and recommendations.
- **Evidence_Bundle**: The collected set of inputs sent to the Completion_Evaluator: action context (title, description, expected_state), policy text, skill profile axes, capability profile (current levels), learning states (quiz answers, open-form evaluations), implementation updates, learning takeaways, and contextual data (asset details, inventory prices, historical actions).
- **Action_Policy**: The rich text field on an action describing the plan or policy for how the action should be carried out, including any learning takeaways appended during the action.
- **Implementation_Updates**: Records in the `action_implementation_updates` table documenting work progress during the action.
- **Learning_Lambda**: The Lambda handler (`lambda/learning/index.js`) responsible for learning objectives, quiz generation, quiz evaluation, and now completion evaluation.
- **UnifiedActionDialog**: The React component (`src/components/UnifiedActionDialog.tsx`) that renders the action detail/edit dialog.
- **Skill_Profile**: The JSONB field on the action containing skill axes with required Bloom's levels and optional growth intent.
- **Capability_Profile**: The computed profile showing the person's current demonstrated Bloom's level per skill axis, based on evidence from quiz responses and observations.

## Requirements

### Requirement 1: Trigger Evaluation via Reflect & Update

**User Story:** As a person who has completed an action, I want to trigger an AI assessment when I'm ready to reflect, so that I can review my work on my own terms.

#### Acceptance Criteria

1. WHEN an action has status `completed`, THE UnifiedActionDialog SHALL display a "Reflect & Update" button.
2. WHEN the person clicks "Reflect & Update", THE frontend SHALL call the Completion_Evaluator endpoint to generate an AI assessment as a starting point for reflection.
3. IF the action has no policy AND no skill profile AND no expected_state, THEN THE Completion_Evaluator SHALL skip the AI assessment, since there is insufficient context to evaluate against — but the person SHALL still be able to create a manual reflection.
4. IF the action has a policy but no skill profile, THEN THE Completion_Evaluator SHALL assess policy alignment, evidence quality, delta from desired state, and advantage — omitting skill demonstration.
5. IF the action has a skill profile but no policy, THEN THE Completion_Evaluator SHALL assess skill demonstration, evidence quality, delta from desired state, and advantage — omitting policy alignment.
6. WHEN the AI assessment is generated, THE Completion_Evaluator SHALL store the assessment timestamp in the action's `scoring_data` JSONB field under a `completion_evaluated_at` key.
7. WHILE the AI assessment is being generated, THE UI SHALL display a loading state and disable the "Reflect & Update" button.

### Requirement 2: Reflect and Update Flow

**User Story:** As a person completing an action, I want the AI assessment as a starting point for my reflection, so that I can add my own context, adjust the evaluation, and have the final say on what I accomplished.

#### Acceptance Criteria

1. WHEN the AI assessment is generated, THE Completion_Report SHALL present it as a draft starting point — not a final grade — that the person can review, adjust, and augment.
2. THE person SHALL be able to add free-text context to any dimension (e.g., "there was a drought this month that affected yield") to provide information the AI couldn't access.
3. THE person SHALL be able to adjust any dimension score if they disagree with the AI's assessment, with their adjustment becoming the final recorded score.
4. THE person SHALL be able to define the actual Advantage with their own context and reasoning, using the AI's estimate as a starting point.
5. WHEN the person saves their reflection, THE final evaluation (AI assessment + person's adjustments and context) SHALL be stored as the Completion_Evaluation record.
6. THE Completion_Evaluation record SHALL preserve both the original AI assessment and the person's adjustments, so the delta between AI and person is visible.
7. IF no AI assessment was generated (skipped per Requirement 1.3), THE person SHALL still be able to create a manual reflection with self-assessed scores and context.

### Requirement 3: Gather Evidence Bundle

**User Story:** As the system, I want to collect all relevant evidence about the person's work on the action, so that the AI assessment is comprehensive and grounded in actual data.

#### Acceptance Criteria

1. WHEN preparing an AI assessment, THE Completion_Evaluator SHALL gather the action's title, description, and expected_state as context.
2. THE Completion_Evaluator SHALL gather the action's full policy text (including any appended learning takeaways).
3. THE Completion_Evaluator SHALL gather all implementation updates from the `action_implementation_updates` table for the action, ordered by creation date.
4. THE Completion_Evaluator SHALL gather all observations (states) linked to the action via `state_links` where `entity_type = 'action'`, including their full `state_text` and `captured_at` timestamps. System-internal states with `[learning_objective]` or `[capability_profile]` prefixes SHALL be excluded.
5. THE Completion_Evaluator SHALL gather all learning takeaways linked to the action (states with `[learning_takeaway]` prefix), as these represent ideas the person captured during learning sessions.
6. WHEN a skill profile exists, THE Completion_Evaluator SHALL gather the skill profile axes (keys, labels, required levels) as the standard the person set for themselves. THE Completion_Evaluator SHALL NOT gather prior quiz scores or capability levels — skill demonstration SHALL be assessed solely from the work evidence (observations and implementation updates).
7. WHEN a skill profile exists, THE Completion_Evaluator SHALL gather the person's growth intent if one was provided.
8. THE Completion_Evaluator SHALL gather contextual data for advantage estimation: the action's linked asset details, relevant inventory prices from the `parts` table, and historical actions on the same asset for baseline comparison.

### Requirement 4: Assess Policy Alignment

**User Story:** As a person, I want to see how well my work aligned with my own policy and plan, so that I can reflect on whether I executed what I committed to.

#### Acceptance Criteria

1. THE Completion_Evaluator SHALL compare the person's observations and implementation updates against the action's policy to determine the degree of alignment.
2. THE Completion_Evaluator SHALL produce a Policy_Alignment_Score on the 0.0–5.0 continuous scale, where: 0–1 = minimal alignment with significant gaps, 1–2 = partial alignment with notable omissions, 2–3 = moderate alignment with some gaps, 3–4 = strong alignment with minor gaps, 4–5 = exemplary alignment with evidence of deep understanding.
3. THE Completion_Evaluator SHALL produce a narrative explanation of the Policy_Alignment_Score, citing specific policy points that were addressed and specific points that were not.
4. THE Completion_Evaluator SHALL identify each Deviation from the policy as a structured object containing: a description of the departure and the reason for the deviation if one can be found in the observations or implementation updates.
5. WHEN a Deviation has no documented reason in the evidence, THE Completion_Evaluator SHALL flag it as needing input, so that the Reflect & Update flow (Requirement 2) can prompt the person to provide the reason for the deviation.
6. THE Completion_Evaluator SHALL produce a summary count of deviations with documented reasons versus deviations needing input.

### Requirement 5: Assess Skill Demonstration

**User Story:** As a person, I want to see what skill levels I demonstrated through my work on this action, so that I can understand what I showed I'm capable of — based on the work itself, not quiz scores.

#### Acceptance Criteria

1. WHEN a skill profile exists, THE Completion_Evaluator SHALL produce an Axis_Summary for each skill axis containing: the axis label, the required Bloom's level (from the skill profile), the demonstrated Bloom's level (assessed from work evidence), and a narrative describing what the person showed they can do on that axis.
2. THE Completion_Evaluator SHALL produce a Skill_Demonstration_Score on the 0.0–5.0 continuous scale, reflecting the overall demonstrated skill across all axes relative to the required levels.
3. THE Completion_Evaluator SHALL highlight axes where the person demonstrated skill beyond the required level, and axes where the demonstrated level remains below, with specific observations from the evidence.
4. WHEN a growth intent was provided, THE Completion_Evaluator SHALL assess whether the person's demonstrated skills aligned with their stated growth direction and include this in the narrative.

### Requirement 6: Assess Evidence Quality

**User Story:** As a person, I want feedback on how well I documented my work, so that I can improve how I capture and communicate what I do.

#### Acceptance Criteria

1. THE Completion_Evaluator SHALL produce an Evidence_Quality_Score on the 0.0–5.0 continuous scale reflecting to what degree the person's work was documented through implementation updates and observations.
2. THE Completion_Evaluator SHALL produce a narrative explanation of the Evidence_Quality_Score, noting what was well-documented and what lacked documentation.

### Requirement 7: Assess Delta from Desired State

**User Story:** As a person, I want to see how close my outcomes are to the state I wanted to achieve, so that I can understand the gap or surplus between what I aimed for and what happened.

#### Acceptance Criteria

1. THE Completion_Evaluator SHALL compare the person's observations and implementation updates against the action's expected_state (S') to assess the delta between observed outcomes and the desired state.
2. THE Completion_Evaluator SHALL produce a Delta_Score on the 0.0–5.0 continuous scale, where lower scores indicate a significant gap from S' and higher scores indicate the desired state was met or exceeded.
3. THE Completion_Evaluator SHALL produce a narrative explaining what elements of S' were achieved, what remains unachieved, and where outcomes exceeded expectations.

### Requirement 8: Assess Advantage

**User Story:** As a person, I want to see the estimated value impact of my work, so that I can understand what advantage my actions created — and refine that estimate with my own context.

#### Acceptance Criteria

1. THE Completion_Evaluator SHALL estimate the value impact of the person's actions relative to the status quo baseline (what would have happened without the person's intervention), inferred from the action context, asset details, inventory prices from the `parts` table, and historical actions on the same asset.
2. WHERE measurable outcomes exist in the observations, THE Completion_Evaluator SHALL produce an Advantage_Estimate containing a monetary or quantitative value and the basis for the estimate (e.g., "yield increase of 50kg × ₱10/kg = ₱500"), showing the delta from the inferred status quo.
3. WHEN the advantage involves projections into the future (ongoing yield, recurring savings, long-term impact), THE Completion_Evaluator SHALL use expected values to estimate the impact, clearly stating the assumptions and time horizon used.
4. THE Completion_Evaluator SHALL break down the components of the estimate (inputs, assumptions, calculations) so the person can see how the advantage was derived and refine individual components during the Reflect & Update flow.
5. THE Completion_Evaluator SHALL produce an Advantage_Score on the 0.0–5.0 continuous scale reflecting the magnitude of estimated value created.
6. THE Completion_Evaluator SHALL produce a narrative explaining the advantage assessment, including what data was used and what assumptions were made.

### Requirement 9: Overall Score and Recommendations

**User Story:** As a person, I want a holistic view and actionable next steps, so that I have a clear picture of my work and know what to focus on next.

#### Acceptance Criteria

1. THE Completion_Evaluator SHALL compute an Overall_Score as a weighted composite of the available dimension scores on the 0.0–5.0 scale.
2. WHEN a dimension is not applicable (no policy, no skill profile, or no expected_state), THE Completion_Evaluator SHALL compute the Overall_Score from the remaining applicable dimensions only.
3. THE Completion_Evaluator SHALL produce a list of up to three strengths observed during the action, each grounded in specific evidence.
4. THE Completion_Evaluator SHALL produce a list of up to three recommendations for the person's next action, each as a specific, actionable suggestion tied to an identified gap or opportunity.
5. THE Completion_Evaluator SHALL produce a one-paragraph overall narrative summarizing the person's work across the dimensions.

### Requirement 10: Store Completion Evaluation as States

**User Story:** As the system, I want to persist the evaluation results as states, so that they are searchable via semantic search, linkable to entities, and contribute to organizational memory.

#### Acceptance Criteria

1. THE Completion_Evaluator SHALL store the evaluation as multiple states, each with a distinct prefix, linked to the action via `state_links` with `entity_type = 'action'`.
2. THE Completion_Evaluator SHALL create a `[completion_reflection]` state containing: the overall score, overall narrative, strengths, and recommendations. One per evaluation.
3. THE Completion_Evaluator SHALL create a `[policy_alignment]` state containing: the Policy_Alignment_Score, narrative, and the list of deviations with their reasons. One per evaluation. Omitted when no policy exists.
4. THE Completion_Evaluator SHALL create a `[skill_demonstrated]` state for each skill axis containing: the axis label, required Bloom's level, demonstrated Bloom's level, and narrative. Multiple states if multiple axes. Omitted when no skill profile exists.
5. THE Completion_Evaluator SHALL create an `[evidence_quality]` state containing: the Evidence_Quality_Score and narrative. One per evaluation.
6. THE Completion_Evaluator SHALL create a `[delta_assessment]` state containing: the Delta_Score, narrative, and what elements of S' were achieved or exceeded. One per evaluation. Omitted when no expected_state exists.
7. THE Completion_Evaluator SHALL create an `[advantage_estimate]` state containing: the Advantage_Score, monetary or quantitative estimate, components breakdown, assumptions, and narrative. One per evaluation.
8. EACH evaluation state SHALL be queued for embedding generation via the existing SQS embeddings pipeline, so that evaluation content is searchable via semantic search.
9. THE Completion_Evaluator SHALL store the person's adjustments from the Reflect & Update flow (Requirement 2) by updating the relevant states with the person's context and revised scores.
10. THE Completion_Evaluator SHALL update the action's `scoring_data` JSONB field with a `completion_evaluated_at` timestamp.

### Requirement 11: Display Completion Report

**User Story:** As a person, I want to see my completion evaluation as a structured report in the action dialog, so that I can review the AI's assessment and reflect on my work.

#### Acceptance Criteria

1. WHEN a completed action has evaluation states, THE UnifiedActionDialog SHALL display a Completion_Report section.
2. THE Completion_Report SHALL display the Overall_Score prominently with a visual indicator (color-coded: 0–2 developing, 2–3.5 solid, 3.5–5 strong).
3. THE Completion_Report SHALL display each dimension score with its narrative, using collapsible sections for detail.
4. WHEN Axis_Summaries exist, THE Completion_Report SHALL display each axis as a visual indicator showing required level vs. demonstrated level on the Bloom's scale.
5. WHEN deviations were identified, THE Completion_Report SHALL display them as a list, with deviations needing input (no documented reason) visually distinguished so the person knows to provide context.
6. WHEN an Advantage_Estimate exists, THE Completion_Report SHALL display the estimate with its component breakdown, clearly labeled as an AI estimate that the person can refine.
7. THE Completion_Report SHALL display the strengths and recommendations sections.
8. WHEN no evaluation states exist for a completed action, THE UnifiedActionDialog SHALL display the "Reflect & Update" button (per Requirement 1.1).
9. WHEN evaluation states exist, THE Completion_Report SHALL display a "Re-reflect" button that triggers a fresh AI assessment with the latest evidence, creating new evaluation states while preserving the previous ones.

### Requirement 12: Completion Evaluation API Endpoint

**User Story:** As the frontend, I want a dedicated API endpoint to trigger and retrieve completion evaluations, so that the evaluation can be requested and displayed independently.

#### Acceptance Criteria

1. THE Learning_Lambda SHALL expose a `POST /api/learning/:actionId/completion-evaluation` endpoint that triggers a Completion_Evaluation for the specified action.
2. THE endpoint SHALL validate that the action exists, belongs to the caller's organization, and has status `completed`.
3. IF the action status is not `completed`, THEN THE endpoint SHALL return a 400 error with a descriptive message.
4. THE endpoint SHALL return the structured evaluation response (all dimension scores, narratives, deviations, axis summaries, advantage estimate, strengths, recommendations).
5. THE Learning_Lambda SHALL expose a `GET /api/learning/:actionId/completion-evaluation` endpoint that retrieves the most recent evaluation states for the specified action.
6. WHEN no evaluation states exist for the action, THE GET endpoint SHALL return a 404 response.
