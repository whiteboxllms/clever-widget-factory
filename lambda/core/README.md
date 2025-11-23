# Core Lambda Deployment

## Prerequisites
- AWS CLI configured with appropriate credentials
- Node.js dependencies installed (`npm install`)

## Deployment Steps

### 1. Copy shared directory
The Lambda requires the shared authorizer context module:
```bash
cp -r ../shared .
```

### 2. Package the Lambda
```bash
zip -r core-lambda-deployment.zip index.js package.json package-lock.json node_modules/ shared/
```

### 3. Deploy to AWS
```bash
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://core-lambda-deployment.zip \
  --region us-west-2
```

### 4. Wait for deployment
The function status will show "InProgress" initially. Wait ~30 seconds for it to become "Active".

## Quick Deploy Script
```bash
#!/bin/bash
cp -r ../shared . && \
zip -r core-lambda-deployment.zip index.js package.json package-lock.json node_modules/ shared/ && \
aws lambda update-function-code --function-name cwf-core-lambda --zip-file fileb://core-lambda-deployment.zip --region us-west-2
```

## Common Issues

### "Cannot find module './shared/authorizerContext'"
- **Cause**: The `shared/` directory wasn't included in the zip
- **Fix**: Run `cp -r ../shared .` before zipping

### 502 Bad Gateway
- **Cause**: Lambda function has a runtime error (check CloudWatch logs)
- **Debug**: `aws logs tail /aws/lambda/cwf-core-lambda --since 5m --region us-west-2 --format short`
