const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

exports.handler = async (event) => {
  const { text } = event;
  
  if (!text) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'text is required' })
    };
  }
  
  try {
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: text })
    });
    
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ embedding: responseBody.embedding })
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
