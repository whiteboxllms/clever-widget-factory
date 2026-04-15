# Implementation Plan: Real-Time WebSocket API

## Overview

This plan implements a WebSocket API for CWF that solves Maxwell chat timeouts and enables real-time cache invalidation across browser tabs/users. The implementation follows an incremental backend-first approach: database tables → Lambda functions → API Gateway wiring → Lambda layer utility → mutation Lambda integration → frontend hooks → UI integration.

Lambda functions use JavaScript/Node.js with the cwf-common-nodejs layer. Frontend code uses TypeScript/React with TanStack Query. All new Lambdas are deployed via `./scripts/deploy/deploy-lambda-with-layer.sh`.

## Tasks

- [x] 1. Database migrations
  - [x] 1.1 Create websocket_connections table
    - Write SQL migration for `websocket_connections` table with columns: id (UUID PK), connection_id (VARCHAR UNIQUE), user_id (UUID), organization_id (UUID FK → organizations), connected_at (TIMESTAMPTZ), disconnected_at (TIMESTAMPTZ nullable)
    - Create partial index `idx_ws_connections_org_active` on (organization_id) WHERE disconnected_at IS NULL
    - Create index `idx_ws_connections_user` on (user_id)
    - Create partial index `idx_ws_connections_cleanup` on (connected_at) WHERE disconnected_at IS NULL
    - Execute via cwf-db-migration Lambda
    - _Requirements: 6.6, 1.2, 1.3_

  - [x] 1.2 Create entity_changes table
    - Write SQL migration for `entity_changes` table with columns: id (UUID PK), entity_type (VARCHAR), entity_id (UUID), mutation_type (VARCHAR with CHECK IN created/updated/deleted), organization_id (UUID FK → organizations), changed_by_connection_id (VARCHAR nullable), created_at (TIMESTAMPTZ)
    - Create index `idx_entity_changes_catchup` on (organization_id, created_at)
    - Create index `idx_entity_changes_cleanup` on (created_at)
    - Execute via cwf-db-migration Lambda
    - _Requirements: 6.7, 3.5_

  - [ ]* 1.3 Write property tests for cleanup retention window
    - **Property 2: Time-based cleanup retention window**
    - Test that connections older than 24h with NULL disconnected_at get marked disconnected
    - Test that connections within 24h or already disconnected are unchanged
    - Test that entity_changes older than 7 days are deleted and within 7 days are preserved
    - **Validates: Requirements 1.4, 3.6**

- [x] 2. Lambda authorizer (cwf-ws-authorizer)
  - [x] 2.1 Create cwf-ws-authorizer Lambda
    - Create `lambda/ws-authorizer/` directory with index.js and package.json
    - Implement handler that reads JWT from `event.queryStringParameters.token` (not headers — browser WebSocket API doesn't support custom headers)
    - Reuse JWT verification and Cognito JWKS validation logic from existing `lambda/authorizer/`
    - Query `organization_members` to resolve Cognito sub → user UUID and org context
    - Return IAM policy with context: `{ organization_id, cognito_user_id, permissions }`
    - Return Deny policy for invalid/expired/malformed tokens
    - _Requirements: 1.1, 1.5, 6.2_

  - [ ]* 2.2 Write property test for authorizer context extraction
    - **Property 1: Authorizer context extraction**
    - For any valid JWT + org_members record, authorizer returns correct org_id, user_id, permissions
    - For any invalid token (expired, wrong issuer, malformed), authorizer returns Deny
    - **Validates: Requirements 1.1, 1.5**

  - [x] 2.3 Deploy cwf-ws-authorizer
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh ws-authorizer cwf-ws-authorizer`
    - Verify deployment succeeds
    - _Requirements: 6.2_

- [x] 3. Connect and disconnect handlers
  - [x] 3.1 Create cwf-ws-connect Lambda
    - Create `lambda/ws-connect/` directory with index.js and package.json
    - Implement handler that extracts connectionId from `event.requestContext.connectionId` and org context from `event.requestContext.authorizer`
    - INSERT into websocket_connections with connection_id, user_id, organization_id, connected_at
    - Query entity_changes since user's last disconnected_at for catch-up events
    - Send catch-up `cache:invalidate` events via `postToConnection` for each missed change
    - Return `{ statusCode: 200 }`
    - _Requirements: 1.2, 3.4_

  - [ ]* 3.2 Write property test for reconnection catch-up completeness
    - **Property 7: Reconnection catch-up completeness**
    - For any set of entity_changes with varying timestamps and org IDs, and any reconnecting client with known disconnected_at:
      - All changes after disconnected_at for client's org are sent
      - No changes before disconnected_at are sent
      - No changes from other orgs are sent
    - **Validates: Requirements 3.4**

  - [x] 3.3 Create cwf-ws-disconnect Lambda
    - Create `lambda/ws-disconnect/` directory with index.js and package.json
    - Implement handler that extracts connectionId from `event.requestContext.connectionId`
    - UPDATE websocket_connections SET disconnected_at = NOW() WHERE connection_id = $1 (soft delete)
    - Return `{ statusCode: 200 }`
    - _Requirements: 1.3_

  - [x] 3.4 Deploy connect and disconnect Lambdas
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh ws-connect cwf-ws-connect`
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh ws-disconnect cwf-ws-disconnect`
    - Verify both deployments succeed
    - _Requirements: 6.1, 6.3_

- [x] 4. Message router with Maxwell chat handler (cwf-ws-message-router)
  - [x] 4.1 Create cwf-ws-message-router Lambda
    - Create `lambda/ws-message-router/` directory with index.js and package.json
    - Implement handler that parses `event.body` as JSON
    - Route by `message.type`: `maxwell:chat` → handleMaxwellChat, `ping` → handlePing, unknown → handleUnknownType
    - For invalid JSON, send `error` message with code `INVALID_JSON`
    - For unknown types, send `error` message with code `UNKNOWN_TYPE`
    - For missing required payload fields, send `error` message with code `MISSING_PAYLOAD`
    - All responses use the JSON envelope format: `{ type, payload, timestamp }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.2 Write property test for invalid message resilience
    - **Property 9: Invalid message resilience**
    - For any string that is not valid JSON, or valid JSON with unrecognized type, or missing required fields:
      - Router returns an error message with descriptive code (INVALID_JSON, UNKNOWN_TYPE, MISSING_PAYLOAD)
      - No unhandled exceptions thrown
      - Connection is not closed
    - **Validates: Requirements 4.4**

  - [x] 4.3 Implement Maxwell chat handler module
    - Create `lambda/ws-message-router/maxwellChatHandler.js`
    - Reuse prompt detection and instruction prefix logic from existing `lambda/maxwell-chat/index.js` (detectPromptMode, buildInstructionPrefix, prompt loading)
    - Copy prompts directory from `lambda/maxwell-chat/prompts/` to `lambda/ws-message-router/prompts/`
    - Create ApiGatewayManagementApiClient using `event.requestContext.domainName` and `event.requestContext.stage`
    - Invoke Bedrock Agent with InvokeAgentCommand (streaming enabled)
    - For each trace event: send `maxwell:progress` via postToConnection
    - For each completion chunk: send `maxwell:response_chunk` via postToConnection
    - On stream complete: send `maxwell:response_complete` with full reply, sessionId, trace
    - Handle errors: ThrottlingException → `MAXWELL_THROTTLED`, ServiceQuotaExceededException → `MAXWELL_TIMEOUT`, other → `MAXWELL_ERROR`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 4.4 Write property test for Maxwell command construction
    - **Property 3: Maxwell command construction**
    - For any chat message, optional sessionId, and sessionAttributes, the handler constructs an InvokeAgentCommand where inputText contains instruction prefix + message, sessionId matches provided or is generated, sessionState contains all attributes as strings plus organization_id and current_date
    - **Validates: Requirements 2.1, 2.5**

  - [ ]* 4.5 Write property test for streaming chunk message formatting
    - **Property 4: Streaming chunk message formatting**
    - For any sequence of Bedrock Agent completion chunks, the handler produces one maxwell:response_chunk per chunk with bytes, one maxwell:progress per trace event, all conforming to JSON envelope format
    - **Validates: Requirements 2.2, 2.7**

  - [ ]* 4.6 Write property test for Bedrock error code mapping
    - **Property 5: Bedrock error code mapping**
    - ThrottlingException → MAXWELL_THROTTLED, ServiceQuotaExceededException → MAXWELL_TIMEOUT, other → MAXWELL_ERROR
    - Resulting maxwell:error message contains both code and non-empty message string
    - **Validates: Requirements 2.6**

  - [ ]* 4.7 Write property test for message envelope round-trip
    - **Property 8: Message envelope round-trip**
    - For any message type and payload, serializing then deserializing produces identical type, deep-equal payload, and valid ISO 8601 timestamp
    - **Validates: Requirements 4.1**

  - [x] 4.8 Deploy cwf-ws-message-router
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh ws-message-router cwf-ws-message-router`
    - Add `@aws-sdk/client-bedrock-agent-runtime` and `@aws-sdk/client-apigatewaymanagementapi` as dependencies
    - Configure environment variables: MAXWELL_AGENT_ID, MAXWELL_AGENT_ALIAS_ID, BEDROCK_REGION
    - Verify deployment succeeds
    - _Requirements: 6.1, 6.4_

- [x] 5. Checkpoint - Backend Lambdas complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API Gateway WebSocket API setup
  - [x] 6.1 Create WebSocket API and routes
    - Create API Gateway WebSocket API (name: cwf-websocket-api)
    - Create $connect route with Lambda authorizer (cwf-ws-authorizer)
    - Create $disconnect route integrated with cwf-ws-disconnect
    - Create $default route integrated with cwf-ws-message-router
    - Create Lambda integration for cwf-ws-connect on $connect route
    - Grant API Gateway invoke permissions on all four Lambda functions
    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Deploy WebSocket API
    - Create deployment stage (name: prod)
    - Note the WebSocket endpoint URL: `wss://{api-id}.execute-api.us-west-2.amazonaws.com/prod`
    - Add `WS_API_ENDPOINT` environment variable to all mutation Lambdas (cwf-core-lambda, cwf-actions-lambda, cwf-explorations-lambda, cwf-experiences-lambda)
    - Add `execute-api:ManageConnections` permission to Lambda execution roles
    - _Requirements: 6.1, 6.4_

  - [x] 6.3 Add WebSocket endpoint to frontend environment
    - Add `VITE_WS_API_URL` to `.env.local` and `.env.production` with the WebSocket endpoint URL
    - _Requirements: 5.1_

- [x] 7. broadcastInvalidation utility in Lambda layer
  - [x] 7.1 Create broadcastInvalidation module
    - Create `lambda/layers/cwf-common-nodejs/nodejs/broadcastInvalidation.js`
    - Implement `broadcastInvalidation({ entityType, entityId, mutationType, organizationId, excludeConnectionId })` function
    - If `WS_API_ENDPOINT` env var is not set, return silently (graceful degradation)
    - INSERT into entity_changes table (entityType, entityId, mutationType, organizationId, changedByConnectionId)
    - SELECT active connections for the org from websocket_connections WHERE disconnected_at IS NULL
    - Send `cache:invalidate` message to each connection (excluding mutator) via postToConnection
    - Handle 410 GoneException by marking connection as disconnected
    - Use Promise.allSettled for parallel sends
    - _Requirements: 3.1, 3.2, 3.5_

  - [ ]* 7.2 Write property test for organization-scoped broadcasting
    - **Property 6: Organization-scoped broadcasting with mutator exclusion**
    - For any set of active connections across multiple orgs, and any invalidation event from a specific connection:
      - All active connections in same org (excluding originator) receive the message
      - No connections in other orgs receive the message
      - The originating connection does not receive the message
    - **Validates: Requirements 3.2, 6.5**

  - [x] 7.3 Deploy updated Lambda layer
    - Run the layer deploy script: `lambda/layers/cwf-common-nodejs/deploy-layer.sh`
    - Update layer version reference in deploy-lambda-with-layer.sh if needed
    - Redeploy mutation Lambdas to pick up new layer version
    - _Requirements: 3.1_

- [x] 8. Mutation Lambda integration
  - [x] 8.1 Add broadcastInvalidation calls to cwf-core-lambda
    - Import `broadcastInvalidation` from `/opt/nodejs/broadcastInvalidation`
    - Add calls after successful POST (created), PUT (updated), DELETE (deleted) operations for tools, parts, and other entities
    - Pass organizationId from authorizer context, excludeConnectionId from request headers (X-Connection-Id) if available
    - _Requirements: 3.1, 3.2_

  - [x] 8.2 Add broadcastInvalidation calls to cwf-actions-lambda
    - Import and call broadcastInvalidation after action create/update/delete operations
    - Entity type: 'action'
    - _Requirements: 3.1, 3.2_

  - [x] 8.3 Add broadcastInvalidation calls to cwf-explorations-lambda
    - Import and call broadcastInvalidation after exploration create/update/delete operations
    - Entity type: 'exploration'
    - _Requirements: 3.1, 3.2_

  - [x] 8.4 Add broadcastInvalidation calls to cwf-experiences-lambda
    - Import and call broadcastInvalidation after experience create/update/delete operations
    - Entity type: 'experience'
    - _Requirements: 3.1, 3.2_

  - [x] 8.5 Redeploy mutation Lambdas
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh core cwf-core-lambda`
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh actions cwf-actions-lambda`
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh explorations cwf-explorations-lambda`
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh experiences cwf-experiences-lambda`
    - _Requirements: 3.1_

- [x] 9. Cleanup Lambda (cwf-ws-cleanup)
  - [x] 9.1 Create cwf-ws-cleanup Lambda
    - Create `lambda/ws-cleanup/` directory with index.js and package.json
    - Implement handler that marks connections older than 24h with NULL disconnected_at as disconnected
    - Delete entity_changes records older than 7 days
    - Log counts of cleaned-up records
    - _Requirements: 1.4, 3.6_

  - [x] 9.2 Deploy cwf-ws-cleanup and configure EventBridge schedule
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh ws-cleanup cwf-ws-cleanup`
    - Create EventBridge rule to invoke cwf-ws-cleanup every hour (rate(1 hour))
    - Grant EventBridge permission to invoke the Lambda
    - _Requirements: 1.4, 3.6_

- [x] 10. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend useWebSocket hook
  - [x] 11.1 Create useWebSocket hook
    - Create `src/hooks/useWebSocket.ts`
    - Implement WebSocket connection to `VITE_WS_API_URL` with Cognito JWT token as query parameter
    - Expose connection status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
    - Implement `sendMessage(type, payload)` that wraps in JSON envelope with timestamp
    - Implement `subscribe(type, handler)` that returns unsubscribe function for message routing
    - Expose `connectionId` from server (if available)
    - Use singleton pattern — one WebSocket connection shared across all consumers
    - _Requirements: 5.1, 5.6_

  - [x] 11.2 Implement reconnection with exponential backoff
    - On unexpected disconnect, set status to 'reconnecting'
    - Implement exponential backoff: delay = min(2^n * 1000, 30000) ms
    - Refresh Cognito JWT token before each reconnection attempt
    - Reset backoff counter on successful connection
    - _Requirements: 5.2_

  - [ ]* 11.3 Write property test for exponential backoff calculation
    - **Property 10: Exponential backoff calculation**
    - For any retry count n ≥ 0, delay equals min(2^n * 1000, 30000) ms
    - Delay is always between 1000ms and 30000ms inclusive
    - **Validates: Requirements 5.2**

  - [x] 11.4 Implement keepalive ping
    - Send `ping` message every 5 minutes to prevent API Gateway idle timeout (10 min)
    - Handle `pong` response
    - If no pong received within timeout, close connection and trigger reconnect
    - _Requirements: 4.5_

  - [ ]* 11.5 Write unit tests for useWebSocket hook
    - Test connection lifecycle (connect, disconnect, reconnect)
    - Test message sending wraps in JSON envelope
    - Test subscribe/unsubscribe routing
    - Test ping/pong keepalive
    - _Requirements: 5.1, 5.2, 5.6_

- [x] 12. Frontend useMaxwell hook update
  - [x] 12.1 Update useMaxwell to use WebSocket with REST fallback
    - Import and use `useWebSocket` hook
    - When `status === 'connected'`, send `maxwell:chat` messages via WebSocket
    - Subscribe to `maxwell:response_chunk`, `maxwell:response_complete`, `maxwell:progress`, `maxwell:error`
    - Accumulate response chunks into the current assistant message for real-time display
    - On `maxwell:response_complete`, finalize the message with full reply, sessionId, trace
    - When WebSocket is disconnected, fall back to existing REST `apiService.post('/agent/maxwell-chat')` call
    - Maintain the same public interface: messages, isLoading, error, sessionId, sendMessage, resetSession
    - _Requirements: 5.4, 5.5, 5.7, 2.1, 2.2, 2.3_

  - [ ]* 12.2 Write property test for response chunk accumulation
    - **Property 12: Response chunk accumulation**
    - For any ordered sequence of maxwell:response_chunk messages, accumulated text equals concatenation of all chunk values in order
    - Final accumulated text equals the reply field in maxwell:response_complete
    - **Validates: Requirements 5.5**

  - [ ]* 12.3 Write property test for client-side message routing
    - **Property 11: Client-side message routing**
    - For any incoming message with known type prefix (maxwell:* or cache:invalidate), correct handler is invoked
    - For cache:invalidate with valid entityType, queryClient.invalidateQueries is called with correct key
    - For unknown types, no exception is thrown
    - **Validates: Requirements 5.3, 3.3**

  - [ ]* 12.4 Write unit tests for useMaxwell WebSocket integration
    - Test WebSocket path sends maxwell:chat and receives streamed response
    - Test REST fallback when WebSocket is disconnected
    - Test error handling for maxwell:error messages
    - _Requirements: 5.4, 5.7_

- [x] 13. Frontend useCacheInvalidation hook
  - [x] 13.1 Create useCacheInvalidation hook
    - Create `src/hooks/useCacheInvalidation.ts`
    - Subscribe to `cache:invalidate` messages via useWebSocket
    - Map entityType to TanStack Query keys using existing queryKeys.ts functions:
      - tool → toolsQueryKey()
      - part → ['parts']
      - action → actionsQueryKey(), completedActionsQueryKey(), allActionsQueryKey()
      - issue → issuesQueryKey() (prefix match)
      - mission → missionsQueryKey()
      - exploration → explorationsQueryKey()
      - experience → experiencesQueryKey()
    - Call `queryClient.invalidateQueries()` with the mapped query key
    - _Requirements: 3.3, 5.3_

  - [x] 13.2 Mount useCacheInvalidation in app root
    - Add `useCacheInvalidation()` call in the app's authenticated layout or provider
    - Ensure it runs for all authenticated users
    - _Requirements: 3.3_

  - [ ]* 13.3 Write unit tests for cache invalidation mapping
    - Test each entityType maps to the correct query key(s)
    - Test unknown entityType is handled gracefully (no crash)
    - _Requirements: 3.3_

- [x] 14. Frontend connection status indicator
  - [x] 14.1 Create WebSocket connection status indicator component
    - Create a small UI component that shows connection status (connecting, connected, disconnected, reconnecting)
    - Use Lucide React icons (e.g., Wifi, WifiOff) with Tailwind CSS styling
    - Show as a subtle indicator in the app header or layout
    - Green dot/icon for connected, yellow for connecting/reconnecting, red for disconnected
    - _Requirements: 5.6_

  - [x] 14.2 Integrate status indicator into app layout
    - Add the connection status component to the main app layout
    - Only show when user is authenticated
    - _Requirements: 5.6_

- [x] 15. Checkpoint - Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. End-to-end testing and verification
  - [x] 16.1 Write integration tests for WebSocket connection lifecycle
    - Test $connect with valid Cognito token establishes connection and inserts DB record
    - Test $disconnect updates disconnected_at (soft delete)
    - Test connection with invalid token is rejected with 401
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 16.2 Write integration tests for Maxwell chat over WebSocket
    - Test sending maxwell:chat message → receiving streamed response chunks → response_complete
    - Test progress events are received during Bedrock Agent processing
    - Test error handling (throttling, timeout)
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_

  - [x] 16.3 Write integration tests for cache invalidation flow
    - Test mutation → entity_changes INSERT → broadcast to connected clients
    - Test organization isolation (other org's connections don't receive events)
    - Test mutator exclusion (originating connection doesn't receive its own event)
    - _Requirements: 3.1, 3.2, 6.5_

  - [x] 16.4 Write integration tests for reconnection catch-up
    - Test disconnect → mutation occurs → reconnect → catch-up events received
    - _Requirements: 3.4_

  - [x] 16.5 Write integration tests for cleanup Lambda
    - Test stale connections (>24h) are marked disconnected
    - Test old entity_changes (>7 days) are deleted
    - Test recent records are preserved
    - _Requirements: 1.4, 3.6_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between backend and frontend phases
- Property tests validate universal correctness properties from the design document using Vitest + fast-check
- Unit tests validate specific examples and edge cases
- Lambda functions use JavaScript/Node.js; frontend uses TypeScript/React
- All new Lambdas are deployed via `./scripts/deploy/deploy-lambda-with-layer.sh` which attaches cwf-common-nodejs layer
- Database migrations are executed via cwf-db-migration Lambda
- The broadcastInvalidation utility is added to the cwf-common-nodejs Lambda layer so all mutation Lambdas can use it
- WebSocket is additive — all existing REST functionality continues to work as fallback
- The existing `lambda/maxwell-chat/` Lambda and REST endpoint remain deployed for fallback support
