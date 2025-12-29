const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const deploy = async () => {
  console.log('📦 Preparing deployment package...');
  
  // Install dependencies if node_modules doesn't exist
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📥 Installing dependencies...');
    execSync('npm install --production', { cwd: __dirname });
  }
  
  // Copy shared folder from core lambda
  const sharedSrc = path.join(__dirname, '..', 'core', 'shared');
  const sharedDest = path.join(__dirname, 'shared');
  
  if (fs.existsSync(sharedDest)) {
    execSync(`rm -rf ${sharedDest}`);
  }
  
  if (fs.existsSync(sharedSrc)) {
    execSync(`cp -r ${sharedSrc} ${sharedDest}`);
    console.log('✓ Copied shared folder');
  } else {
    console.log('⚠️  No shared folder found, skipping');
  }
  
  // Create zip file
  const zipPath = path.join(__dirname, 'function.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  const zipCommand = fs.existsSync(sharedDest)
    ? 'zip -q -r function.zip index.js node_modules/ shared/ -x "*.zip"'
    : 'zip -q -r function.zip index.js node_modules/ -x "*.zip"';
  
  execSync(zipCommand, { cwd: __dirname });
  console.log('✓ Created deployment package');
  
  // Deploy to Lambda
  const client = new LambdaClient({ region: 'us-west-2' });
  const zipBuffer = fs.readFileSync(zipPath);
  
  const command = new UpdateFunctionCodeCommand({
    FunctionName: 'cwf-actions-lambda',
    ZipFile: zipBuffer
  });
  
  try {
    console.log('🚀 Deploying Lambda function...');
    const response = await client.send(command);
    console.log('✅ Deployment successful!');
    console.log('Function ARN:', response.FunctionArn);
    console.log('Last Modified:', response.LastModified);
    console.log('Code Size:', response.CodeSize, 'bytes');
    
    // Cleanup
    if (fs.existsSync(sharedDest)) {
      execSync(`rm -rf ${sharedDest}`);
    }
    fs.unlinkSync(zipPath);
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
};

deploy();
