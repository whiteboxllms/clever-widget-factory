# Requirements Document

## Introduction

The capability assessment system currently recomputes a user's capability profile from scratch on every page load — running ~5 vector similarity queries against `unified_embeddings` per axis and calling Bedrock Claude Sonnet to synthesize Bloom's levels and narratives. This takes 3-8 seconds per request and is never persisted. Additionally, the learning objectives endpoint runs a separate vector similarity query per objective (~20+ queries) when a single per-axis query would suffice.

This feature stores computed capability profiles as states in the existing `states` table so they load instantly on subsequent reads, with recomputation triggered only when new evidence is added or explicitly requested. It also consolidates the per-objective similarity searches into per-axis searches for faster learning objective loading.

## Glossary

- **Capability_Profile_State**: A state in the `states` table that stores a computed capability assessment as its `state_text`, linked to the action via `state_links`. Follows the same pattern as knowledge states and learning objectives.
- **Skill_Profile**: The TARGET profile stored in `actions.skill_profile` JSONB — defines required Bloom's levels per axis. Not the same as a computed capability profile.
- **Evidence_Hash**: A deterministic hash derived from the set of evidence inputs (state IDs, learning completion data) used to compute a capability profile. Stored in the state_text to detect when new evidence has been added.
- **Capability_Lambda**: The `lambda/capability/index.js` Lambda function that handles `GET /api/capability/:actionId/:userId` and `GET /api/capability/:actionId/organization`.
- **Stale_Profile**: A cached capability profile state whose Evidence_Hash no longer matches the current evidence set, indicating new evidence has been added since the last computation.

## Requirements

### Requirement 1: Capability Profile Persistence via States

**User Story:** As a system operator, I want computed capability profiles stored as states in the existing `states` table, so that they can be retrieved instantly without recomputation and follow the same data patterns as all other system state.

#### Acceptance Criteria

1. WHEN a capability profile is computed, THE Capability_Lambda SHALL store the result as a state in the `states` table with a structured `state_text` that includes a `[capability_profile]` prefix, the full profile JSON (user_id, user_name, narrative, axes with levels/evidence/narratives, total_evidence_count), the evidence_hash, and the computed_at timestamp.
2. THE capability profile state SHALL be linked to the action via `state_links` with `entity_type = 'capability_profile'` and `entity_id = action_id`.
3. THE `captured_by` field on the state SHALL be set to the user_id whose capability is being assessed, enabling scoping by user.
4. THERE SHALL be at most one capability profile state per user per action — the Lambda SHALL update the existing state (via UPDATE) rather than creating duplicates.
5. THE capability profile state SHALL be embedded via the existing SQS pipeline, making the assessment searchable alongside other states.
6. NO new database tables or columns are needed — the feature uses the existing `states`, `state_links`, and `unified_embeddings` infrastructure.

### Requirement 2: Cache-First Read Path

**User Story:** As a user viewing an action's growth areas, I want the capability profile to load instantly from the cached state, so that I don't wait 3-8 seconds for Bedrock on every page load.

#### Acceptance Criteria

1. WHEN `GET /api/capability/:actionId/:userId` is called, THE Capability_Lambda SHALL first query the `states` table for an existing capability profile state (matching `[capability_profile]` prefix, `captured_by = userId`, linked to the action via `state_links`).
2. IF a cached state exists and its evidence hash matches the current evidence set, THE Lambda SHALL return the stored profile JSON directly — no Bedrock call, no vector similarity searches.
3. IF a cached state exists but its evidence hash does NOT match (new evidence has been added), THE Lambda SHALL recompute the profile via Bedrock, update the existing state, and return the fresh result.
4. IF no cached state exists, THE Lambda SHALL compute the profile via Bedrock (existing flow), store it as a new state, and return the result.
5. THE evidence hash comparison SHALL be lightweight — computed from a sorted list of relevant state IDs and a count of learning completions, not from re-running vector searches.

### Requirement 3: Cache Invalidation

**User Story:** As a system operator, I want cached capability profiles to be invalidated when the underlying skill profile changes, so that stale assessments against an old axis structure are never shown.

#### Acceptance Criteria

1. WHEN a skill profile is deleted (via the "Regenerate" flow in `lambda/skill-profile/index.js`), ALL capability profile states linked to that action SHALL be deleted from the `states` table.
2. WHEN a new skill profile is approved for an action, any existing capability profile states for that action SHALL be deleted — the next read will trigger a fresh computation against the new axes.
3. THE deletion SHALL cascade through `state_links` and `unified_embeddings` following the existing cleanup patterns.
4. THE frontend "Regenerate" button flow SHALL continue to work as-is — the capability profile cache is invalidated as a side effect of the skill profile deletion, not as a separate user action.

### Requirement 4: Organization Capability Profile Caching

**User Story:** As a user viewing the organization-level capability assessment, I want the organization profile to also be cached, so that it loads instantly like individual profiles.

#### Acceptance Criteria

1. THE `GET /api/capability/:actionId/organization` endpoint SHALL follow the same cache-first pattern as individual profiles — check for a cached state, compare evidence hash, return cached or recompute.
2. THE organization capability profile state SHALL use `captured_by` set to a well-known sentinel value (e.g., `'organization'`) to distinguish it from individual user profiles.
3. THE organization profile state SHALL be linked to the action via `state_links` with the same `entity_type = 'capability_profile'`.
4. WHEN a skill profile is deleted or regenerated, the organization capability profile state SHALL also be invalidated alongside individual profiles.

### Requirement 5: Frontend Loading Behavior

**User Story:** As a user, I want to see the capability profile immediately when cached, and a clear loading indicator when it's being computed for the first time, so that the experience feels responsive.

#### Acceptance Criteria

1. WHEN the cached profile is returned (cache hit), THE frontend SHALL render the radar chart and gap checklist immediately — no loading spinner for the capability section.
2. WHEN the profile is being computed for the first time or recomputed due to new evidence, THE existing "Analyzing target growth areas…" loading state SHALL continue to display.
3. THE frontend SHALL NOT change its fetching logic — the same `GET /api/capability/:actionId/:userId` endpoint is called, but it now returns faster when cached.

### Requirement 6: Per-Axis Similarity Search Instead of Per-Objective

**User Story:** As a system operator, I want the learning objectives endpoint to run one similarity search per axis instead of one per objective, so that the endpoint responds faster and evidence is matched at the right semantic level.

#### Acceptance Criteria

1. THE `handleGetObjectives` function SHALL run ONE vector similarity query per axis using the existing `skill_axis` embedding (entity_type='skill_axis' in `unified_embeddings`), instead of one query per objective.
2. THE per-axis query SHALL return the top N most similar knowledge states for the axis, then distribute matches to individual objectives by comparing the match text against each objective's text.
3. WHEN knowledge states are saved (quiz answers, open-form responses), THE embedding source SHALL include the axis label (e.g., "Cement Work: For learning objective 'Understand mixing ratios'...") to improve axis-level matching.
4. THE total number of DB queries for similarity search SHALL be proportional to the number of axes (typically 4-6), not the number of objectives (typically 15-25).
