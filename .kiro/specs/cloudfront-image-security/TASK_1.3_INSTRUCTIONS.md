# Task 1.3: Store Private Key in AWS Secrets Manager - Quick Instructions

## What You Need to Do

Task 1.3 requires you to securely store the CloudFront private key in AWS Secrets Manager so Lambda functions can access it for signing cookies.

## Prerequisites

- Task 1.2 completed (private key verified at `.keys/cloudfront-private-key.pem`)
- AWS CLI configured with credentials for us-west-2 region
- Permissions: `secretsmanager:CreateSecret`, `secretsmanager:PutSecretValue`

## Step-by-Step Instructions

### 1. Verify Private Key Exists

```bash
# Check the key file is present
ls -lh .keys/cloudfront-private-key.pem
```

Expected output: `-rw------- 1 user user 1.7K ... .keys/cloudfront-private-key.pem`

### 2. Store Private Key in Secrets Manager

```bash
# Store the private key in AWS Secrets Manager
aws secretsmanager create-secret \
  --name cloudfront-private-key \
  --description "CloudFront private key for signed cookie generation" \
  --secret-string file://.keys/cloudfront-private-key.pem \
  --region us-west-2
```

**Expected Output:**
```json
{
    "ARN": "arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:cloudfront-private-key-XXXXXX",
    "Name": "cloudfront-private-key",
    "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### 3. Verify Secret Was Created

```bash
# List the secret to confirm it exists
aws secretsmanager describe-secret \
  --secret-id cloudfront-private-key \
  --region us-west-2
```

**Expected Output:**
```json
{
    "ARN": "arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:cloudfront-private-key-XXXXXX",
    "Name": "cloudfront-private-key",
    "Description": "CloudFront private key for signed cookie generation",
    "LastChangedDate": "2024-01-15T12:00:00.000000-08:00",
    "LastAccessedDate": "2024-01-15T00:00:00.000000-08:00",
    "VersionIdsToStages": {
        "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx": [
            "AWSCURRENT"
        ]
    },
    "CreatedDate": "2024-01-15T12:00:00.000000-08:00"
}
```

### 4. Test Retrieval (Verify Lambda Can Access It)

```bash
# Retrieve the secret value to verify it's stored correctly
aws secretsmanager get-secret-value \
  --secret-id cloudfront-private-key \
  --region us-west-2 \
  --query 'SecretString' \
  --output text | head -n 3
```

**Expected Output:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef...
(first few lines of your private key)
```

**IMPORTANT**: Do NOT share or log the full output! This is your private key.

### 5. Verify Key Format

```bash
# Verify the retrieved key is valid RSA format
aws secretsmanager get-secret-value \
  --secret-id cloudfront-private-key \
  --region us-west-2 \
  --query 'SecretString' \
  --output text | openssl rsa -check -noout
```

**Expected Output:**
```
RSA key ok
```

## How Lambda Will Retrieve the Key

Lambda functions will use the AWS SDK to retrieve the secret:

```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-west-2' });

async function getPrivateKey() {
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: 'cloudfront-private-key',
    })
  );
  
  return response.SecretString;  // Returns the PEM-formatted private key
}
```

## Lambda IAM Permissions Required

The Lambda execution role will need this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:ACCOUNT_ID:secret:cloudfront-private-key-*"
    }
  ]
}
```

This will be added when creating the Cookie Generator Lambda in Task 6.

## Security Best Practices

✅ **DO:**
- Store the secret in the same region as your Lambda functions (us-west-2)
- Use IAM policies to restrict access to only necessary Lambda functions
- Enable CloudTrail logging for secret access auditing
- Rotate the key periodically (every 90 days recommended)

❌ **DON'T:**
- Store the private key in environment variables (not secure)
- Commit the private key to git (already protected by .gitignore)
- Share the secret ARN publicly (it's not sensitive, but keep it internal)
- Log the private key value in CloudWatch or application logs

## Troubleshooting

### Problem: "An error occurred (ResourceExistsException)"

**Solution**: The secret already exists. You can either:

1. **Update the existing secret:**
```bash
aws secretsmanager put-secret-value \
  --secret-id cloudfront-private-key \
  --secret-string file://.keys/cloudfront-private-key.pem \
  --region us-west-2
```

2. **Delete and recreate:**
```bash
# Delete the secret (30-day recovery window)
aws secretsmanager delete-secret \
  --secret-id cloudfront-private-key \
  --region us-west-2

# Force immediate deletion (use with caution!)
aws secretsmanager delete-secret \
  --secret-id cloudfront-private-key \
  --force-delete-without-recovery \
  --region us-west-2

# Then recreate with the create-secret command above
```

### Problem: "An error occurred (AccessDeniedException)"

**Solution**: Your AWS credentials don't have Secrets Manager permissions. Add this policy to your IAM user/role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

### Problem: "RSA key NOT ok" when verifying

**Solution**: The key file may be corrupted. Verify the local file first:

```bash
openssl rsa -in .keys/cloudfront-private-key.pem -check -noout
```

If this fails, regenerate the key pair in AWS Console (Task 1.1).

### Problem: "file://.keys/cloudfront-private-key.pem: No such file or directory"

**Solution**: Run the command from the workspace root directory, not from the spec directory:

```bash
# Navigate to workspace root
cd /path/to/clever-widget-factory

# Then run the command
aws secretsmanager create-secret ...
```

## Cost Information

**AWS Secrets Manager Pricing (us-west-2):**
- $0.40 per secret per month
- $0.05 per 10,000 API calls

**Estimated Cost for This Secret:**
- Storage: $0.40/month
- API calls: ~$0.01/month (assuming 2,000 Lambda invocations/month)
- **Total: ~$0.41/month**

## Verification Checklist

Before proceeding to Task 1.4, ensure:

- [ ] Secret created successfully in Secrets Manager
- [ ] Secret name is exactly `cloudfront-private-key`
- [ ] Secret is in us-west-2 region
- [ ] Secret retrieval test passes
- [ ] RSA key validation passes
- [ ] You have the secret ARN for documentation

## Next Steps

Once Task 1.3 is complete:
1. **Task 1.4**: Note the CloudFront Key Pair ID for Lambda configuration
2. **Task 1.5**: Verify key pair is active in CloudFront
3. **Task 6**: Create Cookie Generator Lambda that retrieves this secret

## Environment Variables for Lambda

When creating the Cookie Generator Lambda (Task 6), you'll need:

```bash
CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=cloudfront-private-key
CLOUDFRONT_KEY_PAIR_ID=APKAXXXXXXXXXX  # From Task 1.4
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net  # From Task 5
```

---

**Task Status**: Ready to execute  
**Estimated Time**: 5 minutes  
**Prerequisites**: Task 1.2 completed  
**AWS Services**: Secrets Manager  
**Region**: us-west-2

