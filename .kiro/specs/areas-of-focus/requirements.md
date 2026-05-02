# Requirements Document: Areas of Focus

## Introduction

Areas of Focus evolves the current flat "growth intents" (simple strings stored in `organization_members.settings.growth_intents[]`) into rich, structured skill objects that act as persistent growth lenses across multiple actions. Currently, when a learner enters a growth intent, the system generates action-scoped concept axes from scratch each time, loses the learner's original narrative context (the podcast, the person, the personal insight), and has no way to track Bloom's progression for a meta-skill like "Extreme Ownership" across actions.

This feature introduces areas of focus that preserve the learner's original narrative as the primary artifact, generate concept axes once at the profile level, and integrate with the existing question lens system as learner-specific lenses during quiz generation. Areas of focus are completely independent from growth intents and per-action skill profile generation — they do not replace or interact with those systems. Growth intents remain action-scoped (what you want to learn about for THIS action), driving per-action axis generation on the SkillProfilePanel. Areas of focus are profile-scoped meta-skills (a personal growth lens carried across ALL actions) that live in the quiz generation layer as additional context, layering in questions framed through the area of focus's concepts alongside the action's normal learning content.

## Glossary

- **Profile_Skill**: A structured learning skill stored at the user profile level, containing the learner's original narrative, AI-generated concept axes, and Bloom's progression data. Replaces flat growth intent strings as the primary self-directed learning structure.
- **Original_Narrative**: The learner's verbatim input text when creating a profile skill — the raw story, reference, or insight exactly as they expressed it (e.g., "I was listening to Diary of a CEO where Rocco the navy seal was interviewed and he talked about Extreme Ownership..."). Preserved as the primary artifact and never overwritten by AI rephrasing.
- **AI_Interpretation**: A structured AI-generated summary of the learner's original narrative, extracting the core concept, source attribution, and learning direction. Stored alongside the original narrative, never replacing it.
- **Profile_Axis**: A concept axis generated at the profile-skill level from the original narrative. Generated once during skill creation, reusable across multiple actions without regeneration. Each axis has a key, label, description, and a Bloom's progression level.
- **Bloom_Progression**: The learner's current evidence-based confidence level (0–5) for a specific profile axis, computed from the full `progression_history` by the Progression_Model, factoring in recency, consistency, and frequency of demonstrated levels across all actions where the profile skill is applied.
- **Progression_Model**: The algorithm that computes a Profile_Axis's current `bloom_level` from its raw `progression_history`. Informed by learning science principles (spaced repetition, forgetting curve, habit formation research), the model weighs recency, consistency over time, and frequency of demonstration rather than using a simple peak score. The specific algorithm is a design-time decision and is intended to be configurable and evolvable.
- **Profile_Skill_Lens**: A learner-specific question lens derived from a profile skill, injected into the quiz generation prompt as additional context alongside org-level lenses (system, values, custom). Frames quiz questions through the profile skill's concepts applied to the current action scenario. Unlike org-level lenses which are selected via weighted random sampling, profile skill lenses are always included when the learner has active profile skills.
- **Quiz_Generator**: The functions `generateQuizViaBedrock` and `generateOpenFormQuizViaBedrock` in the Learning Lambda that construct Bedrock prompts and generate quiz questions.
- **Skill_Profile_Generator**: The Bedrock AI function (`buildSkillProfilePrompt` in `lambda/skill-profile/index.js`) that produces skill axes and narrative from action context and optional growth intent.
- **Learning_Lambda**: The Lambda handler (`lambda/learning/index.js`) responsible for learning objectives, quiz generation, quiz evaluation, and observation verification.
- **Lens_Selector**: The algorithm in the Learning Lambda that selects 2–3 lenses per quiz round using weighted random sampling, biased by capability gap data.
- **SkillProfilePanel**: The React component (`src/components/SkillProfilePanel.tsx`) that handles skill profile generation, preview, editing, and approval UI.
- **ProfileIntentsSection**: The React component (`src/components/ProfileIntentsSection.tsx`) that currently manages flat growth intent strings on the user profile settings page.

## Requirements

### Requirement 1: Profile Skill Creation and Narrative Preservation

**User Story:** As a learner, I want to create a structured profile skill from my growth intent narrative, so that my original context (the podcast, the person, the personal insight) is preserved as the primary artifact and I get reusable concept axes generated from it.

#### Acceptance Criteria

1. THE ProfileIntentsSection SHALL be replaced with a Profile Skills management section that allows the learner to create, view, and delete Profile_Skills.
2. WHEN the learner creates a new Profile_Skill, THE system SHALL store the learner's input text verbatim as the Original_Narrative field, preserving the exact wording without modification.
3. WHEN a Profile_Skill is created, THE Skill_Profile_Generator SHALL generate an AI_Interpretation containing: a `concept_label` (short name, e.g., "Extreme Ownership"), a `source_attribution` (extracted reference, e.g., "Jocko Willink, Diary of a CEO"), and a `learning_direction` (1–2 sentence summary of the growth direction).
4. WHEN a Profile_Skill is created, THE Skill_Profile_Generator SHALL generate 3–5 Profile_Axes from the Original_Narrative, each with a `key`, `label`, `description`, and an initial `bloom_level` of 0.
5. EACH Profile_Axis SHALL represent a distinct concept area grounded in real frameworks, research, or established concepts relevant to the learner's narrative, consistent with the existing concept-axis generation behavior in the Skill_Profile_Generator.
6. THE Profile_Skill SHALL be stored as a state record in the `states` table with `state_text` containing the serialized profile skill JSON, linked to the user via `captured_by` and to the organization via `organization_id`.
7. WHEN the learner views a Profile_Skill, THE system SHALL display the Original_Narrative prominently as the primary content, with the AI_Interpretation and Profile_Axes displayed as structured supporting information.
8. IF the Skill_Profile_Generator fails to generate the AI_Interpretation or Profile_Axes, THEN THE system SHALL store the Profile_Skill with the Original_Narrative only and allow the learner to retry axis generation.

### Requirement 2: Profile Skills as Quiz Generation Prompt Context

**User Story:** As a learner, I want my profile skills injected as context into the quiz generation prompt, so that the existing Bloom's progression system can determine how to reinforce my meta-skills through whatever interaction format is appropriate for my demonstrated level.

#### Acceptance Criteria

1. WHEN the Quiz_Generator prepares a quiz round for a learner who has one or more active Profile_Skills, THE Learning_Lambda SHALL fetch the learner's Profile_Skills and include them as a Profile_Skill_Lens context block in the quiz generation prompt.
2. THE Learning_Lambda SHALL construct each Profile_Skill_Lens context block from the Profile_Skill's Original_Narrative, AI_Interpretation (`concept_label`, `source_attribution`, `learning_direction`), and Profile_Axes (labels, descriptions, and current `bloom_level`), providing the Quiz_Generator with the full profile skill context.
3. THE Profile_Skill_Lens context SHALL be additive to org-level lenses (System_Lenses, Values_Lenses, Custom_Lenses) — profile skill context does not replace, reduce, or compete with the existing lens selection pool.
4. WHEN the learner has no active Profile_Skills, THE Quiz_Generator SHALL use the existing quiz generation behavior unchanged, with only org-level lenses applied.
5. THE Profile_Skill_Lens integration SHALL NOT modify the per-action skill profile generation flow — growth intents, action-driven axis generation, and the SkillProfilePanel remain completely unchanged by this feature.
6. WHEN the learner has multiple active Profile_Skills, THE Learning_Lambda SHALL include all active Profile_Skills as context in the prompt.
7. THE Profile_Skill_Lens context SHALL be structured as a separate prompt section in the quiz generation prompt, distinct from the org-level lens block.
8. THE existing Bloom's progression prompt SHALL determine the interaction format (reflection, application, analysis, etc.) based on the learner's demonstrated Bloom_Progression level for each Profile_Axis — the Profile_Skill_Lens provides the concept to reinforce, not the interaction type.

### Requirement 3: Bloom's Progression Tracking Across Actions

**User Story:** As a learner, I want my demonstrated Bloom's level for each profile skill axis to be tracked and updated as I complete quizzes across all actions, so that the system builds a science-informed picture of where I am in my growth journey and adjusts the depth and frequency of reinforcement based on evidence of true internalization — not just a single high score.

#### Acceptance Criteria

1. WHEN the Evaluator returns a `demonstratedLevel` for a quiz response where the learner has active Profile_Skills, THE Learning_Lambda SHALL attribute the demonstrated level to each Profile_Axis whose concept was reinforced in that quiz round.
2. THE Learning_Lambda SHALL determine which Profile_Axes were reinforced in a quiz round by checking whether the Profile_Skill_Lens context was included in the quiz generation prompt for that round.
3. THE Learning_Lambda SHALL compute a Profile_Axis's `bloom_level` as a current confidence level derived from the full `progression_history`, factoring in recency of demonstrations, consistency of demonstrated levels over time, and frequency of reinforcement — rather than using a simple high-water-mark or peak score.
4. THE Progression_Model SHALL be informed by learning science principles — including spaced repetition, the forgetting curve, and habit formation research (e.g., Phillippa Lally's finding that habit formation averages ~66 days of consistent practice) — so that `bloom_level` reflects whether the learner has truly internalized the concept, not merely demonstrated it once.
5. THE Progression_Model SHALL allow `bloom_level` to decay when the `progression_history` shows insufficient recent reinforcement, reflecting that without sustained practice, confidence in mastery diminishes over time.
6. WHEN updating a Profile_Axis's `bloom_level`, THE Learning_Lambda SHALL persist the updated Profile_Skill state record in the `states` table, replacing the previous serialized JSON with the updated `bloom_level` values.
7. THE Learning_Lambda SHALL store each progression event as a structured entry in the `progression_history` array on the Profile_Axis, containing the `demonstratedLevel`, `action_id`, `state_id` (the quiz knowledge state), and `timestamp`, providing the raw evidence trail from which `bloom_level` is computed. The `progression_history` SHALL NOT be capped or truncated, as the full temporal record is required for recency and consistency analysis.
8. WHEN the learner has multiple active Profile_Skills, THE Learning_Lambda SHALL update progression independently for each Profile_Skill's axes — a quiz round may contribute progression evidence to axes across multiple Profile_Skills simultaneously.
9. THE Learning_Lambda SHALL taper the frequency of Profile_Skill reinforcement in quiz prompts as the learner demonstrates consistent mastery over a sustained period — a single high demonstration is not sufficient to reduce reinforcement; tapering occurs only after the `progression_history` shows repeated, time-distributed evidence of mastery.
10. THE Progression_Model SHALL be configurable and evolvable — the specific algorithm for computing `bloom_level` from `progression_history` is a design-time decision, and the system SHALL support replacing or tuning the progression algorithm without requiring changes to the data model or storage format.
11. THE updated `bloom_level` values SHALL be reflected in the Profile_Skill_Lens context on the next quiz generation (per Requirement 2.2), closing the feedback loop so the Bloom's progression system adjusts question depth based on the learner's current evidence-based confidence level.

### Requirement 4: Profile Skills Display and Progression Visibility

**User Story:** As a learner, I want to see my profile skills with their current Bloom's level per axis and a sense of how I'm progressing, so that I can understand where I stand in my growth journey without needing to dig into raw data.

#### Acceptance Criteria

1. WHEN the learner views a Profile_Skill, THE Profile Skills management section SHALL display each Profile_Axis with its current `bloom_level` as a visual indicator (e.g., level label or progress representation) alongside the axis label and description.
2. WHEN a Profile_Axis has a `bloom_level` of 0, THE system SHALL display the axis as "Not yet demonstrated" to distinguish it from axes where the learner has progression evidence.
3. WHEN the learner views a Profile_Axis that has `progression_history` entries, THE system SHALL display the most recent demonstration date so the learner can see when they last engaged with that concept.
4. THE Profile Skills management section SHALL display Profile_Skills on the profile settings page, replacing the current ProfileIntentsSection component.

### Requirement 5: Profile Skill Activation and Deactivation

**User Story:** As a learner, I want to activate or deactivate my profile skills, so that I can control which skills are currently influencing my quiz experience without losing the skill and its progression history.

#### Acceptance Criteria

1. THE Profile_Skill SHALL have an `active` status that determines whether the Profile_Skill_Lens is included in quiz generation prompts.
2. WHEN the learner creates a new Profile_Skill, THE system SHALL set the Profile_Skill's `active` status to `true` by default.
3. WHEN the learner deactivates a Profile_Skill, THE system SHALL exclude the Profile_Skill_Lens from subsequent quiz generation prompts while preserving the Profile_Skill record and all `progression_history` data.
4. WHEN the learner reactivates a previously deactivated Profile_Skill, THE system SHALL resume including the Profile_Skill_Lens in quiz generation prompts, using the existing `progression_history` and computed `bloom_level` values.

### Requirement 6: Profile Skill Immutability After Creation

**User Story:** As a learner, I want my profile skill's narrative and axes to remain unchanged after creation, so that my progression history stays valid and meaningful against a stable set of concepts.

#### Acceptance Criteria

1. THE Profile_Skill SHALL NOT support editing of the Original_Narrative or Profile_Axes after creation — if the learner's growth direction changes, the learner creates a new Profile_Skill and deactivates the old one.
2. WHEN the learner deletes a Profile_Skill, THE system SHALL remove the Profile_Skill record and all associated `progression_history` data permanently.
