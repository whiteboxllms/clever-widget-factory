#!/usr/bin/env node

/**
 * CDK App for Bedrock Agent Tools
 * Deploy with: cdk deploy
 */

const { App } = require('aws-cdk-lib');
const { BedrockToolsStack } = require('./bedrock-tools-stack');

const app = new App();

new BedrockToolsStack(app, 'BedrockToolsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
  description: 'Lambda tools for Bedrock Agent conversational search'
});

app.synth();