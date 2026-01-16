const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { LambdaClient, UpdateFunctionCodeCommand } = require('@aws-sdk/client-lambda');

const deploy = () => {
  console.log('📦 Preparing deployment package...');
  
  // Copy shared folder from parent directory
  const sharedSrc = path.join(__dirname, '..', 'shared');
  const sharedDest = path.join(__dirname, 'shared');
  
  if (fs.existsSync(sharedDest)) {
    execSync(`rm -rf ${sharedDest}`);
  }
  execSync(`cp -r ${sharedSrc} ${sharedDest}`);
  console.log('✓ Copied shared folder');
  
  // Verify shared folder has required files
  const requiredFiles = ['authorizerContext.js', 'response.js', 'db.js'];
  for (const file of requiredFiles) {
    const filePath = path.join(sharedDest, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing required file: shared/${file}`);
      process.exit(1);
    }
  }
  console.log('✓ Verified shared folder contents');
  
  // Create zip file
  const zipPath = path.join(__dirname, 'function.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  execSync('zip -q -r function.zip index.js package.json package-lock.json node_modules/ shared/ -x "*.zip"', {
    cwd: __dirname
  });
  console.log('✓ Created deployment package');
  
  // Verify zip contains shared folder
  try {
    const zipContents = execSync('unzip -l function.zip | grep "shared/authorizerContext.js"', {
      cwd: __dirname,
      encoding: 'utf8'
    });
    if (!zipContents) {
      console.error('❌ shared/authorizerContext.js not found in zip file');
      process.exit(1);
    }
    console.log('✓ Verified zip package contents');
  } catch (error) {
    console.error('❌ Failed to verify zip contents:', error.message);
    process.exit(1);
  }
  
  // Deploy using AWS CLI
  console.log('🚀 Deploying Lambda function...');
  try {
    const output = execSync(
      'aws lambda update-function-code --function-name cwf-core-lambda --zip-file fileb://function.zip --region us-west-2',
      { cwd: __dirname, encoding: 'utf8' }
    );
    const response = JSON.parse(output);
    console.log('✅ Deployment successful!');
    console.log('Function ARN:', response.FunctionArn);
    console.log('Last Modified:', response.LastModified);
    console.log('Code Size:', response.CodeSize, 'bytes');
  } catch (error) {
    console.error('❌ Deployment failed!');
    console.error(error.message);
    process.exit(1);
  }
};

deploy();
