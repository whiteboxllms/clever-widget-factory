/**
 * Sari-Sari Product Search — Bedrock Action Group Lambda
 *
 * Invoked by the Sari-Sari Bedrock Agent to search sellable products
 * via embedding similarity against the unified_embeddings table.
 *
 * Follows the same pattern as maxwell-storage-advisor/index.js.
 */

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
 * Bedrock may pass parameters in two places:
 *   1. event.parameters — array of [{ name, type, value }, ...] (query/path params)
 *   2. event.requestBody.content['application/json'].properties — same shape (POST body params)
 * We check both and merge, with requestBody taking precedence.
 */
function parseActionGroupParams(event) {
  const params = {};

  // 1. Top-level parameters (query/path style)
  const rawParams = event.parameters || [];
  for (const p of rawParams) {
    params[p.name] = p.value;
  }

  // 2. Request body properties (POST body style)
  try {
    const bodyProps =
      event.requestBody?.content?.['application/json']?.properties || [];
    for (const p of bodyProps) {
      params[p.name] = p.value;
    }
  } catch (_) {
    // requestBody not present or malformed — ignore
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
  console.log('Sari-sari product search event:', JSON.stringify(event, null, 2));

  const actionGroup = event.actionGroup || 'ProductSearch';
  const apiPath = event.apiPath || '/searchProducts';
  const httpMethod = event.httpMethod || 'POST';

  // Extract org context from session attributes (forwarded by sari-sari-agent-chat)
  const sessionAttributes = event.sessionAttributes || {};
  const organizationId = sessionAttributes.organization_id || sessionAttributes.organizationId;

  // Parse parameters from Bedrock Action Group format
  const params = parseActionGroupParams(event);
  const { query } = params;

  // Validate required parameters
  if (!query || query.trim() === '') {
    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 400, {
      error: 'Missing required parameter: query',
    });
  }
  if (!organizationId) {
    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 400, {
      error: 'Missing organization context in session attributes',
    });
  }

  try {
    // Generate embedding for the query
    const embedding = await generateEmbeddingV1(query);
    const embeddingVector = `'[${embedding.join(',')}]'::vector`;
    const safeOrgId = escapeLiteral(organizationId);

    const sql = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.policy,
        p.cost_per_unit,
        p.unit,
        p.current_quantity,
        p.image_url,
        1 - (ue.embedding <=> ${embeddingVector}) AS similarity
      FROM unified_embeddings ue
      INNER JOIN parts p
        ON ue.entity_type = 'part'
        AND ue.entity_id = p.id
      WHERE p.organization_id = '${safeOrgId}'
        AND p.sellable = true
        AND ue.embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT 10
    `;

    const rows = await queryJSON(sql);

    const results = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      policy: row.policy,
      price: parseFloat(row.cost_per_unit),
      unit: row.unit,
      current_quantity: row.current_quantity,
      image_url: row.image_url || null,
      similarity_score: parseFloat(row.similarity),
    }));

    const message =
      results.length > 0
        ? `Found ${results.length} product${results.length === 1 ? '' : 's'} matching your search`
        : 'No products found matching your search';

    const instructions = results.length > 0
      ? 'Present these products to the customer in a friendly, conversational way. Show prices in Philippine Pesos (₱). If a product has health benefits in its policy field, mention them naturally. Select the 2-3 most relevant products to highlight. Use the <!-- PRODUCTS [...] --> delimiter to embed the product data at the end of your response.'
      : 'No products matched the search. Suggest the customer try different search terms or ask about specific product categories.';

    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 200, {
      results,
      message,
      instructions,
    });
  } catch (error) {
    console.error('Sari-sari product search error:', error);

    if (error.message && error.message.includes('Embedding generation failed')) {
      return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
        error: 'Failed to generate embedding for the provided query',
      });
    }

    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
      error: 'Internal error searching for products',
    });
  }
};
