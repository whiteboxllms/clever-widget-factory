const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const deploy = async () => {
  console.log('📦 Preparing deployment package...');
  
  // Copy shared folder from parent directory
  const sharedSrc = path.join(__dirname, '..', 'shared');
  const sharedDest = path.join(__dirname, 'shared');
  
  if (fs.existsSync(sharedDest)) {
    execSync(`rm -rf ${sharedDest}`);
  }
  execSync(`cp -r ${sharedSrc} ${sharedDest}`);
  console.log('✓ Copied shared folder');
  
  // Create zip file
  const zipPath = path.join(__dirname, 'function.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  execSync('zip -q -r function.zip index.js package.json package-lock.json node_modules/ shared/ -x "*.zip"', {
    cwd: __dirname
  });
  console.log('✓ Created deployment package');
  
  // Deploy to Lambda
  const client = new LambdaClient({ region: 'us-west-2' });
  const zipBuffer = fs.readFileSync(zipPath);
  
  const command = new UpdateFunctionCodeCommand({
    FunctionName: 'cwf-core-lambda',
    ZipFile: zipBuffer
  });
  
  try {
    console.log('🚀 Deploying Lambda function...');
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
