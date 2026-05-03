const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-west-2'
});

const MODEL_ID = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

/**
 * Build the prompt for a single cluster given all its action titles.
 *
 * @param {string[]} actionTitles - All deduplicated action titles in the cluster
 * @param {number} clusterId
 * @returns {string}
 */
function buildClaudePrompt(actionTitles, clusterId) {
  const textList = actionTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return (
    `You are analyzing a cluster of organizational actions to infer the emergent role or theme they represent.\n\n` +
    `Here are all ${actionTitles.length} actions in cluster ${clusterId}:\n${textList}\n\n` +
    `Identify the common thread across ALL of these actions — not just the most prominent ones.\n` +
    `If the actions are diverse, name the broader organizational function they collectively serve.\n\n` +
    `Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:\n` +
    `{"title": "<2-4 word role title>", "description": "<one sentence describing what this cluster does>"}\n\n` +
    `Examples of good titles: "Farm Operations", "Compliance & Admin", "Food Production", "Infrastructure Planning".\n` +
    `Avoid naming the cluster after a single specific task — the title should fit all actions in the list.`
  );
}

/**
 * Label clusters using Claude via AWS Bedrock.
 * On Claude error for a specific cluster, returns a fallback label and continues.
 *
 * @param {Array<{ id: number, embeddingSources: string[] }>} clusters
 * @returns {Promise<Array<{ id: number, title: string, description: string }>>}
 */
async function labelClusters(clusters) {
  const results = [];

  for (const cluster of clusters) {
    try {
      const prompt = buildClaudePrompt(cluster.actionTitles, cluster.id);

      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 256,
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

      results.push({
        id: cluster.id,
        title: label.title || `Cluster ${cluster.id}`,
        description: label.description || 'A group of related actions.'
      });
    } catch (err) {
      console.error(`[bedrockClient] Failed to label cluster ${cluster.id}:`, err.message);
      results.push({
        id: cluster.id,
        title: `Cluster ${cluster.id}`,
        description: 'A group of related actions.'
      });
    }
  }

  return results;
}

module.exports = { labelClusters, buildClaudePrompt };
