#!/bin/bash
# Enable gzip compression on API Gateway
# This compresses responses larger than 1KB, which can reduce
# tools (1.2MB) and parts (607KB) payloads by ~70-80%
#
# The client must send Accept-Encoding: gzip header (browsers do this automatically)
# API Gateway will compress the Lambda response before sending it to the client

set -e

API_ID="0720au267k"
REGION="us-west-2"

echo "Enabling compression on API Gateway (minimum 1KB)..."
aws apigateway update-rest-api \
  --rest-api-id $API_ID \
  --patch-operations op=replace,path=/minimumCompressionSize,value=1024 \
  --region $REGION \
  --query '{name: name, minimumCompressionSize: minimumCompressionSize}' \
  --output json

echo ""
echo "Deploying changes to prod stage..."
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region $REGION \
  --query 'id' \
  --output text

echo ""
echo "✅ Compression enabled! Responses > 1KB will be gzipped."
echo "Expected savings: tools ~1.2MB → ~250KB, parts ~607KB → ~130KB"
