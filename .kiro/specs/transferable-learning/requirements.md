# Requirements Document: Transferable Learning

## Introduction

Transferable Learning extends the Growth Learning Module so that a person's demonstrated knowledge carries forward across skill profile regenerations and across different actions. Currently, learning evidence is siloed to specific objective IDs — when a skill profile is regenerated with new axis keys, all prior quiz completions are orphaned. A person who demonstrated understanding of "water chemistry testing" on one skill profile gets zero credit when the profile is regenerated with a "water quality testing methodology" axis covering the same concepts.

The core insight: learning is transferable. Understanding water-cement ratios in concrete applies when working with plaster. The system should recognize semantic similarity between prior learning and new objectives, using vector embeddings that are already stored in `unified_embeddings`.

This spec introduces per-axis embeddings, vector similarity-based evidence retrieval, and transparent evidence display — replacing exact-ID matching with semantic matching while keeping Bedrock for interpretation and narrative generation.

## Glossary

- **Knowledge_State**: A state record capturing a person's quiz response or demonstration, stored in the `states` table and embedded in `unified_embeddings`. The atomic unit of learning evidence.
- **Skill_Axis**: A single dimension of a skill profile (e.g., "Water Chemistry Testing"). Each axis has a required Bloom's level and, with this spec, its own embedding.
- **Skill_Axis_Embedding**: A vector embedding for an individual skill axis, stored in `unified_embeddings` with `entity_type = 'skill_axis'`. Used for targeted evidence retrieval.
- **Prior_Learning**: Completed knowledge states from any action or skill profile that are semantically similar to a current objective or skill axis. Identified via vector similarity, not exact ID matching.
- **Similarity_Score**: Cosine similarity (0.0–1.0) between two embeddings. Used as a continuous signal for evidence relevance — not bucketed into arbitrary categories.
- **Evidence_Type**: The source of a knowledge state — `quiz` (from quiz completion) or `demonstration` (from observation verification). Determines the Bloom's ceiling when Bedrock interprets the evidence.

## Requirements

### Requirement 1: Semantic Evidence Tagging for Learning Objectives

**User Story:** As a user viewing learning objectives for an action, I want each objective to reflect whether I've already demonstrated similar knowledge elsewhere, so that I can focus on what's genuinely new rather than repeating what I already know.

#### Acceptance Criteria

1. WHEN the learning objectives endpoint returns objectives, THE System SHALL search `unified_embeddings` for semantically similar completed knowledge states (quiz answers with "correct answer") captured by the current user, regardless of which action or skill profile they originated from.
2. THE System SHALL use vector similarity (cosine distance) between the objective's embedding and existing knowledge state embeddings to find the closest matches.
3. EACH objective SHALL include a `similarityScore` field (0.0–1.0) representing the cosine similarity to the best-matching completed knowledge state.
4. EACH objective SHALL include a `matchedObjectiveText` field containing the text of the best-matching completed objective, or null if no match was found.
5. THE evidence search SHALL be scoped to the current user and their `organization_id`.
6. THE frontend SHALL use the raw `similarityScore` to drive UI decisions (e.g., which objectives to show as optional review vs required) rather than relying on categorical tags.

### Requirement 2: Per-Axis Evidence Retrieval for Capability Assessment

**User Story:** As a user whose capability is being assessed, I want the system to find my most relevant prior learning and experience for each skill axis specifically, so that the AI assessment is based on targeted evidence rather than a broad search that may miss relevant learning.

#### Acceptance Criteria

1. EACH skill axis in the action's skill profile SHALL have its own embedding in `unified_embeddings` (entity_type `skill_axis`), generated when the skill profile is approved.
2. FOR EACH skill axis, THE System SHALL retrieve the top 5 most similar knowledge states from the user via vector similarity against the axis embedding.
3. THE retrieved evidence SHALL be passed to Bedrock along with the evidence type (quiz completion vs observation) so the model can interpret the evidence and produce a score and narrative.
4. THE Bedrock response SHALL include a per-axis narrative explaining what evidence supports the score and where the person's knowledge transfers from.
5. THE top 5 matches per axis (with similarity scores and source text) SHALL be included in the API response for frontend display and validation.
6. THE evidence search SHALL be scoped to the current user and their `organization_id`.

### Requirement 3: Pre-Tagging New Objectives with Prior Learning Similarity

**User Story:** As a user who starts learning on a new or regenerated skill profile, I want the system to immediately recognize which objectives I've already covered through prior learning, so I don't have to re-prove knowledge I've already demonstrated.

#### Acceptance Criteria

1. WHEN new learning objectives are generated (on first request or after skill profile regeneration), THE System SHALL search the user's existing completed knowledge states for semantically similar content using vector similarity against each new objective's embedding.
2. FOR EACH new objective, THE System SHALL return the top 5 matches with their similarity scores and source texts as `priorLearning: [{ similarityScore, sourceText }]`.
3. THE frontend SHALL use the similarity scores to present objectives with high prior learning similarity as optional review rather than required, letting the user decide whether to skip or revisit.
4. THE objective's `status` SHALL remain `not_started` regardless of similarity — prior learning suggests readiness but doesn't auto-complete the objective. The user still chooses to take the quiz or skip.
5. THE similarity search SHALL be scoped to the current user and their `organization_id`.

### Requirement 4: Skill Axis Embeddings on Profile Approval

**User Story:** As the system, I need individual embeddings for each skill axis so that evidence retrieval and objective matching can target specific skills rather than the entire profile as a whole.

#### Acceptance Criteria

1. WHEN a skill profile is approved, THE System SHALL generate and store an individual embedding for each skill axis in `unified_embeddings` with `entity_type = 'skill_axis'` and `entity_id` composed as `{action_id}:{axis_key}`.
2. THE embedding source for each axis SHALL be composed from the axis label, the axis description (if available), and the relevant portion of the skill profile narrative, providing rich semantic context for matching.
3. WHEN a skill profile is regenerated and re-approved, THE System SHALL delete the old `skill_axis` embeddings for that action and generate new ones for the new axes.
4. THE embedding generation SHALL be awaited (not fire-and-forget) to ensure embeddings are available when the capability assessment runs immediately after approval.
5. THE existing `action_skill_profile` embedding (whole-profile) MAY be retained for backward compatibility but is not required for the new evidence retrieval flow.
