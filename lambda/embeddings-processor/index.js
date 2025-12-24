const { generateEmbeddingV1, generateEmbeddingV2 } = require('../shared/embeddings');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambda = new LambdaClient({ region: 'us-west-2' });

async function updateAssetEmbedding(table, id, searchText, embeddingV1, embeddingV2) {
  const embeddingV1Array = `[${embeddingV1.join(',')}]`;
  const embeddingV2Array = `[${embeddingV2.join(',')}]`;
  const escapedText = searchText.replace(/'/g, "''");
  
  const sql = `UPDATE ${table} SET search_text = '${escapedText}', search_embedding = '${embeddingV1Array}'::vector, search_embedding_v2 = '${embeddingV2Array}'::vector WHERE id = '${id}'`;
  
  // Call db-migration Lambda to execute SQL
  const response = await lambda.send(new InvokeCommand({
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  console.log('DB update result:', result);
  return result;
}

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { id, table, text } = message;
      
      console.log(`Processing ${table} ${id}`);
      
      if (!['parts', 'tools'].includes(table)) {
        console.log(`Skipping ${table} - only processing parts and tools`);
        continue;
      }
      
      if (!text || !text.trim()) {
        console.log(`No text to embed for ${table} ${id}`);
        continue;
      }
      
      console.log(`Generating embeddings for: ${text.substring(0, 100)}...`);
      const [embeddingV1, embeddingV2] = await Promise.all([
        generateEmbeddingV1(text),
        generateEmbeddingV2(text)
      ]);
      console.log(`Generated V1 (${embeddingV1.length} dims) and V2 (${embeddingV2.length} dims)`);
      
      console.log(`Updating ${table} ${id} with both embeddings`);
      await updateAssetEmbedding(table, id, text, embeddingV1, embeddingV2);
      
      console.log(`Successfully processed ${table} ${id}`);
    } catch (error) {
      console.error('Error processing record:', error);
      throw error;
    }
  }
  
  return { statusCode: 200, body: 'Success' };
};
