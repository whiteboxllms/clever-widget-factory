/**
 * WebSocket $disconnect handler for API Gateway WebSocket API
 *
 * Runs when a WebSocket connection is closed (client disconnect, idle timeout,
 * or server-initiated close).
 *
 * Responsibilities:
 * 1. UPDATE the websocket_connections record to set disconnected_at = NOW()
 *    (soft delete — preserves the row for the catch-up mechanism).
 *
 * Note: The $disconnect route does NOT receive authorizer context from
 * API Gateway. Only event.requestContext.connectionId is available.
 */

const { getDbClient } = require('/opt/nodejs/db');

exports.handler = async (event) => {
  console.log('[WS-DISCONNECT] Event:', JSON.stringify(event, null, 2));

  const { connectionId } = event.requestContext;

  if (!connectionId) {
    console.error('[WS-DISCONNECT] Missing connectionId');
    return { statusCode: 500 };
  }

  const client = await getDbClient();

  try {
    const result = await client.query(
      `UPDATE websocket_connections
       SET disconnected_at = NOW()
       WHERE connection_id = $1 AND disconnected_at IS NULL`,
      [connectionId]
    );

    if (result.rowCount === 0) {
      console.warn('[WS-DISCONNECT] No active connection found for:', connectionId);
    } else {
      console.log('[WS-DISCONNECT] Connection marked as disconnected:', connectionId);
    }

    return { statusCode: 200 };
  } catch (error) {
    console.error('[WS-DISCONNECT] Error:', error);
    return { statusCode: 500 };
  } finally {
    client.release();
  }
};
