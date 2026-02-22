#!/usr/bin/env node

/**
 * Deploy Lambda function using AWS SDK
 * This handles large packages better than the CLI
 */

const { LambdaClient, CreateFunctionCommand, PublishVersionCommand } = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');

const FUNCTION_NAME = 'cwf-image-resizer-edge';
const REGION = 'us-east-1';
const ROLE_ARN = 'arn:aws:iam::131745734428:role/lambda-edge-execution-role';

async function deployFunction() {
  const client = new LambdaClient({ region: REGION });
  
  console.log('Reading deployment package...');
  const zipPath = path.join(__dirname, 'cwf-image-resizer-edge.zip');
  const zipBuffer = fs.readFileSync(zipPath);
  console.log(`Package size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('\nCreating Lambda function...');
  try {
    const createCommand = new CreateFunctionCommand({
      FunctionName: FUNCTION_NAME,
      Runtime: 'nodejs18.x',
      Role: ROLE_ARN,
      Handler: 'index.handler',
      Code: {
        ZipFile: zipBuffer
      },
      Timeout: 5,
      MemorySize: 512,
      Environment: {
        Variables: {
          S3_BUCKET: 'cwf-dev-assets',
          S3_REGION: 'us-west-2'
        }
      }
    });
    
    const response = await client.send(createCommand);
    console.log('Function created successfully!');
    console.log(`Function ARN: ${response.FunctionArn}`);
    
    // Publish version
    console.log('\nPublishing version...');
    const publishCommand = new PublishVersionCommand({
      FunctionName: FUNCTION_NAME
    });
    
    const versionResponse = await client.send(publishCommand);
    console.log(`Version: ${versionResponse.Version}`);
    console.log(`Version ARN: ${versionResponse.FunctionArn}`);
    
    console.log('\n==========================================');
    console.log('Deployment Complete!');
    console.log('==========================================');
    console.log(`\nVersion ARN: ${versionResponse.FunctionArn}`);
    console.log('\nNext Steps:');
    console.log('1. Attach this Lambda@Edge function to your CloudFront distribution');
    console.log('2. Use the Version ARN when configuring CloudFront');
    console.log('3. Attach to the "origin-request" event type');
    
  } catch (error) {
    console.error('Error deploying function:', error);
    process.exit(1);
  }
}

deployFunction();
