# AWS Secrets Manager Setup

## Cost Analysis

**AWS Secrets Manager Pricing (2025):**
- **$0.40 per secret per month** (storage)
- **$0.05 per 10,000 API calls** (retrieval)

**Estimated Monthly Cost:**
- 1 secret: **$0.40/month**
- With caching (typical usage): **~$0.40-0.45/month total**
- Even with 5 Lambda functions calling it frequently: **< $1/month**

**Conclusion:** Very affordable! The security benefits far outweigh the minimal cost.

## Alternative: AWS Systems Manager Parameter Store (Free)

If cost is a concern, you can use **SSM Parameter Store** instead:
- **Free tier:** 20,000 API requests/month
- **Advanced parameters:** $0.05 per 10,000 requests (same as Secrets Manager)
- **Storage:** Free

However, Secrets Manager offers:
- Automatic rotation
- Better audit logging
- Integration with RDS
- More security features

## Setup Instructions

### 1. Create the Secret in AWS Secrets Manager

#### Via AWS Console:
1. Go to AWS Secrets Manager
2. Click "Store a new secret"
3. Select "Credentials for Amazon RDS database"
4. Enter your database credentials:
   - Username: `postgres`
   - Password: `your-secure-password`
   - Database: `postgres`
   - Host: `cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com`
   - Port: `5432`
5. Secret name: `cwf/rds/postgres`
6. Click "Store"

#### Via AWS CLI:
```bash
aws secretsmanager create-secret \
  --name cwf/rds/postgres \
  --description "RDS PostgreSQL credentials for CWF" \
  --secret-string '{"username":"postgres","password":"YOUR_PASSWORD","host":"cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com","port":5432,"database":"postgres"}' \
  --region us-west-2
```

### 2. Grant Lambda Functions Permission

Add this policy to your Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:YOUR_ACCOUNT_ID:secret:cwf/rds/postgres-*"
    }
  ]
}
```

#### Via AWS CLI:
```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create policy
aws iam create-policy \
  --policy-name LambdaSecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:'$ACCOUNT_ID':secret:cwf/rds/postgres-*"
    }]
  }'

# Attach to Lambda execution role
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/LambdaSecretsManagerAccess
```

### 3. Install AWS SDK Dependency

The Lambda functions need the AWS SDK v3:

```bash
cd lambda/core
npm install @aws-sdk/client-secrets-manager
```

Or add to `package.json`:
```json
{
  "dependencies": {
    "@aws-sdk/client-secrets-manager": "^3.0.0"
  }
}
```

### 4. Update Lambda Functions

Update each Lambda function to use Secrets Manager:

**Before:**
```javascript
const dbConfig = {
  password: process.env.DB_PASSWORD, // ❌ Insecure
  // ...
};
```

**After:**
```javascript
const { getDatabaseCredentials } = require('./shared/getSecret');

let dbConfig;
let dbConfigPromise;

async function getDbConfig() {
  if (!dbConfigPromise) {
    dbConfigPromise = getDatabaseCredentials();
  }
  if (!dbConfig) {
    dbConfig = await dbConfigPromise;
  }
  return dbConfig;
}

// In handler:
const dbConfig = await getDbConfig();
```

### 5. Remove Environment Variables

Once Secrets Manager is working, you can remove `DB_PASSWORD` from Lambda environment variables:

```bash
aws lambda update-function-configuration \
  --function-name cwf-core-lambda \
  --environment Variables="{DB_HOST=...,DB_PORT=5432}" \
  --region us-west-2
```

## Testing

Test the secret retrieval:

```bash
aws secretsmanager get-secret-value \
  --secret-id cwf/rds/postgres \
  --region us-west-2
```

## Rotation (Optional)

Secrets Manager can automatically rotate RDS passwords:

1. Enable rotation in Secrets Manager console
2. Select "Use a Lambda rotation function"
3. Secrets Manager will automatically rotate the password and update RDS

## Migration Checklist

- [ ] Create secret in Secrets Manager
- [ ] Grant Lambda execution role permissions
- [ ] Install `@aws-sdk/client-secrets-manager` in Lambda packages
- [ ] Update Lambda functions to use `getDatabaseCredentials()`
- [ ] Test each Lambda function
- [ ] Remove `DB_PASSWORD` from environment variables
- [ ] Monitor CloudWatch logs for errors
- [ ] (Optional) Enable automatic rotation

## Cost Optimization Tips

1. **Use caching** - The helper module caches secrets for 1 hour
2. **Reuse Lambda containers** - Lambda containers are reused, so cache persists
3. **Single secret** - Store all DB credentials in one secret (not separate secrets)
4. **Monitor usage** - Check CloudWatch metrics for API call counts

## Troubleshooting

**Error: "User is not authorized to perform: secretsmanager:GetSecretValue"**
- Check IAM role has the correct permissions
- Verify the secret ARN matches the policy

**Error: "Secrets Manager can't find the specified secret"**
- Check secret name/ARN is correct
- Verify region matches

**High API call costs:**
- Increase cache TTL (default is 1 hour)
- Check for Lambda cold starts (cache is lost on cold start)


