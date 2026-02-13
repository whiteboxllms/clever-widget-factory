# Requirements Document: Experience Tracking System

## Introduction

This feature introduces a structured experience tracking system inspired by Reinforcement Learning (RL) that captures state transitions (S → A → S') as "experiences" for learning and analysis. Experiences represent observed changes in the system across multiple domains: physical assets (tools, parts), biological assets (crops, plants), interpersonal relationships (team dynamics, incidents), and organizational processes (projects, workflows). The system uses AI to compute expected initial states E[S] and expected actions E[A] from historical context when not directly observed, supporting probability distributions over multiple hypotheses. This enables pattern detection, impact assessment, and future reward-based learning across all aspects of farm operations.

## Glossary

- **Experience**: A complete state transition tuple (S, A, S') representing an observed change in any entity
- **Entity**: The subject of an experience - can be a tool, part, person, team, project, incident, or field
- **Initial_State (S)**: The starting state before an action occurred, either observed or expected
- **Action (A)**: The work, event, or process that caused the state transition, either documented or expected
- **Final_State (S')**: The observed outcome state captured by the user (ground truth observation)
- **Expected_State E[S]**: AI-computed estimate of initial state when not directly observed
- **Expected_Action E[A]**: AI-computed estimate of action when not documented
- **Probability**: Confidence level for expected values (0.0-1.0), NULL for observed values
- **Hypothesis**: One possible explanation for S or A, with associated probability
- **Component**: A state or action linked to an experience (initial_state, action, final_state)
- **State_Transition**: The change from S to S' caused by action A
- **Agent**: The AI model or process that generated expected values (e.g., 'bedrock-claude-3.5')
- **Tool_Version**: The software version that generated a state or action (e.g., 'state-generator-v2.1.0')
- **Validation**: Human confirmation or rejection of AI-expected hypotheses
- **System**: The Clever Widget Factory asset management application

## Requirements

### Requirement 1: Experience Data Model

**User Story:** As a system architect, I want a flexible experience tracking system that works across all entity types, so that state transitions can be captured and analyzed consistently whether they involve assets, people, or processes.

#### Acceptance Criteria

1. THE System SHALL store experiences in a dedicated `experiences` table
2. WHEN an experience is created, THE System SHALL record entity_type, entity_id, generated_by_agent, organization_id, created_by, and created_at
3. THE System SHALL support entity_type values: 'tool', 'part'
4. THE System SHALL require entity_type and entity_id to be NOT NULL (experiences are always about something)
5. THE System SHALL enforce organization_id foreign key constraint for multi-tenancy
6. THE System SHALL cascade delete experiences when the organization is deleted
7. THE System SHALL store generated_by_agent to track which AI model created the experience
8. THE System SHALL store created_by to track which user triggered the experience creation

### Requirement 2: Experience Components Junction Table

**User Story:** As a system architect, I want a flexible junction table for linking experiences to states and actions, so that multiple hypotheses can be represented without schema changes.

#### Acceptance Criteria

1. THE System SHALL store experience components in a dedicated `experience_components` table
2. WHEN a component is created, THE System SHALL record experience_id, component_type, state_id OR action_id, rank, status, organization_id, and created_at
3. THE System SHALL support component_type values: 'initial_state', 'action', 'final_state'
4. THE System SHALL enforce CHECK constraint: initial_state and final_state components have state_id NOT NULL and action_id NULL
5. THE System SHALL enforce CHECK constraint: action components have action_id NOT NULL and state_id NULL
6. THE System SHALL allow multiple components of the same type per experience (multiple hypotheses)
7. THE System SHALL store rank as INTEGER to order hypotheses (1 = most likely, 2 = second most likely, etc.)
8. THE System SHALL support status values: 'pending', 'confirmed', 'rejected'
9. THE System SHALL cascade delete components when the associated experience is deleted
10. THE System SHALL cascade delete components when the associated state or action is deleted

### Requirement 3: Source Tracking for States and Actions

**User Story:** As a system architect, I want to distinguish between observed values and AI-computed expected values, so that data provenance is clear and tool versions can be tracked.

#### Acceptance Criteria

1. THE System SHALL add a `source` field to the states table with values: 'user_captured', 'ai_expected', 'system_generated'
2. THE System SHALL add a `source_prompt_id` field to the states table (nullable UUID foreign key to scoring_prompts table)
3. THE System SHALL add a `tool_version` field to the states table (nullable VARCHAR(50))
4. THE System SHALL add a `source` field to the actions table with values: 'user_created', 'ai_expected', 'system_generated'
5. THE System SHALL add a `source_prompt_id` field to the actions table (nullable UUID foreign key to scoring_prompts table)
6. THE System SHALL add a `tool_version` field to the actions table (nullable VARCHAR(50))
7. WHEN a user captures a state, THE System SHALL set source='user_captured', source_prompt_id=NULL, tool_version=NULL
8. WHEN a user creates an action, THE System SHALL set source='user_created', source_prompt_id=NULL, tool_version=NULL
9. WHEN AI computes an expected state, THE System SHALL set source='ai_expected', source_prompt_id to the prompt used, and tool_version to the generator version
10. WHEN AI computes an expected action, THE System SHALL set source='ai_expected', source_prompt_id to the prompt used, and tool_version to the generator version

### Requirement 4: Prompt Type Extension

**User Story:** As a system architect, I want to extend the scoring_prompts table to support state and action expectation prompts, so that all AI prompts are managed consistently.

#### Acceptance Criteria

1. THE System SHALL add a `prompt_type` field to the scoring_prompts table with values: 'scoring', 'state_expectation', 'action_expectation'
2. THE System SHALL default existing prompts to prompt_type='scoring' during migration
3. WHEN creating a state expectation prompt, THE System SHALL set prompt_type='state_expectation'
4. WHEN creating an action expectation prompt, THE System SHALL set prompt_type='action_expectation'
5. THE System SHALL enforce CHECK constraint on prompt_type field
6. THE System SHALL support filtering prompts by prompt_type via API
7. THE System SHALL allow multiple prompts per prompt_type (for experimentation and comparison)

### Requirement 5: Experience Creation from Observation

**User Story:** As a user, when I capture an observation (S'), I want the system to automatically create an experience record, so that state transitions are tracked for analysis.

#### Acceptance Criteria

1. WHEN a user captures a new state (observation), THE System SHALL create an experience record
2. WHEN creating an experience, THE System SHALL extract entity_type and entity_id from state_links associated with the captured state
3. WHEN creating an experience, THE System SHALL create a final_state component linking to the captured state
4. WHEN creating a final_state component, THE System SHALL set status='confirmed' (observed value)
5. THE System SHALL set experience.created_by to the user who captured the state
6. THE System SHALL set experience.generated_by_agent based on which agent will compute E[S] and E[A]
7. THE System SHALL support creating experiences for states linked to multiple entities (create one experience per entity)
8. WHEN a state has no entity links, THE System SHALL NOT create an experience record

### Requirement 6: Expected Initial State Computation E[S]

**User Story:** As a system, I want to compute expected initial states E[S] with probability distributions, so that multiple hypotheses can be evaluated and validated.

#### Acceptance Criteria

1. WHEN computing E[S], THE System SHALL query all states linked to the same entity_type and entity_id
2. WHEN computing E[S], THE System SHALL filter states where captured_at < final_state.captured_at AND source='user_captured'
3. WHEN a prior user-captured state exists, THE System SHALL create an initial_state component with status='confirmed'
4. WHEN no prior user-captured state exists, THE System SHALL invoke AI with a state_expectation prompt
5. WHEN invoking AI, THE System SHALL provide context: entity details, final_state details, photos, action history, recent state history
6. WHEN AI generates multiple E[S] hypotheses, THE System SHALL create multiple state records with source='ai_expected'
7. WHEN AI generates E[S], THE System SHALL create initial_state components for each hypothesis with probability and rank
8. WHEN E[S] components are created, THE System SHALL set status='pending' for all hypotheses
9. THE System SHALL provide an API endpoint to trigger E[S] computation for a specific experience
10. THE System SHALL support bulk E[S] computation for all experiences with no initial_state components

### Requirement 7: Expected Action Computation E[A]

**User Story:** As a system, I want to compute expected actions E[A] with probability distributions, so that state transitions can be explained even when actions weren't documented.

#### Acceptance Criteria

1. WHEN computing E[A], THE System SHALL query all actions linked to the same entity_type and entity_id
2. WHEN computing E[A] and initial_state components exist, THE System SHALL filter actions in the time window between initial and final states
3. WHEN computing E[A] and no initial_state components exist, THE System SHALL filter actions where created_at < final_state.captured_at
4. WHEN a documented action exists in the time window, THE System SHALL create an action component with probability=NULL, status='confirmed'
5. WHEN no documented action exists, THE System SHALL invoke AI with an action_expectation prompt
6. WHEN invoking AI, THE System SHALL provide context: entity details, initial_state (if known), final_state, historical actions, photos
7. WHEN AI generates multiple E[A] hypotheses, THE System SHALL create multiple action records with source='ai_expected'
8. WHEN AI generates E[A], THE System SHALL create action components for each hypothesis with probability and rank
9. WHEN E[A] components are created, THE System SHALL set status='pending' for all hypotheses
10. THE System SHALL provide an API endpoint to trigger E[A] computation for a specific experience
11. THE System SHALL support bulk E[A] computation for all experiences with no action components

### Requirement 8: Hypothesis Validation Workflow

**User Story:** As a user, I want to validate or reject AI-generated hypotheses, so that the system learns which expectations are accurate and improves over time.

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint to confirm a specific component hypothesis
2. WHEN a user confirms a hypothesis, THE System SHALL update status='confirmed', validated_by=user_id, validated_at=NOW()
3. WHEN a user confirms a hypothesis, THE System SHALL update other hypotheses of the same type to status='rejected'
4. THE System SHALL provide an API endpoint to reject a specific component hypothesis
5. WHEN a user rejects a hypothesis, THE System SHALL update status='rejected', validated_by=user_id, validated_at=NOW()
6. THE System SHALL allow users to confirm multiple hypotheses if multiple explanations are valid
7. THE System SHALL track validation metadata for learning and model improvement
8. THE System SHALL support re-validation (changing confirmed to rejected or vice versa)

### Requirement 9: Experience Retrieval

**User Story:** As a developer, I want to retrieve experiences for an entity via API, so that analysis and learning systems can access structured state transitions.

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint to retrieve experiences by entity_type and entity_id
2. WHEN retrieving experiences, THE System SHALL include all components (initial_state, action, final_state)
3. WHEN retrieving components, THE System SHALL include state details (state_text, captured_at, source, photos)
4. WHEN retrieving components, THE System SHALL include action details (title, description, created_at, source)
5. WHEN retrieving components, THE System SHALL include rank and status for each hypothesis
6. THE System SHALL sort experiences by created_at descending (most recent first)
7. THE System SHALL filter experiences by organization_id for multi-tenancy
8. THE System SHALL support filtering by component status (pending, confirmed, rejected)
9. THE System SHALL support filtering by entity_type
10. THE System SHALL provide an API endpoint to retrieve a single experience with all components

### Requirement 10: Multi-Tenancy and Data Integrity

**User Story:** As a system architect, I want experiences to respect organization boundaries, so that data remains isolated and secure.

#### Acceptance Criteria

1. THE System SHALL include organization_id in all experiences queries
2. THE System SHALL include organization_id in all experience_components queries
3. THE System SHALL enforce foreign key constraints between experiences and organizations
4. THE System SHALL enforce foreign key constraints between experience_components and organizations
5. WHEN an organization is deleted, THE System SHALL cascade delete all associated experiences
6. WHEN an experience is deleted, THE System SHALL cascade delete all associated components
7. THE System SHALL validate that all components belong to the same organization as the experience
8. WHEN computing E[S] or E[A], THE System SHALL only access data within the experience's organization_id scope

### Requirement 11: Entity Type Support

**User Story:** As a user, I want to track experiences for tools and parts, so that I can understand how physical assets and consumables change over time.

#### Acceptance Criteria

1. THE System SHALL support entity_type='tool' for any asset with a unique identifier (ladders, tractors, equipment, individual plants with ID stakes)
2. THE System SHALL support entity_type='part' for consumable items without unique tracking (wine batches, bulk seeds, materials)
3. THE System SHALL validate entity_id references the appropriate table based on entity_type
4. THE System SHALL support adding new entity types in the future without schema changes (via CHECK constraint update)

### Requirement 12: AI Context Composition for Expectation

**User Story:** As a system architect, I want comprehensive context provided to AI when computing expected values, so that E[S] and E[A] estimates are accurate and grounded in history.

#### Acceptance Criteria

1. WHEN computing E[S], THE System SHALL provide AI with: entity details (name, description, category), final_state details (text, photos, timestamp), recent action history (last 10 actions), and recent state history (last 5 states)
2. WHEN computing E[A], THE System SHALL provide AI with: entity details, initial_state details (if known), final_state details, action history, and state transition context
3. THE System SHALL format context as natural language suitable for LLM analysis
4. THE System SHALL include photo URLs and descriptions in the context
5. THE System SHALL include timestamps to help AI estimate when actions likely occurred
6. THE System SHALL limit context size to prevent token overflow (max 8000 tokens)
7. WHEN context exceeds limits, THE System SHALL prioritize: final_state (required), initial_state (if known), most recent history

## Future Considerations

The following features are out of scope for this initial implementation but should be considered in the design:

1. **Reward Computation E[R]**: Separate table for experience rewards/scores with multi-dimensional values (Δ_condition, Δ_risk, Δ_team)
2. **Experience Chains**: Link experiences into sequences for trajectory analysis (mani mani growth: planting → vegetative → flowering → fruit)
3. **Distribution Over Trajectories**: Track probability distributions over multiple possible paths
4. **Joint Probabilities**: Represent P(S,A|S') for correlated state-action pairs
5. **Confidence Evolution**: Track how probabilities change over time as new evidence arrives
6. **Bayesian Updating**: Update probabilities when new observations contradict or confirm hypotheses
7. **Experience Sampling**: Prioritized sampling for AI agent context (RL experience replay buffer)
8. **Pattern Detection**: Identify recurring state transitions or anomalies across experiences
9. **Impact Analysis**: Correlate experiences with financial, safety, or operational outcomes
10. **Experience Embeddings**: Generate semantic embeddings for experience tuples to enable similarity search
11. **UI/Display**: Timeline views, experience cards, filtering and search interfaces
12. **Model Calibration**: Track which agents/tools produce accurate hypotheses and adjust confidence accordingly

## Non-Functional Requirements

1. **Performance**: Experience queries should return results within 500ms for typical entity histories (< 100 experiences)
2. **Scalability**: The system should support 10,000+ experiences per organization without performance degradation
3. **Data Integrity**: All foreign key constraints must be enforced to prevent orphaned records
4. **Auditability**: All AI-generated content must be traceable to specific agents, prompts, and tool versions
5. **Token Efficiency**: AI context should be optimized to minimize token usage while maintaining accuracy
6. **Extensibility**: New entity types should be addable via configuration without code changes

## Success Metrics

1. **Coverage**: Percentage of user-captured states that have associated experiences
2. **Completeness**: Percentage of experiences with at least one initial_state and action component
3. **Validation Rate**: Percentage of AI-expected hypotheses that users validate (confirm or reject)
4. **Accuracy**: Percentage of confirmed hypotheses that were rank=1 (AI's top guess was correct)
5. **Usage**: Number of experiences created per week
6. **Entity Diversity**: Distribution of experiences across entity types (tools, parts)
7. **Learning Value**: Foundation for future reward-based learning and pattern detection
