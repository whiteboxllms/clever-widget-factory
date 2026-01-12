Exploration Data Collection Flow – Requirements
Introduction
The Exploration Data Collection Flow extends the existing action system to support structured exploration and policy development in agricultural operations. Users can mark actions as explorations, capture structured data about those explorations, and promote successful practices into reusable policies.
​

Field names in this document (for example state_text, policy_text, summary_policy_text) are logical names; Kiro SHOULD map them to existing columns in the current action schema where appropriate.
​

Glossary
Action: A record of what was done at a point in time, including photos, associated assets, materials, and text updates.
​

Exploration: A special kind of action where someone deliberately tries a new path to learn, lightweight and without formal controls.
​

State: Text description of the situation/problem/context at the time of the action (logical field state_text).
​

Policy: A reusable, shared practice or procedure in the policy table that can be linked to multiple actions.
​

Summary_Policy: Per-action synthesis of how an action should be done in this context with key reminders (logical field summary_policy_text).
​

Exploration_Code: Unique identifier for explorations in format SF<mmddyy>EX<number> (e.g., SF010326EX01).
​

Embedding_Service: AI service (e.g., Titan V1) that generates vector embeddings for semantic search.
​

RDS Schema Requirements
1. action table (existing, extended)
The existing action table remains the primary record of what someone did. Kiro MUST use existing columns for state and policy where they already exist; new fields should only be added when not already present.
​

Required/confirmed logical columns:

id (PK)

state_text (text; existing)

User-described context/problem.

policy_text (text, nullable; existing)

“Policy as understood right now” (their research / best practice they thought they were following).

summary_policy_text (text, nullable; new logical field if not already present)

Per‑action synthesis: concise description of how this action should be done in this context, with key reminders/deliverables.

May be AI-assisted or user-written.

policy_id (FK → policy.id, nullable)

Link to an optional promoted policy.

Set only in later review flows (“Create policy from this” or “Link to existing policy”).

Other existing fields (unchanged), for example:

user_id

location fields

crop

timestamps (created_at, updated_at)

attachments / photo relations

Embedding:

No vector column MUST be added to action; all embeddings for action-related text SHOULD be stored in action_embedding (see below).
​

2. exploration table (new, 1‑to‑1 with action)
Represents that an action is an exploration (renamed from the older “experiment” concept).
​

Columns:

id (PK)

action_id (FK → action.id, unique)

Enforces one exploration per action.

exploration_code (string)

Format: SF<mmddyy>EX<number> (e.g., SF010326EX01).

System MUST auto-suggest the next available <number> for that date (or date + farm), and allow user override.

exploration_notes_text (text, nullable)

“What are you changing and why?”.

metrics_text (text, nullable)

“What metrics do you expect to be impacted?” (descriptive text, not numeric results).

public_flag (boolean, default false)

“I am willing to make this exploration visible to others.”

created_at, updated_at (timestamps)

Constraints:

System MUST enforce the one‑to‑one relationship between action and exploration (unique constraint on action_id).
​

exploration_code MUST be unique system-wide.
​

3. policy table (new, promoted/shared policies)
Stores shared, promoted policies (distinct from per-action summary_policy_text).
​

Columns:

id (PK)

title (string)

Short description, e.g. “Vermi tea application on mani mani”.

description_text (text)

Detailed policy statement; may reference other internal SOPs or guidelines.

status (enum/string)

Values: at minimum draft, active, deprecated.

effective_from (date, nullable)

effective_to (date, nullable)

created_by_user_id (FK → users.id)

created_at, updated_at (timestamps)

Relationships:

Many actions MAY share the same policy_id.

Most actions MAY have policy_id null; summary_policy_text still exists on the action in that case.
​

4. Embedding side tables
Vector embeddings MUST be stored in separate tables and MUST NOT be stored directly on the main domain tables.
​

4.1 action_embedding
id (PK)

action_id (FK → action.id)

embedding_type (string)

Values such as: state, policy_text, summary_policy_text, combined (extensible).

model (string)

e.g., titan-text-embeddings-v1.

embedding (vector / varbinary / text)

created_at (timestamp)

4.2 exploration_embedding
id (PK)

exploration_id (FK → exploration.id)

embedding_type (string)

e.g., exploration_notes, metrics.

model (string)

embedding (vector / varbinary / text)

created_at (timestamp)

4.3 policy_embedding
id (PK)

policy_id (FK → policy.id)

embedding_type (string)

e.g., description.

model (string)

embedding (vector / varbinary / text)

created_at (timestamp)

Embedding generation SHOULD be done asynchronously in the background after saves; user saves MUST NOT be blocked by embedding calls.
​

UI / Flow Requirements
1. Action creation (existing flow, light changes)
Existing “create action” flow MUST be maintained; current fields (including state/policy text and photos) MUST continue to work without disruption.
​

Add an optional textarea “Summary policy for this action”, backed by summary_policy_text (or existing equivalent column):

Placeholder: “Briefly summarize how this should be done and key reminders (e.g., PPE, timing, documentation).”

Optional AI assist button: “Suggest summary” that uses state_text, policy_text, and action metadata to propose a summary the user can edit.

Add a checkbox “This is an exploration”:

When checked and the action is saved:

System MUST create an exploration row linked to this action.

System MUST auto-generate exploration_code as SF<mmddyy>EX<number> using the next available number for that date (or date + farm) and allow manual override.

2. Exploration tab (action detail)
When an action has an associated exploration row, the system MUST show an “Exploration” tab on the action detail view (after Policy, before Implementation).
​

Fields on the Exploration tab (all optional, editable anytime):

exploration_notes_text with prompt: “What are you changing and why?”

metrics_text with prompt: “What metrics do you expect to be impacted?”

public_flag checkbox: “I am willing to make this exploration visible to others.”

AI assistance (optional, non-blocking):

Button “Suggest from AI”:

Reads state_text, policy_text, summary_policy_text, and other action fields.

Proposes candidate exploration_notes_text and metrics_text in the UI.

User can accept, edit, or discard suggestions.

On save of the action/exploration:

System MUST persist the exploration fields.

System MUST trigger background embedding generation for:

state_text → action_embedding with embedding_type = 'state'.

policy_text → action_embedding with embedding_type = 'policy_text'.

summary_policy_text → action_embedding with embedding_type = 'summary_policy_text'.

exploration_notes_text and metrics_text → exploration_embedding with appropriate embedding_type values.

3. Photos and timing
System MUST NOT enforce scheduled photos (no mandatory date workflow).
​

Users MUST be able to:

Upload photos of treated/exploration areas.

Optionally upload photos or descriptions of untreated/comparison areas.

Users MUST be able to revisit the action later to add or update photos and notes; saving MUST update action and exploration rows and MAY refresh embeddings.

4. Save / Done behavior
The action detail page MUST have a single “Save” or “Done” button for all action types.
​

System MUST NOT add “Analyze experiment” or similar blocking analysis actions into the primary flow; deeper analysis and review happen on separate surfaces.

Review and Policy Workflows
1. “Review explorations” page
A separate page MUST exist to review explorations.

Features:

Filters MUST include at least:

Date range

Location

Explorer (user)

public_flag

The explorations list MUST be based on exploration joined with action and show for each row:

exploration_code

state_text

Short action summary (from existing action fields)

summary_policy_text (if present)

exploration_notes_text, metrics_text

Key photos (e.g., first or selected thumbnails)

Per-row actions:

“Create policy from this”

Starts policy promotion flow (below).

“Link to existing policy”

Opens a selector of existing policy records and sets action.policy_id when confirmed.

2. Policy promotion flow (from an exploration/action)
Triggered when the user clicks “Create policy from this”.

Flow:

System collects:

state_text, policy_text, summary_policy_text.

Key exploration details (exploration_notes_text, metrics_text).

(Optionally in the future) related actions/observations.

AI proposes a new policy draft:

policy.title: Short, clear rule (e.g., “Vermi tea application on mani mani slope plots”).

policy.description_text: Detailed statement including:

When to use this policy.

High-level steps.

References to other SOPs/guidelines if available.

User can:

Edit title and description_text.

Choose status (draft or active).

Save.

On save:

System MUST create a new policy row.

System MUST optionally set action.policy_id to this new policy if the user chooses to link it.

System MUST generate a policy_embedding for policy.description_text in the background.

3. Linking to an existing policy
From the Review explorations page, “Link to existing policy” MUST open a selector for existing policies (with filtering/search by crop, type, or text).
​

On selection, the system MUST set action.policy_id to the chosen policy.

Queries and Analytics Kiro SHOULD Support
With this schema, the system SHOULD support at least:

Percent of actions that were explorations in a date range

Example SQL sketch:

SELECT COUNT(DISTINCT e.action_id) / COUNT(DISTINCT a.id) ... WHERE a.created_at BETWEEN ...

e is exploration, a is action.

Find explorations about mani mani establishment and weed competition

Semantic search across:

action_embedding (embedding_type in state, summary_policy_text, optionally policy_text)

exploration_embedding (exploration_notes, metrics)

Filter by crop = mani mani and/or keywords like “weed competition”.

Show policies related to safety gear

Semantic search over policy_embedding with embedding_type = 'description' and status = 'active'.

Cluster actions by summary policy

Use embeddings from summary_policy_text to cluster actions into similar “playbooks” even if they are not yet linked to a shared policy.
​

Numeric scoring / RL reward functions are out of scope for this phase; analytics are limited to counts, percentages, and semantic search/clustering over the data above.
​