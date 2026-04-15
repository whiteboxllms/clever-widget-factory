/**
 * Integration tests for WebSocket reconnection catch-up flow
 *
 * Tests the catch-up logic in the ws-connect handler that sends missed
 * cache:invalidate events when a user reconnects after a disconnection.
 * Since the Lambda handlers depend on Lambda layer paths (/opt/nodejs/db)
 * that can't be resolved in a local test environment, we replicate the
 * handler logic here and test it with mocked dependencies.
 *
 * This follows the same pattern as ws-connection-lifecycle.test.ts.
 *
 * Validates: Requirements 3.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB client factory
// ---------------------------------------------------------------------------

interface MockDbClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function createMockDbClient(): MockDbClient {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Handler logic extracted from Lambda handler for testability
// Mirrors the actual handler in lambda/ws-connect/index.js
// ---------------------------------------------------------------------------

/**
 * Core logic from lambda/ws-connect/index.js
 * Mirrors the actual handler: resolves user, inserts connection, sends catch-up.
 */
async function handleConnect(
  event: any,
  dbClient: MockDbClient,
  postToConnection: (params: any) => Promise<void>
) {
  const { connectionId } = event.requestContext;
  const { organization_id, cognito_user_id } = event.requestContext.authorizer;

  if (!connectionId || !organization_id || !cognito_user_id) {
    return { statusCode: 500 };
  }

  try {
    // Resolve cognito_user_id → user_id
    const userResult = await dbClient.query(
      `SELECT user_id FROM organization_members
       WHERE cognito_user_id = $1 AND organization_id = $2 AND is_active = true
       LIMIT 1`,
      [cognito_user_id, organization_id]
    );

    if (userResult.rows.length === 0) {
      return { statusCode: 500 };
    }

    const userId = userResult.rows[0].user_id;

    // Find last disconnect for catch-up
    const lastDisconnectResult = await dbClient.query(
      `SELECT disconnected_at FROM websocket_connections
       WHERE user_id = $1 AND organization_id = $2 AND disconnected_at IS NOT NULL
       ORDER BY disconnected_at DESC
       LIMIT 1`,
      [userId, organization_id]
    );

    const lastDisconnectedAt = lastDisconnectResult.rows.length > 0
      ? lastDisconnectResult.rows[0].disconnected_at
      : null;

    // INSERT connection record
    await dbClient.query(
      `INSERT INTO websocket_connections (connection_id, user_id, organization_id, connected_at)
       VALUES ($1, $2, $3, NOW())`,
      [connectionId, userId, organization_id]
    );

    // Send catch-up events if previously connected
    if (lastDisconnectedAt) {
      const catchUpResult = await dbClient.query(
        `SELECT entity_type, entity_id, mutation_type
         FROM entity_changes
         WHERE organization_id = $1 AND created_at > $2
         ORDER BY created_at ASC`,
        [organization_id, lastDisconnectedAt]
      );

      for (const change of catchUpResult.rows) {
        const message = JSON.stringify({
          type: 'cache:invalidate',
          payload: {
            entityType: change.entity_type,
            entityId: change.entity_id,
            mutationType: change.mutation_type,
          },
          timestamp: new Date().toISOString(),
        });

        await postToConnection({
          ConnectionId: connectionId,
          Data: message,
        });
      }
    }

    return { statusCode: 200 };
  } catch (error) {
    return { statusCode: 500 };
  } finally {
    dbClient.release();
  }
}

// ---------------------------------------------------------------------------
// Event builders
// ---------------------------------------------------------------------------

function buildConnectEvent(overrides: Record<string, any> = {}) {
  return {
    requestContext: {
      connectionId: 'reconnect-conn-123',
      domainName: 'abc123.execute-api.us-west-2.amazonaws.com',
      stage: 'prod',
      authorizer: {
        organization_id: 'org-uuid-1',
        cognito_user_id: 'cognito-sub-1',
        permissions: JSON.stringify(['data:read', 'data:write']),
      },
      ...overrides.requestContext,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the Data field from a postToConnection call. */
function parseSentMessage(call: { ConnectionId: string; Data: string }) {
  return JSON.parse(call.Data);
}

/** Get all messages sent via the mock postToConnection. */
function getSentMessages(mockPostToConnection: ReturnType<typeof vi.fn>) {
  return mockPostToConnection.mock.calls.map((c: any[]) => parseSentMessage(c[0]));
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Reconnection catch-up flow', () => {
  let dbClient: MockDbClient;
  let mockPostToConnection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dbClient = createMockDbClient();
    mockPostToConnection = vi.fn().mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // 1. Disconnect → mutation occurs → reconnect → catch-up events received
  // -------------------------------------------------------------------------
  it('sends catch-up cache:invalidate events for all changes since disconnected_at', async () => {
    const disconnectedAt = new Date('2024-06-15T12:00:00Z');

    dbClient.query
      // Resolve cognito_user_id → user_id
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // Previous disconnect exists (user was disconnected)
      .mockResolvedValueOnce({ rows: [{ disconnected_at: disconnectedAt }], rowCount: 1 })
      // INSERT new connection record
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // Catch-up: entity_changes since disconnected_at
      .mockResolvedValueOnce({
        rows: [
          { entity_type: 'tool', entity_id: 'tool-1', mutation_type: 'updated' },
          { entity_type: 'action', entity_id: 'action-1', mutation_type: 'created' },
          { entity_type: 'part', entity_id: 'part-1', mutation_type: 'deleted' },
        ],
        rowCount: 3,
      });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // Verify catch-up query uses correct org and timestamp
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('entity_changes'),
      ['org-uuid-1', disconnectedAt]
    );

    // Should send 3 catch-up events
    expect(mockPostToConnection).toHaveBeenCalledTimes(3);

    const messages = getSentMessages(mockPostToConnection);

    // Verify all messages are cache:invalidate type
    for (const msg of messages) {
      expect(msg.type).toBe('cache:invalidate');
      expect(msg.timestamp).toBeDefined();
      expect(new Date(msg.timestamp).toISOString()).toBe(msg.timestamp);
    }

    // Verify first catch-up event (tool updated)
    expect(messages[0].payload).toEqual({
      entityType: 'tool',
      entityId: 'tool-1',
      mutationType: 'updated',
    });

    // Verify second catch-up event (action created)
    expect(messages[1].payload).toEqual({
      entityType: 'action',
      entityId: 'action-1',
      mutationType: 'created',
    });

    // Verify third catch-up event (part deleted)
    expect(messages[2].payload).toEqual({
      entityType: 'part',
      entityId: 'part-1',
      mutationType: 'deleted',
    });

    // Verify all messages sent to the reconnecting connection
    for (const call of mockPostToConnection.mock.calls) {
      expect(call[0].ConnectionId).toBe('reconnect-conn-123');
    }

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Only changes after disconnected_at are sent
  // -------------------------------------------------------------------------
  it('only sends changes after disconnected_at — the query filters by timestamp', async () => {
    const disconnectedAt = new Date('2024-06-15T12:00:00Z');

    dbClient.query
      // Resolve user
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // Previous disconnect
      .mockResolvedValueOnce({ rows: [{ disconnected_at: disconnectedAt }], rowCount: 1 })
      // INSERT connection
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // Catch-up: only changes AFTER disconnected_at are returned by the DB
      // (changes before disconnected_at are excluded by the WHERE clause)
      .mockResolvedValueOnce({
        rows: [
          { entity_type: 'tool', entity_id: 'tool-new', mutation_type: 'created' },
        ],
        rowCount: 1,
      });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // Verify the catch-up query uses created_at > $2 with the disconnected_at timestamp
    const catchUpCall = dbClient.query.mock.calls[3];
    expect(catchUpCall[0]).toContain('created_at > $2');
    expect(catchUpCall[1]).toEqual(['org-uuid-1', disconnectedAt]);

    // Only the post-disconnect change is sent
    expect(mockPostToConnection).toHaveBeenCalledTimes(1);

    const messages = getSentMessages(mockPostToConnection);
    expect(messages[0].payload.entityType).toBe('tool');
    expect(messages[0].payload.entityId).toBe('tool-new');
    expect(messages[0].payload.mutationType).toBe('created');

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Only changes for the user's org are sent
  // -------------------------------------------------------------------------
  it('only sends changes for the user\'s organization — the query filters by org_id', async () => {
    const disconnectedAt = new Date('2024-06-15T12:00:00Z');

    dbClient.query
      // Resolve user
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // Previous disconnect
      .mockResolvedValueOnce({ rows: [{ disconnected_at: disconnectedAt }], rowCount: 1 })
      // INSERT connection
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // Catch-up: DB returns only org-uuid-1 changes (other orgs filtered by WHERE clause)
      .mockResolvedValueOnce({
        rows: [
          { entity_type: 'mission', entity_id: 'mission-org1', mutation_type: 'updated' },
        ],
        rowCount: 1,
      });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // Verify the catch-up query filters by organization_id = $1
    const catchUpCall = dbClient.query.mock.calls[3];
    expect(catchUpCall[0]).toContain('organization_id = $1');
    expect(catchUpCall[1][0]).toBe('org-uuid-1');

    // Only org-uuid-1 changes are sent
    expect(mockPostToConnection).toHaveBeenCalledTimes(1);

    const messages = getSentMessages(mockPostToConnection);
    expect(messages[0].payload.entityType).toBe('mission');
    expect(messages[0].payload.entityId).toBe('mission-org1');

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. No catch-up needed for first-time connection
  // -------------------------------------------------------------------------
  it('sends no catch-up events when there is no previous disconnected_at (first-time connection)', async () => {
    dbClient.query
      // Resolve user
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // No previous disconnect — first-time connection
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // INSERT connection
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // No catch-up query should be made (only 3 queries: user lookup, disconnect lookup, INSERT)
    expect(dbClient.query).toHaveBeenCalledTimes(3);

    // No messages sent
    expect(mockPostToConnection).not.toHaveBeenCalled();

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. Empty catch-up — no entity_changes since disconnected_at
  // -------------------------------------------------------------------------
  it('sends no events when there are no entity_changes since disconnected_at', async () => {
    const disconnectedAt = new Date('2024-06-15T12:00:00Z');

    dbClient.query
      // Resolve user
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // Previous disconnect exists
      .mockResolvedValueOnce({ rows: [{ disconnected_at: disconnectedAt }], rowCount: 1 })
      // INSERT connection
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // Catch-up: no changes since disconnected_at
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // Catch-up query was made (4 queries total)
    expect(dbClient.query).toHaveBeenCalledTimes(4);

    // Verify the catch-up query was executed with correct params
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('entity_changes'),
      ['org-uuid-1', disconnectedAt]
    );

    // No messages sent — nothing to catch up on
    expect(mockPostToConnection).not.toHaveBeenCalled();

    expect(dbClient.release).toHaveBeenCalled();
  });
});
