# Requirements Document

## Introduction

The Self-Directed Learning feature shifts the learning model from action-driven quiz generation to learner-driven growth. Currently, skill profiles and quiz questions are derived entirely from the action description — the technical work task defines what the learner studies. This feature introduces a "growth intent" mechanism where learners state what they want to get better at, and the system generates learning content aligned to their stated direction. The action becomes the practice context (a concrete example to apply learning to), not the learning subject itself.

The design philosophy draws from emergent intelligence principles: intelligence emerges when agents pursue their own goals, not when forced into prescribed paths. Different people have different interests and strengths — the system should support diverse growth directions rather than funneling everyone through the same technical learning path. Questions teach a concept first (with a reference link for deeper exploration), then ask the learner to apply it to their specific action context.

When no growth intent is provided, the existing action-driven axis generation and quiz behavior continues unchanged.

Additionally, the evaluation feedback is upgraded for all learners (not just self-directed ones). Instead of a simple "Great depth" / "Keep developing" badge, learners see which Bloom's level they demonstrated, a rephrased summary of what they showed they understand, and a hint about what the next level looks like — making feedback actionable and growth-oriented.

## Glossary

- **Growth_Intent**: A free-text statement from a learner describing what they want to get better at through their work (e.g., "I want to improve my leadership and trust-building skills"). Stored per-action per-user and optionally on the user profile.
- **Growth_Intent_Field**: The optional text input on the SkillProfilePanel UI where a learner enters their growth intent before generating a skill profile.
- **Profile_Intent**: A growth intent stored on the user's profile for reuse across multiple actions. Users can maintain multiple profile intents.
- **Per_Action_Intent**: The growth intent stored alongside a specific skill profile for a specific action. May be auto-filled from a Profile_Intent or entered/overridden manually.
- **Concept_Axis**: A skill axis generated from the learner's growth intent rather than the action description. Each axis represents a distinct concept area the learner can explore (e.g., "Trust Building Frameworks", "Active Listening Techniques", "Stakeholder Mapping").
- **Concept_Reference**: A structured reference to a real framework, research finding, or concept relevant to the growth intent. Includes a `conceptName` and `conceptAuthor` field used to generate a "learn more" search link.
- **Teach_Apply_Question**: An open-form question that presents a concept or framework first (a short teaching moment), then asks the learner how they would apply it to their specific action context. Replaces the current "test what you know" framing with "learn this, then think about how you'd use it."
- **Learn_More_Link**: An auto-generated Google search URL based on the concept name and author (e.g., `https://www.google.com/search?q=Trust+Equation+Maister`), rendered as a clickable link on the concept name in the question UI.
- **Skill_Profile_Generator**: The Bedrock AI function (`generateSkillProfile` in the skill profiles Lambda) that produces skill axes and narrative from action context and optional growth intent.
- **Quiz_Generator**: The functions `generateQuizViaBedrock` and `generateOpenFormQuizViaBedrock` in the Learning Lambda that construct Bedrock prompts and generate quiz questions.
- **Learning_Lambda**: The Lambda handler (`lambda/learning/index.js`) responsible for learning objectives, quiz generation, quiz evaluation, and observation verification.
- **SkillProfilePanel**: The React component (`src/components/SkillProfilePanel.tsx`) that handles skill profile generation, preview, editing, and approval UI.
- **Open_Form_UI**: The `OpenFormInput` component (`src/components/OpenFormInput.tsx`) that renders open-form question input, submission, and post-submission feedback.
- **Evaluator**: The `callBedrockForEvaluation` function in the Learning Lambda that scores learner responses on the Bloom's taxonomy 0–5 scale.
- **Bloom_Feedback**: Structured evaluation feedback that shows the learner which Bloom's level they demonstrated, rephrases what they showed they understand, and hints at what the next level looks like. Replaces the current "Great depth" / "Keep developing" badge with richer, actionable feedback.
- **Demonstrated_Level**: The Bloom's taxonomy level (1–5) that the learner's response reached, as assessed by the Evaluator. Mapped to labels: Remember (1), Understand (2), Apply (3), Analyze (4), Create (5).
- **Concept_Demonstrated**: A rephrased summary of what the learner showed they understand or can do, written in second person ("You showed you can...").
- **Next_Level_Hint**: A brief description of what the next Bloom's level would look like for this concept, giving the learner a concrete growth target.
- **Action_Context**: The action's title, description, expected state, and other metadata — used as the practice ground for applying learned concepts when growth intent is active.

## Requirements

### Requirement 1: Learner Growth Intent Input

**User Story:** As a learner, I want to state what I want to get better at before generating a skill profile, so that the learning content aligns with my personal growth direction rather than being limited to the technical scope of the action.

#### Acceptance Criteria

1. THE SkillProfilePanel SHALL display an optional text field labeled "What do you want to get better at through this work?" above the "Generate Skill Profile" button.
2. THE Growth_Intent_Field SHALL be visually prominent and encouraging (e.g., helper text, warm styling) but SHALL NOT be required to proceed with skill profile generation.
3. WHEN the learner leaves the Growth_Intent_Field blank and clicks "Generate Skill Profile", THE Skill_Profile_Generator SHALL use the existing action-driven axis generation behavior unchanged.
4. WHEN the learner enters text in the Growth_Intent_Field and clicks "Generate Skill Profile", THE SkillProfilePanel SHALL pass the growth intent text to the Skill_Profile_Generator alongside the action context.
5. THE SkillProfilePanel SHALL store the Per_Action_Intent value in the skill profile JSONB on the `actions` table, persisting it across profile regenerations for the same action and user.
6. THE SkillProfilePanel SHALL store a boolean `growth_intent_provided` flag in the skill profile JSONB indicating whether the learner provided a growth intent, for future analysis of self-directed versus default learners.
7. WHEN a skill profile is regenerated for an action, THE SkillProfilePanel SHALL pre-fill the Growth_Intent_Field with the previously stored Per_Action_Intent value if one exists.

### Requirement 2: Growth Intent-Driven Axis Generation

**User Story:** As a learner, I want the skill axes to reflect my stated growth direction rather than the action's technical requirements, so that I learn concepts I care about and apply them to my work context.

#### Acceptance Criteria

1. WHEN a growth intent is provided, THE Skill_Profile_Generator SHALL generate ALL Concept_Axes shaped by the learner's stated growth direction, using the action description as supporting context only.
2. WHEN a growth intent is provided, THE Skill_Profile_Generator SHALL treat the Action_Context as the practice ground for applying learned concepts, not as the primary learning subject.
3. THE Skill_Profile_Generator SHALL identify real frameworks, research, or established concepts relevant to the growth intent and use them to define distinct Concept_Axes (e.g., for growth intent "improve trust and communication": axes like "Trust Building Frameworks", "Active Listening Techniques", "Stakeholder Mapping").
4. EACH Concept_Axis SHALL represent a distinct concept area the learner can explore, with learning objectives grounded in the learner's growth intent and applicable to the action context.
5. THE Skill_Profile_Generator SHALL generate a narrative that explains how the growth intent connects to the action context and what the learner will explore across the axes.
6. WHEN no growth intent is provided, THE Skill_Profile_Generator SHALL use the existing action-driven axis generation behavior, deriving axes from the action description, expected state, and policy.

### Requirement 3: Concept-First Question Generation

**User Story:** As a learner, I want quiz questions that teach me a concept first and then ask me to apply it to my work, so that I learn something new with each question rather than being tested on what I already know.

#### Acceptance Criteria

1. WHEN a growth intent is active for the skill profile, THE Quiz_Generator SHALL generate Teach_Apply_Questions that present a concept or framework first (a short teaching moment), then ask the learner how they would apply it to their specific Action_Context.
2. THE Quiz_Generator SHALL structure each Teach_Apply_Question with the pattern: teach a concept → ask the learner to apply it, replacing the current "test what you know" framing with "learn this, then think about how you'd use it."
3. THE Quiz_Generator SHALL generate a `conceptName` field and a `conceptAuthor` field alongside each question's text, referencing the specific framework, model, or research concept being taught.
4. THE Open_Form_UI SHALL render the `conceptName` as a clickable Learn_More_Link that opens a Google search URL constructed from the concept name and author (e.g., `https://www.google.com/search?q=Trust+Equation+Maister`).
5. WHEN no growth intent is active for the skill profile, THE Quiz_Generator SHALL use the existing question generation behavior unchanged.
6. THE Teach_Apply_Question format SHALL work alongside the existing Bloom's taxonomy progression system — the teach-then-apply framing applies at all progression levels (bridging through synthesis), with the depth of application scaling with the Bloom's level.
7. THE Teach_Apply_Question format SHALL work alongside the existing question lens system — lenses frame the angle of the question while the concept provides the teaching content.

### Requirement 4: Growth Intent Storage and Auto-Fill

**User Story:** As a learner, I want to save my growth intents on my profile and have them auto-fill when I generate skill profiles, so that I do not have to re-type my learning direction for every action.

#### Acceptance Criteria

1. THE user profile settings page SHALL provide a section for managing Profile_Intents, allowing the learner to add, edit, and remove multiple growth intent statements.
2. EACH Profile_Intent SHALL be a free-text string stored in the user's profile data.
3. WHEN the learner opens the SkillProfilePanel to generate a skill profile, THE Growth_Intent_Field SHALL auto-fill from the learner's Profile_Intents. IF multiple Profile_Intents exist, THE SkillProfilePanel SHALL present a selectable list for the learner to choose from.
4. THE learner SHALL be able to override, edit, or clear the auto-filled intent for a specific action before generating the skill profile.
5. THE Per_Action_Intent (the value used at generation time, whether auto-filled or manually entered) SHALL be stored with the skill profile JSONB so it persists across page reloads.
6. WHEN no Profile_Intents exist on the user profile and no Per_Action_Intent is provided, THE Skill_Profile_Generator SHALL use the existing action-driven axis generation behavior unchanged.
7. IF the learner clears the Growth_Intent_Field (removing an auto-filled or previously stored intent) and generates a skill profile, THEN THE Skill_Profile_Generator SHALL revert to action-driven axis generation for that action.

### Requirement 5: Evaluation Context Includes Growth Intent

**User Story:** As a learner, I want my responses to be evaluated in the context of the concept I was learning about, so that the scoring reflects how well I understood and applied the taught concept rather than just the action's technical content.

#### Acceptance Criteria

1. WHEN evaluating a response to a Teach_Apply_Question, THE Evaluator SHALL receive the learner's growth intent and the Concept_Reference (concept name and author) being assessed as part of the evaluation prompt context.
2. THE Evaluator SHALL continue to use the existing Bloom's taxonomy 0–5 continuous scoring scale — the scoring scale remains unchanged.
3. WHEN generating the ideal answer reference for a Teach_Apply_Question, THE Quiz_Generator SHALL base the ideal answer on the taught concept applied to the learner's Action_Context, not solely on the action's technical content.
4. THE Evaluator SHALL assess the learner's response based on how well the learner understood the taught concept and applied it to the action context, using the concept-aware ideal answer as the scoring reference.
5. WHEN no growth intent is active for the skill profile, THE Evaluator SHALL use the existing evaluation behavior unchanged.
6. THE Evaluator SHALL return the structured Bloom_Feedback fields (Demonstrated_Level, Concept_Demonstrated, Next_Level_Hint) as defined in Requirement 6, regardless of whether a growth intent is active.


### Requirement 6: Structured Bloom's Feedback Display

**User Story:** As a learner, I want to see which Bloom's level my response demonstrated, what I showed I understand (rephrased in my own context), and what the next level looks like, so that I get actionable feedback that helps me grow rather than just a pass/fail badge.

#### Acceptance Criteria

1. AFTER a learner submits an open-form response and the Evaluator returns a result, THE Open_Form_UI SHALL display a Bloom_Feedback section that replaces the current "Great depth" / "Keep developing" badge and reasoning text.
2. THE Bloom_Feedback section SHALL display a visual Bloom's level indicator showing the full progression (Remember → Understand → Apply → Analyze → Create) with the learner's Demonstrated_Level highlighted.
3. THE Bloom_Feedback section SHALL display a Concept_Demonstrated summary that rephrases what the learner showed they understand or can do, written in second person (e.g., "You showed you can apply the Trust Equation by identifying that reducing self-orientation means leading with their priorities").
4. WHEN the learner's Demonstrated_Level is below Create (Level 5), THE Bloom_Feedback section SHALL display a Next_Level_Hint describing what the next Bloom's level would look like for this concept (e.g., "To reach Analyze: compare this approach with an alternative trust-building strategy and evaluate the tradeoffs").
5. WHEN the learner's Demonstrated_Level is Create (Level 5), THE Bloom_Feedback section SHALL display an encouraging message acknowledging mastery-level thinking without a next-level hint.
6. THE Evaluator SHALL return the following structured fields in addition to the existing score and reasoning: `demonstratedLevel` (integer 1–5), `conceptDemonstrated` (string), and `nextLevelHint` (string, empty when demonstratedLevel is 5).
7. THE structured Bloom_Feedback display SHALL apply to ALL open-form evaluations — both growth-intent-driven and action-driven skill profiles.
8. THE Evaluator SHALL derive the Demonstrated_Level from the continuous 0–5 score by mapping to the nearest Bloom's level: score 0–0.9 → Remember (1), 1.0–1.9 → Understand (2), 2.0–2.9 → Apply (3), 3.0–3.9 → Analyze (4), 4.0–5.0 → Create (5).
