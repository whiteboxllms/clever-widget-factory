# CloudFormation Infrastructure Documentation

## Overview

This directory contains CloudFormation templates documenting the Clever Widget Factory infrastructure.

## Stack: cwf-infrastructure.yaml

Complete infrastructure stack including:

### Networking
- VPC (10.0.0.0/16)
- 2 Private Subnets (AZ1, AZ2)
- Security Groups (Lambda, RDS)

### Database
- RDS PostgreSQL 15.4 (db.t3.micro)
- 20GB storage
- 7-day backup retention
- Private subnet deployment

### Authentication
- Cognito User Pool
- User Pool Client
- Email verification

### Messaging
- SQS Queue: `cwf-embeddings-queue`
- Visibility timeout: 300s
- Message retention: 14 days

### Lambda Functions
1. **cwf-core-lambda** (IN VPC)
   - Handles all API requests
   - Connects to RDS
   - Publishes to SQS queue

2. **cwf-api-authorizer** (IN VPC)
   - JWT validation
   - Organization context extraction
   - Connects to RDS for user lookup

3. **cwf-embeddings-processor** (NO VPC)
   - Consumes SQS messages
   - Calls Bedrock for embeddings
   - Updates database via API

4. **cwf-embeddings-lambda** (NO VPC)
   - Direct embedding generation
   - Called by other services

5. **cwf-db-migration** (IN VPC)
   - Database migrations
   - Schema updates

### API Gateway
- REST API: `cwf-api`
- Custom authorizer
- CORS enabled
- Stage: prod

### IAM Roles
- Lambda execution role with:
  - VPC access
  - Bedrock invoke permissions
  - SQS publish/consume
  - CloudWatch logs

## Asset Events Infrastructure

See `asset-events-infrastructure.yaml` for the event-driven architecture that publishes asset changes to SQS for async embedding generation.

## Next Steps: Wire Up SQS Publishing

The core Lambda needs to publish messages to SQS when tools/parts are created/updated.

### Required Changes to lambda/core/index.js

Add at top of file:
```javascript
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: 'us-west-2' });
const EMBEDDINGS_QUEUE_URL = process.env.EMBEDDINGS_QUEUE_URL;
```

Add helper function:
```javascript
async function publishToEmbeddingsQueue(eventType, assetType, assetId, assetData) {
  if (!EMBEDDINGS_QUEUE_URL) {
    console.warn('EMBEDDINGS_QUEUE_URL not set, skipping queue publish');
    return;
  }
  
  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: EMBEDDINGS_QUEUE_URL,
      MessageBody: JSON.stringify({
        eventType,
        assetType,
        assetId,
        assetData,
        timestamp: new Date().toISOString()
      })
    }));
    console.log(`Published ${eventType} event for ${assetType} ${assetId}`);
  } catch (error) {
    console.error('Failed to publish to queue:', error);
  }
}
```

Add after tool creation (line ~180):
```javascript
// After: const result = await queryJSON(insertSql);
await publishToEmbeddingsQueue('created', 'tool', toolId, {
  name: body.name,
  description: body.description,
  category: body.category
});
```

Add after tool update (line ~220):
```javascript
// After: const result = await queryJSON(sql);
await publishToEmbeddingsQueue('updated', 'tool', toolId, {
  name: body.name,
  description: body.description,
  category: body.category
});
```

Add after part creation (line ~350):
```javascript
// After: const result = await queryJSON(sql);
await publishToEmbeddingsQueue('created', 'part', partId, {
  name: body.name,
  description: body.description,
  category: body.category
});
```

Add after part update (line ~420):
```javascript
// After: const result = await queryJSON(sql);
await publishToEmbeddingsQueue('updated', 'part', partId, {
  name: body.name,
  description: body.description,
  category: body.category
});
```

### Deploy Steps

1. Add SQS SDK to core Lambda:
```bash
cd lambda/core
npm install @aws-sdk/client-sqs
```

2. Update Lambda environment variable:
```bash
aws lambda update-function-configuration \
  --function-name cwf-core-lambda \
  --environment Variables="{DB_PASSWORD=<actual_password>,EMBEDDINGS_QUEUE_URL=https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue}" \
  --region us-west-2
```

3. Deploy updated Lambda code:
```bash
cd lambda/core
zip -r core-with-sqs.zip index.js shared/ node_modules/ package.json
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://core-with-sqs.zip \
  --region us-west-2
```

4. Verify SQS trigger is connected to processor Lambda:
```bash
aws lambda list-event-source-mappings \
  --function-name cwf-embeddings-processor \
  --region us-west-2
```

## Cost Estimate

Monthly costs (assuming moderate usage):
- RDS db.t3.micro: ~$15
- Lambda invocations: ~$1
- SQS messages: <$1
- Bedrock embeddings: <$1
- API Gateway: <$1
- **Total: ~$18/month**

## Notes

- VPC Lambda functions have cold start penalty (~10s)
- Embeddings processor is outside VPC for Bedrock access
- SQS provides async, reliable embedding generation
- No VPC endpoint needed (saves $7/month)
