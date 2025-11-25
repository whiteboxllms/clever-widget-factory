const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: 'us-west-2' });

async function getOpenRouterKey() {
  const command = new GetParameterCommand({
    Name: '/cwf/openrouter-api-key',
    WithDecryption: true
  });
  
  const response = await ssm.send(command);
  return response.Parameter.Value;
}

module.exports = { getOpenRouterKey };