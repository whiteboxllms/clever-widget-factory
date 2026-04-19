# Requirements Document

## Introduction

The Scoring Context Reduction feature reduces the volume of context sent to AWS Bedrock during capability scoring, cutting costs without degrading scoring quality. Currently the system sends up to 25 evidence items per prompt (5 axes × 5 evidence items per axis), searching across all user states including raw observations. This feature introduces configurable axis counts (default 3), configurable evidence limits (default 3 per axis), narrows evidence retrieval to learning-objective-linked states only, makes Bedrock temperature configurable for scoring/evaluation calls, and provides a UI for leadership users to manage these AI parameters per organization. With defaults applied, the prompt shrinks from 25 items to 9 items — a 64% reduction.

## Glossary

- **Skill_Profile_Generator**: The backend handler (`handleGenerate` in `lambda/skill-profile/index.js`) that calls Bedrock to produce a skill profile preview with a narrative and skill axes.
- **Skill_Profile_Validator**: The `isValidSkillProfile` function in `lambda/skill-profile/index.js` that validates the structure and axis count of a generated skill profile before approval.
- **Frontend_Profile_Schema**: The Zod validation schema (`skillProfileFormSchema`) in `src/components/SkillProfilePanel.tsx` that enforces axis count constraints on the client side.
- **Evidence_Retriever**: The per-axis vector similarity search logic in `handlePerAxisCapability` (`lambda/capability/index.js`) that finds relevant user states for each skill axis.
- **Scoring_Prompt**: The Bedrock prompt constructed by `callBedrockForPerAxisCapability` in `lambda/capability/index.js` that includes per-axis evidence for capability scoring.
- **Axis_Count_Config**: A configurable parameter controlling the number of skill axes generated per profile (minimum and maximum bounds).
- **Evidence_Limit_Config**: A configurable parameter controlling the maximum number of evidence items retrieved per axis during capability scoring.
- **Learning_Objective_State**: A state record in the `states` table that is linked to a learning objective via the `state_links` table with `entity_type = 'learning_objective'`.
- **Organization_Capability_Handler**: The `handleOrganizationCapability` function in `lambda/capability/index.js` that computes organization-level capability profiles using the same per-axis evidence retrieval pattern.
- **Quiz_Temperature_Config**: A configurable parameter controlling the Bedrock temperature value used for quiz-related Bedrock calls (capability scoring, quiz evaluation, and observation verification) in the learning and capability Lambdas.
- **Learning_Lambda**: The Lambda handler (`lambda/learning/index.js`) responsible for learning objectives, quiz generation, quiz evaluation, and observation verification.
- **Capability_Lambda**: The Lambda handler (`lambda/capability/index.js`) responsible for individual and organization-level capability scoring.
- **AI_Config**: A JSONB column on the organizations table storing per-organization AI configuration parameters (max axes, evidence limit, quiz temperature).
- **Organization_Settings_UI**: The AI Configuration section on the `/organization` page where leadership users manage AI parameters.

## Requirements

### Requirement 1: Configurable Maximum Axes per Skill Profile

**User Story:** As a system administrator, I want to configure the maximum number of skill axes generated per profile, so that fewer axes are sent to Bedrock during capability scoring, reducing prompt size and cost.

#### Acceptance Criteria

1. THE Skill_Profile_Generator SHALL use Axis_Count_Config to determine the axis range requested in the Bedrock prompt, with a default maximum of 3 and a default minimum of 2.
2. WHEN the Skill_Profile_Generator constructs the Bedrock prompt, THE Skill_Profile_Generator SHALL replace the hardcoded "4 to 6 axes" instruction with the configured minimum and maximum values from Axis_Count_Config.
3. WHEN the `strict` retry prompt is constructed, THE Skill_Profile_Generator SHALL replace the hardcoded "EXACTLY 4 to 6 axes" clause with the configured values from Axis_Count_Config.
4. THE Skill_Profile_Validator SHALL accept profiles with axis counts within the range defined by Axis_Count_Config (default: 2 to 3 axes) instead of the hardcoded 4 to 6 range.
5. THE Frontend_Profile_Schema SHALL enforce axis count constraints matching the Axis_Count_Config range (default: minimum 2, maximum 3).
6. WHEN an existing approved profile contains more axes than the configured maximum, THE Skill_Profile_Validator SHALL continue to accept the existing profile without modification during capability scoring.
7. THE Axis_Count_Config SHALL default to constants in the Lambda function code, overridable by the organization's AI_Config when present.

### Requirement 2: Validator Accepts Configured Axis Range

**User Story:** As a system administrator, I want the skill profile validator to accept profiles within the configured axis range on the first attempt, so that unnecessary Bedrock retry calls are eliminated and profile generation cost is halved.

#### Acceptance Criteria

1. WHEN Bedrock returns a profile with an axis count within the Axis_Count_Config range (default: 2 to 3), THE Skill_Profile_Validator SHALL accept the profile without triggering a retry.
2. WHEN Bedrock returns a profile with an axis count outside the Axis_Count_Config range, THE Skill_Profile_Generator SHALL retry with a stricter prompt specifying the configured range.
3. THE Skill_Profile_Validator SHALL validate that each axis has a non-empty `key`, a non-empty `label`, and a `required_level` between 0 and 5 inclusive, independent of axis count validation.
4. WHEN the `handleApprove` handler validates an incoming profile, THE Skill_Profile_Validator SHALL use the same Axis_Count_Config range as the generation handler.
5. THE Skill_Profile_Validator SHALL log a warning when a retry is triggered due to axis count mismatch, including the returned count and the expected range.

### Requirement 3: Evidence Retrieval Searches Learning Objective States Only

**User Story:** As a system administrator, I want evidence retrieval to search only states linked to learning objectives instead of all user states, so that the scoring prompt contains fewer, more relevant evidence items and Bedrock costs are reduced.

#### Acceptance Criteria

1. WHEN the Evidence_Retriever performs a per-axis vector similarity search for an individual user, THE Evidence_Retriever SHALL restrict the search to states that have a corresponding entry in `state_links` with `entity_type = 'learning_objective'`, excluding raw observation states.
2. WHEN the Organization_Capability_Handler performs a per-axis vector similarity search, THE Organization_Capability_Handler SHALL apply the same learning-objective-only filter as the individual Evidence_Retriever.
3. THE Evidence_Retriever SHALL limit results to the top N matches per axis as defined by Evidence_Limit_Config, with a default of 3 (down from the current hardcoded 5).
4. THE Organization_Capability_Handler SHALL use the same Evidence_Limit_Config default of 3 results per axis.
5. WHEN the configured defaults are applied (3 axes × 3 evidence items), THE Scoring_Prompt SHALL contain a maximum of 9 evidence items, representing a 64% reduction from the previous maximum of 25 items (5 axes × 5 evidence items).
6. THE Evidence_Limit_Config SHALL default to a constant in the Lambda function code, overridable by the organization's AI_Config when present.
7. WHEN no learning-objective-linked states exist for a user on a given axis, THE Evidence_Retriever SHALL return an empty evidence list for that axis, and the Scoring_Prompt SHALL indicate no evidence was found.
8. IF the `state_links` join returns no matching states for any axis, THEN THE Evidence_Retriever SHALL return a zero-score capability profile using the existing `buildZeroCapabilityProfile` function.
9. THE Evidence_Retriever SHALL preserve the existing evidence enrichment logic (`determineEvidenceTypeEnriched`) and source action title resolution for all returned evidence items.
10. THE Evidence_Retriever SHALL preserve the existing cache invalidation behavior — the `computeEvidenceHash` function SHALL continue to use the same evidence state ID set so that cached profiles are correctly invalidated when new learning-objective states are added.

### Requirement 4: Configurable Quiz Generation Temperature

**User Story:** As a system administrator, I want the Bedrock temperature for scoring and evaluation calls to be configurable per organization with a higher default, so that quiz question variety improves when the same objectives are quizzed multiple times with reduced context.

#### Acceptance Criteria

1. THE Learning_Lambda SHALL use Quiz_Temperature_Config to determine the Bedrock temperature for the `callBedrockForCapabilityLevels` function, with a default of 0.7 (changed from the current hardcoded 0.3).
2. THE Learning_Lambda SHALL use Quiz_Temperature_Config to determine the Bedrock temperature for the `callBedrockForEvaluation` function, with a default of 0.7 (changed from the current hardcoded 0.3).
3. THE Learning_Lambda SHALL use Quiz_Temperature_Config to determine the Bedrock temperature for the `evaluateObservationViaBedrock` function, with a default of 0.7 (changed from the current hardcoded 0.3).
4. THE Capability_Lambda SHALL use Quiz_Temperature_Config to determine the Bedrock temperature for the `callBedrockForPerAxisCapability` function, with a default of 0.7 (changed from the current hardcoded 0.3).
5. THE Learning_Lambda SHALL preserve the existing temperature of 0.7 for `generateObjectivesViaBedrock`, `generateQuizViaBedrock`, and `generateOpenFormQuizViaBedrock` without modification.
6. WHEN an organization has a Quiz_Temperature_Config value stored in AI_Config, THE Learning_Lambda SHALL use that value instead of the default 0.7 for the functions specified in criteria 1-3.
7. WHEN an organization has a Quiz_Temperature_Config value stored in AI_Config, THE Capability_Lambda SHALL use that value instead of the default 0.7 for the function specified in criterion 4.
8. IF no AI_Config record exists for the organization, THEN THE Learning_Lambda and Capability_Lambda SHALL fall back to the default temperature of 0.7.
9. THE Quiz_Temperature_Config SHALL accept values between 0.0 and 1.0 inclusive.

### Requirement 5: Organization AI Configuration Settings UI

**User Story:** As a leadership user, I want an AI Configuration section on the Organization page, so that I can adjust AI parameters for my organization without requiring code changes or developer intervention.

#### Acceptance Criteria

1. THE Organization_Settings_UI SHALL be rendered as a new card section on the existing `/organization` page (`src/pages/Organization.tsx`), alongside the existing Organization Details, Organization Values, and AI Scoring Prompts sections.
2. THE Organization_Settings_UI SHALL display three configurable fields: max axes per skill profile (default 3), evidence limit per axis (default 3), and quiz generation temperature (default 0.7).
3. THE Organization_Settings_UI SHALL only be visible to users who have leadership or admin access, consistent with the existing LeadershipRoute access control on the `/organization` page.
4. WHEN a leadership user updates an AI configuration value, THE Organization_Settings_UI SHALL persist the change to the AI_Config column on the organizations table.
5. WHEN the Organization page loads, THE Organization_Settings_UI SHALL read the current AI_Config values from the organization record and display them, falling back to default values when AI_Config is null or missing fields.
6. THE AI_Config column SHALL be added to the organizations table as a JSONB column with a default of null.
7. THE Organization_Settings_UI SHALL validate that max axes per skill profile is an integer between 1 and 6 inclusive.
8. THE Organization_Settings_UI SHALL validate that evidence limit per axis is an integer between 1 and 10 inclusive.
9. THE Organization_Settings_UI SHALL validate that quiz generation temperature is a decimal between 0.0 and 1.0 inclusive.
10. WHEN a Lambda function processes a request, THE Lambda function SHALL read the requesting organization's AI_Config from the organizations table and use the configured values, falling back to defaults when AI_Config is null or a specific field is missing.
11. IF the AI_Config column does not exist or the database query fails, THEN THE Lambda function SHALL use default values (max axes: 3, evidence limit: 3, temperature: 0.7) and log a warning.
