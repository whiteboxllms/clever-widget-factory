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

/**
 * Resolve a created_by_name to cognito_user_id(s) via ILIKE partial match
 * on organization_members.full_name, scoped to the organization.
 */
async function resolveCreatedByName(client, organizationId, createdByName) {
  const safeName = escapeLiteral(createdByName);
  const safeOrgId = escapeLiteral(organizationId);

  const sql = `
    SELECT cognito_user_id, full_name
    FROM organization_members
    WHERE organization_id = '${safeOrgId}'
      AND full_name ILIKE '%' || '${safeName}' || '%'
  `;

  const result = await client.query(sql);
  return result.rows;
}

exports.handler = async (event) => {
  console.log('Maxwell expenses event:', JSON.stringify(event, null, 2));

  const actionGroup = event.actionGroup || 'SearchFinancialRecords';
  const apiPath = event.apiPath || '/searchFinancialRecords';
  const httpMethod = event.httpMethod || 'POST';

  // Extract org context from session attributes (forwarded by cwf-maxwell-chat)
  const sessionAttributes = event.sessionAttributes || {};
  const organizationId = sessionAttributes.organization_id || sessionAttributes.organizationId;

  // Parse parameters from Bedrock Action Group format
  const params = parseActionGroupParams(event);
  const {
    query,
    created_by_name,
    payment_method,
    start_date,
    end_date,
    sort_by,
    limit,
  } = params;

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

  // Default date range: 6 months ago to today
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setMonth(defaultStart.getMonth() - 6);
  const startDate = start_date || defaultStart.toISOString().split('T')[0];
  const endDate = end_date || now.toISOString().split('T')[0];
  const resultLimit = parseInt(limit, 10) || 20;

  const safeOrgId = escapeLiteral(organizationId);

  let client;
  try {
    client = await getDbClient();

    // If created_by_name provided, resolve to user IDs
    let resolvedUsers = null;
    if (created_by_name && created_by_name.trim() !== '') {
      resolvedUsers = await resolveCreatedByName(client, organizationId, created_by_name);

      // No matching users → return empty results with message
      if (resolvedUsers.length === 0) {
        return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 200, {
          results: [],
          total_count: 0,
          message: `No user matching '${created_by_name}' found in your organization`,
          instructions: 'No matching financial records were found for this query. Inform the user and suggest they try different search terms or a wider date range.',
        });
      }
    }

    // Generate embedding for the query
    let embedding;
    try {
      embedding = await generateEmbeddingV1(query);
    } catch (embeddingError) {
      console.error('Embedding generation error:', embeddingError);
      return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
        error: 'Failed to generate embedding for the provided query',
      });
    }

    const embeddingVector = `'[${embedding.join(',')}]'::vector`;
    const safeStartDate = escapeLiteral(startDate);
    const safeEndDate = escapeLiteral(endDate);

    // Build WHERE clauses
    let whereClauses = `
      ue.entity_type = 'financial_record'
      AND ue.organization_id = '${safeOrgId}'
      AND fr.transaction_date >= '${safeStartDate}'
      AND fr.transaction_date <= '${safeEndDate}'`;

    if (payment_method && payment_method.trim() !== '') {
      const safePaymentMethod = escapeLiteral(payment_method);
      whereClauses += `\n      AND fr.payment_method = '${safePaymentMethod}'`;
    }

    if (resolvedUsers && resolvedUsers.length > 0) {
      const userIds = resolvedUsers.map((u) => `'${escapeLiteral(u.cognito_user_id)}'`).join(', ');
      whereClauses += `\n      AND fr.created_by::text IN (${userIds})`;
    }

    // Build sort clause
    let sortClause = `similarity DESC`;
    if (sort_by === 'amount_desc') sortClause = 'fr.amount DESC';
    else if (sort_by === 'amount_asc') sortClause = 'fr.amount ASC';
    else if (sort_by === 'date_desc') sortClause = 'fr.transaction_date DESC';
    else if (sort_by === 'date_asc') sortClause = 'fr.transaction_date ASC';

    // Main query: embedding similarity + joins + filters
    const mainSql = `
      SELECT
        ue.entity_id,
        ue.embedding_source,
        1 - (ue.embedding <=> ${embeddingVector}) AS similarity,
        fr.amount,
        fr.transaction_date,
        fr.payment_method,
        s.state_text AS description,
        COALESCE(om.full_name, 'Unknown') AS created_by_name
      FROM unified_embeddings ue
      JOIN financial_records fr ON ue.entity_id = fr.id
        AND fr.organization_id = '${safeOrgId}'
      JOIN state_links sl ON sl.entity_id = fr.id AND sl.entity_type = 'financial_record'
      JOIN states s ON s.id = sl.state_id
      LEFT JOIN organization_members om
        ON fr.created_by::text = om.cognito_user_id::text
        AND om.organization_id = fr.organization_id
      WHERE ${whereClauses}
      ORDER BY ${sortClause}
      LIMIT ${resultLimit}
    `;

    // Count query: same WHERE clauses, no LIMIT
    const countSql = `
      SELECT COUNT(*) AS total_count
      FROM unified_embeddings ue
      JOIN financial_records fr ON ue.entity_id = fr.id
        AND fr.organization_id = '${safeOrgId}'
      JOIN state_links sl ON sl.entity_id = fr.id AND sl.entity_type = 'financial_record'
      JOIN states s ON s.id = sl.state_id
      LEFT JOIN organization_members om
        ON fr.created_by::text = om.cognito_user_id::text
        AND om.organization_id = fr.organization_id
      WHERE ${whereClauses}
    `;

    // Execute both queries in parallel
    const [mainResult, countResult] = await Promise.all([
      client.query(mainSql),
      client.query(countSql),
    ]);

    const rows = mainResult.rows;
    const totalCount = parseInt(countResult.rows[0].total_count, 10);

    const results = rows.map((row) => ({
      entity_id: row.entity_id,
      description: row.description,
      amount: parseFloat(row.amount),
      transaction_date: row.transaction_date,
      payment_method: row.payment_method,
      created_by_name: row.created_by_name,
      similarity: parseFloat(row.similarity),
    }));

    const message =
      results.length > 0
        ? `Found ${totalCount} matching financial record${totalCount === 1 ? '' : 's'}${results.length < totalCount ? `, showing top ${results.length}` : ''}`
        : 'No matching financial records found for this query';

    const instructions = results.length > 0
      ? 'You are answering a question about financial records/expenses. Use ONLY the data provided. Show amounts in ₱ (Philippine Peso). When multiple records are returned, calculate totals, averages, or breakdowns as appropriate to answer the question. Group by created_by_name or payment_method when relevant. Always mention the date range covered. If total_count exceeds the number of results shown, mention that more records exist. IMPORTANT: As the LAST line of your answer (inside the <answer> tag, before </answer>), include a <referenced_records> tag containing a JSON array of entity_id values for ONLY the records you actually referenced or used in your analysis. Do not include records you ignored. Example: <referenced_records>["id1","id2"]</referenced_records>'
      : 'No matching financial records were found for this query. Inform the user and suggest they try different search terms or a wider date range.';

    const responseBody = {
      results,
      total_count: totalCount,
      message,
      instructions,
    };

    // Include matched user names when multiple users resolved
    if (resolvedUsers && resolvedUsers.length > 1) {
      responseBody.matched_users = resolvedUsers.map((u) => u.full_name);
    }

    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 200, responseBody);
  } catch (error) {
    console.error('Maxwell expenses error:', error);

    if (error.message && error.message.includes('Embedding generation failed')) {
      return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
        error: 'Failed to generate embedding for the provided query',
      });
    }

    return buildActionGroupResponse(actionGroup, apiPath, httpMethod, 500, {
      error: 'Internal error searching financial records',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};
