/**
 * Integration tests for WebSocket cleanup Lambda (cwf-ws-cleanup)
 *
 * Tests the cleanup logic that runs on an hourly EventBridge schedule:
 * 1. Marks stale connections (>24h with no disconnected_at) as disconnected
 * 2. Deletes old entity_changes records (>7 days)
 *
 * Since the Lambda handler depends on Lambda layer paths (/opt/nodejs/db)
 * that can't be resolved in a local test environment, we replicate the
 * handler logic here and test it with mocked dependencies.
 *
 * This follows the same pattern as ws-connection-lifecycle.test.ts.
 *
 * Validates: Requirements 1.4, 3.6
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
// Handler logic extracted from lambda/ws-cleanup/index.js for testability
// Mirrors the actual handler implementation.
// ---------------------------------------------------------------------------

/**
 * Core logic from lambda/ws-cleanup/index.js
 * Mirrors the actual handler: marks stale connections, deletes old entity_changes.
 */
async function handleCleanup(dbClient: MockDbClient) {
  try {
    // 1. Mark stale connections as disconnected
    const staleResult = await dbClient.query(`
      UPDATE websocket_connections
      SET disconnected_at = NOW()
      WHERE disconnected_at IS NULL
        AND connected_at < NOW() - INTERVAL '24 hours'
    `);

    // 2. Delete old entity_changes records
    const purgeResult = await dbClient.query(`
      DELETE FROM entity_changes
      WHERE created_at < NOW() - INTERVAL '7 days'
    `);

    return {
      statusCode: 200,
      body: JSON.stringify({
        staleConnections: staleResult.rowCount,
        purgedEntityChanges: purgeResult.rowCount,
      }),
    };
  } catch (error) {
    throw error;
  } finally {
    dbClient.release();
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('cwf-ws-cleanup handler', () => {
  let dbClient: MockDbClient;

  beforeEach(() => {
    dbClient = createMockDbClient();
  });

  // -------------------------------------------------------------------------
  // 1. Stale connections (>24h) are marked disconnected
  // -------------------------------------------------------------------------
  it('marks stale connections older than 24h as disconnected', async () => {
    dbClient.query
      // UPDATE stale connections
      .mockResolvedValueOnce({ rows: [], rowCount: 3 })
      // DELETE old entity_changes
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await handleCleanup(dbClient);

    expect(result.statusCode).toBe(200);

    // Verify the UPDATE query targets connections with NULL disconnected_at
    // older than 24 hours
    const updateCall = dbClient.query.mock.calls[0][0];
    expect(updateCall).toContain('UPDATE websocket_connections');
    expect(updateCall).toContain('SET disconnected_at = NOW()');
    expect(updateCall).toContain('disconnected_at IS NULL');
    expect(updateCall).toContain("INTERVAL '24 hours'");

    // Verify response includes the count
    const body = JSON.parse(result.body);
    expect(body.staleConnections).toBe(3);

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Old entity_changes (>7 days) are deleted
  // -------------------------------------------------------------------------
  it('deletes entity_changes records older than 7 days', async () => {
    dbClient.query
      // UPDATE stale connections
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // DELETE old entity_changes
      .mockResolvedValueOnce({ rows: [], rowCount: 15 });

    const result = await handleCleanup(dbClient);

    expect(result.statusCode).toBe(200);

    // Verify the DELETE query targets entity_changes older than 7 days
    const deleteCall = dbClient.query.mock.calls[1][0];
    expect(deleteCall).toContain('DELETE FROM entity_changes');
    expect(deleteCall).toContain("INTERVAL '7 days'");

    // Verify response includes the count
    const body = JSON.parse(result.body);
    expect(body.purgedEntityChanges).toBe(15);

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Recent records are preserved — SQL uses correct time intervals
  // -------------------------------------------------------------------------
  it('uses correct time intervals — 24h for connections, 7 days for entity_changes', async () => {
    dbClient.query
      // UPDATE stale connections — 0 affected means recent connections preserved
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      // DELETE old entity_changes — 0 affected means recent records preserved
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await handleCleanup(dbClient);

    expect(result.statusCode).toBe(200);

    // Verify exactly 2 queries are executed
    expect(dbClient.query).toHaveBeenCalledTimes(2);

    // Verify the connection cleanup uses 24 hours interval
    const connectionQuery = dbClient.query.mock.calls[0][0];
    expect(connectionQuery).toContain("NOW() - INTERVAL '24 hours'");
    // Only targets connections that haven't been disconnected yet
    expect(connectionQuery).toContain('disconnected_at IS NULL');

    // Verify the entity_changes cleanup uses 7 days interval
    const entityChangesQuery = dbClient.query.mock.calls[1][0];
    expect(entityChangesQuery).toContain("NOW() - INTERVAL '7 days'");

    // Both counts should be 0 — recent records preserved
    const body = JSON.parse(result.body);
    expect(body.staleConnections).toBe(0);
    expect(body.purgedEntityChanges).toBe(0);

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. Cleanup returns counts of cleaned-up records
  // -------------------------------------------------------------------------
  it('returns counts of stale connections and purged entity_changes', async () => {
    dbClient.query
      // UPDATE stale connections
      .mockResolvedValueOnce({ rows: [], rowCount: 5 })
      // DELETE old entity_changes
      .mockResolvedValueOnce({ rows: [], rowCount: 42 });

    const result = await handleCleanup(dbClient);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toEqual({
      staleConnections: 5,
      purgedEntityChanges: 42,
    });

    expect(dbClient.release).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. DB client is released on success and error
  // -------------------------------------------------------------------------
  it('releases the DB client on successful cleanup', async () => {
    dbClient.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await handleCleanup(dbClient);

    expect(dbClient.release).toHaveBeenCalledTimes(1);
  });

  it('releases the DB client when the first query fails', async () => {
    dbClient.query.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(handleCleanup(dbClient)).rejects.toThrow('DB connection lost');

    expect(dbClient.release).toHaveBeenCalledTimes(1);
  });

  it('releases the DB client when the second query fails', async () => {
    dbClient.query
      // First query succeeds
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      // Second query fails
      .mockRejectedValueOnce(new Error('DB timeout'));

    await expect(handleCleanup(dbClient)).rejects.toThrow('DB timeout');

    expect(dbClient.release).toHaveBeenCalledTimes(1);
  });
});
