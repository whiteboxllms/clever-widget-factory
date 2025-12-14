const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

/**
 * Generate embedding using AWS Bedrock Titan Embeddings
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
async function generateEmbedding(text) {
  const modelId = 'amazon.titan-embed-text-v1';
  
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text })
  });
  
  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.embedding;
}

module.exports = { generateEmbedding };
