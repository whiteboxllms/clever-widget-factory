# Requirements Document

## Introduction

The capability assessment system uses Bedrock Claude to compute Bloom's taxonomy scores (0.0–5.0) per skill axis based on learning evidence and field observations. The current prompts overstate what multiple-choice quiz completions prove — describing them as "tests understanding (Bloom's level 2)" when they only demonstrate that the learner recognized the correct answer from a set.

The evidence hierarchy should reflect what each type actually proves:

1. **Multiple-choice recognition** → engaged exposure / guided participation. Not proof of independent recall or understanding.
2. **Open-form responses** (bridging, self_explanation, application, analysis, synthesis) → the learner produced their own reasoning. Demonstrates understanding at the depth indicated by the continuous score.
3. **Field observations** → demonstrated capability in a real-world context. Bloom's level varies based on content.

## Glossary

- **Capability_Lambda**: `lambda/capability/index.js` — handles `GET /api/capability/:actionId/:userId` and `GET /api/capability/:actionId/organization`.
- **Per_Axis_Prompt**: The Bedrock prompt in `callBedrockForPerAxisCapability()` — receives evidence grouped by axis with typed tags like `[quiz:recognition]` and `[quiz:self_explanation, score:2.4]`.
- **Whole_Profile_Prompt**: The legacy Bedrock prompt in `callBedrockForCapability()` — used when no `skill_axis` embeddings exist. Being removed by this feature.
- **Learning_Completion_Section**: The section appended to prompts when quiz data exists. Currently describes all completions as "tests understanding (Bloom's level 2)."
- **Recognition_Evidence**: A multiple-choice quiz answer. State text contains "which was the correct answer."
- **Open_Form_Evidence**: A quiz response where the learner wrote their own answer. Evaluated by Bedrock with a continuous score.
- **Observation_Evidence**: A field observation describing real-world actions.

## Requirements

### Requirement 1: Correct Evidence Hierarchy in Bedrock Prompts

**User Story:** As a system operator, I want all Bedrock prompts to accurately describe what each evidence type proves about capability, so that scores reflect actual demonstrated depth rather than inflating based on multiple-choice participation.

#### Acceptance Criteria

1. ALL Bedrock prompts (per-axis capability, learning Lambda scorer) SHALL describe recognition evidence as engaged exposure where the learner selected from options — not proof of independent recall or understanding. Recognition-only evidence for an axis warrants a score in the 0.3–0.7 range.
2. ALL Bedrock prompts SHALL describe open-form evidence as learner-produced reasoning that demonstrates understanding at the depth indicated by the continuous score.
3. ALL Bedrock prompts SHALL describe observation evidence as real-world demonstration whose Bloom's level varies based on the content.
4. THE Learning_Completion_Section SHALL NOT describe quiz completion as "tests understanding (Bloom's level 2)" or claim it "demonstrates at least Understand-level capability." It SHALL distinguish recognition completions (guided selection) from open-form completions (independent reasoning).
5. THE learning completion data sent to Bedrock SHALL include the completion type (recognition vs. open-form) and, for open-form completions, the question type and continuous score.

### Requirement 2: Remove Whole-Profile Fallback Path

**User Story:** As a system operator, I want the whole-profile fallback scoring path removed so there is only one code path for capability assessment.

#### Acceptance Criteria

1. THE Capability_Lambda SHALL remove the `hasPerAxisEmbeddings` check and the `handleWholeProfileCapability` function.
2. THE Capability_Lambda SHALL always use the per-axis evidence retrieval flow regardless of whether `skill_axis` embeddings currently exist.
3. WHEN `skill_axis` embeddings do not exist for an action, THE Capability_Lambda SHALL generate them on-the-fly, store them in `unified_embeddings`, and proceed with the per-axis flow.
4. THE `callBedrockForCapability()` function (whole-profile prompt) SHALL be removed.

### Requirement 3: Cache Invalidation After Prompt Changes

**User Story:** As a system operator, I want cached capability profiles recomputed after prompt changes are deployed, so that stale scores from the old overweighted prompts are not served.

#### Acceptance Criteria

1. THE evidence hash computation SHALL incorporate a prompt version identifier (e.g., `'v2'`), so that a prompt change causes all existing cached profiles to appear stale and trigger recomputation on next access.
2. THE prompt version SHALL be a simple constant included in the hash input alongside evidence state IDs and learning completion count, so that future prompt changes can bump the version to force recomputation.

### Requirement 4: Preserve Response Format and Non-Recognition Scoring

**User Story:** As a system operator, I want the capability profile response format and scoring behavior for open-form and observation evidence to remain unchanged.

#### Acceptance Criteria

1. THE capability profile response format (user_id, user_name, narrative, axes with levels/evidence/narratives, total_evidence_count) SHALL remain unchanged.
2. THE existing evidence tag format (`[quiz:recognition]`, `[quiz:self_explanation, score:2.4]`, `[observation]`) SHALL be preserved.
3. Open-form evidence scoring and observation evidence scoring SHALL not change — only recognition evidence weighting is corrected.
