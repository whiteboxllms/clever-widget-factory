const { getDbClient } = require('/opt/nodejs/db');
const { escapeLiteral } = require('/opt/nodejs/sqlUtils');
const { generateEmbeddingV1 } = require('./shared/embeddings');

async function queryJSON(sql) {
  const client = await getDbClient();
  try {
    const result = await client.query(sql);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Parse parameters from Bedrock Action Group event.
 * Bedrock passes parameters as an array: [{ name, type, value }, ...]
 */
function parseActionGroupParams(event) {
  const params = {};
  const rawParams = event.parameters || [];
  for (const p of rawParams) {
    params[p.name] = p.value;
  }
  return params;
}

/**
 * Build the Bedrock Action Group response envelope.
 */
function buildActionGroupResponse(actionGroup, apiPath, httpMethod, statusCode, body) {
  return {
    messageVersion: '1.0',
    response: {
      actionGroup,
      apiPath,
      httpMethod,
      httpStatusCode: statusCode,
      responseBody: {
        'application/json': {
          body: JSON.stringify(body),
        },
      },
    },
  };
}

exports.handler = async (event) => {
  console.log('Maxwell storage advisor event:', JSON.stringify(event, null, 2));

  const actionGroup = event.actionGroup || 'SuggestStorageLocation';
  const apiPath = event.apiPath || '/suggestStorageLocation';
  const httpMethod = event.httpMethod || 'POST';

  // Extract org context from session attributes (forwarded by cwf-maxwell-chat)
  const sessionAttributes = event.sessionAttributes || {};
  const organizationId = sessionAttributes.organization_id || sessionAttributes.organizationId;

  // Parse parameters from Bedrock Action Group format
  const params = parseActionGroupParams(event);
  const { description } = params;

  // Validate required parameters
  if (!description || description.trim() === '') {
    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 400, {
      error: 'Missing required parameter: description',
    });
  }
  if (!organizationId) {
    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 400, {
      error: 'Missing organization context in session attributes',
    });
  }

  try {
    // Generate embedding for the description
    const embedding = await generateEmbeddingV1(description);
    const embeddingVector = `'[${embedding.join(',')}]'::vector`;
    const safeOrgId = escapeLiteral(organizationId);

    const sql = `
      SELECT
        ue.entity_type,
        ue.entity_id,
        ue.embedding_source,
        1 - (ue.embedding <=> ${embeddingVector}) AS similarity,
        COALESCE(t.name, p.name) AS name,
        COALESCE(t.storage_location, p.storage_location) AS storage_location,
        COALESCE(t.image_url, p.image_url) AS image_url,
        parent_tool.name AS area_name
      FROM unified_embeddings ue
      LEFT JOIN tools t ON ue.entity_type = 'tool' AND ue.entity_id = t.id AND t.organization_id = '${safeOrgId}'
      LEFT JOIN parts p ON ue.entity_type = 'part' AND ue.entity_id = p.id AND p.organization_id = '${safeOrgId}'
      LEFT JOIN tools parent_tool ON COALESCE(t.parent_structure_id, p.parent_structure_id) = parent_tool.id
      WHERE ue.entity_type IN ('tool', 'part')
        AND ue.organization_id = '${safeOrgId}'
      ORDER BY similarity DESC
      LIMIT 10
    `;

    const rows = await queryJSON(sql);

    const results = rows.map((row) => ({
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      name: row.name,
      similarity: parseFloat(row.similarity),
      area_name: row.area_name || null,
      storage_location: row.storage_location || null,
      image_url: row.image_url || null,
      embedding_source: row.embedding_source,
    }));

    const message =
      results.length > 0
        ? `Found ${results.length} similar item${results.length === 1 ? '' : 's'} in inventory`
        : 'No similar items found in inventory';

    // Self-contained instructions tell the agent how to present these results.
    // This keeps tool-specific behavior out of the system prompt.
    const instructions = results.length > 0
      ? 'ALWAYS start with a Considerations section before listing options. For each storage option, show its name, area_name, and storage_location WITH reasoning for why that location fits the asset. When results include image_url, render photos using markdown: ![name](url). Use ONLY data from the results. Follow the Standard Response Format from your system prompt: Considerations first, then Storage Location Options with reasoning, then Synthesis of Action.'
      : 'No similar items were found in inventory.';

    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 200, {
      results,
      message,
      instructions,
    });
  } catch (error) {
    console.error('Maxwell storage advisor error:', error);

    if (error.message && error.message.includes('Embedding generation failed')) {
      return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
        error: 'Failed to generate embedding for the provided description',
      });
    }

    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
      error: 'Internal error searching for similar items',
    });
  }
};
