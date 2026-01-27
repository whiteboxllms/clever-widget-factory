/**
 * Action Scoring with AWS Bedrock
 * 
 * Provides reusable functions for generating action accountability scores
 * using AWS Bedrock (Claude Haiku).
 * 
 * Used by:
 * - lambda/action-scoring: Auto-scoring Lambda function
 * - Future: Batch scoring, analytics
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
const MODEL_ID = 'anthropic.claude-3-5-haiku-20241022-v1:0';

/**
 * Strip HTML tags and decode entities
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  // Simple HTML stripping for Node.js (no DOM parser)
  return html
    .replace(/<[^>]*>/g, '') // Remove tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Build scoring prompt with action context
 * 
 * Replicates the logic from ActionScoreDialog.generatePrompt()
 * to ensure consistency between manual and automated flows.
 * 
 * @param {Object} action - Action with joined data
 * @param {string} action.id - Action ID
 * @param {string} action.title - Action title
 * @param {string} [action.description] - Action description
 * @param {string} [action.policy] - Action policy (HTML)
 * @param {string} [action.observations] - Action observations (HTML)
 * @param {string} action.status - Action status
 * @param {string} action.created_at - Created timestamp
 * @param {string} [action.completed_at] - Completed timestamp
 * @param {string} [action.estimated_duration] - Estimated duration
 * @param {string} [action.issue_reference] - Issue reference
 * @param {Array} [action.required_tools] - Required tools
 * @param {Array} [action.required_stock] - Required stock
 * @param {Object} [action.assignee] - Assignee info
 * @param {Object} [action.asset] - Asset info
 * @param {Object} [action.linked_issue] - Linked issue info
 * @param {Object} prompt - Scoring prompt
 * @param {string} prompt.prompt_text - Prompt template
 * @returns {string} - Complete prompt for Bedrock
 */
function buildScoringPrompt(action, prompt) {
  // Build action context - asset is optional
  const actionContext = {
    id: action.id,
    title: action.title,
    description: action.description,
    policy: stripHtml(action.policy),
    observations: stripHtml(action.observations),
    status: action.status,
    created_at: action.created_at,
    assigned_to: action.assignee?.full_name,
    estimated_duration: action.estimated_duration,
    required_tools: action.required_tools,
    required_stock: action.required_stock,
    completed_at: action.completed_at,
    issue_reference: action.issue_reference
  };

  // Add asset info only if available
  if (action.asset) {
    actionContext.asset = {
      name: action.asset.name,
      id: action.asset.id,
      category: action.asset.category,
      location: action.asset.storage_vicinity,
      serial_number: action.asset.serial_number
    };
  }

  // Add linked issue if available
  if (action.linked_issue) {
    actionContext.linked_issue = {
      description: action.linked_issue.description,
      type: action.linked_issue.issue_type,
      status: action.linked_issue.status,
      reported_at: action.linked_issue.reported_at,
      damage_assessment: action.linked_issue.damage_assessment,
      efficiency_loss_percentage: action.linked_issue.efficiency_loss_percentage,
      root_cause: action.linked_issue.root_cause,
      resolution_notes: action.linked_issue.resolution_notes
    };
  }

  // Add strict instructions to avoid defaulting or guessing assets
  const antiLeakageAddendum = `

IMPORTANT OVERRIDES (do not ignore):
- Do NOT invent, infer, or reuse any asset from prior context or examples.
- Only include an "asset" field in the output if actionContext.asset is present.
- If actionContext.asset is not present, OMIT the "asset" field entirely (do not write "unspecified").
- If present, the asset name MUST exactly match actionContext.asset.name.
`;

  return `${prompt.prompt_text}${antiLeakageAddendum}\n\n${JSON.stringify(actionContext, null, 2)}`;
}

/**
 * Call Bedrock to generate scores
 * 
 * @param {string} prompt - Complete prompt with action context
 * @returns {Promise<Object>} - Raw Bedrock response
 * @throws {Error} - If Bedrock call fails
 */
async function generateScoresWithBedrock(prompt) {
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000, // Scores can be verbose
    temperature: 0.3,  // Consistency over creativity
    messages: [{ role: "user", content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json'
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.content?.[0]?.text) {
      throw new Error('Invalid response from Bedrock: missing content');
    }
    
    return responseBody.content[0].text.trim();
  } catch (error) {
    console.error('Bedrock API error:', error);
    throw new Error(`Bedrock API error: ${error.message}`);
  }
}

/**
 * Validate and parse AI response
 * 
 * Expected format:
 * {
 *   "scores": {
 *     "category_name": {
 *       "score": 1-10,
 *       "reason": "explanation"
 *     }
 *   },
 *   "likely_root_causes": ["cause1", "cause2"]
 * }
 * 
 * @param {string} responseText - Raw text response from Bedrock
 * @returns {Object} - Validated scores and root causes
 * @returns {Object} .scores - Score object with categories
 * @returns {Array<string>} .likely_root_causes - Root causes array
 * @returns {Object} .raw - Raw parsed JSON for storage
 * @throws {Error} - If response format is invalid
 */
function parseAndValidateScores(responseText) {
  let parsed;
  
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`Invalid JSON response from AI: ${error.message}`);
  }

  // Validate scores object exists
  if (!parsed.scores || typeof parsed.scores !== 'object') {
    throw new Error('Invalid response format: missing or invalid "scores" object');
  }

  // Validate each score entry
  const scores = {};
  for (const [category, scoreData] of Object.entries(parsed.scores)) {
    if (!scoreData || typeof scoreData !== 'object') {
      throw new Error(`Invalid score data for category "${category}"`);
    }

    if (typeof scoreData.score !== 'number') {
      throw new Error(`Invalid score value for category "${category}": must be a number`);
    }

    if (scoreData.score < 1 || scoreData.score > 10) {
      throw new Error(`Invalid score value for category "${category}": must be between 1 and 10`);
    }

    if (typeof scoreData.reason !== 'string' || !scoreData.reason.trim()) {
      throw new Error(`Invalid reason for category "${category}": must be a non-empty string`);
    }

    scores[category] = {
      score: scoreData.score,
      reason: scoreData.reason.trim()
    };
  }

  // Validate likely_root_causes (optional but must be array if present)
  let rootCauses = [];
  if (parsed.likely_root_causes !== undefined) {
    if (!Array.isArray(parsed.likely_root_causes)) {
      throw new Error('Invalid response format: "likely_root_causes" must be an array');
    }
    rootCauses = parsed.likely_root_causes.filter(cause => 
      typeof cause === 'string' && cause.trim()
    );
  }

  return {
    scores,
    likely_root_causes: rootCauses,
    raw: parsed // Store full response for reference
  };
}

module.exports = {
  buildScoringPrompt,
  generateScoresWithBedrock,
  parseAndValidateScores,
  stripHtml // Export for testing
};
