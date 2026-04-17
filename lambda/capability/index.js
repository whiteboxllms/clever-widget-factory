const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse, corsResponse } = require('/opt/nodejs/response');
const { getDbClient } = require('/opt/nodejs/db');
const { escapeLiteral } = require('/opt/nodejs/sqlUtils');

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-west-2' });

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
    // GET /api/capability/:actionId/organization — Organization capability assessment
    // GET /api/capability/:actionId/:userId — Individual capability assessment
    // Note: organization route is checked first since "organization" occupies the :userId position
    if (httpMethod === 'GET' && path.startsWith('/api/capability/')) {
      const segments = path.replace('/api/capability/', '').split('/');
      const actionId = segments[0];
      const secondSegment = segments[1];

      if (!actionId || !secondSegment) {
        return error('Invalid path. Expected /api/capability/:actionId/:userId or /api/capability/:actionId/organization', 400);
      }

      if (secondSegment === 'organization') {
        return await handleOrganizationCapability(actionId, organizationId);
      } else {
        const userId = secondSegment;
        return await handleIndividualCapability(actionId, userId, organizationId);
      }
    }

    return error('Not found', 404);

  } catch (err) {
    console.error('Error:', err);
    return error(err.message, 500);
  }
};

/**
 * GET /api/capability/:actionId/:userId
 * Compute capability profile for one person relative to an action.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */
async function handleIndividualCapability(actionId, userId, organizationId) {
  const db = await getDbClient();
  try {
    const actionIdSafe = escapeLiteral(actionId);
    const userIdSafe = escapeLiteral(userId);
    const orgIdSafe = escapeLiteral(organizationId);

    // 1. Fetch action's skill_profile JSON; return 404 if no approved profile
    const actionResult = await db.query(
      `SELECT id, skill_profile FROM actions WHERE id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}'`
    );

    if (!actionResult.rows || actionResult.rows.length === 0) {
      return error('Action not found', 404);
    }

    const action = actionResult.rows[0];
    const skillProfile = action.skill_profile;

    if (!skillProfile || !skillProfile.approved_at) {
      return error('No skill profile found for this action. Generate and approve one first.', 404);
    }

    // Resolve user name from organization_members
    const userResult = await db.query(
      `SELECT full_name FROM organization_members WHERE user_id = '${userIdSafe}' AND organization_id = '${orgIdSafe}'`
    );
    const userName = userResult.rows?.[0]?.full_name || 'Unknown';

    // 2. Fetch the action_skill_profile embedding from unified_embeddings
    //    Retry with short waits if not found — the embedding pipeline may still be processing
    //    after a skill profile was just approved.
    let skillProfileEmbedding = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const embeddingResult = await db.query(
        `SELECT embedding FROM unified_embeddings WHERE entity_type = 'action_skill_profile' AND entity_id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}' LIMIT 1`
      );
      if (embeddingResult.rows && embeddingResult.rows.length > 0) {
        skillProfileEmbedding = embeddingResult.rows[0].embedding;
        break;
      }
      if (attempt < 3) {
        console.log(`Embedding not found for action ${actionId}, retrying in ${(attempt + 1) * 3}s (attempt ${attempt + 1}/4)`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 3000));
      }
    }

    if (!skillProfileEmbedding) {
      console.error('No action_skill_profile embedding found for action', actionId, 'after retries');
      return error('Skill profile embedding not found. Please try again in a few seconds.', 500);
    }

    // 3. Vector similarity search for observation evidence scoped by organization_id
    // Search 'state' embeddings — observations linked to actions are filtered via state_links join
    const OBSERVATION_LIMIT = 50;
    const observationSearchResult = await db.query(
      `SELECT
        entity_id,
        embedding_source,
        (1 - (embedding <=> '${skillProfileEmbedding}'::vector)) as similarity
      FROM unified_embeddings
      WHERE entity_type = 'state'
        AND organization_id = '${orgIdSafe}'
      ORDER BY embedding <=> '${skillProfileEmbedding}'::vector
      LIMIT ${OBSERVATION_LIMIT}`
    );

    const candidateStateIds = observationSearchResult.rows.map(r => r.entity_id);

    if (candidateStateIds.length === 0) {
      // 7. No observations — but check if learning data exists
      const learningCompletionData = await fetchLearningCompletionData(db, actionIdSafe, userIdSafe, orgIdSafe, skillProfile);
      if (learningCompletionData.length > 0) {
        // Has learning data — let Bedrock score based on that
        const capabilityResult = await callBedrockForCapability(skillProfile, [], userName, learningCompletionData);
        const axes = skillProfile.axes.map(skillAxis => {
          const aiAxis = capabilityResult.axes.find(a => a.key === skillAxis.key);
          return {
            key: skillAxis.key,
            label: skillAxis.label,
            level: aiAxis ? Math.max(0, Math.min(5, Math.round(aiAxis.level))) : 0,
            evidence_count: 0,
            evidence: []
          };
        });
        return success({
          user_id: userId, user_name: userName, action_id: actionId,
          narrative: capabilityResult.narrative || 'Assessment based on learning completion.',
          axes, total_evidence_count: 0, computed_at: new Date().toISOString()
        });
      }
      return success(buildZeroCapabilityProfile(skillProfile, actionId, userId, userName));
    }

    // 4. Filter to states relevant to this user:
    //    - Observations linked to actions where the user is involved (existing behavior)
    //    - Knowledge states (quiz answers, learning objectives) captured by the user
    const stateIdsList = candidateStateIds.map(id => `'${escapeLiteral(id)}'`).join(',');

    const filteredObservationsResult = await db.query(
      `SELECT DISTINCT s.id as state_id, s.state_text, s.captured_at, s.organization_id,
        COALESCE(a.id, sl_lo_action.entity_id) as linked_action_id,
        COALESCE(a.title, '') as action_title
      FROM states s
      LEFT JOIN state_links sl ON sl.state_id = s.id AND sl.entity_type = 'action'
      LEFT JOIN actions a ON a.id = sl.entity_id
      LEFT JOIN state_links sl_lo ON sl_lo.state_id = s.id AND sl_lo.entity_type = 'learning_objective'
      LEFT JOIN state_links sl_lo_action ON sl_lo_action.state_id = sl_lo.entity_id AND sl_lo_action.entity_type = 'action'
      WHERE s.id IN (${stateIdsList})
        AND s.organization_id = '${orgIdSafe}'
        AND (
          -- Observations linked to actions where user is involved
          (a.id IS NOT NULL AND (
            a.assigned_to = '${userIdSafe}'
            OR a.created_by = '${userIdSafe}'
            OR '${userIdSafe}' = ANY(a.participants)
          ))
          OR
          -- Knowledge states captured by this user (quiz answers, learning data)
          s.captured_by = '${userIdSafe}'
        )`
    );

    if (filteredObservationsResult.rows.length === 0) {
      // 7. No relevant observations — but check if learning data exists
      const learningCompletionData = await fetchLearningCompletionData(db, actionIdSafe, userIdSafe, orgIdSafe, skillProfile);
      if (learningCompletionData.length > 0) {
        const capabilityResult = await callBedrockForCapability(skillProfile, [], userName, learningCompletionData);
        const axes = skillProfile.axes.map(skillAxis => {
          const aiAxis = capabilityResult.axes.find(a => a.key === skillAxis.key);
          return {
            key: skillAxis.key,
            label: skillAxis.label,
            level: aiAxis ? Math.max(0, Math.min(5, Math.round(aiAxis.level))) : 0,
            evidence_count: 0,
            evidence: []
          };
        });
        return success({
          user_id: userId, user_name: userName, action_id: actionId,
          narrative: capabilityResult.narrative || 'Assessment based on learning completion.',
          axes, total_evidence_count: 0, computed_at: new Date().toISOString()
        });
      }
      return success(buildZeroCapabilityProfile(skillProfile, actionId, userId, userName));
    }

    // Build a map of similarity scores from the vector search
    const similarityMap = {};
    for (const row of observationSearchResult.rows) {
      similarityMap[row.entity_id] = parseFloat(row.similarity);
    }

    // 5. Resolve observation details: photos from state_photos
    const relevantStateIds = filteredObservationsResult.rows.map(r => r.state_id);
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
      photosByState[photo.state_id].push(photo.photo_url);
    }

    // 6. Apply recency weighting and build evidence list
    const allEvidence = filteredObservationsResult.rows.map(obs => {
      const recencyWeight = computeRecencyWeight(obs.captured_at);
      const relevanceScore = (similarityMap[obs.state_id] || 0) * recencyWeight;

      return {
        observation_id: obs.state_id,
        action_id: obs.linked_action_id,
        action_title: obs.action_title || '',
        text_excerpt: (obs.state_text || '').substring(0, 500),
        photo_urls: photosByState[obs.state_id] || [],
        captured_at: obs.captured_at,
        relevance_score: Math.round(relevanceScore * 100) / 100,
        recency_weight: recencyWeight
      };
    });

    // Sort by relevance_score descending
    allEvidence.sort((a, b) => b.relevance_score - a.relevance_score);

    // 8. Send evidence + skill axes to Bedrock Claude for capability synthesis
    // Include learning completion data so the model can factor in quiz-demonstrated understanding
    const learningCompletionData = await fetchLearningCompletionData(db, actionIdSafe, userIdSafe, orgIdSafe, skillProfile);
    const capabilityResult = await callBedrockForCapability(skillProfile, allEvidence, userName, learningCompletionData);

    // 9. Build and return the CapabilityProfile response
    const axes = skillProfile.axes.map(skillAxis => {
      const aiAxis = capabilityResult.axes.find(a => a.key === skillAxis.key);
      const level = aiAxis ? Math.max(0, Math.min(5, Math.round(aiAxis.level))) : 0;

      // Attach evidence to each axis — use AI axis_evidence mapping if available, otherwise distribute top evidence
      const axisEvidence = aiAxis?.evidence_ids
        ? allEvidence.filter(e => aiAxis.evidence_ids.includes(e.observation_id))
        : [];

      return {
        key: skillAxis.key,
        label: skillAxis.label,
        level,
        evidence_count: axisEvidence.length,
        evidence: axisEvidence.slice(0, 5) // Limit evidence per axis
      };
    });

    const capabilityProfile = {
      user_id: userId,
      user_name: userName,
      action_id: actionId,
      narrative: capabilityResult.narrative || 'Capability assessment completed.',
      axes,
      total_evidence_count: allEvidence.length,
      computed_at: new Date().toISOString()
    };

    return success(capabilityProfile);
  } finally {
    db.release();
  }
}

/**
 * Build a zero-score capability profile when no relevant evidence is found.
 * Requirements: 3.8
 */
function buildZeroCapabilityProfile(skillProfile, actionId, userId, userName) {
  return {
    user_id: userId,
    user_name: userName,
    action_id: actionId,
    narrative: 'No relevant evidence found.',
    axes: skillProfile.axes.map(axis => ({
      key: axis.key,
      label: axis.label,
      level: 0.0,
      evidence_count: 0,
      evidence: []
    })),
    total_evidence_count: 0,
    computed_at: new Date().toISOString()
  };
}

/**
 * Call Bedrock Claude to synthesize capability levels from evidence and skill axes.
 * Returns { narrative, axes: [{ key, level, evidence_ids }] }
 */
async function callBedrockForCapability(skillProfile, evidence, userName, learningCompletionData = []) {
  const MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0';

  const axesDescription = skillProfile.axes.map(a =>
    `- ${a.key} ("${a.label}"): required level ${a.required_level}`
  ).join('\n');

  const evidenceSummary = evidence.slice(0, 30).map((e, i) =>
    `${i + 1}. [${e.observation_id}] Action: "${e.action_title}" | Captured: ${e.captured_at} | Relevance: ${e.relevance_score} | Recency weight: ${e.recency_weight}\n   Text: ${e.text_excerpt}${e.photo_urls.length > 0 ? `\n   Photos: ${e.photo_urls.length} photo(s)` : ''}`
  ).join('\n\n');

  // Build learning completion section if data exists
  let learningSection = '';
  if (learningCompletionData.length > 0) {
    const learningLines = learningCompletionData.map(ld =>
      `- Axis "${ld.axisLabel}" (${ld.axisKey}): ${ld.completedObjectives} of ${ld.totalObjectives} learning objectives completed via quiz.\n  Completed objectives: ${ld.objectiveTexts.join('; ')}`
    ).join('\n');
    learningSection = `

LEARNING COMPLETION (quiz-based training results):
The person completed adaptive quizzes that test understanding (Bloom's level 2 — "why" comprehension, not just recall). Each completed objective means the person answered correctly on the first attempt for a question testing that concept.
${learningLines}

Factor this learning data into your assessment. Quiz completion that tests "why" reasoning demonstrates at least Understand-level capability on the relevant axis. Combine this with observation evidence for the final score.`;
  }

  const prompt = `You are a skill assessment expert. Analyze the following evidence observations and learning data for ${userName} and produce a capability assessment relative to the skill profile axes.

SKILL LEVEL SCALE (Bloom's Taxonomy — use integers 0-5):
  0 = No exposure — no evidence of this skill
  1 = Remember — evidence shows they can recall facts and follow documented procedures
  2 = Understand — evidence shows they can explain why, not just how
  3 = Apply — evidence shows they can use knowledge in new situations without guidance
  4 = Analyze — evidence shows they can break down problems, evaluate tradeoffs
  5 = Create — evidence shows they can innovate, teach others, set standards

SKILL PROFILE:
${skillProfile.narrative}

AXES (each has a required level on the 0-5 Bloom's scale):
${axesDescription}

EVIDENCE OBSERVATIONS (sorted by relevance):
${evidenceSummary || 'No observation evidence available.'}
${learningSection}

ASSESSMENT GUIDELINES:
- Score each axis as an INTEGER from 0 to 5 using the Bloom's scale above.
- Consider consistency across multiple observations — mastery requires repeated demonstration.
- Weight recent evidence more heavily (recency_weight is already provided).
- A person with no evidence and no learning for an axis should score 0.
- A person who has followed procedures but not shown deeper understanding scores 1.
- A person who explains reasoning in their observations or has completed learning quizzes testing "why" comprehension scores at least 2.
- A person who adapts approaches to new situations scores 3.
- Be fair and evidence-based. Do not infer skills not demonstrated in the observations or learning data.

Produce a JSON object with:
1. "narrative": A 2-4 sentence assessment of ${userName}'s demonstrated capabilities relative to this action's requirements. Be specific about strengths and gaps. Mention learning completion where relevant.
2. "axes": An array with one entry per skill axis, each containing:
   - "key": The axis key (must match exactly)
   - "level": An INTEGER from 0 to 5 representing demonstrated capability on the Bloom's scale
   - "evidence_ids": An array of observation_id strings (from the evidence list) that support this score

Respond with ONLY the JSON object, no markdown formatting, no code fences, no explanation.`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1500,
    temperature: 0.3,
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
  const cleaned = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Failed to parse Bedrock capability response:', text);
    // Return a fallback with zero scores if AI response is malformed
    return {
      narrative: 'Capability assessment could not be fully synthesized from available evidence.',
      axes: skillProfile.axes.map(a => ({ key: a.key, level: 0.0, evidence_ids: [] }))
    };
  }
}

/**
 * GET /api/capability/:actionId/organization
 * Compute organization-level capability profile for an action.
 * Requirements: 6.1, 6.2, 6.3, 6.6
 */
async function handleOrganizationCapability(actionId, organizationId) {
  const db = await getDbClient();
  try {
    const actionIdSafe = escapeLiteral(actionId);
    const orgIdSafe = escapeLiteral(organizationId);

    // 1. Fetch action's skill_profile JSON; return 404 if no approved profile
    const actionResult = await db.query(
      `SELECT id, skill_profile FROM actions WHERE id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}'`
    );

    if (!actionResult.rows || actionResult.rows.length === 0) {
      return error('Action not found', 404);
    }

    const action = actionResult.rows[0];
    const skillProfile = action.skill_profile;

    if (!skillProfile || !skillProfile.approved_at) {
      return error('No skill profile found for this action. Generate and approve one first.', 404);
    }

    // 2. Fetch the action_skill_profile embedding from unified_embeddings
    const embeddingResult = await db.query(
      `SELECT embedding FROM unified_embeddings WHERE entity_type = 'action_skill_profile' AND entity_id = '${actionIdSafe}' AND organization_id = '${orgIdSafe}' LIMIT 1`
    );

    if (!embeddingResult.rows || embeddingResult.rows.length === 0) {
      console.error('No action_skill_profile embedding found for action', actionId);
      return error('Skill profile embedding not found. The embedding pipeline may still be processing.', 500);
    }

    const skillProfileEmbedding = embeddingResult.rows[0].embedding;

    // 3. Vector similarity search for observation evidence scoped by organization_id (no user filter)
    // Search 'state' embeddings — observations linked to actions are filtered via state_links join
    const OBSERVATION_LIMIT = 50;
    const observationSearchResult = await db.query(
      `SELECT
        entity_id,
        embedding_source,
        (1 - (embedding <=> '${skillProfileEmbedding}'::vector)) as similarity
      FROM unified_embeddings
      WHERE entity_type = 'state'
        AND organization_id = '${orgIdSafe}'
      ORDER BY embedding <=> '${skillProfileEmbedding}'::vector
      LIMIT ${OBSERVATION_LIMIT}`
    );

    const candidateStateIds = observationSearchResult.rows.map(r => r.entity_id);

    if (candidateStateIds.length === 0) {
      // No observations at all — return zero scores
      return success(buildZeroCapabilityProfile(skillProfile, actionId, 'organization', 'Organization'));
    }

    // 4. Resolve observation details from states + state_photos + state_links (no user filter)
    const stateIdsList = candidateStateIds.map(id => `'${escapeLiteral(id)}'`).join(',');

    const observationsResult = await db.query(
      `SELECT DISTINCT s.id as state_id, s.state_text, s.captured_at, s.organization_id,
        sl.entity_id as linked_action_id,
        a.title as action_title
      FROM states s
      INNER JOIN state_links sl ON sl.state_id = s.id AND sl.entity_type = 'action'
      INNER JOIN actions a ON a.id = sl.entity_id
      WHERE s.id IN (${stateIdsList})
        AND s.organization_id = '${orgIdSafe}'`
    );

    if (observationsResult.rows.length === 0) {
      // No linked observations found — return zero scores
      return success(buildZeroCapabilityProfile(skillProfile, actionId, 'organization', 'Organization'));
    }

    // Build a map of similarity scores from the vector search
    const similarityMap = {};
    for (const row of observationSearchResult.rows) {
      similarityMap[row.entity_id] = parseFloat(row.similarity);
    }

    // 5. Resolve photos for observations
    const relevantStateIds = observationsResult.rows.map(r => r.state_id);
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
      photosByState[photo.state_id].push(photo.photo_url);
    }

    // 6. Apply recency weighting and build evidence list
    const allEvidence = observationsResult.rows.map(obs => {
      const recencyWeight = computeRecencyWeight(obs.captured_at);
      const relevanceScore = (similarityMap[obs.state_id] || 0) * recencyWeight;

      return {
        observation_id: obs.state_id,
        action_id: obs.linked_action_id,
        action_title: obs.action_title || '',
        text_excerpt: (obs.state_text || '').substring(0, 500),
        photo_urls: photosByState[obs.state_id] || [],
        captured_at: obs.captured_at,
        relevance_score: Math.round(relevanceScore * 100) / 100,
        recency_weight: recencyWeight
      };
    });

    // Sort by relevance_score descending
    allEvidence.sort((a, b) => b.relevance_score - a.relevance_score);

    // 7. Send evidence + skill axes to Bedrock Claude for organization-level capability synthesis
    const capabilityResult = await callBedrockForCapability(skillProfile, allEvidence, 'the organization');

    // 8. Build and return the organization-level CapabilityProfile response
    const axes = skillProfile.axes.map(skillAxis => {
      const aiAxis = capabilityResult.axes.find(a => a.key === skillAxis.key);
      const level = aiAxis ? Math.max(0, Math.min(5, Math.round(aiAxis.level))) : 0;

      // Attach evidence to each axis
      const axisEvidence = aiAxis?.evidence_ids
        ? allEvidence.filter(e => aiAxis.evidence_ids.includes(e.observation_id))
        : [];

      return {
        key: skillAxis.key,
        label: skillAxis.label,
        level,
        evidence_count: axisEvidence.length,
        evidence: axisEvidence.slice(0, 5) // Limit evidence per axis
      };
    });

    const capabilityProfile = {
      user_id: 'organization',
      user_name: 'Organization',
      action_id: actionId,
      narrative: capabilityResult.narrative || 'Organization capability assessment completed.',
      axes,
      total_evidence_count: allEvidence.length,
      computed_at: new Date().toISOString()
    };

    return success(capabilityProfile);
  } finally {
    db.release();
  }
}

/**
 * Compute recency weight for an observation based on its capture date.
 * 0-30 days: 1.0, 30-90 days: 0.7, 90-180 days: 0.4, >180 days: 0.2
 * Requirements: 3.6
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
 * Detect whether a gap exists between requirement and capability levels.
 * Gap is detected when requirement - capability > threshold.
 * Requirements: 4.5
 */
function detectGap(requirementLevel, capabilityLevel, threshold = 1) {
  return (requirementLevel - capabilityLevel) > threshold;
}

/**
 * Build the vector similarity search SQL query for retrieving observation evidence.
 * Extracted from the inline SQL in handleIndividualCapability and handleOrganizationCapability.
 * Requirements: 3.6, 4.5
 */
function buildEvidenceQuery(skillProfileEmbedding, organizationId) {
  const OBSERVATION_LIMIT = 50;

  return `SELECT
        entity_id,
        embedding_source,
        (1 - (embedding <=> '${skillProfileEmbedding}'::vector)) as similarity
      FROM unified_embeddings
      WHERE entity_type = 'state'
        AND organization_id = '${organizationId}'
      ORDER BY embedding <=> '${skillProfileEmbedding}'::vector
      LIMIT ${OBSERVATION_LIMIT}`;
}

module.exports.computeRecencyWeight = computeRecencyWeight;
module.exports.detectGap = detectGap;

/**
 * Fetch learning completion data for a user on an action.
 * Returns an array of { axisKey, axisLabel, totalObjectives, completedObjectives, objectiveTexts }
 * for each axis that has learning objectives.
 *
 * Learning objectives are states with [learning_objective] prefix linked to the action.
 * Completion is determined by knowledge states linked to the objective that contain "correct answer".
 */
async function fetchLearningCompletionData(db, actionIdSafe, userIdSafe, orgIdSafe, skillProfile) {
  try {
    // Fetch all learning objectives for this user on this action
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
      return [];
    }

    // Parse objectives and group by axis
    const objectivesByAxis = {};
    const allObjectiveIds = [];
    for (const row of objectivesResult.rows) {
      const match = row.state_text.match(
        /^\[learning_objective\] axis=(\S+) action=\S+ user=\S+ \| (.+)$/
      );
      if (match) {
        const axisKey = match[1];
        const objectiveText = match[2];
        if (!objectivesByAxis[axisKey]) {
          objectivesByAxis[axisKey] = [];
        }
        objectivesByAxis[axisKey].push({ id: row.id, text: objectiveText });
        allObjectiveIds.push(row.id);
      }
    }

    if (allObjectiveIds.length === 0) return [];

    // Fetch knowledge states to determine which objectives are completed
    const objectiveIdsList = allObjectiveIds.map(id => `'${escapeLiteral(id)}'`).join(',');
    const knowledgeResult = await db.query(
      `SELECT sl.entity_id as objective_id, s.state_text
       FROM states s
       INNER JOIN state_links sl ON sl.state_id = s.id
       WHERE sl.entity_type = 'learning_objective'
         AND sl.entity_id IN (${objectiveIdsList})
         AND s.organization_id = '${orgIdSafe}'`
    );

    // Build set of completed objective IDs (has "correct answer" in knowledge state)
    const completedObjectiveIds = new Set();
    for (const row of knowledgeResult.rows) {
      if (row.state_text.includes('which was the correct answer')) {
        completedObjectiveIds.add(row.objective_id);
      }
      // Also check for demonstration completion
      if (row.state_text.startsWith('Demonstrated learning objective')) {
        completedObjectiveIds.add(row.objective_id);
      }
    }

    // Build per-axis learning completion data
    const result = [];
    for (const [axisKey, objectives] of Object.entries(objectivesByAxis)) {
      const skillAxis = skillProfile.axes.find(a => a.key === axisKey);
      const completedObjectives = objectives.filter(o => completedObjectiveIds.has(o.id));
      result.push({
        axisKey,
        axisLabel: skillAxis?.label || axisKey,
        totalObjectives: objectives.length,
        completedObjectives: completedObjectives.length,
        objectiveTexts: completedObjectives.map(o => o.text)
      });
    }

    return result;
  } catch (err) {
    console.error('Error fetching learning completion data:', err);
    return [];
  }
}
module.exports.buildEvidenceQuery = buildEvidenceQuery;
module.exports.buildZeroCapabilityProfile = buildZeroCapabilityProfile;
