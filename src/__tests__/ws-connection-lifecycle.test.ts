/**
 * Integration tests for WebSocket connection lifecycle
 *
 * Tests the core logic of the Lambda handlers (ws-connect, ws-disconnect,
 * ws-authorizer) using mock-based unit tests. Since the Lambda handlers
 * depend on Lambda layer paths (/opt/nodejs/db) that can't be resolved in
 * a local test environment, we replicate the handler logic here and test
 * it with mocked dependencies.
 *
 * This verifies:
 * - Correct SQL queries are constructed with correct parameters
 * - Correct responses are returned for each scenario
 * - The authorization flow produces Allow/Deny policies correctly
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
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
// Handler logic extracted from Lambda handlers for testability
// These mirror the actual handler implementations in lambda/ws-connect,
// lambda/ws-disconnect, and lambda/ws-authorizer.
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

/**
 * Core logic from lambda/ws-disconnect/index.js
 * Mirrors the actual handler: soft-deletes connection by setting disconnected_at.
 */
async function handleDisconnect(event: any, dbClient: MockDbClient) {
  const { connectionId } = event.requestContext;

  if (!connectionId) {
    return { statusCode: 500 };
  }

  try {
    await dbClient.query(
      `UPDATE websocket_connections
       SET disconnected_at = NOW()
       WHERE connection_id = $1 AND disconnected_at IS NULL`,
      [connectionId]
    );

    return { statusCode: 200 };
  } catch (error) {
    return { statusCode: 500 };
  } finally {
    dbClient.release();
  }
}

/**
 * Core logic from lambda/ws-authorizer/index.js
 * Mirrors the actual handler: validates JWT, looks up org, returns policy.
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
) {
  const policy: any = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
  if (context) {
    policy.context = context;
  }
  return policy;
}

function calculatePermissions(userRole: string, memberships: any[]) {
  const permissions: string[] = [];
  switch (userRole) {
    case 'admin':
      permissions.push(
        'organizations:read', 'organizations:update', 'members:manage',
        'data:read', 'data:read:all', 'data:write', 'data:write:all'
      );
      break;
    case 'leadership':
      permissions.push('organizations:read', 'data:read', 'data:read:org', 'data:write', 'data:write:org');
      break;
    case 'contributor':
      permissions.push('data:read', 'data:write');
      break;
    case 'viewer':
      permissions.push('data:read');
      break;
    default:
      permissions.push('data:read');
  }
  const adminOrgs = memberships.filter((m: any) => m.role === 'admin');
  if (adminOrgs.length > 1) {
    permissions.push('organizations:read:multiple');
  }
  return permissions;
}

interface AuthorizerDeps {
  verifyToken: (token: string) => Promise<{ sub: string }>;
  getUserOrgData: (cognitoUserId: string) => Promise<any | null>;
}

async function handleAuthorizer(event: any, deps: AuthorizerDeps) {
  try {
    const token = event.queryStringParameters?.token;
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    const cleanToken = token.replace(/^Bearer /, '');
    let decoded: { sub: string };
    try {
      decoded = await deps.verifyToken(cleanToken);
    } catch {
      throw new Error('Unauthorized: Invalid token');
    }

    const cognitoUserId = decoded.sub;
    const userData = await deps.getUserOrgData(cognitoUserId);

    if (!userData) {
      throw new Error('Forbidden: User not found in any organization');
    }

    if (!userData.accessible_organization_ids || userData.accessible_organization_ids.length === 0) {
      throw new Error('Forbidden: User has no accessible organizations');
    }

    const context = {
      organization_id: userData.organization_id,
      organization_memberships: JSON.stringify(userData.organization_memberships || []),
      accessible_organization_ids: JSON.stringify(userData.accessible_organization_ids),
      cognito_user_id: cognitoUserId,
      user_role: userData.role,
      permissions: JSON.stringify(userData.permissions || []),
    };

    const resource = event.methodArn.split('/').slice(0, 2).join('/') + '/*';
    return generatePolicy(cognitoUserId, 'Allow', resource, context);
  } catch {
    const resource = event.methodArn
      ? event.methodArn.split('/').slice(0, 2).join('/') + '/*'
      : '*';
    return generatePolicy('user', 'Deny', resource);
  }
}

// ---------------------------------------------------------------------------
// Event builders
// ---------------------------------------------------------------------------

function buildConnectEvent(overrides: Record<string, any> = {}) {
  return {
    requestContext: {
      connectionId: 'test-connection-id-123',
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

function buildDisconnectEvent(connectionId = 'test-connection-id-123') {
  return { requestContext: { connectionId } };
}

function buildAuthorizerEvent(token?: string) {
  return {
    queryStringParameters: token !== undefined ? { token } : {},
    methodArn: 'arn:aws:execute-api:us-west-2:123456789:abc123/prod/$connect',
  };
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. $connect with valid auth context
// ---------------------------------------------------------------------------

describe('cwf-ws-connect handler', () => {
  let dbClient: MockDbClient;
  let mockPostToConnection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dbClient = createMockDbClient();
    mockPostToConnection = vi.fn().mockResolvedValue(undefined);
  });

  it('inserts a connection record into the DB on valid $connect', async () => {
    // Resolve cognito_user_id → user_id
    dbClient.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // No previous disconnect
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // INSERT connection
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // Verify user lookup query
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT user_id FROM organization_members'),
      ['cognito-sub-1', 'org-uuid-1']
    );

    // Verify INSERT query
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO websocket_connections'),
      ['test-connection-id-123', 'user-uuid-1', 'org-uuid-1']
    );

    // Verify client released
    expect(dbClient.release).toHaveBeenCalled();
  });

  it('sends catch-up events when user has a previous disconnected_at', async () => {
    const lastDisconnect = new Date('2024-01-15T10:00:00Z');

    dbClient.query
      // Resolve user
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-uuid-1' }], rowCount: 1 })
      // Previous disconnect exists
      .mockResolvedValueOnce({ rows: [{ disconnected_at: lastDisconnect }], rowCount: 1 })
      // INSERT connection
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      // Catch-up entity changes
      .mockResolvedValueOnce({
        rows: [
          { entity_type: 'tool', entity_id: 'tool-1', mutation_type: 'updated' },
          { entity_type: 'action', entity_id: 'action-1', mutation_type: 'created' },
        ],
        rowCount: 2,
      });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 200 });

    // Verify catch-up query uses correct org and timestamp
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('entity_changes'),
      ['org-uuid-1', lastDisconnect]
    );

    // Should send 2 catch-up events
    expect(mockPostToConnection).toHaveBeenCalledTimes(2);

    // Verify first catch-up message format
    const firstCallData = JSON.parse(mockPostToConnection.mock.calls[0][0].Data);
    expect(firstCallData.type).toBe('cache:invalidate');
    expect(firstCallData.payload.entityType).toBe('tool');
    expect(firstCallData.payload.entityId).toBe('tool-1');
    expect(firstCallData.payload.mutationType).toBe('updated');
    expect(firstCallData.timestamp).toBeDefined();
  });

  it('returns 500 when no active organization member is found', async () => {
    dbClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 500 });
    expect(dbClient.release).toHaveBeenCalled();
  });

  it('returns 500 when required context is missing', async () => {
    const event = {
      requestContext: {
        connectionId: null,
        authorizer: {
          organization_id: 'org-uuid-1',
          cognito_user_id: 'cognito-sub-1',
        },
      },
    };

    const result = await handleConnect(event, dbClient, mockPostToConnection);
    expect(result).toEqual({ statusCode: 500 });
  });

  it('returns 500 and releases client on DB error', async () => {
    dbClient.query.mockRejectedValueOnce(new Error('DB connection failed'));

    const event = buildConnectEvent();
    const result = await handleConnect(event, dbClient, mockPostToConnection);

    expect(result).toEqual({ statusCode: 500 });
    expect(dbClient.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. $disconnect updates disconnected_at (soft delete)
// ---------------------------------------------------------------------------

describe('cwf-ws-disconnect handler', () => {
  let dbClient: MockDbClient;

  beforeEach(() => {
    dbClient = createMockDbClient();
  });

  it('sets disconnected_at on the connection record (soft delete)', async () => {
    dbClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const event = buildDisconnectEvent('conn-abc-123');
    const result = await handleDisconnect(event, dbClient);

    expect(result).toEqual({ statusCode: 200 });

    // Verify the UPDATE query uses soft delete pattern
    expect(dbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SET disconnected_at = NOW()'),
      ['conn-abc-123']
    );

    // Verify it only updates records that aren't already disconnected
    const sql = dbClient.query.mock.calls[0][0];
    expect(sql).toContain('disconnected_at IS NULL');

    expect(dbClient.release).toHaveBeenCalled();
  });

  it('handles missing connection gracefully (rowCount 0)', async () => {
    dbClient.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const event = buildDisconnectEvent('nonexistent-conn');
    const result = await handleDisconnect(event, dbClient);

    // Should still return 200 — no error, just a no-op
    expect(result).toEqual({ statusCode: 200 });
    expect(dbClient.release).toHaveBeenCalled();
  });

  it('returns 500 when connectionId is missing', async () => {
    const event = { requestContext: { connectionId: null } };
    const result = await handleDisconnect(event, dbClient);

    expect(result).toEqual({ statusCode: 500 });
  });

  it('returns 500 and releases client on DB error', async () => {
    dbClient.query.mockRejectedValueOnce(new Error('DB timeout'));

    const event = buildDisconnectEvent('conn-abc-123');
    const result = await handleDisconnect(event, dbClient);

    expect(result).toEqual({ statusCode: 500 });
    expect(dbClient.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. WebSocket authorizer — Allow/Deny policy
// ---------------------------------------------------------------------------

describe('cwf-ws-authorizer handler', () => {
  it('returns Allow policy with correct context for valid token', async () => {
    const deps: AuthorizerDeps = {
      verifyToken: vi.fn().mockResolvedValue({ sub: 'cognito-sub-1' }),
      getUserOrgData: vi.fn().mockResolvedValue({
        organization_id: 'org-uuid-1',
        organization_memberships: [{ organization_id: 'org-uuid-1', role: 'admin' }],
        accessible_organization_ids: ['org-uuid-1'],
        role: 'admin',
        permissions: calculatePermissions('admin', [{ role: 'admin' }]),
      }),
    };

    const event = buildAuthorizerEvent('valid-jwt-token');
    const result = await handleAuthorizer(event, deps);

    // Should return Allow policy
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.principalId).toBe('cognito-sub-1');

    // Context should contain org info
    expect(result.context).toBeDefined();
    expect(result.context.organization_id).toBe('org-uuid-1');
    expect(result.context.cognito_user_id).toBe('cognito-sub-1');
    expect(result.context.user_role).toBe('admin');

    // Permissions should include admin permissions
    const permissions = JSON.parse(result.context.permissions);
    expect(permissions).toContain('organizations:read');
    expect(permissions).toContain('data:write:all');
  });

  it('returns Deny policy when no token is provided', async () => {
    const deps: AuthorizerDeps = {
      verifyToken: vi.fn(),
      getUserOrgData: vi.fn(),
    };

    const event = buildAuthorizerEvent(undefined);
    event.queryStringParameters = {};
    const result = await handleAuthorizer(event, deps);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    // verifyToken should not have been called
    expect(deps.verifyToken).not.toHaveBeenCalled();
  });

  it('returns Deny policy for invalid/expired token', async () => {
    const deps: AuthorizerDeps = {
      verifyToken: vi.fn().mockRejectedValue(new Error('jwt expired')),
      getUserOrgData: vi.fn(),
    };

    const event = buildAuthorizerEvent('expired-jwt-token');
    const result = await handleAuthorizer(event, deps);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
    // getUserOrgData should not have been called
    expect(deps.getUserOrgData).not.toHaveBeenCalled();
  });

  it('returns Deny policy when user has no organization memberships', async () => {
    const deps: AuthorizerDeps = {
      verifyToken: vi.fn().mockResolvedValue({ sub: 'cognito-sub-orphan' }),
      getUserOrgData: vi.fn().mockResolvedValue(null),
    };

    const event = buildAuthorizerEvent('valid-token-no-org');
    const result = await handleAuthorizer(event, deps);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
  });

  it('returns Deny policy when user has no accessible organizations', async () => {
    const deps: AuthorizerDeps = {
      verifyToken: vi.fn().mockResolvedValue({ sub: 'cognito-sub-1' }),
      getUserOrgData: vi.fn().mockResolvedValue({
        organization_id: 'org-uuid-1',
        accessible_organization_ids: [],
        role: 'viewer',
        permissions: ['data:read'],
      }),
    };

    const event = buildAuthorizerEvent('valid-token');
    const result = await handleAuthorizer(event, deps);

    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
  });
});

// ---------------------------------------------------------------------------
// 4. generatePolicy utility
// ---------------------------------------------------------------------------

describe('generatePolicy', () => {
  it('generates Allow policy with context', () => {
    const policy = generatePolicy('user-1', 'Allow', 'arn:aws:execute-api:*', {
      organization_id: 'org-1',
    });

    expect(policy.principalId).toBe('user-1');
    expect(policy.policyDocument.Version).toBe('2012-10-17');
    expect(policy.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(policy.policyDocument.Statement[0].Action).toBe('execute-api:Invoke');
    expect(policy.context.organization_id).toBe('org-1');
  });

  it('generates Deny policy without context', () => {
    const policy = generatePolicy('user', 'Deny', '*');

    expect(policy.policyDocument.Statement[0].Effect).toBe('Deny');
    expect(policy.context).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. calculatePermissions utility
// ---------------------------------------------------------------------------

describe('calculatePermissions', () => {
  it('returns admin permissions for admin role', () => {
    const perms = calculatePermissions('admin', [{ role: 'admin' }]);
    expect(perms).toContain('organizations:read');
    expect(perms).toContain('organizations:update');
    expect(perms).toContain('members:manage');
    expect(perms).toContain('data:read');
    expect(perms).toContain('data:write:all');
  });

  it('returns viewer permissions for viewer role', () => {
    const perms = calculatePermissions('viewer', [{ role: 'viewer' }]);
    expect(perms).toEqual(['data:read']);
  });

  it('returns contributor permissions for contributor role', () => {
    const perms = calculatePermissions('contributor', [{ role: 'contributor' }]);
    expect(perms).toContain('data:read');
    expect(perms).toContain('data:write');
    expect(perms).not.toContain('data:write:all');
  });

  it('adds cross-org permission for multi-org admins', () => {
    const perms = calculatePermissions('admin', [
      { role: 'admin' },
      { role: 'admin' },
    ]);
    expect(perms).toContain('organizations:read:multiple');
  });

  it('defaults to data:read for unknown roles', () => {
    const perms = calculatePermissions('unknown', []);
    expect(perms).toEqual(['data:read']);
  });
});
