#!/bin/bash

QUEUE_URL="https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue"
REGION="us-west-2"

echo "Creating Dead Letter Queue..."
DLQ_URL=$(aws sqs create-queue \
  --queue-name cwf-embeddings-dlq \
  --region $REGION \
  --output text \
  --query 'QueueUrl')

echo "DLQ created: $DLQ_URL"

# Get DLQ ARN
DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --region $REGION \
  --query 'Attributes.QueueArn' \
  --output text)

echo "DLQ ARN: $DLQ_ARN"

# Configure main queue with DLQ (after 3 failed attempts)
echo "Configuring main queue with DLQ..."
aws sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}" \
  --region $REGION

echo "✅ DLQ configured! Messages will move to DLQ after 3 failed attempts"
