const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse, corsResponse } = require('/opt/nodejs/response');
const { getDbClient } = require('/opt/nodejs/db');
const { escapeLiteral } = require('/opt/nodejs/sqlUtils');

const sqs = new SQSClient({ region: 'us-west-2' });
const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-west-2' });
const EMBEDDINGS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';

const { composeAxisEmbeddingSource, composeAxisEntityId, parseAxisEntityId } = require('./axisUtils');

const success = (data) => successResponse({ data });
const error = (message, statusCode = 500) => errorResponse(statusCode, message);

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { httpMethod, path } = event;

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return corsResponse();
  }

  let authContext;
  let organizationId;

  try {
    authContext = getAuthorizerContext(event);
    organizationId = authContext?.organization_id;
  } catch (err) {
    console.error('Error getting authorizer context:', err);
    return error('Authorization context not available', 401);
  }

  if (!organizationId) {
    return error('Organization ID not found', 401);
  }

  try {
    // POST /api/skill-profiles/generate — Generate a skill profile preview (not stored)
    if (httpMethod === 'POST' && path === '/api/skill-profiles/generate') {
      return await handleGenerate(event, organizationId);
    }

    // POST /api/skill-profiles/approve — Approve and store a skill profile + queue embedding
    if (httpMethod === 'POST' && path === '/api/skill-profiles/approve') {
      return await handleApprove(event, organizationId);
    }

    // DELETE /api/skill-profiles/:actionId — Remove a skill profile from an action
    if (httpMethod === 'DELETE' && path.startsWith('/api/skill-profiles/')) {
      const actionId = path.split('/api/skill-profiles/')[1];
      if (!actionId) {
        return error('Action ID is required', 400);
      }
      return await handleDelete(actionId, organizationId);
    }

    return error('Not found', 404);

  } catch (err) {
    console.error('Error:', err);
    return error(err.message, 500);
  }
};

/**
 * POST /api/skill-profiles/generate
 * Generate a skill profile preview from action context. Nothing is persisted.
 * Requirements: 2.1, 2.2, 2.3, 2.7
 */
async function handleGenerate(event, organizationId) {
  const body = JSON.parse(event.body || '{}');
  const { action_id, action_context } = body;

  if (!action_id) {
    return error('action_id is required', 400);
  }

  const ctx = action_context || {};
  const title = (ctx.title || '').trim();
  const description = (ctx.description || '').trim();
  const expectedState = (ctx.expected_state || '').trim();

  // Requirement 2.7: at least one of title, description, or expected_state must be non-empty
  if (!title && !description && !expectedState) {
    return error('Insufficient context to generate skill profile. Add a title, description, or expected state.', 400);
  }

  const prompt = buildSkillProfilePrompt(ctx);

  let profile;
  try {
    profile = await callBedrockForSkillProfile(prompt);
  } catch (err) {
    console.error('Bedrock call failed:', err);
    return error('AI service temporarily unavailable. Please try again.', 503);
  }

  // Validate the AI response structure; retry once with a stricter prompt if malformed
  if (!isValidSkillProfile(profile)) {
    console.warn('First attempt returned malformed profile, retrying with stricter prompt');
    const stricterPrompt = buildSkillProfilePrompt(ctx, true);
    try {
      profile = await callBedrockForSkillProfile(stricterPrompt);
    } catch (err) {
      console.error('Bedrock retry failed:', err);
      return error('AI service temporarily unavailable. Please try again.', 503);
    }

    if (!isValidSkillProfile(profile)) {
      console.error('Second attempt also returned malformed profile:', JSON.stringify(profile));
      return error('Failed to generate valid profile.', 500);
    }
  }

  // Return preview — no approved_at/approved_by, nothing persisted
  return success(profile);
}

/**
 * Build the prompt for Bedrock Claude to generate a skill profile.
 * @param {Object} ctx - Action context
 * @param {boolean} strict - Whether to use a stricter prompt (retry)
 * @returns {string}
 */
function buildSkillProfilePrompt(ctx, strict = false) {
  const parts = [];
  if (ctx.title) parts.push(`Title: ${ctx.title}`);
  if (ctx.description) parts.push(`Description: ${ctx.description}`);
  if (ctx.expected_state) parts.push(`Expected Outcome (S'): ${ctx.expected_state}`);
  if (ctx.policy) parts.push(`Policy: ${ctx.policy}`);
  if (ctx.asset_name) parts.push(`Asset: ${ctx.asset_name}`);
  if (ctx.required_tools && ctx.required_tools.length > 0) {
    parts.push(`Required Tools: ${ctx.required_tools.join(', ')}`);
  }

  const actionContext = parts.join('\n');

  const strictClause = strict
    ? `\nCRITICAL: You MUST return EXACTLY 4 to 6 axes. Each required_level MUST be an INTEGER between 0 and 5 inclusive. Do NOT return fewer than 4 or more than 6 axes. Do NOT return levels outside 0-5. Failure to comply will cause an error.`
    : '';

  return `You are a skill assessment expert. Analyze the following action context and produce a JSON skill requirements profile.

Action Context:
${actionContext}

SKILL LEVEL SCALE (Bloom's Taxonomy — use integers 0-5):
  0 = No exposure needed
  1 = Remember — can recall facts and follow documented procedures
  2 = Understand — can explain why the procedure works, not just how
  3 = Apply — can use knowledge in new situations without step-by-step guidance
  4 = Analyze — can break down problems, evaluate tradeoffs between approaches
  5 = Create — can innovate new approaches, teach others, set standards

Most routine tasks require level 1-2. Tasks requiring judgment or adaptation require level 3. Only specialized or leadership tasks should require level 4-5.

Produce a JSON object with these fields:
1. "narrative": A 2-4 sentence natural language description of what capabilities this action demands.
2. "axes": An array of 4 to 6 skill axes, each with:
   - "key": A snake_case identifier (e.g., "regulatory_navigation")
   - "label": A human-readable label (e.g., "Regulatory Navigation")
   - "required_level": An INTEGER from 0 to 5 using the Bloom's scale above. Be realistic — most axes should be 1-3.
3. "generated_at": The current UTC timestamp in ISO 8601 format.

The axes should be specific to THIS action — different actions should surface different skill dimensions.
${strictClause}
Respond with ONLY the JSON object, no markdown formatting, no code fences, no explanation.`;
}

/**
 * Call Bedrock Claude to generate a skill profile from the prompt.
 * @param {string} prompt
 * @returns {Promise<Object>} Parsed skill profile object
 */
async function callBedrockForSkillProfile(prompt) {
  const MODEL_ID = 'anthropic.claude-3-5-haiku-20241022-v1:0';

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    temperature: 0.4,
    messages: [{ role: 'user', content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json'
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (!responseBody.content?.[0]?.text) {
    throw new Error('Invalid response from Bedrock: missing content');
  }

  const text = responseBody.content[0].text.trim();

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  return JSON.parse(cleaned);
}

/**
 * Validate that a skill profile has the correct structure.
 * - narrative: non-empty string
 * - axes: array of 4-6 objects, each with non-empty key, label, and required_level in [0.0, 1.0]
 * - generated_at: non-empty string
 * @param {Object} profile
 * @returns {boolean}
 */
function isValidSkillProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (typeof profile.narrative !== 'string' || !profile.narrative.trim()) return false;
  if (typeof profile.generated_at !== 'string' || !profile.generated_at.trim()) return false;
  if (!Array.isArray(profile.axes)) return false;
  if (profile.axes.length < 4 || profile.axes.length > 6) return false;

  for (const axis of profile.axes) {
    if (!axis || typeof axis !== 'object') return false;
    if (typeof axis.key !== 'string' || !axis.key.trim()) return false;
    if (typeof axis.label !== 'string' || !axis.label.trim()) return false;
    if (typeof axis.required_level !== 'number') return false;
    if (axis.required_level < 0 || axis.required_level > 5) return false;
  }

  return true;
}

/**
 * POST /api/skill-profiles/approve
 * Approve and store a skill profile, then queue embedding generation.
 * Requirements: 2.5, 2.6, 2.8
 */
async function handleApprove(event, organizationId) {
  const body = JSON.parse(event.body || '{}');
  const { action_id, skill_profile, approved_by } = body;

  if (!action_id) {
    return error('action_id is required', 400);
  }
  if (!approved_by) {
    return error('approved_by is required', 400);
  }
  if (!skill_profile || typeof skill_profile !== 'object') {
    return error('skill_profile is required', 400);
  }

  // Validate profile structure using existing validator
  if (!isValidSkillProfile(skill_profile)) {
    return error('Invalid skill profile structure: requires non-empty narrative, generated_at, and 4-6 axes each with non-empty key, label, and required_level in [0.0, 1.0]', 400);
  }

  // Add approval metadata to the profile
  const approvedProfile = {
    ...skill_profile,
    approved_at: new Date().toISOString(),
    approved_by
  };

  // Store the profile as JSONB in actions.skill_profile
  const db = await getDbClient();
  let updatedAction;
  try {
    const profileJson = escapeLiteral(JSON.stringify(approvedProfile));
    const actionIdSafe = escapeLiteral(action_id);
    const orgIdSafe = escapeLiteral(organizationId);

    const result = await db.query(
      `UPDATE actions SET skill_profile = '${profileJson}'::jsonb, updated_at = NOW() WHERE id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}' RETURNING id, organization_id`
    );

    if (!result.rows || result.rows.length === 0) {
      return error('Action not found', 404);
    }

    updatedAction = result.rows[0];
  } finally {
    db.release();
  }

  // Delete existing skill_axis embeddings for this action before generating new ones
  const deleteDb = await getDbClient();
  try {
    const actionIdPattern = escapeLiteral(updatedAction.id + ':%');
    await deleteDb.query(
      `DELETE FROM unified_embeddings WHERE entity_type = 'skill_axis' AND entity_id LIKE '${actionIdPattern}'`
    );
    console.log('Deleted existing skill_axis embeddings for action', updatedAction.id);
  } catch (err) {
    console.error('Failed to delete existing skill_axis embeddings:', err);
  } finally {
    deleteDb.release();
  }

  // Generate per-axis embedding SQS messages — await all sends
  const axisEmbeddingPromises = approvedProfile.axes.map(axis => {
    const entityId = composeAxisEntityId(updatedAction.id, axis.key);
    const embeddingSource = composeAxisEmbeddingSource(axis, approvedProfile.narrative);

    return sqs.send(new SendMessageCommand({
      QueueUrl: EMBEDDINGS_QUEUE_URL,
      MessageBody: JSON.stringify({
        entity_type: 'skill_axis',
        entity_id: entityId,
        embedding_source: embeddingSource,
        organization_id: updatedAction.organization_id
      })
    })).then(() => {
      console.log('Queued skill_axis embedding:', entityId);
    }).catch(err => {
      console.error('Failed to queue skill_axis embedding:', entityId, err);
    });
  });

  await Promise.all(axisEmbeddingPromises);

  // Retain existing action_skill_profile embedding for backward compatibility
  const axisLabels = approvedProfile.axes.map(a => a.label).join(', ');
  const wholeProfileEmbeddingSource = `${approvedProfile.narrative} ${axisLabels}`;

  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: EMBEDDINGS_QUEUE_URL,
      MessageBody: JSON.stringify({
        entity_type: 'action_skill_profile',
        entity_id: updatedAction.id,
        embedding_source: wholeProfileEmbeddingSource,
        organization_id: updatedAction.organization_id
      })
    }));
    console.log('Queued action_skill_profile embedding for action', updatedAction.id);
  } catch (err) {
    console.error('Failed to queue action_skill_profile embedding:', err);
  }

  return success(approvedProfile);
}

/**
 * DELETE /api/skill-profiles/:actionId
 * Remove a skill profile from an action and delete its embedding.
 * Requirements: 2.4
 */
async function handleDelete(actionId, organizationId) {
  const db = await getDbClient();
  try {
    const actionIdSafe = escapeLiteral(actionId);
    const orgIdSafe = escapeLiteral(organizationId);

    // 1. Set skill_profile to NULL on the action
    const result = await db.query(
      `UPDATE actions SET skill_profile = NULL, updated_at = NOW() WHERE id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}' RETURNING id`
    );

    if (!result.rows || result.rows.length === 0) {
      return error('Action not found', 404);
    }

    // 2. Delete the corresponding action_skill_profile entry from unified_embeddings
    await db.query(
      `DELETE FROM unified_embeddings WHERE entity_type = 'action_skill_profile' AND entity_id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}'`
    );

    return success({ deleted: true, action_id: actionId });
  } finally {
    db.release();
  }
}

// Export utility functions for testing
exports.composeAxisEmbeddingSource = composeAxisEmbeddingSource;
exports.composeAxisEntityId = composeAxisEntityId;
exports.parseAxisEntityId = parseAxisEntityId;
