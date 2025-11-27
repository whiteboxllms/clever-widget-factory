const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');

const deploy = async () => {
  const client = new LambdaClient({ region: 'us-west-2' });
  
  const zipPath = path.join(__dirname, 'function.zip');
  const zipBuffer = fs.readFileSync(zipPath);
  
  const command = new UpdateFunctionCodeCommand({
    FunctionName: 'cwf-core-lambda',
    ZipFile: zipBuffer
  });
  
  try {
    console.log('Deploying Lambda function...');
    const response = await client.send(command);
    console.log('✅ Deployment successful!');
    console.log('Function ARN:', response.FunctionArn);
    console.log('Last Modified:', response.LastModified);
    console.log('Code Size:', response.CodeSize, 'bytes');
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
};

deploy();
