const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');

const client = new BedrockAgentRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-west-2' });

const AGENT_ID = process.env.MAXWELL_AGENT_ID;
const AGENT_ALIAS_ID = process.env.MAXWELL_AGENT_ALIAS_ID;

exports.handler = async (event) => {
  console.log('Maxwell chat event:', JSON.stringify(event, null, 2));

  const authContext = getAuthorizerContext(event);
  if (!authContext.organization_id) {
    return { 
      statusCode: 401, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({ error: 'Unauthorized: No organization context' }) 
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { 
      statusCode: 400, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({ error: 'Invalid request body' }) 
    };
  }

  const { message, sessionId, sessionAttributes = {} } = body;

  if (!message) {
    return { 
      statusCode: 400, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({ error: 'message is required' }) 
    };
  }

  // Inject entity context into the message so the Agent has it in the conversation
  let enhancedMessage = message;
  if (sessionAttributes.entityId && sessionAttributes.entityType && sessionAttributes.entityName) {
    const contextPrefix = `[Context: You are discussing ${sessionAttributes.entityType} "${sessionAttributes.entityName}" (ID: ${sessionAttributes.entityId})] `;
    enhancedMessage = contextPrefix + message;
  }

  if (!AGENT_ID || !AGENT_ALIAS_ID) {
    console.error('Missing MAXWELL_AGENT_ID or MAXWELL_AGENT_ALIAS_ID env vars');
    return { 
      statusCode: 500, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({ error: 'Agent not configured' }) 
    };
  }

  // Merge org context into session attributes so the tool Lambda can scope queries
  const mergedSessionAttributes = {
    ...sessionAttributes,
    organization_id: authContext.organization_id,
  };

  // Convert all session attribute values to strings (Bedrock requirement)
  const stringifiedAttributes = Object.fromEntries(
    Object.entries(mergedSessionAttributes).map(([k, v]) => [k, String(v ?? '')])
  );

  console.log('Session attributes being sent to Maxwell:', JSON.stringify(stringifiedAttributes, null, 2));

  // Generate a session ID if not provided (Bedrock requires it)
  const effectiveSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const command = new InvokeAgentCommand({
    agentId: AGENT_ID,
    agentAliasId: AGENT_ALIAS_ID,
    sessionId: effectiveSessionId,
    inputText: enhancedMessage, // Use enhanced message with context
    enableTrace: true, // Enable trace for debugging
    sessionState: {
      sessionAttributes: stringifiedAttributes,
    },
  });

  try {
    const response = await client.send(command);
    const returnedSessionId = response.sessionId;

    // Collect streamed chunks and trace events
    let reply = '';
    const traceEvents = [];
    
    for await (const chunk of response.completion) {
      if (chunk.chunk?.bytes) {
        reply += new TextDecoder().decode(chunk.chunk.bytes);
      }
      if (chunk.trace) {
        traceEvents.push(chunk.trace);
      }
    }

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({ 
        reply, 
        sessionId: returnedSessionId,
        trace: traceEvents // Include trace in response
      }),
    };
  } catch (err) {
    console.error('Bedrock Agent error:', err);

    if (err.name === 'ThrottlingException') {
      return { 
        statusCode: 429, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({ error: 'Maxwell is busy, please try again' }) 
      };
    }
    if (err.name === 'ServiceQuotaExceededException' || err.$metadata?.httpStatusCode === 504) {
      return { 
        statusCode: 504, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: JSON.stringify({ error: 'Maxwell took too long to respond' }) 
      };
    }

    return { 
      statusCode: 500, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({ error: 'Internal error communicating with Maxwell' }) 
    };
  }
};
