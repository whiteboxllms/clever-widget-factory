# Requirements Document

## Introduction

CWF needs a WebSocket API (API Gateway WebSocket) to solve two problems:

1. **Maxwell chat timeouts** — The current REST endpoint (`/api/agent/maxwell-chat`) has a hard 29-second API Gateway timeout. The Bedrock Agent with Sonnet 4.6 and multi-step tool calls routinely takes 30-60+ seconds, causing timeouts. WebSocket eliminates this constraint and enables streaming responses.

2. **Real-time data sync** — When one user creates, updates, or deletes an entity, other connected users in the same organization see stale data until they manually refresh. WebSocket pushes cache invalidation events so TanStack Query caches stay fresh across all connected clients.

The WebSocket API uses API Gateway WebSocket (not Lambda Function URLs) to support bidirectional communication, enabling future features like collaborative Maxwell sessions, typing/progress indicators, and presence.

Connection state is tracked in the existing RDS PostgreSQL database (measured at 0.054ms query time) rather than introducing DynamoDB.

## Glossary

- **WebSocket_API**: The AWS API Gateway WebSocket API that manages bidirectional connections between clients and the server
- **WebSocket_Authorizer**: A Lambda authorizer on the $connect route that validates Cognito JWT tokens and extracts user/org context
- **Connection_Handler**: The Lambda function handling $connect events — validates auth and records the connection
- **Disconnect_Handler**: The Lambda function handling $disconnect events — marks connections as disconnected
- **Message_Router**: The Lambda function handling $default route — parses incoming messages and routes them by type
- **Maxwell_Chat_Handler**: The server-side handler that invokes the Bedrock Agent and streams responses back over WebSocket
- **Invalidation_Broadcaster**: The component that sends cache invalidation events to all active connections in an organization
- **Mutation_Handler**: The existing mutation Lambda functions (cwf-core-lambda, cwf-actions-lambda, etc.) extended to publish change events
- **WebSocket_Client**: The frontend React module that manages the WebSocket connection, sends messages, and routes incoming messages
- **Reconnect_Handler**: The server-side handler that pushes catch-up invalidation events when a client reconnects after a disconnection
- **Connection_Cleanup**: A scheduled process that marks stale connections as disconnected
- **Cleanup_Process**: A scheduled process that deletes old entity_changes records

## Requirements

### Requirement 1: WebSocket Connection Lifecycle

**User Story:** As a CWF user, I want a persistent WebSocket connection to the server, so that I can receive real-time updates and chat with Maxwell without timeout constraints.

#### Acceptance Criteria

1. WHEN a client sends a $connect request with a Cognito JWT token, THE WebSocket_Authorizer SHALL validate the token and extract userId and orgId from the Cognito session and organization_members table.
2. WHEN a WebSocket connection is established, THE Connection_Handler SHALL insert a record into the `websocket_connections` table with connectionId, userId, orgId, and connectedAt timestamp.
3. WHEN a client disconnects or the connection drops, THE Disconnect_Handler SHALL update the connection record with a disconnectedAt timestamp (soft delete, not hard delete — needed for catch-up logic).
4. WHILE a connection record has no disconnectedAt and is older than 24 hours, THE Connection_Cleanup process SHALL mark the connection as disconnected (handles cases where $disconnect never fires).
5. IF the WebSocket_Authorizer fails to validate the token, THEN THE WebSocket_API SHALL reject the connection with a 401 status and not create a connection record.

### Requirement 2: Maxwell Chat over WebSocket

**User Story:** As a CWF user, I want to chat with Maxwell over WebSocket, so that I can have long-running conversations without hitting the 29-second API Gateway REST timeout and see responses as they stream in.

#### Acceptance Criteria

1. WHEN a client sends a message with type `maxwell:chat`, THE Maxwell_Chat_Handler SHALL invoke the Bedrock Agent with the message text, sessionId, and session attributes (entityId, entityType, entityName, policy, implementation).
2. WHILE the Bedrock Agent is generating a response, THE Maxwell_Chat_Handler SHALL stream response chunks to the client as `maxwell:response_chunk` messages, enabling real-time display of partial responses.
3. WHEN the Bedrock Agent completes its response, THE Maxwell_Chat_Handler SHALL send a `maxwell:response_complete` message containing the full reply, sessionId, and trace data.
4. THE WebSocket_API SHALL maintain the connection for the full duration of the Bedrock Agent invocation without imposing a response timeout (eliminating the current 29-second API Gateway REST timeout).
5. WHEN a client sends a `maxwell:chat` message with an existing sessionId, THE Maxwell_Chat_Handler SHALL continue the existing Bedrock Agent session (same behavior as the current REST endpoint).
6. IF the Bedrock Agent returns a ThrottlingException or ServiceQuotaExceededException, THEN THE Maxwell_Chat_Handler SHALL send a `maxwell:error` message with an appropriate error code and user-friendly message.
7. WHILE the Bedrock Agent is processing (invoking tools, searching, analyzing), THE Maxwell_Chat_Handler SHALL forward trace events as `maxwell:progress` messages so the frontend can show status like "Maxwell is searching..." or "Analyzing results...".

### Requirement 3: Real-Time Cache Invalidation

**User Story:** As a CWF user, I want to see changes made by other users in my organization in real-time, so that I always work with fresh data without manually refreshing.

#### Acceptance Criteria

1. WHEN a mutation Lambda (POST, PUT, DELETE) successfully modifies an entity (tool, part, action, issue, mission, exploration, experience), THE Mutation_Handler SHALL publish a cache invalidation event containing entityType, entityId, mutationType (created/updated/deleted), and orgId.
2. WHEN a cache invalidation event is published, THE Invalidation_Broadcaster SHALL send the event to all active WebSocket connections belonging to the same orgId, excluding the connection that originated the mutation.
3. WHEN the WebSocket_Client receives a `cache:invalidate` message, THE WebSocket_Client SHALL call `queryClient.invalidateQueries()` with the appropriate query key for the affected entity type.
4. WHEN a client reconnects after a disconnection, THE Reconnect_Handler SHALL query for entity changes that occurred since the client's last disconnectedAt timestamp and push catch-up invalidation events for each change.
5. THE Mutation_Handler SHALL record entity changes (entityType, entityId, mutationType, orgId, timestamp) in an `entity_changes` table to support the catch-up mechanism.
6. WHILE an entity_changes record is older than 7 days, THE Cleanup_Process SHALL delete the record (catch-up only needs recent history).

### Requirement 4: WebSocket Message Protocol

**User Story:** As a developer, I want a well-defined message protocol, so that all WebSocket communication follows a consistent format and new message types can be added in the future.

#### Acceptance Criteria

1. THE WebSocket_API SHALL use a JSON message envelope with fields: `type` (string, message type identifier), `payload` (object, type-specific data), and `timestamp` (ISO 8601 string).
2. THE WebSocket_Client SHALL support sending the following message types: `maxwell:chat` (chat messages), `ping` (keepalive).
3. THE WebSocket_API SHALL support sending the following message types: `maxwell:response_chunk`, `maxwell:response_complete`, `maxwell:progress`, `maxwell:error`, `cache:invalidate`, `pong`, `error`.
4. WHEN a client sends a message with an unrecognized type or invalid JSON, THE Message_Router SHALL respond with an `error` message containing a descriptive error code and not crash the connection.
5. WHILE a WebSocket connection is active, THE WebSocket_Client SHALL send a `ping` message at a regular interval (e.g., every 5 minutes) to prevent API Gateway from closing idle connections (API Gateway idle timeout is 10 minutes).

### Requirement 5: Frontend WebSocket Client

**User Story:** As a CWF user, I want the WebSocket connection to be managed automatically, so that I get real-time features without any manual setup or awareness of the underlying transport.

#### Acceptance Criteria

1. WHEN a user is authenticated, THE WebSocket_Client SHALL establish a WebSocket connection to the API Gateway WebSocket endpoint, passing the Cognito JWT token during the $connect handshake.
2. IF the WebSocket connection drops unexpectedly, THEN THE WebSocket_Client SHALL attempt to reconnect with exponential backoff (starting at 1 second, max 30 seconds).
3. WHEN the WebSocket_Client receives a message, THE Message_Router SHALL route it to the appropriate handler based on message type: `maxwell:*` messages to the Maxwell chat panel, `cache:invalidate` messages to TanStack Query's `queryClient.invalidateQueries()`.
4. THE useMaxwell hook SHALL be updated to send chat messages via WebSocket instead of the REST `apiService.post('/agent/maxwell-chat')` call, while maintaining the same public interface (messages, isLoading, error, sessionId, sendMessage, resetSession).
5. WHEN `maxwell:response_chunk` messages arrive, THE Maxwell chat panel SHALL display the partial response in real-time, appending each chunk to the current assistant message.
6. THE WebSocket_Client SHALL expose connection status (connecting, connected, disconnected, reconnecting) so the UI can display a connection indicator to the user.
7. IF the WebSocket connection is unavailable, THEN THE useMaxwell hook SHALL fall back to the existing REST endpoint for Maxwell chat (ensuring the feature still works if WebSocket is down).

### Requirement 6: Infrastructure and Security

**User Story:** As a system administrator, I want the WebSocket infrastructure to be secure and follow existing CWF patterns, so that the system remains maintainable and organization data stays isolated.

#### Acceptance Criteria

1. THE Infrastructure SHALL provision an AWS API Gateway WebSocket API with $connect, $disconnect, and $default routes, each backed by Lambda functions.
2. THE $connect route SHALL use a Lambda authorizer that validates Cognito JWT tokens and returns userId and orgId in the authorizer context (similar pattern to the existing REST API authorizer `cwf-api-authorizer`).
3. THE WebSocket Lambda functions SHALL be deployed in the same VPC as existing Lambda functions to access the RDS PostgreSQL database.
4. THE WebSocket Lambda execution role SHALL include `execute-api:ManageConnections` permission to post messages back to connected clients via the API Gateway Management API.
5. THE WebSocket_API SHALL enforce organization-scoped data access: clients SHALL only receive cache invalidation events for their own organization, and Maxwell chat sessions SHALL be scoped to the authenticated user's organization.
6. THE `websocket_connections` table SHALL be created in the existing RDS PostgreSQL database with columns: id (UUID PK), connection_id (VARCHAR, unique), user_id (UUID), organization_id (UUID), connected_at (TIMESTAMPTZ), disconnected_at (TIMESTAMPTZ, nullable).
7. THE `entity_changes` table SHALL be created in the existing RDS PostgreSQL database with columns: id (UUID PK), entity_type (VARCHAR), entity_id (UUID), mutation_type (VARCHAR), organization_id (UUID), changed_by_connection_id (VARCHAR, nullable), created_at (TIMESTAMPTZ).
