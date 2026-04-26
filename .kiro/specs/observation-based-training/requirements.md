# Requirements Document

## Introduction

An observation-driven skill assessment and transparency system for CWF. The system provides visibility into the capabilities each person brings to an action relative to what the action demands, using field observations as skill evidence and radar charts for visualization.

The core design principle is **transparency over recommendation**: the system does NOT recommend assignments, rank workers, or block anyone from proceeding. It surfaces action skill requirements and each person's demonstrated capabilities so that humans — who have context the system cannot capture — make the decisions.

Skill profiles are **computed on-demand** relative to a specific action context using semantic embeddings, not stored as static scores. The system is **role-agnostic** — everyone involved in an action (assigned worker, participants, the person who created it) is assessed the same way. A person's capability reflects the quality of work on all actions they've been involved in, not just work they personally executed. This creates shared accountability: when the team flourishes, everyone's profile reflects it. When work falls short, everyone involved sees it in their vectors.

Every observation captured during an action serves as both documentation AND skill evidence. This creates intrinsic motivation to document — the radar chart fills in as you take observations. To demonstrate mastery, a person needs consistent quality across multiple observations, not just one good result.

The system embodies **extreme ownership** — there are no strict roles in assessment. A farm manager should know what quality concrete looks like. When a worker improves, the person who coached them sees their own capability grow. Everyone's vectors reflect the degree to which they are demonstrating entelechy — actualizing their potential and helping others actualize theirs.

## Glossary

- **Expected_State (S')**: A new text field on the actions table representing "where we want to get to" — the expected outcome for the action. Used to measure deltas between actual results and the ideal. For skilled workers, this becomes the primary guidance instead of the policy field.
- **Skill_Profile**: An AI-generated profile of what capabilities an action demands, including a natural language narrative and 4-6 labeled skill axes with requirement levels. Generated on user request, reviewed and approved by a human before being stored.
- **Capability_Vector**: A person's computed skill profile relative to a specific action context, derived from semantically relevant observations across all actions they were involved in. Computed on-demand, not stored as a static score.
- **Radar_Chart**: A multi-axis visualization showing action skill requirements overlaid with each involved person's demonstrated capabilities. Axes are AI-derived from the action context — different actions surface different axes. Each axis is drillable to see the evidence and reasoning behind the score.
- **Observation**: A photo-first state capture (stored in the `states` table) linked to an action via `state_links`. Each observation is both documentation and skill evidence. Embedded in `unified_embeddings` with entity_type `state`.
- **Arete_Delta**: The gap between an observation and the Expected State (S') for its action context. Computed by AI analysis of the observation against S'.
- **Embedding_Space**: The 1536-dimensional semantic vector space (AWS Bedrock Titan v1) used to represent skill requirements and capabilities for similarity matching.

## Requirements

### Requirement 1: Expected State (S') Field on Actions

**User Story:** As a user, I want to define the expected state for an action, so that everyone knows where we want to get to and the system can measure the gap between actual outcomes and the ideal.

#### Acceptance Criteria

1. THE System SHALL add an `expected_state` text field to the `actions` table to capture the expected outcome (S') for the action.
2. THE System SHALL display the `expected_state` field on the action form with the label "Where we want to get to" or equivalent, positioned alongside the existing description and policy fields.
3. THE `expected_state` field SHALL accept free-text input and SHALL be optional — actions can exist without a defined S'.
4. THE System SHALL provide an AI-generation option for the `expected_state` field that synthesizes a suggested S' from the action's title, description, and context. The user can accept, edit, or discard the suggestion.
5. WHEN an action is completed, THE System SHALL retain the `expected_state` so that post-completion observations can be compared against S' to compute a completion delta.
6. THE System SHALL include the `expected_state` field in the action's embedding source composition so that S' is searchable via the existing unified semantic search.
7. FOR skilled workers (those with high demonstrated capability relative to the action), THE `expected_state` SHALL serve as the primary guidance — they see where to get to and decide how to get there. The policy field (how) becomes secondary.

### Requirement 2: Action Skill Profile Generation

**User Story:** As a user, I want to generate a skill requirements profile for an action, so that I can see what capabilities the action demands.

#### Acceptance Criteria

1. WHEN a user requests skill profile generation for an action, THE System SHALL analyze the action's title, description, expected state (S'), policy text, linked asset context, and required tools to produce a structured skill requirements profile.
2. THE System SHALL produce a natural language skill narrative describing the required capabilities, and a set of 4 to 6 labeled skill axes with requirement levels on a 0.0 to 1.0 scale suitable for radar chart rendering.
3. THE System SHALL derive radar chart axes from the specific action context — different actions SHALL surface different interpretable axes (e.g., a concrete action surfaces "chemistry understanding", "physical technique", "equipment operation"; an electrical action surfaces "wiring knowledge", "safety protocols", "code compliance").
4. WHEN the skill profile is generated, THE System SHALL present it to the user as a preview for review. The user SHALL be able to read the narrative, see the proposed axes and levels, and edit any part of the profile before approving.
5. THE System SHALL NOT store the skill profile or generate any embeddings until the user explicitly approves the profile.
6. WHEN the user approves the skill profile, THE System SHALL store the profile as a JSON record associated with the action (including axes, levels, and narrative) AND generate an embedding of the skill narrative in the `unified_embeddings` table with entity_type `action_skill_profile` and the action's ID as entity_id.
7. IF the action has no title and no description and no expected state, THEN THE System SHALL return an error message indicating insufficient context to generate a skill profile.
8. THE stored embedding SHALL enable future semantic search for actions with similar skill requirements.

### Requirement 3: Worker Capability Assessment

**User Story:** As a user, I want to see a person's capability profile relative to a specific action, so that I can understand their strengths and gaps for this assignment.

#### Acceptance Criteria

1. WHEN an approved skill profile exists for an action and a person is the assigned worker or a participant, THE System SHALL compute a contextual capability profile for that person relative to the action.
2. THE System SHALL search for relevant evidence by querying the `unified_embeddings` table for observations (entity_type `state`) that are semantically similar to the action's skill profile embedding, filtering to observations from actions where the person was involved (as assigned worker, participant, or creator) within the same organization.
3. THE System SHALL include observations taken by anyone on actions the person was involved in — not just observations the person personally captured. A person's capability reflects the quality of work that happened under their involvement.
4. THE System SHALL synthesize a natural language capability narrative from the retrieved evidence and produce skill levels on a 0.0 to 1.0 scale on the same axes as the action's skill profile, using AI via Bedrock.
5. THE System SHALL compute capability profiles on-demand at query time — profiles SHALL NOT be stored as static scores in the database.
6. WHEN computing a capability profile, THE System SHALL weight recent evidence more heavily than older evidence to reflect the person's current demonstrated state.
7. WHEN computing a capability profile, THE System SHALL consider consistency across multiple observations — demonstrating mastery requires consistent quality over multiple instances, not a single good result.
8. IF a person has no relevant history for a given action context, THEN THE System SHALL return a profile with all axes at 0.0 and a narrative indicating no relevant evidence was found.
9. THE System SHALL apply capability assessment identically regardless of a person's role — there are no role-based differences in how capability is computed.

### Requirement 4: Radar Chart Visualization

**User Story:** As a user, I want to see a radar chart comparing action skill requirements against each involved person's capabilities, so that skill gaps and strengths are visually transparent.

#### Acceptance Criteria

1. WHEN an approved skill profile and at least one person's capability profile exist for an action, THE System SHALL render a radar chart with the action requirement levels as one polygon and each person's capability levels as additional overlaid polygons.
2. THE Radar Chart SHALL support overlaying the action requirements plus one polygon for each person from the `assigned_to` field and the `participants` array — no artificial limit on the number of overlaid profiles.
3. THE Radar Chart SHALL use distinct visual styles (colors, line patterns) for each overlaid profile and include a legend identifying each profile by person name or "Action Requirements".
4. THE Radar Chart SHALL display the AI-derived axis labels around the chart perimeter, with each axis scaled from 0.0 at the center to 1.0 at the perimeter.
5. WHEN a person's capability level on an axis is below the action requirement level by more than 0.3, THE Radar Chart SHALL visually highlight the gap area to draw attention to the deficiency.
6. EACH axis on the Radar Chart SHALL be clickable or expandable to show the reasoning behind a person's score on that axis — including which observations contributed (with links to the actual photos and text), which past actions were relevant, and a summary of the evidence trail.
7. THE Radar Chart SHALL be accessible from the action detail view, positioned near the worker assignment and participants section.
8. THE System SHALL NOT rank people or recommend assignments — the radar chart provides transparency for humans to make their own decisions.

### Requirement 5: Observations as Skill Evidence

**User Story:** As a user, I want observations to automatically contribute to capability profiles, so that documenting work is intrinsically rewarding and visibly improves demonstrated skills.

#### Acceptance Criteria

1. WHEN a person captures an observation (state) linked to an action, THE System SHALL generate an embedding for the observation via the existing SQS-based embedding pipeline and store it in the `unified_embeddings` table with entity_type `state` and the state's ID as entity_id. No separate entity type is needed — the existing `state` embeddings serve as skill evidence, with action linkage resolved via `state_links` at query time.
2. THE observation embedding source SHALL be composed from the observation's text content and all photo descriptions, following the existing embedding composition patterns.
3. WHEN computing a person's capability profile for an action, THE System SHALL retrieve relevant observations by searching the `unified_embeddings` table for `state` entries that are semantically similar to the action's skill profile embedding, then filtering via `state_links` to observations linked to actions the person was involved in.
4. THE System SHALL include ALL observations as evidence — both high-quality and low-quality work. Inconsistency across observations is itself a signal that the AI should reflect in the capability narrative.
5. WHEN a person captures a new observation on an action that has a skill profile, THE Radar Chart SHALL reflect the updated capability profile on the next render, providing visible feedback that documenting work affects the person's profile.
6. THE System SHALL scope all observation evidence queries by organization_id to maintain multi-tenant data isolation.

### Requirement 6: Organization Capability Profile

**User Story:** As a user, I want to see the organization's collective capability profile for an action, so that shared strengths and gaps are visible and everyone has a stake in the team's growth.

#### Acceptance Criteria

1. WHEN an action has an approved skill profile, THE System SHALL be able to compute an organization-level capability profile by aggregating observation evidence from all organization members across all actions semantically similar to the current action's skill profile.
2. THE organization capability profile SHALL be displayed as an additional overlay on the radar chart — a "Company" polygon alongside individual profiles, using a distinct visual style.
3. THE organization capability profile SHALL be computed on-demand using the same mechanism as individual capability profiles (semantic search of `state` embeddings in `unified_embeddings`) but without filtering to a single person — it reflects the collective evidence across the entire organization.
4. WHEN the organization profile shows a gap on an axis, THAT gap represents a shared weakness — an area where the collective has not demonstrated competence. The gap is visible to everyone in the organization.
5. WHEN any person in the organization captures observations that improve capability in a gap area, THE organization profile SHALL reflect that improvement on the next computation — one person's growth strengthens the whole.
6. THE System SHALL scope the organization capability profile by organization_id to maintain multi-tenant isolation.
