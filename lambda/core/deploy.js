const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LAYER_ARN = 'arn:aws:lambda:us-west-2:131745734428:layer:cwf-common-nodejs:9';

const deploy = () => {
  console.log('📦 Preparing deployment package...');
  
  // Create zip file (no shared folder - using layer)
  const zipPath = path.join(__dirname, 'function.zip');
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  execSync('zip -q -r function.zip index.js package.json package-lock.json node_modules/ -x "*.zip"', {
    cwd: __dirname
  });
  console.log('✓ Created deployment package');
  
  // Deploy code
  console.log('🚀 Deploying Lambda function...');
  try {
    const output = execSync(
      'aws lambda update-function-code --function-name cwf-core-lambda --zip-file fileb://function.zip --region us-west-2',
      { cwd: __dirname, encoding: 'utf8' }
    );
    const response = JSON.parse(output);
    console.log('✅ Code deployed!');
    console.log('Code Size:', response.CodeSize, 'bytes');
  } catch (error) {
    console.error('❌ Code deployment failed!');
    console.error(error.message);
    process.exit(1);
  }
  
  // Update layer configuration
  console.log('🔧 Updating layer configuration...');
  try {
    execSync(
      `aws lambda update-function-configuration --function-name cwf-core-lambda --layers ${LAYER_ARN} --region us-west-2`,
      { cwd: __dirname, encoding: 'utf8' }
    );
    console.log('✅ Layer configured!');
  } catch (error) {
    console.error('❌ Layer configuration failed!');
    console.error(error.message);
    process.exit(1);
  }
};

deploy();
console.log('\n✅ Deployment complete! Using layer:', LAYER_ARN);
