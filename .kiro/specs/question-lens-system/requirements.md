# Requirements Document

## Introduction

The Question Lens System introduces diversity and depth into quiz generation by approaching learning objectives from multiple angles ("lenses") rather than rephrasing the same concept. The system defines three lens sources — built-in system lenses, auto-derived organization values lenses, and custom org-defined lenses — and uses weighted random selection to pick 2–3 lenses per quiz round. Lens selection is further biased by organization-level capability gaps so that struggling areas receive more rigorous questioning. Quiz generation is enriched with cross-domain asset context via vector search against skill axis embeddings. The ideal answer display for open-form questions is removed from the UI (while retained for AI evaluation), and open-form question generation is tuned for high-ceiling critical thinking expression. A Lens Management UI on the Organization settings page gives leadership control over lens weights and custom lens definitions.

## Glossary

- **Lens**: A lightweight instruction passed to the quiz generation prompt that frames a learning objective from a specific angle (e.g., failure analysis, underlying science, org value alignment).
- **System_Lens**: A built-in lens that ships with the platform and cannot be deleted, only weight-adjusted or disabled.
- **Values_Lens**: A lens auto-derived from an organization's `strategic_attributes` (organization values). Each org value becomes a lens automatically.
- **Custom_Lens**: An organization-defined lens created by leadership with a label, description, and weight.
- **Lens_Weight**: A numeric value (0.0–1.0) controlling the probability of a lens being selected in a given quiz round. A weight of 0.1 means roughly 1 in 10 quiz rounds includes that lens.
- **Lens_Selector**: The algorithm in the Learning Lambda that selects 2–3 lenses per quiz round using weighted random sampling, biased by capability gap data.
- **Capability_Gap**: The difference between an axis's `required_level` and the organization's current assessed `level` for that axis, as computed by the Organization_Capability_Handler.
- **Organization_Capability_Handler**: The `handleOrganizationCapability` function in `lambda/capability/index.js` that computes organization-level capability profiles with per-axis levels.
- **Asset_Context_Retriever**: The component in the Learning Lambda that performs a vector search against skill axis embeddings in `unified_embeddings` to find semantically related assets (actions, parts, tools, policies) for quiz context enrichment.
- **Learning_Lambda**: The Lambda handler (`lambda/learning/index.js`) responsible for learning objectives, quiz generation, quiz evaluation, and observation verification.
- **Quiz_Generator**: The functions `generateQuizViaBedrock` and `generateOpenFormQuizViaBedrock` in the Learning Lambda that construct Bedrock prompts and generate quiz questions.
- **Open_Form_UI**: The `OpenFormInput` component (`src/components/OpenFormInput.tsx`) that renders open-form question input, submission, and post-submission feedback.
- **Ideal_Answer**: The model-generated reference answer included in the quiz payload for AI evaluation scoring. Currently displayed to the learner after submission.
- **Lens_Config**: The lens configuration stored in the organization's `ai_config` JSONB column, containing system lens weights, custom lens definitions, and values lens weight overrides.
- **Lens_Management_UI**: The admin-only card on the Organization settings page for managing lens weights, custom lenses, and values lens configuration.
- **Organization_Settings_Page**: The existing `/organization` page (`src/pages/Organization.tsx`) where leadership manages organization details, values, and AI configuration.

## Requirements

### Requirement 1: System Lens Definitions

**User Story:** As a platform operator, I want a set of built-in question lenses that ship with the system, so that quiz questions approach learning objectives from diverse angles without requiring manual configuration.

#### Acceptance Criteria

1. THE Learning_Lambda SHALL define six System_Lenses with the following keys and prompt instructions: `failure_analysis` ("What could go wrong if..."), `underlying_science` (physics, chemistry, biology behind the practice), `cross_asset_comparison` (contrast with related farm work), `practical_tradeoffs` (time, cost, effort considerations), `root_cause_reasoning` ("Why does this happen at a fundamental level"), and `scenario_response` ("Here's a situation, describe what you'd do").
2. WHEN no Lens_Config exists for an organization, THE Learning_Lambda SHALL use default weights for all six System_Lenses, with each lens assigned an equal default weight of 0.5.
3. THE Learning_Lambda SHALL store System_Lens definitions as constants in a shared module accessible to both the Learning Lambda and the Lens_Management_UI defaults.
4. WHEN a System_Lens has a Lens_Weight of 0.0 or is marked as disabled in the Lens_Config, THE Lens_Selector SHALL exclude that lens from selection.

### Requirement 2: Values Lens Auto-Derivation

**User Story:** As an organization leader, I want each of our organization values to automatically become a question lens, so that our culture and priorities are naturally reinforced through training without manual lens creation.

#### Acceptance Criteria

1. WHEN the Learning_Lambda generates a quiz for an organization, THE Learning_Lambda SHALL read the organization's `strategic_attributes` from the `organizations.settings` JSONB column and create a Values_Lens for each attribute.
2. WHEN a Values_Lens is selected for a quiz round, THE Quiz_Generator SHALL frame the question through the lens of that organization value (e.g., for value "organic": "How does this practice align with organic certification requirements?").
3. THE Learning_Lambda SHALL assign a default Lens_Weight of 0.3 to each Values_Lens when no weight override exists in the Lens_Config.
4. WHEN an organization adds or removes a value from `strategic_attributes`, THE Values_Lens set SHALL reflect the change on the next quiz generation without requiring manual lens management.
5. WHEN an organization has no `strategic_attributes` configured, THE Learning_Lambda SHALL skip Values_Lens generation and proceed with System_Lenses and Custom_Lenses only.

### Requirement 3: Custom Lens Management

**User Story:** As an organization leader, I want to create custom question lenses with descriptions and weights, so that I can introduce organization-specific questioning angles beyond the built-in set.

#### Acceptance Criteria

1. THE Lens_Config SHALL support an array of Custom_Lens objects, each containing a unique `key` (auto-generated slug), a `label` (display name, 1–100 characters), a `description` (prompt instruction text, 1–500 characters), a `weight` (0.0–1.0), and an `enabled` boolean.
2. WHEN a leadership user creates a Custom_Lens via the Lens_Management_UI, THE Lens_Management_UI SHALL persist the lens definition to the organization's `ai_config.lens_config.custom_lenses` JSONB path.
3. WHEN a leadership user edits a Custom_Lens label, description, or weight, THE Lens_Management_UI SHALL update the corresponding entry in `ai_config.lens_config.custom_lenses`.
4. WHEN a leadership user deletes a Custom_Lens, THE Lens_Management_UI SHALL remove the entry from `ai_config.lens_config.custom_lenses`.
5. THE Lens_Config SHALL support a maximum of 20 Custom_Lenses per organization.
6. IF a leadership user attempts to create a Custom_Lens with a label that duplicates an existing Custom_Lens label in the same organization, THEN THE Lens_Management_UI SHALL display a validation error and prevent the save.

### Requirement 4: Weighted Random Lens Selection

**User Story:** As a learner, I want each quiz round to approach my learning objectives from different angles, so that I develop deeper understanding rather than memorizing rephrased versions of the same question.

#### Acceptance Criteria

1. WHEN the Quiz_Generator prepares a quiz round, THE Lens_Selector SHALL select 2–3 lenses from the combined pool of enabled System_Lenses, Values_Lenses, and Custom_Lenses using weighted random sampling without replacement.
2. THE Lens_Selector SHALL use each lens's Lens_Weight as the relative probability of selection, normalized across all enabled lenses in the pool.
3. WHEN the total number of enabled lenses is fewer than 2, THE Lens_Selector SHALL select all available enabled lenses (1 or 0).
4. THE Lens_Selector SHALL pass the selected lens instructions to the Quiz_Generator as a lightweight context block appended to the existing prompt structure, without modifying the core prompt template.
5. WHEN the Quiz_Generator receives lens instructions, THE Quiz_Generator SHALL incorporate them as framing guidance for question generation, not as rigid constraints that override the learning objective focus.
6. FOR ALL quiz rounds generated for the same learning objectives, THE Lens_Selector SHALL produce varying lens combinations across rounds due to the random selection, providing natural question diversity.

### Requirement 5: Admin-Configured Capability Gap Lens Boosting

**User Story:** As an organization admin, I want to configure which lenses are boosted when my team has capability gaps on specific axes, so that I can direct training emphasis based on my knowledge of the organization's needs.

#### Acceptance Criteria

1. THE Lens_Management_UI SHALL provide a "Gap Boost Rules" section where an admin can define rules that map capability gap thresholds to lens weight multipliers.
2. EACH gap boost rule SHALL specify: a minimum Capability_Gap threshold (decimal ≥ 0.5), one or more target lens keys to boost, and a weight multiplier (1.1–3.0).
3. WHEN the Lens_Selector selects lenses for a quiz round, THE Lens_Selector SHALL retrieve the organization's capability profile for the target action and compute the Capability_Gap for the target axis.
4. WHEN the target axis Capability_Gap meets or exceeds a gap boost rule's threshold, THE Lens_Selector SHALL apply that rule's multiplier to the specified lens weights before normalizing for random selection.
5. WHEN multiple gap boost rules match the current Capability_Gap, THE Lens_Selector SHALL apply the rule with the highest threshold that is still met (most specific match).
6. WHEN no gap boost rules are configured, THE Lens_Selector SHALL use unmodified lens weights regardless of capability gaps.
7. IF the organization capability profile is unavailable or the capability query fails, THEN THE Lens_Selector SHALL fall back to unmodified lens weights and log a warning.
8. THE Lens_Config SHALL support a maximum of 10 gap boost rules per organization.

### Requirement 6: Asset-Enriched Quiz Context

**User Story:** As a learner, I want quiz questions that reference real assets from my organization (tools, parts, policies, related actions), so that questions feel grounded in my actual work environment and enable meaningful cross-domain comparisons.

#### Acceptance Criteria

1. WHEN the Quiz_Generator prepares a quiz round, THE Asset_Context_Retriever SHALL perform a vector similarity search against the target skill axis embedding in `unified_embeddings` to find the top 10 semantically related assets.
2. THE Asset_Context_Retriever SHALL search across entity types `action`, `part`, `tool`, and `policy` in `unified_embeddings`, filtered by the quiz taker's `organization_id`.
3. THE Asset_Context_Retriever SHALL exclude the current action's own embeddings from the search results to avoid self-referential context.
4. WHEN the top 10 assets are retrieved, THE Asset_Context_Retriever SHALL randomly select 3 of those 10 and pass their `embedding_source` descriptions to the Quiz_Generator as supplementary context.
5. THE Quiz_Generator SHALL include the 3 selected asset descriptions in the prompt as a "Related Assets" context block, available for the AI to use in crafting compare/contrast or scenario-based questions.
6. WHEN fewer than 3 assets are found in the vector search, THE Asset_Context_Retriever SHALL pass all available assets (0, 1, or 2) without error.
7. IF the vector search fails or the skill axis embedding does not exist, THEN THE Asset_Context_Retriever SHALL proceed with quiz generation without asset context and log a warning.

### Requirement 7: Remove Ideal Answer Display for Open-Form Questions

**User Story:** As a learner, I want to receive only evaluation feedback after submitting an open-form answer (not a model-generated "ideal answer"), so that I develop my own critical thinking rather than comparing against a generic reference.

#### Acceptance Criteria

1. WHEN a learner submits an open-form response, THE Open_Form_UI SHALL display only the evaluation result feedback (score badge and reasoning text) and SHALL NOT display the Ideal_Answer card ("Here's a strong example").
2. THE Quiz_Generator SHALL continue to include the `idealAnswer` field in the quiz question payload, as the AI evaluation scoring system requires it as a reference for grading.
3. WHEN the Open_Form_UI renders the post-submission state, THE Open_Form_UI SHALL show the "Great depth" or "Keep developing" badge with the evaluator's reasoning text, consistent with the current evaluation display.
4. THE Open_Form_UI SHALL remove the blue-bordered card component that currently displays the `idealAnswer` text after submission.

### Requirement 8: High-Ceiling Open-Form Question Generation

**User Story:** As a learner, I want open-form questions that allow me to express the full depth of my critical thinking, so that a level 1 thinker can give a level 1 answer and a level 5 thinker can give a level 5 answer to the same question.

#### Acceptance Criteria

1. WHEN the Quiz_Generator generates open-form questions, THE Quiz_Generator SHALL include a high-ceiling instruction in the prompt directing the AI to craft questions that are open-ended enough for responses ranging from basic recall to expert-level synthesis.
2. THE Quiz_Generator SHALL instruct the AI to avoid questions with a single correct answer or a narrow expected response, favoring questions that invite layered reasoning, multiple valid perspectives, and depth of analysis.
3. THE Quiz_Generator SHALL instruct the AI to avoid yes/no framings, list-based questions, and questions that cap the learner's expression at a specific knowledge level.
4. WHEN generating the `idealAnswer` reference (used only for AI evaluation), THE Quiz_Generator SHALL instruct the AI to produce a level 4–5 reference answer that demonstrates expert-level reasoning, so the evaluator can score across the full 0–5 continuum.

### Requirement 9: Lens Management UI

**User Story:** As an organization leader, I want a management interface on the Organization settings page to view and adjust lens weights, manage custom lenses, and see auto-derived values lenses, so that I can tune how quiz diversity works for my organization.

#### Acceptance Criteria

1. THE Lens_Management_UI SHALL be rendered as a new card section on the Organization_Settings_Page, visible only to users with leadership or admin access.
2. THE Lens_Management_UI SHALL display all six System_Lenses with their labels and adjustable weight controls (slider or number input, range 0.0–1.0, step 0.1) and an enabled/disabled toggle.
3. THE Lens_Management_UI SHALL display all Values_Lenses auto-populated from the organization's `strategic_attributes`, each with an adjustable weight control (range 0.0–1.0, step 0.1) and an enabled/disabled toggle.
4. THE Lens_Management_UI SHALL display a Custom Lenses section with controls to add a new Custom_Lens (label input, description textarea, weight input) and to edit or delete existing Custom_Lenses.
5. WHEN the Organization_Settings_Page loads, THE Lens_Management_UI SHALL read the current Lens_Config from `ai_config.lens_config` and display configured weights, falling back to default weights when no Lens_Config exists.
6. WHEN a leadership user modifies any lens weight, toggle, or custom lens definition, THE Lens_Management_UI SHALL persist the changes to the organization's `ai_config.lens_config` via the existing organization update API endpoint.
7. THE Lens_Management_UI SHALL validate that all weight values are between 0.0 and 1.0 inclusive before saving.
8. THE Lens_Management_UI SHALL validate that Custom_Lens labels are between 1 and 100 characters and descriptions are between 1 and 500 characters.
9. WHEN the organization's `strategic_attributes` change (values added or removed), THE Lens_Management_UI SHALL reflect the updated Values_Lenses on the next page load without requiring manual intervention.
10. THE Lens_Management_UI SHALL group lenses into three visually distinct sections: "System Lenses", "Values Lenses" (with a note that these are auto-derived from organization values), and "Custom Lenses".
