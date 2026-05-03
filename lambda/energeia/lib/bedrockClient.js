const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-west-2'
});

const MODEL_ID = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

const VALID_BOUNDARY_TYPES = new Set(['internal', 'external']);
const VALID_ENERGY_TYPES = new Set(['dynamis', 'oikonomia', 'techne']);

/**
 * Build the prompt for a single cluster.
 * Returns cluster title, description, boundary_type, and per-action energy_type
 * in a single JSON response.
 *
 * @param {string[]} actionTitles - All deduplicated action titles in the cluster
 * @param {number} clusterId
 * @returns {string}
 */
function buildClaudePrompt(actionTitles, clusterId) {
  const textList = actionTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const exampleMap = actionTitles.slice(0, 2).reduce((acc, t) => {
    acc[t] = 'oikonomia';
    return acc;
  }, {});

  return (
    `You are analyzing a cluster of organizational actions to infer the emergent role or theme they represent.\n\n` +
    `Here are all ${actionTitles.length} actions in cluster ${clusterId}:\n${textList}\n\n` +
    `Identify the common thread across ALL of these actions — not just the most prominent ones.\n` +
    `If the actions are diverse, name the broader organizational function they collectively serve.\n\n` +
    `Also classify the cluster boundary:\n` +
    `- "internal" if it represents core operations of the organization (e.g. Poultry Care, Agriculture, Food Production, Equipment Maintenance)\n` +
    `- "external" if it represents interactions with outside entities (e.g. Compliance, Government, Vendors, Purchases, Reporting, Certification)\n\n` +
    `Also classify each action by Aristotelian energy type (with RL equivalent):\n` +
    `- "dynamis"   — Exploration. Activities that expand capability, revenue, or reach. The Spark.\n` +
    `- "oikonomia" — Exploitation. Activities that sustain existing operations. The Hearth.\n` +
    `- "techne"    — Meta-Policy. Activities that improve how work is done. The Tool.\n\n` +
    `Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:\n` +
    `{\n` +
    `  "title": "<2-4 word role title>",\n` +
    `  "description": "<one sentence describing what this cluster does>",\n` +
    `  "boundary_type": "internal" or "external",\n` +
    `  "action_energy_map": ${JSON.stringify(exampleMap)}\n` +
    `}\n\n` +
    `The action_energy_map must contain an entry for every action title listed above.\n` +
    `Examples of good titles: "Farm Operations", "Compliance & Admin", "Food Production", "Infrastructure Planning".\n` +
    `Avoid naming the cluster after a single specific task — the title should fit all actions in the list.`
  );
}

/**
 * Label clusters using Claude via AWS Bedrock.
 * Returns title, description, boundary_type, and action_energy_map per cluster.
 * On Claude error for a specific cluster, returns a fallback label and continues.
 *
 * @param {Array<{ id: number, actionTitles: string[] }>} clusters
 * @returns {Promise<Array<{
 *   id: number,
 *   title: string,
 *   description: string,
 *   boundary_type: 'internal' | 'external',
 *   action_energy_map: Record<string, 'dynamis' | 'oikonomia' | 'techne'>
 * }>>}
 */
async function labelClusters(clusters) {
  const results = [];

  for (const cluster of clusters) {
    try {
      const prompt = buildClaudePrompt(cluster.actionTitles, cluster.id);

      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(body)
      });

      const response = await client.send(command);
      const responseText = Buffer.from(response.body).toString('utf-8');
      const parsed = JSON.parse(responseText);

      // Claude response format: { content: [{ type: 'text', text: '...' }] }
      const text = parsed.content?.[0]?.text || '';
      const label = JSON.parse(text.trim());

      // Validate boundary_type — default to 'internal' if missing or invalid
      const boundaryType = VALID_BOUNDARY_TYPES.has(label.boundary_type)
        ? label.boundary_type
        : 'internal';

      // Validate action_energy_map — default each missing/invalid entry to 'oikonomia'
      const actionEnergyMap = {};
      for (const title of cluster.actionTitles) {
        const raw = label.action_energy_map?.[title];
        actionEnergyMap[title] = VALID_ENERGY_TYPES.has(raw) ? raw : 'oikonomia';
      }

      results.push({
        id: cluster.id,
        title: label.title || `Cluster ${cluster.id}`,
        description: label.description || 'A group of related actions.',
        boundary_type: boundaryType,
        action_energy_map: actionEnergyMap,
      });
    } catch (err) {
      console.error(`[bedrockClient] Failed to label cluster ${cluster.id}:`, err.message);
      // Fallback: all actions default to 'oikonomia', cluster defaults to 'internal'
      const actionEnergyMap = {};
      for (const title of cluster.actionTitles) {
        actionEnergyMap[title] = 'oikonomia';
      }
      results.push({
        id: cluster.id,
        title: `Cluster ${cluster.id}`,
        description: 'A group of related actions.',
        boundary_type: 'internal',
        action_energy_map: actionEnergyMap,
      });
    }
  }

  return results;
}

module.exports = { labelClusters, buildClaudePrompt };
