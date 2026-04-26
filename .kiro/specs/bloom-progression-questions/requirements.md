# Requirements Document

## Introduction

Bloom's Progression Questions extends the Growth Learning Module's quiz system from single-type multiple-choice questions to a progressive ladder of question types mapped to Bloom's taxonomy levels. Currently, the quiz system only supports Recognition (multiple-choice) questions, which cap at Bloom's Level 2 (Understand). A learner who already has deep expertise is forced through simple recall questions when they could demonstrate much higher capability.

This spec introduces five additional question types (Bridging, Self-Explanation, Application, Analysis, Synthesis) that progress the learner through Bloom's levels. Open-form questions are evaluated by AI asynchronously, with pre-generated ideal answers shown immediately for self-comparison. Scoring uses a continuous Bloom's scale (e.g., 2.4) rather than integers, giving learners visible incremental progress. The AI evaluates the actual depth a learner demonstrates — if someone shows Level 4 thinking on a Level 2 question, the system recognizes that.

The design philosophy is growth-oriented: this is a tool to understand where a person is at and help them grow, not a test. Language, framing, and scoring all reinforce development rather than judgment.

## Glossary

- **Recognition Question**: Multiple-choice question testing recall/recognition of facts (Bloom's Level 1 — Remember). The existing quiz question type.
- **Bridging Question**: An open-ended question asked once per axis after completing Recognition, asking the learner to connect concepts to their action context (e.g., "Do you see anything worth adopting for this action?"). Completes Level 1.
- **Self-Explanation Question**: Open-ended prompt asking the learner to explain a concept in their own words (Bloom's Level 2 — Understand).
- **Application Question**: Scenario-based prompt asking the learner to transfer knowledge to a novel context (Bloom's Level 3 — Apply).
- **Analysis Question**: Comparison prompt asking the learner to evaluate tradeoffs between approaches (Bloom's Level 4 — Analyze).
- **Synthesis Question**: Design/teaching prompt asking the learner to construct or teach (Bloom's Level 5 — Create).
- **Continuous Bloom's Score**: A decimal score (e.g., 2.4) representing a learner's demonstrated depth within the Bloom's taxonomy, derived from quiz performance and AI evaluation.
- **Ideal Reference Answer**: A pre-generated model answer shown to the learner immediately after they submit an open-form response, enabling self-comparison as the primary learning mechanism.
- **Sufficiency Judgment**: A binary assessment (sufficient/insufficient) of whether an open-form response meets the expected depth for its question type's Bloom's level.
- **Open-Form Question**: Any question type requiring free-text response evaluated by AI (Bridging, Self-Explanation, Application, Analysis, Synthesis).
- **Closed-Form Question**: A question with a single correct answer from predefined options (Recognition/multiple-choice).

## Requirements

### Requirement 1: Question Type Taxonomy

**User Story:** As a learner progressing through a skill gap, I want to encounter different question types as I advance, so that I can develop deeper levels of understanding beyond recall and recognition.

#### Acceptance Criteria

1. THE System SHALL support five question types, each mapped to a Bloom's taxonomy level:
   - **Recognition** (Level 1 — Remember): Multiple-choice questions testing recall of facts and concepts (existing, no changes needed)
   - **Self-Explanation** (Level 2 — Understand): Open-ended prompts asking the learner to explain a concept in their own words (e.g., "Explain why this works" / "What does this mean in your own words?")
   - **Application** (Level 3 — Apply): Scenario-based prompts asking the learner to transfer knowledge to a novel context (e.g., "How would you apply this in [new situation]?")
   - **Analysis** (Level 4 — Analyze): Comparison prompts asking the learner to evaluate tradeoffs between approaches (e.g., "Compare these two methods and explain the tradeoffs")
   - **Synthesis** (Level 5 — Create): Design/teaching prompts asking the learner to construct or teach (e.g., "Design a procedure for..." / "How would you teach this concept?")
2. THE AI evaluation SHALL assess the actual depth of understanding demonstrated in any response, regardless of the question type asked. A learner who demonstrates Level 4 thinking on a Level 2 question SHALL receive a continuous score reflecting that depth — the system does not artificially cap scores based on question type.
3. THE System SHALL classify questions as either closed-form (Recognition — single correct answer from options) or open-form (Self-Explanation, Application, Analysis, Synthesis — free-text response evaluated by AI).
4. WHEN a learner submits an open-form response, THE System SHALL display an ideal reference answer alongside the AI's evaluation, so the learner can compare their reasoning and learn from the gap between their response and the ideal.
5. EACH question SHALL map to a learning objective from the existing learning objectives system — the new question types use the same objectives, storage model, and progress tracking as the current Recognition questions.
6. THE System SHALL retain the existing multiple-choice quiz generation for Recognition questions — the new question types extend the quiz system rather than replacing it.

### Requirement 2: Bloom's Level Progression Logic

**User Story:** As a learner, I want the system to start me at the right question type for my current level and progress me through harder types as I succeed, so that I'm always working at the edge of my understanding.

#### Acceptance Criteria

1. WHEN generating questions for a learning objective, THE System SHALL select the question type based on the learner's current demonstrated Bloom's level for that objective's skill axis:
   - Level 0 (No exposure): Start with Recognition (multiple-choice)
   - Level 1 (Remember): After passing all Recognition questions for the axis, present one Bridging question per axis — an open-ended prompt asking the learner what from these concepts they would adopt for this action and why
   - Level 2 (Understand): Present Self-Explanation questions
   - Level 3 (Apply): Present Application questions
   - Level 4 (Analyze): Present Analysis questions
   - Level 5 (Create): Present Synthesis questions
2. WHEN a learner successfully completes all questions at their current level for an axis, THE System SHALL offer the next higher question type for that axis's objectives in subsequent rounds.
3. THE System SHALL NOT skip levels — a learner must successfully complete each level before being offered the next.
4. WHEN a learner's response to an open-form question is evaluated as insufficient by the AI, THE System SHALL keep the learner at the current question type for that objective and generate a new question targeting the same level from a different angle.
5. THE progression state for each objective SHALL be derived from the stored knowledge states — the system determines the learner's current level by examining which question types have been successfully completed, not by caching progression state separately.
6. THE System SHALL present all question types through Level 5 (Synthesis) in the quiz progression. Real-world demonstration through the observation verification system provides additional evidence for Level 5 capability but is not the only path to achieving it.
7. THE Bridging question SHALL be scoped to the axis (one per axis, not per objective), reference the specific action context, and be evaluated by AI for whether the learner references relevant concepts and connects them to the action.

### Requirement 3: AI Evaluation of Open-Form Responses

**User Story:** As a learner submitting an open-ended response, I want to keep moving through questions without waiting, and see the ideal answer immediately, so that the learning flow stays smooth.

#### Acceptance Criteria

1. WHEN generating an open-form question, THE System SHALL also generate an ideal reference answer for that question, delivered to the frontend alongside the question.
2. WHEN a learner submits an open-form response, THE System SHALL immediately reveal the pre-generated ideal reference answer so the learner can compare their response to the ideal.
3. THE System SHALL allow the learner to proceed to the next question immediately after viewing the ideal answer — no waiting for AI scoring.
4. THE System SHALL store the learner's response as a knowledge state immediately on submission, recording the question type, response text, and the ideal answer.
5. THE System SHALL evaluate the learner's response against the ideal answer asynchronously via Bedrock, producing a sufficiency judgment (sufficient or insufficient) and a reasoning summary.
6. WHEN the evaluation completes, THE System SHALL update the knowledge state with the sufficiency judgment and reasoning summary.
7. THE evaluation results SHALL be used as context for future quiz generation — past responses, ideal answers, and evaluations inform follow-up question targeting.
8. THE knowledge state for open-form responses SHALL follow the existing natural language format: "For learning objective '{objective}' and {question_type} question '{question}', I responded: '{response_summary}'. Ideal answer: '{ideal_summary}'. Evaluation: {sufficient|insufficient|pending}."

### Requirement 4: Open-Form Question UI

**User Story:** As a learner answering an open-ended question, I want a clear text input area and immediate access to the ideal answer after I submit, so that the experience feels like a learning conversation rather than a test.

#### Acceptance Criteria

1. WHEN the quiz presents an open-form question, THE System SHALL display a text area input instead of multiple-choice options, with the question prompt and its Bloom's level context (e.g., "Explain in your own words" for Self-Explanation, "How would you apply this?" for Application).
2. THE text area SHALL allow multi-line responses with no strict character limit, but SHALL display a soft guidance indicator (e.g., "A few sentences is enough") to set expectations without constraining the learner.
3. WHEN the learner submits their response, THE System SHALL display the ideal reference answer in a visually distinct panel alongside or below the learner's response, enabling side-by-side comparison.
4. THE System SHALL display a "Next" button after the ideal answer is revealed, allowing the learner to proceed at their own pace after reviewing the comparison.
5. WHEN the background evaluation completes while the learner is still viewing the comparison, THE System SHALL display the sufficiency result (sufficient/insufficient) and reasoning summary inline — without disrupting the learner's reading flow.
6. THE open-form question UI SHALL use the same full-page quiz layout, action title header, and axis context as the existing Recognition question UI, maintaining visual consistency.
7. WHEN a question includes a photo from an evidence observation, THE System SHALL display the photo above the question text, consistent with the existing photo-based question display.

### Requirement 5: Knowledge State Storage for Open-Form Responses

**User Story:** As the system, I need to persist open-form responses and their evaluations using the existing states infrastructure, so that learning evidence from all question types is searchable, embeddable, and available for capability assessment.

#### Acceptance Criteria

1. THE System SHALL store open-form responses as knowledge states in the existing states table, following the same pattern as Recognition responses — linked to the learning objective via state_links with entity_type = 'learning_objective'.
2. THE knowledge state state_text for open-form responses SHALL include the question type, the learner's response, and the ideal answer in natural language format: "For learning objective '{objective}' and {question_type} question '{question}', I responded: '{response_text}'. Ideal answer: '{ideal_answer}'."
3. WHEN the async AI evaluation completes, THE System SHALL update the knowledge state's state_text to append the evaluation result: "Evaluation: {sufficient|insufficient}. {reasoning_summary}."
4. THE knowledge state SHALL include a metadata indicator of the question type (recognition, bridging, self_explanation, application, analysis, synthesis) so the capability Lambda can interpret the Bloom's level demonstrated.
5. BOTH the initial storage and the evaluation update SHALL trigger embedding generation via the existing SQS pipeline, ensuring the full response context is searchable.
6. THE System SHALL NOT create new tables or columns — all open-form response data uses the existing states, state_links, and unified_embeddings tables.
7. THE capability Lambda SHALL interpret open-form knowledge states with their question type when assessing Bloom's level — a sufficient Self-Explanation response demonstrates at least Level 2, a sufficient Application response demonstrates at least Level 3, and so on.

### Requirement 6: Quiz Generation for Progressive Question Types

**User Story:** As the system generating quiz questions, I need to produce the right question type at the right Bloom's level with a pre-generated ideal answer for open-form questions, so that the quiz adapts to the learner's progression.

#### Acceptance Criteria

1. WHEN generating a quiz round, THE System SHALL determine the appropriate question type for each objective based on the learner's progression state (derived from stored knowledge states for that axis).
2. FOR Recognition questions (Level 1), THE System SHALL generate multiple-choice questions following the existing generation logic — no changes to the current flow.
3. FOR open-form questions (Bridging, Self-Explanation, Application, Analysis, Synthesis), THE System SHALL generate a question prompt and an ideal reference answer in a single Bedrock call, returning both to the frontend.
4. THE generated ideal answer SHALL reflect the expected depth for the question's Bloom's level — a Self-Explanation ideal demonstrates clear "why" reasoning, an Application ideal shows transfer to a specific context, an Analysis ideal articulates tradeoffs, and a Synthesis ideal presents a coherent design or teaching approach.
5. THE System SHALL use the learner's previous responses and their evaluations as context when generating new questions at the same level — targeting specific gaps identified in prior insufficient responses.
6. THE quiz generation endpoint response SHALL be extended to include a questionType field (recognition, bridging, self_explanation, application, analysis, synthesis) and, for open-form questions, an idealAnswer field.
7. THE System SHALL use Claude Sonnet for all question generation, consistent with the existing quiz generation model choice.

### Requirement 7: Asynchronous Response Evaluation

**User Story:** As the system, I need to evaluate open-form responses in the background with continuous Bloom's scoring, so that learners see granular progress and the quiz adapts to their actual demonstrated depth.

#### Acceptance Criteria

1. WHEN a learner submits an open-form response, THE System SHALL immediately store the knowledge state with evaluation status "pending" and return success to the frontend.
2. THE System SHALL trigger an asynchronous evaluation by invoking the learning Lambda with the response text, ideal answer, question context, and learning objective.
3. THE evaluation SHALL assess the learner's response on a continuous Bloom's scale (e.g., 2.4, 3.1) — not limited to the question type's level. A strong Self-Explanation response that demonstrates application-level thinking SHALL receive a score reflecting that depth (e.g., 3.0+).
4. WHEN the evaluation completes, THE System SHALL update the knowledge state to include the continuous Bloom's score, sufficiency judgment, and reasoning summary, and re-trigger embedding generation for the updated text.
5. IF the evaluation fails (Bedrock timeout, error, or malformed response), THE System SHALL mark the evaluation status as "error" and log the failure. The learner's response remains stored and the quiz flow is not affected.
6. THE frontend SHALL poll or check for evaluation results when the learner returns to the learning objectives view or completes the quiz.
7. FOR progression decisions, THE System SHALL use the continuous score — a score at or above the next level's threshold advances the learner to that question type. A score of 2.8 on a Self-Explanation question could advance the learner to Application questions.
8. THE quiz system SHALL present all question types through Level 5 (Synthesis). Real-world demonstration through the observation verification system provides additional evidence but the quiz is not artificially capped.
9. THE System SHALL treat "pending" evaluations as incomplete for progression decisions — the learner stays at the current level until evaluation confirms advancement.

### Requirement 8: Continuous Bloom's Progress Display

**User Story:** As a learner, I want to see my Bloom's level as a continuous score that shows incremental progress, so that I can see I'm growing even before reaching the next whole level.

#### Acceptance Criteria

1. THE Growth_Checklist SHALL display the learner's current Bloom's level for each skill axis as a continuous value (e.g., "0.8", "2.4") reflecting their progress through the question type progression.
2. THE System SHALL derive the continuous score from all knowledge states on the axis:
   - Recognition phase: Score is proportional to correct first-attempt answers (e.g., 4 of 5 correct = 0.8 within the Level 0–1 range)
   - Bridging phase: Completing the bridging question reaches 1.0
   - Open-form phases: The AI's continuous Bloom's score from evaluated responses (e.g., 2.4 for a Self-Explanation response)
3. THE displayed score SHALL be the highest achieved score across all evaluated knowledge states for that axis.
4. THE radar chart visualization SHALL use the continuous score for plotting the learner's polygon, providing granular visual representation of progress.
5. THE axis drilldown SHALL show the continuous score alongside the required level, with a visual indicator of progress toward the next whole level.

### Requirement 9: Capability Assessment Integration

**User Story:** As the system assessing a person's capability, I need to interpret open-form knowledge states with their question type and continuous score, so that the capability profile accurately reflects the depth of understanding demonstrated through progressive questions.

#### Acceptance Criteria

1. THE capability Lambda SHALL interpret knowledge states from all question types when computing a person's Bloom's level for each axis — not just Recognition (multiple-choice) responses.
2. THE capability Lambda SHALL use the continuous Bloom's score from evaluated open-form responses as direct evidence of the person's demonstrated level. A sufficient Self-Explanation response scored at 2.4 provides stronger evidence of Level 2 capability than a Recognition-only completion.
3. THE Bedrock prompt for capability assessment SHALL include the question type and continuous score for each knowledge state, so the AI can weight evidence appropriately — open-form responses that demonstrate reasoning carry more weight than multiple-choice recognition.
4. THE capability Lambda SHALL continue to use the existing evidence type classification (determineEvidenceType) — open-form knowledge states still contain "sufficient" or "insufficient" markers that the function can detect.
5. THE capability assessment SHALL NOT be blocked by pending evaluations — knowledge states with "pending" evaluation status are included as evidence but with a note that evaluation is in progress.
6. THE existing determineEvidenceType function SHALL be extended to recognize open-form response patterns in state text, classifying them with their question type for richer Bedrock prompting.

### Requirement 10: Growth-Oriented Framing

**User Story:** As a learner, I want the progression experience to feel like growth and development rather than testing and grading, so that I'm motivated to engage deeply rather than anxious about getting things wrong.

#### Acceptance Criteria

1. THE System SHALL frame question type transitions as growth milestones, not difficulty levels — e.g., "You're ready to explain your understanding" rather than "Moving to harder questions."
2. THE System SHALL use encouraging language in the quiz UI when presenting new question types — acknowledging the learner's progress and framing the new type as the next step in their development.
3. WHEN displaying the ideal reference answer after an open-form submission, THE System SHALL frame it as "Here's a strong example" rather than "The correct answer is" — reinforcing that open-form responses have multiple valid approaches.
4. THE continuous Bloom's score SHALL be presented with growth-oriented labels alongside the number:
   - 0.0–0.9: "Building foundations"
   - 1.0–1.9: "Developing recall"
   - 2.0–2.9: "Deepening understanding"
   - 3.0–3.9: "Applying knowledge"
   - 4.0–4.9: "Analyzing and evaluating"
   - 5.0: "Creating and teaching"
5. THE System SHALL NOT display "fail" or "incorrect" language for insufficient open-form responses — instead using "Keep developing" or "There's more to explore here" with the reasoning summary showing what to focus on next.