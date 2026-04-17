# Requirements Document

## Introduction

The Growth Learning Module extends the existing observation-based training system by reframing the skill radar chart from a "capability assessment" into a "growth checklist" — a tool that identifies what a person needs to learn before starting an action. When the chart surfaces a skill gap (any axis where demonstrated capability falls below the required level), the system offers a "Start Learning" flow that generates AI-powered learning briefs tailored to each specific gap.

The core philosophy: the actual skill level matters less than a person's ability to learn. The radar chart is not a performance score — it is a learning gap analysis. The minimum bar for starting a task is Bloom's level 2 (Understand) on every axis: a person should grasp WHY, not just HOW, before beginning work.

This spec focuses exclusively on the growth/learning aspect of the skills layer. It builds on the deployed observation-based training system (skill profiles, capability assessment, radar chart, axis drilldown) and integrates with the existing Maxwell AI assistant pattern for generating learning content via Bedrock. Future specs will address virtues (how) and mission alignment (why) — those are out of scope here.

## Glossary

- **Growth_Checklist**: The reframed radar chart section that presents skill gaps as items to learn rather than deficiencies to judge. Replaces the previous "Capability Assessment" label.
- **Skill_Gap**: A condition where a person's demonstrated capability on a skill axis is below the action's required level for that axis. Identified by the existing radar chart gap detection logic.
- **Learning_Brief**: An AI-generated document for a specific skill gap, containing what to study, why the skill matters for the action, key concepts to understand, and suggested learning activities. Tailored to bring a person from their current demonstrated level to at least Bloom's level 2 (Understand).
- **Bloom_Level**: A classification on the Bloom's taxonomy scale (0-5) used by the existing skill profile system. Level 0 = No exposure, 1 = Remember, 2 = Understand, 3 = Apply, 4 = Analyze, 5 = Create.
- **Understand_Threshold**: Bloom's level 2 (Understand) — the minimum bar where a person grasps WHY something works, not just HOW to do it. The target level before a person should start a task.
- **Learning_Flow**: The user experience initiated by clicking "Start Learning" on a gap axis, which generates and presents a Learning_Brief and tracks the person's learning engagement.
- **Maxwell**: The existing AI assistant powered by AWS Bedrock Agent, used here for generating Learning_Brief content.
- **Skill_Profile**: The existing AI-generated, human-approved profile of what capabilities an action demands (4-6 Bloom's-scaled axes stored as JSONB on the action).
- **Capability_Profile**: The existing on-demand computed profile of a person's demonstrated skill levels relative to an action, derived from observation evidence via semantic search.
- **Knowledge_State**: A state record capturing a person's quiz response as a natural language record. Stored in the `states` table and linked to its learning objective via `state_links` with `entity_type = 'learning_objective'`. Embedded automatically for semantic search.

## Requirements

### Requirement 1: Growth Checklist Reframing

**User Story:** As a user, I want the skill assessment section to be framed as a growth checklist, so that skill gaps feel like learning opportunities rather than judgments.

#### Acceptance Criteria

1. THE Growth_Checklist SHALL use the heading "Growth Checklist" in place of any previous "Capability Assessment" label in the action detail view.
2. WHEN skill gaps exist on one or more axes for a person, THE Growth_Checklist SHALL present each gap as a checklist item with the axis label, the person's current level, and the required level.
3. THE Growth_Checklist SHALL retain the existing radar chart visualization — the reframing applies to labels and surrounding UI copy, not to the chart rendering logic.
4. WHEN no skill gaps exist for a person (all axes meet or exceed the required level), THE Growth_Checklist SHALL display a confirmation message indicating the person meets all requirements for this action.
5. THE Growth_Checklist SHALL display a summary count of gaps remaining (e.g., "3 of 5 skills need attention") for each person who has gaps.

### Requirement 2: Gap Identification and Understand Threshold

**User Story:** As a user, I want to see which skills need to reach at least Bloom's level 2 (Understand), so that I know the minimum learning target before starting a task.

#### Acceptance Criteria

1. THE Growth_Checklist SHALL identify a gap on any axis where a person's demonstrated capability level is below the action's required level for that axis, using the existing gap detection logic.
2. FOR EACH gap axis, THE Growth_Checklist SHALL display the Understand_Threshold (Bloom's level 2) as the minimum target the person should reach before starting the action.
3. WHEN a person's demonstrated level on a gap axis is below Bloom's level 2, THE Growth_Checklist SHALL visually distinguish that axis as needing learning attention (e.g., a warning indicator or highlight).
4. WHEN a person's demonstrated level on a gap axis is at or above Bloom's level 2 but still below the required level, THE Growth_Checklist SHALL indicate partial readiness — the person understands the concept but has not yet demonstrated full proficiency.
5. THE Growth_Checklist SHALL order gap axes by severity, with axes furthest below Bloom's level 2 listed first.

### Requirement 3: Start Learning Button and Entry Point

**User Story:** As a user viewing a skill gap, I want a "Start Learning" button on each gap axis, so that I can initiate a learning flow for that specific skill.

#### Acceptance Criteria

1. WHEN a person has a gap on a skill axis, THE Growth_Checklist SHALL display a "Start Learning" button adjacent to that axis in the gap checklist and within the AxisDrilldown sheet.
2. WHEN the user clicks the "Start Learning" button, THE System SHALL initiate a Learning_Flow for that specific axis, person, and action context.
3. WHEN a Learning_Session already exists for the person on that axis and action, THE Growth_Checklist SHALL display a "Review Learning" button instead of "Start Learning" to allow the person to revisit the generated Learning_Brief.
4. WHEN no approved Skill_Profile exists for the action, THE System SHALL NOT display any "Start Learning" buttons.
5. WHEN no Capability_Profile has been computed for the person, THE System SHALL NOT display any "Start Learning" buttons.

### Requirement 3.5: Learning Objectives Generation

**User Story:** As a user starting a learning flow, I want to see specific learning objectives for my skill gap, with ones I've likely covered marked as optional, so that I focus on what I need to learn without wasting time on what I already know.

#### Acceptance Criteria

1. WHEN the user clicks "Start Learning" on a gap axis, THE System SHALL first generate a set of learning objectives for that axis based on the action's expected state, the skill axis label, and the person's current demonstrated level.
2. THE learning objectives SHALL describe what the person needs to understand (Bloom's level 2) — focused on "why" rather than "how to."
3. THE System SHALL use the action's expected state (S') as the primary driver for generating objectives — what does the person need to understand to achieve the desired outcome?
4. THE System SHALL tag each objective with the person's evidence level based on their capability assessment evidence and past quiz answers: "No evidence" (required), "Some evidence from past work" (optional review), or "Previously answered correctly" (optional review).
5. THE System SHALL present all objectives to the person before the quiz begins — required objectives are shown prominently, optional review objectives are shown as skippable.
6. THE person SHALL be able to choose to include optional review objectives in their quiz if they want to review.
7. EACH quiz question generated in Requirement 4 SHALL map to at least one learning objective.
8. THE System SHALL track whether the person chose to review optional objectives, providing data on learning engagement.
9. THE learning objectives SHALL be stored and displayed on the action detail view as a checklist grouped by skill axis, showing each objective's status (not started, in progress, completed) so the person can see what's needed for this task.

### Requirement 4: Quiz-Based Learning Flow

**User Story:** As a user with a skill gap, I want to take an adaptive quiz that tests my understanding using real observations, tools, and process knowledge, and keeps going until I demonstrate understanding of each learning objective.

#### Acceptance Criteria

1. WHEN the user starts a quiz for a gap axis, THE System SHALL generate an initial round of multiple-choice questions covering the selected learning objectives, with at least one question per objective.
2. THE System SHALL generate three types of questions: photo-based questions using images from the evidence observations pulled during capability assessment, concept-based questions probing the "why" behind practices relevant to the skill axis, and tool/equipment-based questions about tools available to the team (from the action's required_tools and organization tool inventory).
3. THE System SHALL prioritize the action's expected state (S') as the primary context for question generation — questions should orient the person toward understanding why the desired outcome matters. The policy field SHALL NOT be used as source material for quiz generation.
4. THE System SHALL use the following as source material for generating questions: the full action context (title, description, expected state), evidence observations (photos and text) from the capability assessment, the action's required tools and linked asset context, the organization's tool inventory, and the person's past quiz answers for this axis and action.
5. THE System SHALL record each answer (correct or incorrect) with a timestamp, the question text, the selected answer, and the correct answer. The first selected answer is the scored response.
6. WHEN the person completes a round of questions, THE System SHALL evaluate which learning objectives had incorrect first-attempt answers.
7. FOR EACH objective with incorrect answers, THE System SHALL generate new questions targeting that objective from a different angle or probing deeper, using the person's previous wrong answers as context so the AI can address the specific misconception.
8. THE System SHALL continue generating rounds until the person answers correctly (first attempt) on at least one question for every learning objective.
9. WHEN a learning objective has been answered correctly, THE System SHALL mark that objective's status as completed.
10. WHEN all selected learning objectives are completed, THE System SHALL display a completion summary and return the person to the action detail view.

### Requirement 5: Storage Model

**User Story:** As the system, I need to persist learning objectives and knowledge states using the existing states infrastructure, so that learning data is searchable, embeddable, and integrated with the observation pipeline.

#### Acceptance Criteria

1. THE System SHALL store learning objectives as states in the existing `states` table, with `state_text` containing the objective text, linked to the action via `state_links` with `entity_type = 'action'`.
2. THE System SHALL store quiz responses as knowledge states in the `states` table, with `state_text` containing a natural language record in the format: "For learning objective '{objective}' and question '{question}', I selected '{answer}' which was the {correct|incorrect} answer." Each knowledge state SHALL be linked to its learning objective state via `state_links` with `entity_type = 'learning_objective'`.
3. BOTH learning objectives and knowledge states SHALL be embedded automatically via the existing SQS-based embedding pipeline as `state` entity types, enabling semantic search across all learning data alongside work observations.
4. THE System SHALL NOT create new tables for learning data — all persistence uses the existing `states`, `state_links`, and `unified_embeddings` tables.
5. THE System SHALL scope all learning data queries by organization_id for multi-tenant isolation.

### Requirement 6: Quiz UI and Display

**User Story:** As a user taking a learning quiz, I want a full-page focused experience that shows one question at a time with immediate feedback, so that I can learn at my own pace without feeling rushed.

#### Acceptance Criteria

1. WHEN the user starts a quiz, THE System SHALL navigate to a dedicated full-page quiz view (new route), showing the action title and skill axis as context at the top.
2. THE System SHALL display one question at a time with a "Next" button that appears only after the person has selected the correct answer.
3. WHEN a question includes a photo from an evidence observation, THE System SHALL display the photo large above the question text.
4. WHEN the person selects a wrong answer, THE System SHALL immediately show why it's wrong with a brief explanation, and allow the person to select another answer.
5. WHEN the person selects the correct answer, THE System SHALL show a brief explanation of why it's correct. The person MAY continue clicking other answer options to explore the explanations before clicking "Next."
6. THE System SHALL record the person's first selected answer as their scored response. Subsequent selections on the same question are exploratory and not scored.
7. AT the end of the quiz, THE System SHALL display a summary showing the number of questions answered correctly on the first attempt, with a link back to the action detail view.

### Requirement 7: Learning Progress Indicators

**User Story:** As a user, I want to see which learning objectives I've completed, which are in progress, and which haven't been started, so that I can track my readiness for this action.

#### Acceptance Criteria

1. THE Growth_Checklist on the action detail view SHALL display learning objectives grouped by skill axis, with each objective showing one of three states: not started, in progress (quiz started but objective not yet passed), or completed (answered correctly on first attempt).
2. FOR EACH skill axis that has learning objectives, THE Growth_Checklist SHALL show a progress summary (e.g., "2 of 4 objectives completed").
3. WHEN all learning objectives for an axis are completed, THE System SHALL visually mark that axis as learning-complete (e.g., a checkmark on the axis in the growth checklist).
4. WHEN all learning objectives across all gap axes are completed, THE Growth_Checklist SHALL display a summary indicating the person has completed all learning for this action.
5. THE progress indicators SHALL update immediately after the person completes a quiz round — no manual refresh required.

### Requirement 8: Integration with Existing Systems

**User Story:** As a user, I want the learning module to work seamlessly with the existing radar chart and axis drilldown, so that the experience feels like a natural extension of the current system.

#### Acceptance Criteria

1. THE Growth_Checklist SHALL continue to render the existing radar chart with all current functionality intact: requirement polygon, person polygons, organization polygon, gap highlighting, and clickable axis labels.
2. THE AxisDrilldown sheet SHALL be extended to include a "Start Learning" or "Review Learning" button for the displayed axis when a gap exists for the person being viewed.
3. THE System SHALL use TanStack Query hooks for fetching and caching learning objectives and quiz data, following the project's existing data fetching patterns.
4. THE System SHALL use shadcn-ui components and Tailwind CSS for all new UI elements, consistent with the existing component library.
5. THE learning flow SHALL NOT modify or interfere with the existing capability assessment computation — learning objectives and quiz results are supplementary, not inputs to the scoring model.
6. THE new full-page quiz route SHALL be accessible via React Router and support direct URL navigation (bookmarkable).
7. WHEN a person returns to a quiz, THE System SHALL regenerate questions fresh using the person's existing knowledge states as context — completed objectives are skipped, past wrong answers inform new question generation. No quiz state is cached or stored as JSON.
8. THE quiz generation Lambda SHALL use Claude Sonnet for question quality, particularly for photo-based questions requiring visual interpretation and adaptive follow-up questions requiring pedagogical reasoning about misconceptions.

### Requirement 9: Demonstrated Skill Verification via Observations

**User Story:** As a user capturing an observation on an action, I want to see which learning objectives I can demonstrate with this observation, so that my practical work closes the loop on what I learned.

#### Acceptance Criteria

1. WHEN a person opens the observation form for an action that has learning objectives, THE System SHALL display the incomplete learning objectives as a demonstration checklist alongside the observation form.
2. THE person MAY check off which learning objectives they believe this observation demonstrates before saving.
3. AFTER the observation is saved, THE System SHALL send the observation text, photos, and the learning objectives to the AI to evaluate which objectives the observation actually demonstrates.
4. THE System SHALL compare the person's self-assessment against the AI's evaluation and display the results — confirmed (both agree), unconfirmed (person claimed but AI didn't see evidence), or AI-detected (AI found evidence the person didn't claim).
5. WHEN an objective is confirmed (person checked it and AI agrees), THE System SHALL mark that objective as demonstrated by creating a knowledge state linking the observation to the learning objective.
6. THE demonstrated objectives SHALL update the learning progress indicators on the Growth_Checklist, distinguishing between "quiz-completed" (understood the why) and "demonstrated" (applied it in practice).
