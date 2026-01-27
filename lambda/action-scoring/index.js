/**
 * Action Scoring Lambda
 * 
 * Generates accountability scores for actions using AWS Bedrock (Claude Haiku).
 * 
 * Endpoints:
 * - POST /action-scoring/generate: Generate scores for an action
 * 
 * Features:
 * - Auto-save mode: Saves scores directly to database
 * - Review mode: Returns scores for user review before saving
 * - Uses default prompt or user-specified prompt
 * - Organization-scoped (via Lambda authorizer)
 */

const { Pool } = require('pg');
const {
  buildScoringPrompt,
  generateScoresWithBedrock,
  parseAndValidateScores
} = require('./shared/action-scoring');

// Database connection
const pool = new Pool({
  host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 2, // Limit connections for Lambda
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

/**
 * Query database with error handling
 */
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Fetch action with joined data (asset, issue, assignee)
 */
async function fetchAction(actionId, organizationId) {
  const sql = `
    SELECT 
      a.*,
      json_build_object(
        'full_name', p.full_name
      ) as assignee,
      json_build_object(
        'id', t.id,
        'name', t.name,
        'category', t.category,
        'storage_location', t.storage_location,
        'serial_number', t.serial_number
      ) as asset,
      json_build_object(
        'description', i.description,
        'issue_type', i.issue_type,
        'status', i.status,
        'reported_at', i.reported_at,
        'damage_assessment', i.damage_assessment,
        'efficiency_loss_percentage', i.efficiency_loss_percentage,
        'root_cause', i.root_cause,
        'resolution_notes', i.resolution_notes
      ) as linked_issue
    FROM actions a
    LEFT JOIN profiles p ON a.assigned_to = p.user_id
    LEFT JOIN tools t ON a.asset_id = t.id
    LEFT JOIN issues i ON a.linked_issue_id = i.id
    WHERE a.id = $1 AND a.organization_id = $2
  `;

  const rows = await query(sql, [actionId, organizationId]);
  
  if (rows.length === 0) {
    return null;
  }

  const action = rows[0];
  
  // Clean up null JSON objects
  if (action.asset && !action.asset.id) {
    action.asset = null;
  }
  if (action.linked_issue && !action.linked_issue.description) {
    action.linked_issue = null;
  }
  if (action.assignee && !action.assignee.full_name) {
    action.assignee = null;
  }

  return action;
}

/**
 * Fetch scoring prompt (default or specified)
 */
async function fetchPrompt(promptId, organizationId) {
  let sql, params;
  
  if (promptId) {
    // Fetch specific prompt
    sql = `
      SELECT * FROM scoring_prompts 
      WHERE id = $1 AND organization_id = $2
    `;
    params = [promptId, organizationId];
  } else {
    // Fetch default prompt
    sql = `
      SELECT * FROM scoring_prompts 
      WHERE is_default = true AND organization_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    params = [organizationId];
  }

  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Save scores to database
 */
async function saveScores(actionId, promptId, promptText, scores, aiResponse, rootCauses, assetContextId, assetContextName, organizationId) {
  // Check if score already exists for this action
  const existingRows = await query(
    'SELECT id FROM action_scores WHERE action_id = $1 AND source_type = $2',
    [actionId, 'action']
  );

  if (existingRows.length > 0) {
    // Update existing score
    const sql = `
      UPDATE action_scores
      SET 
        prompt_id = $1,
        prompt_text = $2,
        scores = $3,
        ai_response = $4,
        likely_root_causes = $5,
        asset_context_id = $6,
        asset_context_name = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;
    
    const rows = await query(sql, [
      promptId,
      promptText,
      JSON.stringify(scores),
      JSON.stringify(aiResponse),
      JSON.stringify(rootCauses),
      assetContextId,
      assetContextName,
      existingRows[0].id
    ]);
    
    return rows[0];
  } else {
    // Insert new score
    const sql = `
      INSERT INTO action_scores (
        action_id,
        source_type,
        source_id,
        prompt_id,
        prompt_text,
        scores,
        ai_response,
        likely_root_causes,
        asset_context_id,
        asset_context_name,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;
    
    const rows = await query(sql, [
      actionId,
      'action',
      actionId,
      promptId,
      promptText,
      JSON.stringify(scores),
      JSON.stringify(aiResponse),
      JSON.stringify(rootCauses),
      assetContextId,
      assetContextName
    ]);
    
    return rows[0];
  }
}

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get organization_id from authorizer context
    const organizationId = event.requestContext?.authorizer?.organization_id;
    if (!organizationId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: missing organization context' })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { action_id, prompt_id, auto_save = false } = body;

    // Validate required fields
    if (!action_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required field: action_id' })
      };
    }

    // Fetch action
    console.log('Fetching action:', action_id);
    const action = await fetchAction(action_id, organizationId);
    
    if (!action) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Action not found' })
      };
    }

    // Fetch prompt
    console.log('Fetching prompt:', prompt_id || 'default');
    const prompt = await fetchPrompt(prompt_id, organizationId);
    
    if (!prompt) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: prompt_id 
            ? 'Scoring prompt not found' 
            : 'No default scoring prompt found. Please create a default prompt first.'
        })
      };
    }

    // Build prompt
    console.log('Building scoring prompt');
    const fullPrompt = buildScoringPrompt(action, prompt);

    // Call Bedrock
    console.log('Calling Bedrock for scoring');
    const responseText = await generateScoresWithBedrock(fullPrompt);

    // Parse and validate response
    console.log('Parsing AI response');
    const { scores, likely_root_causes, raw } = parseAndValidateScores(responseText);

    // Prepare response data
    const responseData = {
      scores,
      likely_root_causes,
      ai_response: raw,
      prompt_id: prompt.id,
      prompt_text: prompt.prompt_text,
      asset_context_id: action.asset?.id || null,
      asset_context_name: action.asset?.name || null
    };

    // Auto-save if requested
    if (auto_save) {
      console.log('Auto-saving scores to database');
      await saveScores(
        action_id,
        prompt.id,
        prompt.prompt_text,
        scores,
        raw,
        likely_root_causes,
        action.asset?.id || null,
        action.asset?.name || null,
        organizationId
      );
      responseData.saved = true;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: responseData
      })
    };

  } catch (error) {
    console.error('Error generating scores:', error);

    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.message.includes('Bedrock')) {
      statusCode = 503;
      errorMessage = 'AI service error';
    } else if (error.message.includes('Invalid JSON') || error.message.includes('Invalid response')) {
      statusCode = 422;
      errorMessage = error.message;
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'AI service timeout';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
