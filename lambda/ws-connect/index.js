/**
 * WebSocket $connect handler for API Gateway WebSocket API
 *
 * Runs on every new WebSocket connection after the authorizer approves it.
 *
 * Responsibilities:
 * 1. INSERT a record into websocket_connections with connection_id, user_id,
 *    organization_id, and connected_at.
 * 2. Look up the user's most recent disconnected_at timestamp to determine
 *    what entity_changes they may have missed.
 * 3. Send catch-up `cache:invalidate` events via postToConnection for each
 *    change that occurred while the user was disconnected.
 *
 * The authorizer context provides: organization_id, cognito_user_id, permissions.
 * We resolve cognito_user_id → user_id via the organization_members table.
 */

const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { getDbClient } = require('/opt/nodejs/db');

exports.handler = async (event) => {
  console.log('[WS-CONNECT] Event:', JSON.stringify(event, null, 2));

  const { connectionId } = event.requestContext;
  const { organization_id, cognito_user_id } = event.requestContext.authorizer;

  if (!connectionId || !organization_id || !cognito_user_id) {
    console.error('[WS-CONNECT] Missing required context:', {
      connectionId,
      organization_id,
      cognito_user_id
    });
    return { statusCode: 500 };
  }

  const client = await getDbClient();

  try {
    // Resolve cognito_user_id → user_id from organization_members
    const userResult = await client.query(
      `SELECT user_id FROM organization_members
       WHERE cognito_user_id = $1 AND organization_id = $2 AND is_active = true
       LIMIT 1`,
      [cognito_user_id, organization_id]
    );

    if (userResult.rows.length === 0) {
      console.error('[WS-CONNECT] No active organization member found:', {
        cognito_user_id,
        organization_id
      });
      return { statusCode: 500 };
    }

    const userId = userResult.rows[0].user_id;

    // Find the user's most recent disconnected_at for catch-up
    const lastDisconnectResult = await client.query(
      `SELECT disconnected_at FROM websocket_connections
       WHERE user_id = $1 AND organization_id = $2 AND disconnected_at IS NOT NULL
       ORDER BY disconnected_at DESC
       LIMIT 1`,
      [userId, organization_id]
    );

    const lastDisconnectedAt = lastDisconnectResult.rows.length > 0
      ? lastDisconnectResult.rows[0].disconnected_at
      : null;

    // INSERT the new connection record
    await client.query(
      `INSERT INTO websocket_connections (connection_id, user_id, organization_id, connected_at)
       VALUES ($1, $2, $3, NOW())`,
      [connectionId, userId, organization_id]
    );

    console.log('[WS-CONNECT] Connection recorded:', {
      connectionId,
      userId,
      organization_id
    });

    // Send catch-up events if the user was previously connected
    if (lastDisconnectedAt) {
      const catchUpResult = await client.query(
        `SELECT entity_type, entity_id, mutation_type
         FROM entity_changes
         WHERE organization_id = $1 AND created_at > $2
         ORDER BY created_at ASC`,
        [organization_id, lastDisconnectedAt]
      );

      if (catchUpResult.rows.length > 0) {
        console.log('[WS-CONNECT] Sending catch-up events:', {
          count: catchUpResult.rows.length,
          since: lastDisconnectedAt
        });

        const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
        const apiGwClient = new ApiGatewayManagementApiClient({ endpoint });

        for (const change of catchUpResult.rows) {
          const message = JSON.stringify({
            type: 'cache:invalidate',
            payload: {
              entityType: change.entity_type,
              entityId: change.entity_id,
              mutationType: change.mutation_type
            },
            timestamp: new Date().toISOString()
          });

          try {
            await apiGwClient.send(new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: message
            }));
          } catch (err) {
            // 410 means the connection is already gone — unlikely during $connect
            // but handle gracefully
            if (err.statusCode === 410 || err.$metadata?.httpStatusCode === 410) {
              console.warn('[WS-CONNECT] Connection gone during catch-up:', connectionId);
              break;
            }
            console.error('[WS-CONNECT] Failed to send catch-up event:', err.message);
          }
        }

        console.log('[WS-CONNECT] Catch-up complete');
      } else {
        console.log('[WS-CONNECT] No catch-up events needed');
      }
    } else {
      console.log('[WS-CONNECT] First connection for user, no catch-up needed');
    }

    return { statusCode: 200 };
  } catch (error) {
    console.error('[WS-CONNECT] Error:', error);
    return { statusCode: 500 };
  } finally {
    client.release();
  }
};
