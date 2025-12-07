const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const https = require('https');

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const API_BASE_URL = process.env.API_BASE_URL || 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';

async function generateEmbedding(text) {
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({ inputText: text })
  });
  
  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.embedding;
}

async function updateAssetEmbedding(assetType, assetId, embedding) {
  const tableName = assetType === 'part' ? 'parts' : 'tools';
  const embeddingArray = `[${embedding.join(',')}]`;
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      sql: `UPDATE ${tableName} SET search_embedding = '${embeddingArray}' WHERE id = '${assetId}'`
    });
    
    const options = {
      hostname: API_BASE_URL.replace('https://', '').split('/')[0],
      path: '/prod/api/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const snsMessage = JSON.parse(message.Message);
      
      const { eventType, assetType, assetId, assetData } = snsMessage;
      
      console.log(`Processing ${eventType} for ${assetType} ${assetId}`);
      
      if (!['part', 'tool'].includes(assetType)) {
        console.log(`Skipping ${assetType} - only processing parts and tools`);
        continue;
      }
      
      const text = `${assetData.name || ''} ${assetData.description || ''} ${assetData.category || ''}`.trim();
      
      if (!text) {
        console.log(`No text to embed for ${assetType} ${assetId}`);
        continue;
      }
      
      console.log(`Generating embedding for: ${text.substring(0, 100)}...`);
      const embedding = await generateEmbedding(text);
      
      console.log(`Updating ${assetType} ${assetId} with embedding`);
      await updateAssetEmbedding(assetType, assetId, embedding);
      
      console.log(`Successfully processed ${assetType} ${assetId}`);
    } catch (error) {
      console.error('Error processing record:', error);
      throw error;
    }
  }
  
  return { statusCode: 200, body: 'Success' };
};
