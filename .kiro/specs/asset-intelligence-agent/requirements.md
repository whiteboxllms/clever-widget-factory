# Requirements Document

## Introduction

Maxwell is a conversational AI assistant embedded in the CWF application, named after Maxwell's Demon — the entity that sorts signal from noise. Users launch Maxwell from a tool, part, or action detail view. Maxwell is pre-loaded with the entity's context via Bedrock session attributes and answers natural language questions about observations recorded against that entity. Maxwell v1 exposes a single Action Group: `GetEntityObservations`. The architecture is designed to be extended with additional tools in future iterations.

Maxwell is implemented as a real AWS Bedrock Agent with Action Groups — not a manual `BedrockRuntimeClient` loop. It only answers using data returned by its tools and never fabricates or guesses.

## Glossary

- **Maxwell**: The AWS Bedrock Agent that orchestrates conversation, selects Action Groups, and synthesizes responses for CWF users.
- **Action_Group**: A named set of functions exposed to Maxwell via a Lambda function, defining what Maxwell can look up.
- **Tool_Lambda**: The Lambda function backing an Action Group, which queries the CWF database and returns structured data to Maxwell.
- **Session_Attributes**: Key-value pairs passed from the frontend carrying `entityId`, `entityType`, `entityName`, `policy`, and `implementation` so Maxwell never needs to ask the user which entity they mean and already understands the intent and expected behavior of the entity.
- **Entity**: A tool, part, or action tracked in the CWF system.
- **Observation**: A state record linked to an entity via `state_links`, containing observation text, photos, and metrics captured by an organization member.
- **Chat_Panel**: The frontend UI component hosting the Maxwell conversation, embedded in the entity detail view.
- **Organization**: The multi-tenant boundary; all data queries are scoped to the authenticated user's `organization_id`.

## Requirements

### Requirement 1: Maxwell Agent Infrastructure

**User Story:** As a developer, I want Maxwell to be a real AWS Bedrock Agent with Action Groups, so that it has native multi-turn session management and a clean extension path for future tools.

#### Acceptance Criteria

1. THE Maxwell SHALL be an AWS Bedrock Agent resource using Action Groups — not a manual `BedrockRuntimeClient` loop.
2. THE Maxwell SHALL be configured with the `anthropic.claude-3-5-haiku-20241022-v1:0` model.
3. THE Maxwell SHALL have one Action Group named `GetEntityObservations`, backed by a Tool_Lambda.
4. THE Maxwell's system prompt SHALL instruct it to: be concise and factual, cite sources (e.g. "Based on 3 observations between Jan–Mar 2025..."), never fabricate data not returned by tools, and identify itself as Maxwell, CWF's organizational intelligence assistant.
5. THE Tool_Lambda SHALL be deployed using the existing `deploy-lambda-with-layer.sh` script with the `cwf-common-nodejs` layer.
6. THE Maxwell invocation endpoint SHALL be registered in API Gateway as `POST /api/agent/maxwell-chat`.

---

### Requirement 2: Session Attributes and Context

**User Story:** As an organization member, I want Maxwell to already know which entity I'm asking about when I open the chat panel, so that I don't have to repeat context in every message.

#### Acceptance Criteria

1. WHEN the user opens the Chat_Panel from an entity detail view, THE Chat_Panel SHALL pass `entityId`, `entityType` (`tool` | `part` | `action`), `entityName`, `policy`, and `implementation` as Bedrock Session_Attributes at session start.
2. WHILE a session is active, THE Maxwell SHALL use the Session_Attributes to scope all Action_Group invocations to the correct entity without prompting the user to identify it.
3. THE Chat_Panel SHALL NOT persist session data to the CWF database; sessions are ephemeral and managed natively by the Bedrock Agent.
4. WHEN the user opens the Chat_Panel, THE Chat_Panel SHALL start a fresh Bedrock session with no memory of previous sessions for that entity.
5. THE Maxwell SHALL support multi-turn conversation natively via Bedrock Agent session management.
6. WHEN the user navigates to a different entity, THE Chat_Panel SHALL terminate the current Bedrock session and start a fresh session scoped to the new entity.

---

### Requirement 3: GetEntityObservations Tool

**User Story:** As an organization member, I want to ask Maxwell questions like "what have people observed about this tool?" so that I can understand its condition and history of use.

#### Acceptance Criteria

1. WHEN Maxwell invokes `GetEntityObservations`, THE Tool_Lambda SHALL accept the following parameters: `entityId` (required), `entityType` (required, one of `"tool"` | `"part"` | `"action"`), `dateFrom` (optional, ISO date string), and `dateTo` (optional, ISO date string).
2. THE Tool_Lambda SHALL return for each observation: `observation_text`, `observed_by_name`, `observed_at`, `photos` (array of `{ photo_url, photo_description }`), and `metrics` (array of `{ metric_name, value, unit }`). Photo URLs and descriptions SHALL always be returned together.
3. THE Tool_Lambda SHALL return observations ordered by `observed_at` descending.
4. THE Tool_Lambda SHALL scope all queries to the `organization_id` derived from the authenticated session, returning only records belonging to the user's organization.
5. THE Tool_Lambda SHALL reuse the existing observation query logic from `lambda/history/index.js` (states + state_links join) rather than duplicating the SQL.
6. WHEN no observations are found, THE Tool_Lambda SHALL return an empty array and a message indicating no observations have been recorded; THE Maxwell SHALL acknowledge the absence of data.
7. IF `entityId` or `entityType` is missing from the invocation parameters, THEN THE Tool_Lambda SHALL return a structured error response indicating the missing parameters.
8. WHEN observations include photos, THE Chat_Panel SHALL render photo thumbnails inline in Maxwell's response when the photo URL is included in the tool result.

---

### Requirement 4: Authentication and Authorization

**User Story:** As a system administrator, I want Maxwell to enforce the same authentication and authorization rules as the rest of the CWF API, so that users can only query entities belonging to their organization.

#### Acceptance Criteria

1. THE Chat_Panel SHALL include the authenticated user's Cognito JWT in all requests to the Maxwell endpoint.
2. THE Maxwell endpoint SHALL be protected by the existing CWF Lambda authorizer, which validates the JWT and extracts `organization_id`.
3. THE Tool_Lambda SHALL receive `organization_id` from the authorizer context and SHALL apply it as a filter on all database queries.
4. THE Tool_Lambda SHALL use `getAuthorizerContext` and `buildOrganizationFilter` from the `cwf-common-nodejs` layer, consistent with existing Lambda patterns.
5. IF a user queries an `entityId` not belonging to their organization, THEN THE Tool_Lambda SHALL return an empty result set rather than an authorization error, preventing entity enumeration.
6. WHILE a user has `data:read:all` permission, THE Tool_Lambda SHALL allow querying any entity in the organization; WHILE a user has standard member permissions, THE Tool_Lambda SHALL scope results to their accessible data.

---

### Requirement 5: Frontend Chat Panel

**User Story:** As an organization member using the app on mobile, I want a chat interface that I can expand to talk to Maxwell and collapse to review the entity detail, so that I can reference both without closing anything.

#### Acceptance Criteria

1. THE Chat_Panel SHALL be accessible via a dedicated button on the tool detail view, part detail view, and action detail view.
2. THE Chat_Panel SHALL render as a mobile-first expandable bottom sheet that can expand to full screen and collapse to a persistent minimized bar at the bottom of the screen.
3. WHEN collapsed, THE Chat_Panel SHALL remain visible as a persistent bar so the user can re-expand it without losing the conversation.
4. WHEN expanded, THE Chat_Panel SHALL occupy the full screen height on mobile, allowing the user to read and interact with Maxwell comfortably.
5. THE Chat_Panel SHALL display the entity name and type as a header so the user knows what Maxwell is analyzing.
6. THE Chat_Panel SHALL display a scrollable message history with clear visual distinction between user messages and Maxwell responses.
7. WHEN Maxwell is processing a response, THE Chat_Panel SHALL display a loading indicator.
8. WHEN the Chat_Panel first opens, THE Chat_Panel SHALL display suggested starter questions: "What observations have been recorded?", "Who made the most recent observation?", "Were any metrics captured?", and "Show me observations from the last 30 days".
9. WHEN the user submits a message, THE Chat_Panel SHALL disable the input field until Maxwell's response is received.
10. IF the Maxwell invocation returns an error, THEN THE Chat_Panel SHALL display a user-friendly error message and allow the user to retry.
11. THE Chat_Panel SHALL be built using the existing shadcn-ui, Radix UI, and Tailwind CSS components consistent with the rest of the CWF frontend.
