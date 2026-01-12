Core concepts
State: Text description of the situation/problem/context at the time of the action (state_text).​
Action: What was actually done at a point in time, including photos, associated assets, materials and text updates, etc.​
Exploration: A special kind of action where someone deliberately tries a new path to learn, lightweight and without formal controls.​
Per‑action summary policy: summary_policy_text on the action, a synthesized “what should be done here” plus reminders, specific to this action or pattern.
Promoted policy: A reusable, shared policy record in policy table, optionally linked to actions later.​

RDS schema requirements
1. action table (existing, extended)
Use the existing action table as the primary record of what someone did.​
Required/confirmed columns:
id (PK)
state_text (text)
User-described context/problem.
policy_text (text, nullable)
“Policy as understood right now” (their research / best practice they thought they were following).
summary_policy_text (text, nullable)
Per‑action synthesis: concise description of how this action should be done in this context, with key reminders/deliverables.
May be AI-assisted or user-written.
policy_id (FK → policy.id, nullable, new)
Link to an optional promoted policy.
Set only in later review flows (“Create policy from this” or “Link to existing policy”).
Other existing fields remain unchanged (examples):
Embedding:
No vector column directly on action; embeddings stored in action_embedding table (see below).​
2. exploration table (new, 1‑to‑1 with action)
Represents that an action is an exploration (formerly “experiment”).​
Columns:
id (PK)
action_id (FK → action.id, unique)
Enforces one exploration per action.
exploration_code (string)
Format: SF<mmddyy>EX<number> (e.g., SF010326EX01).
Auto-suggest the next number per farm + date or at least per date; allow user override.
exploration_notes_text (text, nullable)
“What are you changing and why?”.
metrics_text (text, nullable)
“What metrics do you expect to be impacted?”.
public_flag (boolean, default false)
“I am willing to make this exploration visible to others.”
created_at, updated_at (timestamps)
3. policy table (new, promoted/shared policies)
Stores shared, promoted policies (distinct from per-action summary_policy_text).​
Columns:
id (PK)
title (string)
Short description, e.g. “Vermi tea application on mani mani”.
description_text (text)
Detailed policy statement; may reference other internal SOPs or guidelines.
status (enum/string)
Values: draft, active, deprecated (minimum).
effective_from (date, nullable)
effective_to (date, nullable)
created_by_user_id (FK → users.id)
created_at, updated_at (timestamps)
Relationships:
Many actions may share the same policy_id.
Most actions may have policy_id null; summary_policy_text still exists on the action in that case.
4. Embedding side tables
Do not store vector columns in main tables; follow AWS vector-store patterns (Titan V1, pgvector/varbinary/etc.).​
4.1 action_embedding
id (PK)
action_id (FK → action.id)
embedding_type (string)
Values: state, policy_text, summary_policy_text, combined (extensible).
model (string)
e.g., titan-text-embeddings-v1.
embedding (vector / varbinary / text, as per existing pattern)
created_at (timestamp)
4.2 exploration_embedding
id (PK)
exploration_id (FK → exploration.id)
embedding_type (string)
e.g., exploration_notes, metrics.
model (string)
embedding (vector / varbinary / text)
created_at
4.3 policy_embedding
id (PK)
policy_id (FK → policy.id)
embedding_type (string)
e.g., description.
model (string)
embedding (vector / varbinary / text)
created_at

UI / flow requirements
1. Action creation (existing flow, light changes)
Keep current “create action” flow; fields such as state_text, policy_text, photos, etc. remain.​
Add new optional textarea: “Summary policy for this action” (backed by summary_policy_text).
Placeholder text:
“Briefly summarize how this should be done and key reminders (e.g., PPE, timing, documentation).”
Optional AI assist button: “Suggest summary” that uses state_text, policy_text, and action metadata to propose summary_policy_text the user can edit.
Add checkbox: “This is an exploration”.
When checked on save:
Create an exploration row linked to this action.
Auto-generate exploration_code as SF<mmddyy>EX<number> using the next available number for that date; allow manual edit.
2. Exploration tab (action detail)
When an action has an associated exploration row, show an “Exploration” tab (after Policy, before Implementation).​
Fields on the Exploration tab (all optional, editable anytime):
exploration_notes_text with prompt: “What are you changing and why?”
metrics_text with prompt: “What metrics do you expect to be impacted?”
public_flag: checkbox “I am willing to make this exploration visible to others.”
AI assistance (optional, non-blocking):
Button: “Suggest from AI”.
Reads state_text, policy_text, summary_policy_text, and other action fields.
Proposes candidate values for exploration_notes_text and metrics_text in the UI.
User can accept, edit, or discard.
On save of the action/exploration:
Persist exploration fields.
Trigger background embedding generation for:
state_text → action_embedding (embedding_type = state).
policy_text → action_embedding (embedding_type = policy_text).
summary_policy_text → action_embedding (embedding_type = summary_policy_text).
exploration_notes_text, metrics_text → exploration_embedding with appropriate types.
3. Photos and timing
Do not enforce scheduled photos (no mandatory date workflow).​
Allow users to:
Upload photos of treated/exploration areas.
Optionally upload photos or descriptions of untreated/comparison areas.
Users may revisit the action later to add or update photos and notes; saving just updates action and exploration rows and may refresh embeddings.
4. “Save / Done” behavior
Keep a single “Save” or “Done” button on the action detail page.​
Do not add “Analyze experiment” in the primary flow; any deeper analysis is kept for a separate review surface.

Review and policy workflows
1. “Review explorations” page
Create a separate page to review explorations at a later time.​
Features:
Filters:
Date range
Location
Explorer
public_flag
List of explorations:
Join exploration with action.
Show for each row:
exploration_code
state_text
Short action summary (existing action fields)
summary_policy_text (if present)
exploration_notes_text, metrics_text
Key photos
Per-row actions:
“Create policy from this”
Starts policy promotion flow (see below).
“Link to existing policy”
Allows selection of an existing policy record and sets action.policy_id.
2. Policy promotion flow (Phase 2 from an exploration/action)
Triggered when user clicks “Create policy from this” on the Review explorations page.​
Flow:
System collects:
state_text, policy_text, summary_policy_text
Key exploration details (exploration_notes_text, metrics_text)
Possibly multiple related actions/observations if implemented in future.
AI proposes a new policy draft:
policy.title
Short, clear rule (e.g., “Vermi tea application on mani mani slope plots”).
policy.description_text
Detailed statement derived from the above texts, including:
When to use this policy.
High-level steps.
References to other internal SOPs or guidelines if known.
User can:
Edit title and description_text.
Choose status (draft or active).
Save.
On save:
Create a new policy row.
Optionally set action.policy_id to this new policy (user toggle like “Link this action to the new policy”).
Generate policy_embedding from policy.description_text in background.
3. Linking to an existing policy
From the Review explorations page, “Link to existing policy” opens a selector of existing policy records (filtered by crop, type, or search).​
On selection, set action.policy_id to that policy.

Queries and analytics Kiro should support
Using this schema Kiro should support, at minimum:
Percent of actions that were explorations in the last week
SQL sketch:
SELECT COUNT(DISTINCT e.action_id) / COUNT(DISTINCT a.id) ... WHERE a.created_at BETWEEN ...
e is exploration, a is action.​
Find explorations about mani mani establishment and weed competition
Semantic search across:
action_embedding (embedding_type = state, summary_policy_text, possibly policy_text)
exploration_embedding (exploration_notes, metrics)
Filter by crop = mani mani and keywords like “weed competition”.​
Show policies related to safety gear
Semantic search over policy_embedding (description) with filters status = 'active'.
Cluster actions by summary policy
Use embeddings from summary_policy_text to cluster actions into similar “playbooks” even if not yet promoted to a shared policy.
