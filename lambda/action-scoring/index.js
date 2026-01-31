/**
 * Action Scoring Lambda
 * 
 * Handles AI-powered analysis and scoring with new normalized schema.
 * 
 * Endpoints:
 * - POST /action-scoring/generate: Run AI prompt (no save)
 * - GET /action-scoring/analyses: List analyses
 * - POST /action-scoring/analyses: Create analysis with scores
 * - GET /action-scoring/analyses/{id}: Get single analysis
 * - GET /action-scoring/prompts: List scoring prompts
 */

const { Client } = require('pg');
const { generateScoresWithBedrock } = require('./shared/action-scoring');
const { getAuthorizerContext } = require('./shared/authorizerContext');

const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

const escapeLiteral = (value = '') => String(value).replace(/'/g, "''");

async function queryJSON(sql) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end();
  }
}

exports.handler = async (event) => {
  console.log('🔍 Event:', JSON.stringify(event, null, 2));

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { httpMethod, path } = event;
  const authContext = getAuthorizerContext(event);
  const organizationId = authContext.organization_id;

  console.log('🔐 Auth context:', { organizationId, userId: authContext.cognito_user_id });

  try {
    // POST /action-scoring/generate - Run AI prompt only
    if (httpMethod === 'POST' && path.endsWith('/generate')) {
      const body = JSON.parse(event.body || '{}');
      const { prompt, model = 'haiku' } = body;

      if (!prompt) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'prompt required' }) };
      }

      console.log('🤖 Calling Bedrock with model:', model);
      const aiResponse = await generateScoresWithBedrock(prompt, model);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: { ai_response: aiResponse } })
      };
    }

    // GET /action-scoring/analyses - List analyses
    if (httpMethod === 'GET' && path.endsWith('/analyses')) {
      const { context_service, context_id, start_date, end_date } = event.queryStringParameters || {};
      let whereConditions = [`a.organization_id::text = '${escapeLiteral(organizationId)}'`];

      if (context_service) whereConditions.push(`ac.context_service = '${escapeLiteral(context_service)}'`);
      if (context_id) whereConditions.push(`ac.context_id = '${escapeLiteral(context_id)}'`);
      if (start_date) whereConditions.push(`a.created_at >= '${start_date}'`);
      if (end_date) whereConditions.push(`a.created_at <= '${end_date}'`);

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          a.*,
          (SELECT json_agg(json_build_object('score_name', s.score_name, 'score', s.score, 'reason', s.reason, 'how_to_improve', s.how_to_improve))
           FROM analysis_scores s WHERE s.analysis_id = a.id) as scores,
          (SELECT json_agg(json_build_object('attribute_name', attr.attribute_name, 'attribute_values', attr.attribute_values))
           FROM analysis_attributes attr WHERE attr.analysis_id = a.id) as attributes,
          (SELECT json_agg(json_build_object('context_service', ctx.context_service, 'context_id', ctx.context_id))
           FROM analysis_contexts ctx WHERE ctx.analysis_id = a.id) as contexts
        FROM analyses a
        LEFT JOIN analysis_contexts ac ON ac.analysis_id = a.id
        ${whereClause}
        ORDER BY a.created_at DESC
      ) t;`;

      const result = await queryJSON(sql);
      return { statusCode: 200, headers, body: JSON.stringify({ data: result?.[0]?.json_agg || [] }) };
    }

    // POST /action-scoring/analyses - Create analysis
    if (httpMethod === 'POST' && path.endsWith('/analyses')) {
      const body = JSON.parse(event.body || '{}');
      const { prompt_id, ai_response, scores, attributes, contexts } = body;

      if (!prompt_id || !scores || !Array.isArray(scores)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'prompt_id and scores array required' }) };
      }

      const userId = authContext.cognito_user_id;
      const client = new Client(dbConfig);

      try {
        await client.connect();
        await client.query('BEGIN');

        // Insert analysis
        const analysisSql = `INSERT INTO analyses (organization_id, created_by, prompt_id, ai_response, created_at, updated_at)
          VALUES ('${organizationId}', ${userId ? `'${userId}'` : 'NULL'}, '${prompt_id}', 
                  ${ai_response ? `'${escapeLiteral(JSON.stringify(ai_response))}'::jsonb` : 'NULL'}, NOW(), NOW())
          RETURNING id;`;
        const analysisResult = await client.query(analysisSql);
        const analysisId = analysisResult.rows[0].id;

        // Insert scores
        for (const score of scores) {
          const scoreSql = `INSERT INTO analysis_scores (analysis_id, score_name, score, reason, how_to_improve, created_at, updated_at)
            VALUES ('${analysisId}', '${escapeLiteral(score.score_name)}', ${score.score}, '${escapeLiteral(score.reason)}', 
                    ${score.how_to_improve ? `'${escapeLiteral(score.how_to_improve)}'` : 'NULL'}, NOW(), NOW());`;
          await client.query(scoreSql);
        }

        // Insert attributes
        if (attributes && Array.isArray(attributes)) {
          for (const attr of attributes) {
            const values = attr.attribute_values.map(v => `'${escapeLiteral(v)}'`).join(',');
            const attrSql = `INSERT INTO analysis_attributes (analysis_id, attribute_name, attribute_values, created_at, updated_at)
              VALUES ('${analysisId}', '${escapeLiteral(attr.attribute_name)}', ARRAY[${values}], NOW(), NOW());`;
            await client.query(attrSql);
          }
        }

        // Insert contexts
        if (contexts && Array.isArray(contexts)) {
          for (const ctx of contexts) {
            const ctxSql = `INSERT INTO analysis_contexts (analysis_id, context_service, context_id, created_at)
              VALUES ('${analysisId}', '${escapeLiteral(ctx.context_service)}', '${escapeLiteral(ctx.context_id)}', NOW());`;
            await client.query(ctxSql);
          }
        }

        await client.query('COMMIT');

        // Fetch complete analysis
        const fetchSql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT a.*, 
            (SELECT json_agg(json_build_object('score_name', s.score_name, 'score', s.score, 'reason', s.reason, 'how_to_improve', s.how_to_improve))
             FROM analysis_scores s WHERE s.analysis_id = a.id) as scores,
            (SELECT json_agg(json_build_object('attribute_name', attr.attribute_name, 'attribute_values', attr.attribute_values))
             FROM analysis_attributes attr WHERE attr.analysis_id = a.id) as attributes,
            (SELECT json_agg(json_build_object('context_service', ctx.context_service, 'context_id', ctx.context_id))
             FROM analysis_contexts ctx WHERE ctx.analysis_id = a.id) as contexts
          FROM analyses a WHERE a.id = '${analysisId}'
        ) t;`;

        const result = await queryJSON(fetchSql);
        return { statusCode: 201, headers, body: JSON.stringify({ data: result?.[0]?.json_agg?.[0] || null }) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        await client.end();
      }
    }

    // GET /action-scoring/analyses/{id} - Get single analysis
    if (httpMethod === 'GET' && path.match(/\/analyses\/[a-f0-9-]+$/)) {
      const analysisId = path.split('/').pop();
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT a.*,
          (SELECT json_agg(json_build_object('score_name', s.score_name, 'score', s.score, 'reason', s.reason, 'how_to_improve', s.how_to_improve))
           FROM analysis_scores s WHERE s.analysis_id = a.id) as scores,
          (SELECT json_agg(json_build_object('attribute_name', attr.attribute_name, 'attribute_values', attr.attribute_values))
           FROM analysis_attributes attr WHERE attr.analysis_id = a.id) as attributes,
          (SELECT json_agg(json_build_object('context_service', ctx.context_service, 'context_id', ctx.context_id))
           FROM analysis_contexts ctx WHERE ctx.analysis_id = a.id) as contexts
        FROM analyses a
        WHERE a.id = '${escapeLiteral(analysisId)}' AND a.organization_id::text = '${escapeLiteral(organizationId)}'
      ) t;`;

      const result = await queryJSON(sql);
      const analysis = result?.[0]?.json_agg?.[0];
      if (!analysis) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Analysis not found' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ data: analysis }) };
    }

    // GET /action-scoring/prompts - List scoring prompts
    if (httpMethod === 'GET' && path.endsWith('/prompts')) {
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM scoring_prompts ORDER BY created_at DESC
      ) t;`;
      const result = await queryJSON(sql);
      return { statusCode: 200, headers, body: JSON.stringify({ data: result?.[0]?.json_agg || [] }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
