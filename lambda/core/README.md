# Core Lambda Deployment

## ⚠️ CRITICAL: Always Include node_modules

**The Lambda MUST include `node_modules/` in the zip file.**

Without it, you'll get:
- `Runtime.ImportModuleError: Cannot find module 'pg'`
- 502 Bad Gateway errors
- CORS failures

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
**ALWAYS include these 3 things:**
```bash
zip -r function.zip index.js shared/ node_modules/
```

### 3. Deploy to AWS
```bash
aws lambda update-function-code \
  --function-name cwf-core-lambda \
  --zip-file fileb://function.zip \
  --region us-west-2
```

### 4. Clean up
```bash
rm function.zip
```

## One-Line Deploy
```bash
zip -r function.zip index.js shared/ node_modules/ && aws lambda update-function-code --function-name cwf-core-lambda --zip-file fileb://function.zip --region us-west-2 && rm function.zip
```

## Common Issues

### "Cannot find module 'pg'" or "Cannot find module './shared/authorizerContext'"
- **Cause**: Missing `node_modules/` or `shared/` in the zip
- **Fix**: ALWAYS include both: `zip -r function.zip index.js shared/ node_modules/`

### 502 Bad Gateway / CORS errors
- **Cause**: Lambda runtime error (usually missing node_modules)
- **Debug**: `aws logs tail /aws/lambda/cwf-core-lambda --since 5m --region us-west-2 --format short`
