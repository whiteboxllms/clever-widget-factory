/**
 * WebSocket cleanup handler (cwf-ws-cleanup)
 *
 * Scheduled via EventBridge (rate: 1 hour). Performs two cleanup tasks:
 *
 * 1. Marks stale connections as disconnected — connections older than 24 hours
 *    with no disconnected_at timestamp. This handles cases where the $disconnect
 *    route never fires (e.g., client crashes, network drops).
 *
 * 2. Deletes old entity_changes records — records older than 7 days are no longer
 *    needed for the reconnection catch-up mechanism.
 */

const { getDbClient } = require('/opt/nodejs/db');

exports.handler = async () => {
  console.log('[WS-CLEANUP] Starting cleanup');

  const client = await getDbClient();

  try {
    // 1. Mark stale connections as disconnected
    const staleResult = await client.query(`
      UPDATE websocket_connections
      SET disconnected_at = NOW()
      WHERE disconnected_at IS NULL
        AND connected_at < NOW() - INTERVAL '24 hours'
    `);

    console.log(`[WS-CLEANUP] Marked ${staleResult.rowCount} stale connection(s) as disconnected`);

    // 2. Delete old entity_changes records
    const purgeResult = await client.query(`
      DELETE FROM entity_changes
      WHERE created_at < NOW() - INTERVAL '7 days'
    `);

    console.log(`[WS-CLEANUP] Deleted ${purgeResult.rowCount} old entity_changes record(s)`);

    console.log('[WS-CLEANUP] Cleanup complete', {
      staleConnections: staleResult.rowCount,
      purgedEntityChanges: purgeResult.rowCount,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        staleConnections: staleResult.rowCount,
        purgedEntityChanges: purgeResult.rowCount,
      }),
    };
  } catch (error) {
    console.error('[WS-CLEANUP] Error:', error);
    throw error;
  } finally {
    client.release();
  }
};
