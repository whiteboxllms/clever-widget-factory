const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse, corsResponse } = require('/opt/nodejs/response');
const { getDbClient } = require('/opt/nodejs/db');
const { escapeLiteral } = require('/opt/nodejs/sqlUtils');
const { composeStateEmbeddingSource } = require('/opt/nodejs/embedding-composition');

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-west-2' });
const sqs = new SQSClient({ region: 'us-west-2' });
const EMBEDDINGS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';

const OBJECTIVE_MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0';

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
    // Route dispatch based on HTTP method and path segments
    const segments = path.replace('/api/learning/', '').split('/');

    // GET /api/learning/:actionId/:userId/objectives
    if (httpMethod === 'GET' && segments.length === 3 && segments[2] === 'objectives') {
      const actionId = segments[0];
      const userId = segments[1];
      return await handleGetObjectives(actionId, userId, organizationId);
    }

    // POST /api/learning/:actionId/quiz/generate
    if (httpMethod === 'POST' && segments.length === 3 && segments[1] === 'quiz' && segments[2] === 'generate') {
      const actionId = segments[0];
      const body = JSON.parse(event.body || '{}');
      return await handleQuizGenerate(actionId, body, organizationId);
    }

    // POST /api/learning/:actionId/verify
    if (httpMethod === 'POST' && segments.length === 2 && segments[1] === 'verify') {
      const actionId = segments[0];
      const body = JSON.parse(event.body || '{}');
      return await handleVerify(actionId, body, organizationId);
    }

    return error('Not found', 404);

  } catch (err) {
    console.error('Error:', err);
    return error(err.message, 500);
  }
};

/**
 * GET /api/learning/:actionId/:userId/objectives
 * Get or generate learning objectives for a user's gap axes on an action.
 * Requirements: 3.5.1, 3.5.2, 3.5.3, 3.5.4, 3.5.9, 5.1, 5.5
 */
async function handleGetObjectives(actionId, userId, organizationId) {
  const db = await getDbClient();
  try {
    const actionIdSafe = escapeLiteral(actionId);
    const userIdSafe = escapeLiteral(userId);
    const orgIdSafe = escapeLiteral(organizationId);

    // 1. Fetch action with skill_profile; return 404 if no approved profile
    const actionResult = await db.query(
      `SELECT id, title, description, expected_state, skill_profile
       FROM actions
       WHERE id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}'`
    );

    if (!actionResult.rows || actionResult.rows.length === 0) {
      return error('Action not found', 404);
    }

    const action = actionResult.rows[0];
    const skillProfile = action.skill_profile;

    if (!skillProfile || !skillProfile.approved_at) {
      return error('No approved skill profile found for this action', 404);
    }

    // 2. Build axes from the skill profile — treat all axes as potential learning axes.
    //    The frontend determines which are gaps based on the capability Lambda's data.
    //    The learning Lambda generates objectives for any axis that doesn't already have them.
    const allAxes = skillProfile.axes.map(axis => ({
      axisKey: axis.key,
      axisLabel: axis.label,
      requiredLevel: Math.max(0, Math.min(5, Math.round(axis.required_level))),
      currentLevel: 0 // Placeholder — frontend uses capability Lambda for actual levels
    }));

    // 4. Check for existing learning objective states for this action + user
    const existingObjectivesResult = await db.query(
      `SELECT s.id, s.state_text, s.captured_at
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id
       WHERE sl.entity_type = 'action' AND sl.entity_id = '${actionIdSafe}'
         AND s.organization_id = '${orgIdSafe}'
         AND s.state_text LIKE '[learning_objective]%'
         AND s.state_text LIKE '%user=${userIdSafe}%'
       ORDER BY s.captured_at ASC`
    );

    // Group existing objectives by axis key
    const existingByAxis = {};
    for (const row of existingObjectivesResult.rows) {
      const parsed = parseLearningObjectiveStateText(row.state_text);
      if (parsed) {
        if (!existingByAxis[parsed.axisKey]) {
          existingByAxis[parsed.axisKey] = [];
        }
        existingByAxis[parsed.axisKey].push({
          id: row.id,
          text: parsed.objectiveText,
          axisKey: parsed.axisKey
        });
      }
    }

    // 5. For each axis without existing objectives, generate via Bedrock
    const axesNeedingGeneration = allAxes.filter(
      (axis) => !existingByAxis[axis.axisKey] || existingByAxis[axis.axisKey].length === 0
    );

    if (axesNeedingGeneration.length > 0) {
      const generatedObjectives = await generateObjectivesViaBedrock(
        action, skillProfile, axesNeedingGeneration
      );

      // Store each generated objective as a state with state_links
      for (const obj of generatedObjectives) {
        const stateText = composeLearningObjectiveStateText(
          obj.axisKey, actionId, userId, obj.text
        );

        await db.query('BEGIN');
        try {
          const insertResult = await db.query(
            `INSERT INTO states (organization_id, state_text, captured_by, captured_at)
             VALUES ('${orgIdSafe}', '${escapeLiteral(stateText)}', '${userIdSafe}', NOW())
             RETURNING id`
          );
          const stateId = insertResult.rows[0].id;

          // Create state_link to the action
          await db.query(
            `INSERT INTO state_links (state_id, entity_type, entity_id)
             VALUES ('${escapeLiteral(stateId)}', 'action', '${actionIdSafe}')`
          );

          await db.query('COMMIT');

          // Track the new objective
          if (!existingByAxis[obj.axisKey]) {
            existingByAxis[obj.axisKey] = [];
          }
          existingByAxis[obj.axisKey].push({
            id: stateId,
            text: obj.text,
            axisKey: obj.axisKey
          });

          // 6. Queue embedding for each new objective state via SQS (fire-and-forget)
          queueObjectiveEmbedding(stateId, stateText, organizationId)
            .catch(err => console.error('Failed to queue objective embedding:', err));
        } catch (insertErr) {
          await db.query('ROLLBACK');
          throw insertErr;
        }
      }
    }

    // 7. Fetch knowledge states for evidence tagging
    //    Knowledge states are linked to learning objectives via state_links entity_type='learning_objective'
    const allObjectiveIds = [];
    for (const objectives of Object.values(existingByAxis)) {
      for (const obj of objectives) {
        allObjectiveIds.push(obj.id);
      }
    }

    let knowledgeStatesByObjective = {};
    if (allObjectiveIds.length > 0) {
      const objectiveIdsList = allObjectiveIds.map(id => `'${escapeLiteral(id)}'`).join(',');
      const knowledgeResult = await db.query(
        `SELECT sl.entity_id as objective_id, s.state_text
         FROM states s
         INNER JOIN state_links sl ON sl.state_id = s.id
         WHERE sl.entity_type = 'learning_objective'
           AND sl.entity_id IN (${objectiveIdsList})
           AND s.organization_id = '${orgIdSafe}'
         ORDER BY s.captured_at ASC`
      );

      for (const row of knowledgeResult.rows) {
        if (!knowledgeStatesByObjective[row.objective_id]) {
          knowledgeStatesByObjective[row.objective_id] = [];
        }
        knowledgeStatesByObjective[row.objective_id].push(row.state_text);
      }
    }

    // 8. Fetch capability evidence for 'some_evidence' tagging
    //    Check if the action has an action_skill_profile embedding for evidence search
    const evidenceObjectiveIds = await fetchEvidenceObjectiveIds(db, actionIdSafe, orgIdSafe, allObjectiveIds);

    // 9. Build response grouped by axis
    const axes = allAxes.map((gap) => {
      const objectives = (existingByAxis[gap.axisKey] || []).map((obj) => {
        const knowledgeStates = knowledgeStatesByObjective[obj.id] || [];
        const { status, completionType } = deriveObjectiveStatusFromStates(knowledgeStates);
        const evidenceTag = tagObjectiveEvidence(obj.id, knowledgeStates, evidenceObjectiveIds);

        return {
          id: obj.id,
          text: obj.text,
          evidenceTag,
          status,
          completionType
        };
      });

      return {
        axisKey: gap.axisKey,
        axisLabel: gap.axisLabel,
        requiredLevel: gap.requiredLevel,
        currentLevel: gap.currentLevel,
        objectives
      };
    });

    return success({ axes });
  } finally {
    db.release();
  }
}

/**
 * Fetch capability levels for a user on an action's skill axes.
 * Uses a lightweight approach: checks for existing capability evidence
 * via the action_skill_profile embedding similarity search, then uses
 * Bedrock to score if evidence exists. Falls back to zero levels if
 * no embedding or evidence is found.
 */
async function fetchCapabilityLevels(db, actionIdSafe, userIdSafe, orgIdSafe, skillProfile) {
  const levels = {};
  for (const axis of skillProfile.axes) {
    levels[axis.key] = 0;
  }

  try {
    // Check for action_skill_profile embedding
    const embeddingResult = await db.query(
      `SELECT embedding FROM unified_embeddings
       WHERE entity_type = 'action_skill_profile'
         AND entity_id = '${actionIdSafe}'
         AND organization_id = '${orgIdSafe}'
       LIMIT 1`
    );

    if (!embeddingResult.rows || embeddingResult.rows.length === 0) {
      // No embedding yet — return zero levels
      return levels;
    }

    const skillProfileEmbedding = embeddingResult.rows[0].embedding;

    // Vector similarity search for observation evidence
    const OBSERVATION_LIMIT = 50;
    const observationSearchResult = await db.query(
      `SELECT entity_id,
              (1 - (embedding <=> '${skillProfileEmbedding}'::vector)) as similarity
       FROM unified_embeddings
       WHERE entity_type = 'state'
         AND organization_id = '${orgIdSafe}'
       ORDER BY embedding <=> '${skillProfileEmbedding}'::vector
       LIMIT ${OBSERVATION_LIMIT}`
    );

    const candidateStateIds = observationSearchResult.rows.map(r => r.entity_id);
    if (candidateStateIds.length === 0) {
      return levels;
    }

    // Filter to observations linked to actions where the target user is involved
    const stateIdsList = candidateStateIds.map(id => `'${escapeLiteral(id)}'`).join(',');
    const filteredResult = await db.query(
      `SELECT DISTINCT s.id as state_id, s.state_text, s.captured_at,
              a.title as action_title
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id AND sl.entity_type = 'action'
       INNER JOIN actions a ON a.id = sl.entity_id
       WHERE s.id IN (${stateIdsList})
         AND s.organization_id = '${orgIdSafe}'
         AND (
           a.assigned_to = '${userIdSafe}'
           OR a.created_by = '${userIdSafe}'
           OR '${userIdSafe}' = ANY(a.participants)
         )`
    );

    if (filteredResult.rows.length === 0) {
      return levels;
    }

    // Build similarity map
    const similarityMap = {};
    for (const row of observationSearchResult.rows) {
      similarityMap[row.entity_id] = parseFloat(row.similarity);
    }

    // Build evidence list for Bedrock
    const allEvidence = filteredResult.rows.map(obs => {
      const recencyWeight = computeRecencyWeight(obs.captured_at);
      const relevanceScore = (similarityMap[obs.state_id] || 0) * recencyWeight;
      return {
        observation_id: obs.state_id,
        action_title: obs.action_title || '',
        text_excerpt: (obs.state_text || '').substring(0, 500),
        captured_at: obs.captured_at,
        relevance_score: Math.round(relevanceScore * 100) / 100
      };
    });

    allEvidence.sort((a, b) => b.relevance_score - a.relevance_score);

    // Call Bedrock for lightweight capability scoring
    const capabilityResult = await callBedrockForCapabilityLevels(skillProfile, allEvidence);

    for (const axisResult of capabilityResult.axes) {
      if (levels.hasOwnProperty(axisResult.key)) {
        levels[axisResult.key] = Math.max(0, Math.min(5, Math.round(axisResult.level)));
      }
    }
  } catch (err) {
    console.error('Error fetching capability levels, defaulting to zero:', err);
  }

  return levels;
}

/**
 * Call Bedrock to get lightweight capability level scores.
 * Similar to the capability Lambda's approach but returns only levels.
 */
async function callBedrockForCapabilityLevels(skillProfile, evidence) {
  const axesDescription = skillProfile.axes.map(a =>
    `- ${a.key} ("${a.label}"): required level ${a.required_level}`
  ).join('\n');

  const evidenceSummary = evidence.slice(0, 20).map((e, i) =>
    `${i + 1}. Action: "${e.action_title}" | Text: ${e.text_excerpt}`
  ).join('\n');

  const prompt = `You are a skill assessment expert. Analyze the evidence and score each skill axis on Bloom's taxonomy (0-5 integers).

SKILL LEVEL SCALE:
  0 = No exposure, 1 = Remember, 2 = Understand, 3 = Apply, 4 = Analyze, 5 = Create

AXES:
${axesDescription}

EVIDENCE:
${evidenceSummary || 'No evidence available.'}

Return ONLY a JSON object with:
{ "axes": [{ "key": "<axis_key>", "level": <integer 0-5> }] }

No markdown, no code fences, no explanation.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 500,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: OBJECTIVE_MODEL_ID,
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
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Failed to parse Bedrock capability levels response:', text);
    return { axes: skillProfile.axes.map(a => ({ key: a.key, level: 0 })) };
  }
}

/**
 * Generate learning objectives for gap axes via Bedrock Sonnet.
 * Returns an array of { axisKey, text } objects.
 */
async function generateObjectivesViaBedrock(action, skillProfile, gapAxes) {
  const gapAxesDescription = gapAxes.map(g => {
    const skillAxis = skillProfile.axes.find(a => a.key === g.axisKey);
    return `- ${g.axisKey} ("${g.axisLabel}"): current level ${g.currentLevel}, required level ${g.requiredLevel}${skillAxis?.description ? `, description: ${skillAxis.description}` : ''}`;
  }).join('\n');

  const prompt = `You are a learning design expert. Generate specific learning objectives for a person who needs to close skill gaps before performing an action.

ACTION CONTEXT:
- Title: ${action.title || 'Untitled'}
- Description: ${action.description || 'No description'}
- Expected Outcome (S'): ${action.expected_state || 'Not specified'}

SKILL PROFILE NARRATIVE:
${skillProfile.narrative || 'No narrative available.'}

GAP AXES (person needs to improve on these):
${gapAxesDescription}

INSTRUCTIONS:
- For each gap axis, generate 3-6 learning objectives
- Each objective should describe what the person needs to UNDERSTAND (Bloom's level 2) — focus on "why" rather than "how to"
- Use the action's expected outcome (S') as the primary driver — what does the person need to understand to achieve the desired outcome?
- Objectives should be specific, measurable, and relevant to the action context
- Write objectives as clear, concise statements starting with an action verb (e.g., "Understand why...", "Explain how...", "Identify the relationship between...")

Return ONLY a JSON object with:
{
  "objectives": [
    { "axisKey": "<axis_key>", "text": "<objective text>" }
  ]
}

No markdown, no code fences, no explanation.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: OBJECTIVE_MODEL_ID,
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
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    // Validate and filter to only requested axes
    const validAxisKeys = new Set(gapAxes.map(g => g.axisKey));
    return (parsed.objectives || []).filter(obj =>
      obj.axisKey && obj.text && validAxisKeys.has(obj.axisKey)
    );
  } catch (parseErr) {
    console.error('Failed to parse Bedrock objectives response:', text);
    // Return a minimal fallback objective per axis
    return gapAxes.map(g => ({
      axisKey: g.axisKey,
      text: `Understand the key concepts of ${g.axisLabel} required for this action`
    }));
  }
}

/**
 * Compose a learning objective state_text in the canonical format.
 * Mirrors the frontend composeLearningObjectiveStateText function.
 */
function composeLearningObjectiveStateText(axisKey, actionId, userId, objectiveText) {
  return `[learning_objective] axis=${axisKey} action=${actionId} user=${userId} | ${objectiveText}`;
}

/**
 * Parse a learning objective state_text, extracting axis key, action ID, user ID, and text.
 * Returns null if format doesn't match.
 */
function parseLearningObjectiveStateText(stateText) {
  const match = stateText.match(
    /^\[learning_objective\] axis=(\S+) action=(\S+) user=(\S+) \| (.+)$/
  );
  if (!match) return null;
  return {
    axisKey: match[1],
    actionId: match[2],
    userId: match[3],
    objectiveText: match[4]
  };
}

/**
 * Queue embedding generation for a new learning objective state via SQS.
 * Uses the same pipeline as the states Lambda.
 */
async function queueObjectiveEmbedding(stateId, stateText, organizationId) {
  const embeddingSource = composeStateEmbeddingSource({
    entity_names: [],
    state_text: stateText,
    photo_descriptions: [],
    metrics: []
  });

  if (!embeddingSource || !embeddingSource.trim()) {
    console.log('Empty embedding source for objective state', stateId, '— skipping SQS send');
    return;
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: EMBEDDINGS_QUEUE_URL,
    MessageBody: JSON.stringify({
      entity_type: 'state',
      entity_id: stateId,
      embedding_source: embeddingSource,
      organization_id: organizationId
    })
  }));

  console.log('Queued embedding for objective state', stateId);
}

/**
 * Derive objective status and completion type from knowledge state texts.
 * Mirrors the frontend deriveObjectiveStatus logic.
 */
function deriveObjectiveStatusFromStates(knowledgeStateTexts) {
  if (knowledgeStateTexts.length === 0) {
    return { status: 'not_started', completionType: null };
  }

  // Check for correct first-attempt quiz answer
  for (const text of knowledgeStateTexts) {
    if (text.includes('which was the correct answer')) {
      return { status: 'completed', completionType: 'quiz' };
    }
  }

  // Check for demonstration
  for (const text of knowledgeStateTexts) {
    if (text.startsWith('Demonstrated learning objective')) {
      return { status: 'completed', completionType: 'demonstrated' };
    }
  }

  return { status: 'in_progress', completionType: null };
}

/**
 * Tag an objective with evidence level based on knowledge states and capability evidence.
 * Returns 'previously_correct', 'some_evidence', or 'no_evidence'.
 */
function tagObjectiveEvidence(objectiveId, knowledgeStateTexts, evidenceObjectiveIds) {
  // Check for correct first-attempt answer in knowledge states
  for (const text of knowledgeStateTexts) {
    if (text.includes('which was the correct answer')) {
      return 'previously_correct';
    }
  }

  // Check if capability evidence exists for this objective
  if (evidenceObjectiveIds.has(objectiveId)) {
    return 'some_evidence';
  }

  return 'no_evidence';
}

/**
 * Fetch objective IDs that have some capability evidence (observations linked to the action).
 * Returns a Set of objective IDs that have related evidence.
 */
async function fetchEvidenceObjectiveIds(db, actionIdSafe, orgIdSafe, allObjectiveIds) {
  const evidenceSet = new Set();

  if (allObjectiveIds.length === 0) {
    return evidenceSet;
  }

  try {
    // Check if there are any observations linked to this action
    // If observations exist, we consider objectives on those axes as having "some_evidence"
    const observationResult = await db.query(
      `SELECT COUNT(*) as count
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id
       WHERE sl.entity_type = 'action' AND sl.entity_id = '${actionIdSafe}'
         AND s.organization_id = '${orgIdSafe}'
         AND s.state_text NOT LIKE '[learning_objective]%'`
    );

    const hasObservations = parseInt(observationResult.rows[0].count) > 0;

    if (hasObservations) {
      // If there are observations linked to this action, mark all objectives as having some evidence
      // This is a simplified heuristic — the capability Lambda does the full semantic matching
      for (const id of allObjectiveIds) {
        evidenceSet.add(id);
      }
    }
  } catch (err) {
    console.error('Error fetching evidence objective IDs:', err);
  }

  return evidenceSet;
}

/**
 * Compute recency weight for an observation based on its capture date.
 * Matches the capability Lambda's recency weighting.
 */
function computeRecencyWeight(capturedAt) {
  const now = new Date();
  const captured = new Date(capturedAt);
  const daysDiff = (now - captured) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 30) return 1.0;
  if (daysDiff <= 90) return 0.7;
  if (daysDiff <= 180) return 0.4;
  return 0.2;
}

/**
 * POST /api/learning/:actionId/quiz/generate
 * Generate a round of quiz questions for selected learning objectives.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 8.7, 8.8
 */
async function handleQuizGenerate(actionId, body, organizationId) {
  const { userId, axisKey, objectiveIds, previousAnswers } = body;

  // Validate required fields
  if (!userId || !axisKey || !objectiveIds || !Array.isArray(objectiveIds) || objectiveIds.length === 0) {
    return error('At least one learning objective must be selected.', 400);
  }

  const db = await getDbClient();
  try {
    const actionIdSafe = escapeLiteral(actionId);
    const userIdSafe = escapeLiteral(userId);
    const orgIdSafe = escapeLiteral(organizationId);

    // 1. Fetch action context (title, description, expected_state, skill_profile)
    const actionResult = await db.query(
      `SELECT id, title, description, expected_state, skill_profile
       FROM actions
       WHERE id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}'`
    );

    if (!actionResult.rows || actionResult.rows.length === 0) {
      return error('Action not found', 404);
    }

    const action = actionResult.rows[0];
    const skillProfile = action.skill_profile;

    if (!skillProfile || !skillProfile.approved_at) {
      return error('No approved skill profile found for this action', 404);
    }

    // Find the target axis from the skill profile
    const targetAxis = skillProfile.axes.find(a => a.key === axisKey);
    if (!targetAxis) {
      return error('Axis not found in skill profile', 404);
    }

    // 2. Fetch the learning objective texts for the requested IDs
    const objectiveIdsList = objectiveIds.map(id => `'${escapeLiteral(id)}'`).join(',');
    const objectivesResult = await db.query(
      `SELECT s.id, s.state_text
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id
       WHERE sl.entity_type = 'action' AND sl.entity_id = '${actionIdSafe}'
         AND s.id IN (${objectiveIdsList})
         AND s.organization_id = '${orgIdSafe}'
         AND s.state_text LIKE '[learning_objective]%'`
    );

    if (!objectivesResult.rows || objectivesResult.rows.length === 0) {
      return error('Learning objectives not found for this action.', 404);
    }

    const objectives = objectivesResult.rows.map(row => {
      const parsed = parseLearningObjectiveStateText(row.state_text);
      return {
        id: row.id,
        text: parsed ? parsed.objectiveText : row.state_text
      };
    });

    // 3. Skip expensive evidence/tool fetching to stay within API Gateway 29s timeout.
    //    The quiz prompt uses action context + objectives + previous answers only.
    //    Evidence and tools can be added in a future optimization with async generation.

    // 4. Build structured prompt and call Bedrock Sonnet
    const questions = await generateQuizViaBedrock(
      action,
      targetAxis,
      objectives,
      { observations: [], photoUrls: [] },
      [],
      {},
      previousAnswers || []
    );

    // 5. Validate response structure
    const validatedQuestions = validateQuizQuestions(questions, objectiveIds);

    return success({ questions: validatedQuestions });
  } finally {
    db.release();
  }
}

/**
 * Fetch evidence observations (photos + text) from capability assessment for quiz context.
 * Uses the same vector similarity approach as the capability Lambda.
 */
async function fetchEvidenceObservations(db, actionIdSafe, userIdSafe, orgIdSafe) {
  const evidence = { observations: [], photoUrls: [] };

  try {
    // Fetch action_skill_profile embedding for similarity search
    const embeddingResult = await db.query(
      `SELECT embedding FROM unified_embeddings
       WHERE entity_type = 'action_skill_profile'
         AND entity_id = '${actionIdSafe}'
         AND organization_id = '${orgIdSafe}'
       LIMIT 1`
    );

    if (!embeddingResult.rows || embeddingResult.rows.length === 0) {
      return evidence;
    }

    const skillProfileEmbedding = embeddingResult.rows[0].embedding;

    // Vector similarity search for observation evidence
    const OBSERVATION_LIMIT = 30;
    const observationSearchResult = await db.query(
      `SELECT entity_id,
              (1 - (embedding <=> '${skillProfileEmbedding}'::vector)) as similarity
       FROM unified_embeddings
       WHERE entity_type = 'state'
         AND organization_id = '${orgIdSafe}'
       ORDER BY embedding <=> '${skillProfileEmbedding}'::vector
       LIMIT ${OBSERVATION_LIMIT}`
    );

    const candidateStateIds = observationSearchResult.rows.map(r => r.entity_id);
    if (candidateStateIds.length === 0) {
      return evidence;
    }

    // Filter to observations linked to actions where the target user is involved
    const stateIdsList = candidateStateIds.map(id => `'${escapeLiteral(id)}'`).join(',');
    const filteredResult = await db.query(
      `SELECT DISTINCT s.id as state_id, s.state_text, s.captured_at
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id AND sl.entity_type = 'action'
       INNER JOIN actions a ON a.id = sl.entity_id
       WHERE s.id IN (${stateIdsList})
         AND s.organization_id = '${orgIdSafe}'
         AND s.state_text NOT LIKE '[learning_objective]%'
         AND (
           a.assigned_to = '${userIdSafe}'
           OR a.created_by = '${userIdSafe}'
           OR '${userIdSafe}' = ANY(a.participants)
         )`
    );

    if (filteredResult.rows.length === 0) {
      return evidence;
    }

    // Fetch photos for these observations
    const relevantStateIds = filteredResult.rows.map(r => r.state_id);
    const relevantStateIdsList = relevantStateIds.map(id => `'${escapeLiteral(id)}'`).join(',');

    const photosResult = await db.query(
      `SELECT state_id, photo_url, photo_description, photo_order
       FROM state_photos
       WHERE state_id IN (${relevantStateIdsList})
       ORDER BY state_id, photo_order`
    );

    // Group photos by state_id
    const photosByState = {};
    for (const photo of photosResult.rows) {
      if (!photosByState[photo.state_id]) {
        photosByState[photo.state_id] = [];
      }
      photosByState[photo.state_id].push({
        url: photo.photo_url,
        description: photo.photo_description
      });
    }

    // Build similarity map
    const similarityMap = {};
    for (const row of observationSearchResult.rows) {
      similarityMap[row.entity_id] = parseFloat(row.similarity);
    }

    // Build evidence list sorted by relevance
    evidence.observations = filteredResult.rows.map(obs => {
      const recencyWeight = computeRecencyWeight(obs.captured_at);
      const relevanceScore = (similarityMap[obs.state_id] || 0) * recencyWeight;
      const photos = photosByState[obs.state_id] || [];

      // Collect S3 photo URLs for the prompt
      for (const photo of photos) {
        if (photo.url) {
          evidence.photoUrls.push(photo.url);
        }
      }

      return {
        text: (obs.state_text || '').substring(0, 500),
        photos: photos.map(p => ({
          url: p.url,
          description: p.description
        })),
        relevanceScore: Math.round(relevanceScore * 100) / 100
      };
    });

    evidence.observations.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (err) {
    console.error('Error fetching evidence observations for quiz:', err);
  }

  return evidence;
}

/**
 * Fetch organization tool inventory for quiz context.
 * Returns a simplified list of tool names, categories, and descriptions.
 */
async function fetchToolInventory(db, orgIdSafe) {
  try {
    const toolsResult = await db.query(
      `SELECT name, category, description
       FROM tools
       WHERE organization_id = '${orgIdSafe}'
         AND status != 'removed'
       ORDER BY name
       LIMIT 100`
    );

    return toolsResult.rows.map(t => ({
      name: t.name,
      category: t.category,
      description: (t.description || '').substring(0, 200)
    }));
  } catch (err) {
    console.error('Error fetching tool inventory:', err);
    return [];
  }
}

/**
 * Fetch existing knowledge states for the given objective IDs.
 * Returns knowledge state texts grouped by objective ID.
 */
async function fetchKnowledgeStatesForObjectives(db, objectiveIds, orgIdSafe) {
  const knowledgeByObjective = {};

  if (objectiveIds.length === 0) return knowledgeByObjective;

  try {
    const objectiveIdsList = objectiveIds.map(id => `'${escapeLiteral(id)}'`).join(',');
    const result = await db.query(
      `SELECT sl.entity_id as objective_id, s.state_text
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id
       WHERE sl.entity_type = 'learning_objective'
         AND sl.entity_id IN (${objectiveIdsList})
         AND s.organization_id = '${orgIdSafe}'
       ORDER BY s.captured_at ASC`
    );

    for (const row of result.rows) {
      if (!knowledgeByObjective[row.objective_id]) {
        knowledgeByObjective[row.objective_id] = [];
      }
      knowledgeByObjective[row.objective_id].push(row.state_text);
    }
  } catch (err) {
    console.error('Error fetching knowledge states:', err);
  }

  return knowledgeByObjective;
}

/**
 * Generate quiz questions via Bedrock Sonnet.
 * Builds a structured prompt with action context, evidence, tools, and previous answers.
 */
async function generateQuizViaBedrock(action, targetAxis, objectives, evidenceData, toolInventory, knowledgeStates, previousAnswers) {
  // Build the objectives section
  const objectivesSection = objectives.map(obj => {
    const pastStates = knowledgeStates[obj.id] || [];
    const pastSummary = pastStates.length > 0
      ? `\n    Past quiz history: ${pastStates.length} previous answer(s)`
      : '';
    return `  - ID: ${obj.id}\n    Objective: ${obj.text}${pastSummary}`;
  }).join('\n');

  // Build evidence observations section (limit to top 10 for prompt size)
  const topEvidence = evidenceData.observations.slice(0, 10);
  const evidenceSection = topEvidence.length > 0
    ? topEvidence.map((obs, i) => {
        const photoInfo = obs.photos.length > 0
          ? `\n    Photos: ${obs.photos.map(p => p.description || 'Photo available').join(', ')}`
          : '';
        return `  ${i + 1}. Observation: ${obs.text}${photoInfo}`;
      }).join('\n')
    : '  No evidence observations available.';

  // Build photo URLs section for photo-based questions
  const availablePhotos = [];
  for (const obs of topEvidence) {
    for (const photo of obs.photos) {
      if (photo.url && availablePhotos.length < 5) {
        const s3Url = photo.url.startsWith('http')
          ? photo.url
          : `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${photo.url}`;
        availablePhotos.push({
          url: s3Url,
          description: photo.description || 'Evidence photo'
        });
      }
    }
  }

  const photoSection = availablePhotos.length > 0
    ? `\nAVAILABLE PHOTOS FOR PHOTO-BASED QUESTIONS:\n${availablePhotos.map((p, i) => `  ${i + 1}. URL: ${p.url}\n     Description: ${p.description}`).join('\n')}`
    : '\nNo photos available — generate concept-based and tool-based questions only.';

  // Build tool inventory section
  const requiredTools = action.skill_profile?.required_tools || [];
  const toolSection = toolInventory.length > 0
    ? `Required tools for this action: ${requiredTools.length > 0 ? requiredTools.join(', ') : 'Not specified'}\nOrganization tool inventory (${toolInventory.length} tools):\n${toolInventory.slice(0, 20).map(t => `  - ${t.name} (${t.category || 'uncategorized'})${t.description ? ': ' + t.description : ''}`).join('\n')}`
    : 'No tool inventory available.';

  // Build previous wrong answers section
  const wrongAnswersSection = previousAnswers.filter(a => !a.wasCorrect).length > 0
    ? `\nPREVIOUS WRONG ANSWERS (address these misconceptions with new questions from different angles):\n${previousAnswers.filter(a => !a.wasCorrect).map(a =>
        `  - Objective: ${a.objectiveId}\n    Question: ${a.questionText}\n    Wrong answer chosen: "${a.selectedAnswer}"\n    Correct answer was: "${a.correctAnswer}"\n    Misconception to address: The person thought "${a.selectedAnswer}" — generate a question that helps them understand why "${a.correctAnswer}" is correct.`
      ).join('\n')}`
    : '';

  const prompt = `You are an expert learning assessment designer. Generate multiple-choice quiz questions to test a person's understanding of specific learning objectives related to a work action.

ACTION CONTEXT:
- Title: ${action.title || 'Untitled'}
- Description: ${action.description || 'No description'}
- Expected Outcome (S'): ${action.expected_state || 'Not specified'}
  The expected outcome is the PRIMARY DRIVER for all questions. Questions should orient the person toward understanding WHY the desired outcome matters.

SKILL AXIS: ${targetAxis.label} (${targetAxis.key})
${targetAxis.description ? `Axis Description: ${targetAxis.description}` : ''}

LEARNING OBJECTIVES TO COVER (generate at least one question per objective):
${objectivesSection}

EVIDENCE OBSERVATIONS FROM PAST WORK:
${evidenceSection}
${photoSection}

TOOLS AND EQUIPMENT:
${toolSection}
${wrongAnswersSection}

INSTRUCTIONS:
1. Generate at least one question per learning objective listed above.
2. Each question MUST have exactly 4 answer options with explanations for each option.
3. Generate three types of questions:
   - "concept": Questions probing the "why" behind practices (most common)
   - "photo": Questions referencing evidence photos (only if photos are available — use the exact photoUrl provided)
   - "tool": Questions about tools and equipment relevant to the skill axis
4. For photo-based questions, set the photoUrl field to the exact URL from the AVAILABLE PHOTOS section.
5. Each explanation should teach — explain WHY the option is correct or incorrect.
6. Questions should test understanding (Bloom's level 2), not just recall.
7. Make wrong options plausible but clearly distinguishable with good explanations.
8. DO NOT use any policy content as source material.
9. Vary the correctIndex across questions (don't always put the correct answer in the same position).

Return ONLY a JSON object with:
{
  "questions": [
    {
      "objectiveId": "<objective_id from the list above>",
      "type": "concept" | "photo" | "tool",
      "text": "<question text>",
      "photoUrl": "<exact photo URL or null>",
      "options": [
        { "index": 0, "text": "<option text>", "explanation": "<why this is correct/incorrect>" },
        { "index": 1, "text": "<option text>", "explanation": "<why this is correct/incorrect>" },
        { "index": 2, "text": "<option text>", "explanation": "<why this is correct/incorrect>" },
        { "index": 3, "text": "<option text>", "explanation": "<why this is correct/incorrect>" }
      ],
      "correctIndex": <0-3>
    }
  ]
}

No markdown, no code fences, no explanation outside the JSON.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: OBJECTIVE_MODEL_ID,
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
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    return parsed.questions || [];
  } catch (parseErr) {
    console.error('Failed to parse Bedrock quiz response:', text);
    throw new Error('Failed to generate quiz questions — AI returned invalid format');
  }
}

/**
 * Validate and normalize quiz question structure.
 * Ensures each question has required fields and maps to a requested objective.
 * Assigns unique IDs to each question.
 */
function validateQuizQuestions(questions, requestedObjectiveIds) {
  const validObjectiveIds = new Set(requestedObjectiveIds);
  const validated = [];

  for (const q of questions) {
    // Skip questions that don't map to a requested objective
    if (!q.objectiveId || !validObjectiveIds.has(q.objectiveId)) {
      console.warn('Skipping question with invalid objectiveId:', q.objectiveId);
      continue;
    }

    // Validate options — must have exactly 4
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      console.warn('Skipping question with invalid options count:', q.options?.length);
      continue;
    }

    // Validate correctIndex
    const correctIndex = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
      ? q.correctIndex
      : 0;

    // Normalize options to ensure each has index, text, and explanation
    const options = q.options.map((opt, i) => ({
      index: typeof opt.index === 'number' ? opt.index : i,
      text: opt.text || `Option ${i + 1}`,
      explanation: opt.explanation || ''
    }));

    // Ensure each option has a valid explanation
    const hasExplanations = options.every(opt => opt.explanation && opt.explanation.length > 0);
    if (!hasExplanations) {
      console.warn('Question has options missing explanations, proceeding with available data');
    }

    validated.push({
      id: `q-${require('crypto').randomUUID()}`,
      objectiveId: q.objectiveId,
      type: ['concept', 'photo', 'tool'].includes(q.type) ? q.type : 'concept',
      text: q.text || '',
      photoUrl: q.photoUrl || null,
      options,
      correctIndex
    });
  }

  return validated;
}

/**
 * POST /api/learning/:actionId/verify
 * Verify which learning objectives an observation demonstrates.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
async function handleVerify(actionId, body, organizationId) {
  const { observationId, selfAssessedObjectiveIds, userId } = body;

  // Validate required fields
  if (!observationId || !userId) {
    return error('observationId and userId are required', 400);
  }

  if (!Array.isArray(selfAssessedObjectiveIds)) {
    return error('selfAssessedObjectiveIds must be an array', 400);
  }

  const db = await getDbClient();
  try {
    const actionIdSafe = escapeLiteral(actionId);
    const observationIdSafe = escapeLiteral(observationId);
    const userIdSafe = escapeLiteral(userId);
    const orgIdSafe = escapeLiteral(organizationId);

    // 1. Fetch observation from states table (text)
    const observationResult = await db.query(
      `SELECT s.id, s.state_text, s.captured_by, s.captured_at
       FROM states s
       WHERE s.id = '${observationIdSafe}'
         AND s.organization_id = '${orgIdSafe}'`
    );

    if (!observationResult.rows || observationResult.rows.length === 0) {
      return error('Observation not found', 404);
    }

    const observation = observationResult.rows[0];

    // 2. Fetch observation photos from state_photos
    const photosResult = await db.query(
      `SELECT photo_url, photo_description, photo_order
       FROM state_photos
       WHERE state_id = '${observationIdSafe}'
       ORDER BY photo_order`
    );

    const observationPhotos = photosResult.rows.map(p => ({
      url: p.photo_url,
      description: p.photo_description
    }));

    // 3. Fetch learning objectives for this action
    const objectivesResult = await db.query(
      `SELECT s.id, s.state_text
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id
       WHERE sl.entity_type = 'action' AND sl.entity_id = '${actionIdSafe}'
         AND s.organization_id = '${orgIdSafe}'
         AND s.state_text LIKE '[learning_objective]%'
         AND s.state_text LIKE '%user=${userIdSafe}%'
       ORDER BY s.captured_at ASC`
    );

    if (!objectivesResult.rows || objectivesResult.rows.length === 0) {
      return error('No learning objectives found for this action and user', 404);
    }

    const objectives = objectivesResult.rows.map(row => {
      const parsed = parseLearningObjectiveStateText(row.state_text);
      return {
        id: row.id,
        text: parsed ? parsed.objectiveText : row.state_text
      };
    });

    // 4. Call Bedrock Sonnet to evaluate which objectives the observation demonstrates
    const aiEvaluatedIds = await evaluateObservationViaBedrock(
      observation,
      observationPhotos,
      objectives
    );

    // 5. Compare self-assessment vs AI evaluation
    const result = compareAssessments(selfAssessedObjectiveIds, aiEvaluatedIds);

    // 6. For each confirmed objective, create a demonstration knowledge state
    for (const confirmedId of result.confirmed) {
      const objective = objectives.find(o => o.id === confirmedId);
      if (!objective) continue;

      const stateText = `Demonstrated learning objective '${objective.text}' via observation. Both self-assessed and AI-confirmed.`;

      await db.query('BEGIN');
      try {
        const insertResult = await db.query(
          `INSERT INTO states (organization_id, state_text, captured_by, captured_at)
           VALUES ('${orgIdSafe}', '${escapeLiteral(stateText)}', '${userIdSafe}', NOW())
           RETURNING id`
        );
        const stateId = insertResult.rows[0].id;

        // Create state_link to the learning objective
        await db.query(
          `INSERT INTO state_links (state_id, entity_type, entity_id)
           VALUES ('${escapeLiteral(stateId)}', 'learning_objective', '${escapeLiteral(confirmedId)}')`
        );

        await db.query('COMMIT');

        // 7. Queue embedding for each new demonstration state via SQS (fire-and-forget)
        queueDemonstrationEmbedding(stateId, stateText, organizationId)
          .catch(err => console.error('Failed to queue demonstration embedding:', err));
      } catch (insertErr) {
        await db.query('ROLLBACK');
        throw insertErr;
      }
    }

    // 8. Return verification results
    return success({
      confirmed: result.confirmed,
      unconfirmed: result.unconfirmed,
      aiDetected: result.aiDetected
    });
  } finally {
    db.release();
  }
}

/**
 * Call Bedrock Sonnet to evaluate which learning objectives an observation demonstrates.
 * Returns an array of objective IDs that the AI determines are demonstrated.
 */
async function evaluateObservationViaBedrock(observation, photos, objectives) {
  const objectivesList = objectives.map(obj =>
    `  - ID: ${obj.id}\n    Objective: ${obj.text}`
  ).join('\n');

  const photoDescriptions = photos
    .filter(p => p.description)
    .map((p, i) => `  ${i + 1}. ${p.description}`)
    .join('\n');

  const photoSection = photoDescriptions
    ? `\nPHOTO DESCRIPTIONS:\n${photoDescriptions}`
    : '\nNo photos attached to this observation.';

  const prompt = `You are an expert skill evaluator. Analyze an observation and determine which learning objectives it demonstrates.

OBSERVATION TEXT:
${observation.state_text || 'No text provided.'}
${photoSection}

LEARNING OBJECTIVES TO EVALUATE:
${objectivesList}

INSTRUCTIONS:
- For each learning objective, determine if the observation provides evidence that the person understands or can demonstrate that objective.
- Be reasonably generous — if the observation shows practical application or understanding related to the objective, include it.
- Only exclude objectives where the observation provides no relevant evidence at all.
- Return the IDs of objectives that the observation demonstrates.

Return ONLY a JSON object with:
{ "demonstratedObjectiveIds": ["<objective_id_1>", "<objective_id_2>"] }

If no objectives are demonstrated, return:
{ "demonstratedObjectiveIds": [] }

No markdown, no code fences, no explanation.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: OBJECTIVE_MODEL_ID,
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
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    // Validate that returned IDs are from the objectives list
    const validIds = new Set(objectives.map(o => o.id));
    return (parsed.demonstratedObjectiveIds || []).filter(id => validIds.has(id));
  } catch (parseErr) {
    console.error('Failed to parse Bedrock verification response:', text);
    return [];
  }
}

/**
 * Compare self-assessment against AI evaluation.
 * Returns { confirmed, unconfirmed, aiDetected }.
 */
function compareAssessments(selfAssessedIds, aiEvaluatedIds) {
  const selfSet = new Set(selfAssessedIds);
  const aiSet = new Set(aiEvaluatedIds);

  const confirmed = [];
  const unconfirmed = [];
  const aiDetected = [];

  // confirmed = intersection(self, ai)
  for (const id of selfSet) {
    if (aiSet.has(id)) {
      confirmed.push(id);
    } else {
      unconfirmed.push(id);
    }
  }

  // aiDetected = ai - self
  for (const id of aiSet) {
    if (!selfSet.has(id)) {
      aiDetected.push(id);
    }
  }

  return { confirmed, unconfirmed, aiDetected };
}

/**
 * Queue embedding generation for a new demonstration knowledge state via SQS.
 * Uses the same pipeline as the states Lambda.
 */
async function queueDemonstrationEmbedding(stateId, stateText, organizationId) {
  const embeddingSource = composeStateEmbeddingSource({
    entity_names: [],
    state_text: stateText,
    photo_descriptions: [],
    metrics: []
  });

  if (!embeddingSource || !embeddingSource.trim()) {
    console.log('Empty embedding source for demonstration state', stateId, '— skipping SQS send');
    return;
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: EMBEDDINGS_QUEUE_URL,
    MessageBody: JSON.stringify({
      entity_type: 'state',
      entity_id: stateId,
      embedding_source: embeddingSource,
      organization_id: organizationId
    })
  }));

  console.log('Queued embedding for demonstration state', stateId);
}
