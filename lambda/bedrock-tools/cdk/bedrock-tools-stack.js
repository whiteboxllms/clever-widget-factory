/**
 * CDK Stack for Bedrock Agent Tools
 * Deploys Lambda functions for conversational product search
 */

const { Stack, Duration } = require('aws-cdk-lib');
const { Function, Runtime, Code } = require('aws-cdk-lib/aws-lambda');
const { Role, ServicePrincipal, PolicyStatement, Effect } = require('aws-cdk-lib/aws-iam');
const { LogGroup, RetentionDays } = require('aws-cdk-lib/aws-logs');

class BedrockToolsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create IAM role for Lambda functions
    const lambdaRole = new Role(this, 'BedrockToolsLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Bedrock Agent Lambda tools',
    });

    // Add basic Lambda execution permissions
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['arn:aws:logs:*:*:*']
    }));

    // Add Bedrock permissions for embeddings
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1'
      ]
    }));

    // Add RDS connection permissions (adjust as needed)
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'rds:DescribeDBInstances',
        'rds-db:connect'
      ],
      resources: ['*'] // Restrict this to your specific RDS instance
    }));

    // Create pgvector Search Tool Lambda
    const pgvectorSearchTool = new Function(this, 'PgvectorSearchTool', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: Code.fromAsset('../pgvector-search'),
      role: lambdaRole,
      timeout: Duration.seconds(30),
      memorySize: 512,
      description: 'Conversational pgvector search tool for Bedrock Agent',
      environment: {
        DB_HOST: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
        DB_PORT: process.env.DB_PORT || '5432',
        DB_NAME: process.env.DB_NAME || 'postgres',
        DB_USER: process.env.DB_USER || 'postgres',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        AWS_REGION: process.env.AWS_REGION || 'us-west-2'
      }
    });

    // Create CloudWatch Log Group with retention
    new LogGroup(this, 'PgvectorSearchToolLogGroup', {
      logGroupName: `/aws/lambda/${pgvectorSearchTool.functionName}`,
      retention: RetentionDays.ONE_WEEK
    });

    // Create IAM role for Bedrock Agent
    const bedrockExecutionRole = new Role(this, 'BedrockExecutionRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Bedrock Agent to invoke Lambda tools',
    });

    // Allow Bedrock Agent to invoke Lambda functions
    bedrockExecutionRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction'
      ],
      resources: [
        pgvectorSearchTool.functionArn
      ]
    }));

    // Allow Bedrock Agent to use Claude models
    bedrockExecutionRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0'
      ]
    }));

    // Output important values
    this.pgvectorSearchToolArn = pgvectorSearchTool.functionArn;
    this.bedrockExecutionRoleArn = bedrockExecutionRole.roleArn;
  }
}

module.exports = { BedrockToolsStack };