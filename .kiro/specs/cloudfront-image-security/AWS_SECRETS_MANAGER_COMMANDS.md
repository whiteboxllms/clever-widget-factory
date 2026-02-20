# AWS Secrets Manager Commands - Quick Reference

This document provides quick-reference AWS CLI commands for managing the CloudFront private key in Secrets Manager.

## Prerequisites

```bash
# Verify AWS CLI is installed
aws --version

# Verify credentials are configured
aws sts get-caller-identity --region us-west-2

# Verify private key exists locally
ls -lh .keys/cloudfront-private-key.pem
```

## Create Secret (Task 1.3)

```bash
# Store private key in Secrets Manager
aws secretsmanager create-secret \
  --name cloudfront-private-key \
  --description "CloudFront private key for signed cookie generation" \
  --secret-string file://.keys/cloudfront-private-key.pem \
  --region us-west-2
```

## Verify Secret

```bash
# Get secret metadata
aws secretsmanager describe-secret \
  --secret-id cloudfront-private-key \
  --region us-west-2

# Retrieve secret value (first 3 lines only for safety)
aws secretsmanager get-secret-value \
  --secret-id cloudfront-private-key \
  --region us-west-2 \
  --query 'SecretString' \
  --output text | head -n 3

# Verify RSA key integrity
aws secretsmanager get-secret-value \
  --secret-id cloudfront-private-key \
  --region us-west-2 \
  --query 'SecretString' \
  --output text | openssl rsa -check -noout
```

## Update Secret

```bash
# Update secret value (if key was rotated)
aws secretsmanager put-secret-value \
  --secret-id cloudfront-private-key \
  --secret-string file://.keys/cloudfront-private-key.pem \
  --region us-west-2
```

## List Secret Versions

```bash
# List all versions of the secret
aws secretsmanager list-secret-version-ids \
  --secret-id cloudfront-private-key \
  --region us-west-2
```

## Delete Secret

```bash
# Delete secret with 30-day recovery window (recommended)
aws secretsmanager delete-secret \
  --secret-id cloudfront-private-key \
  --recovery-window-in-days 30 \
  --region us-west-2

# Force immediate deletion (use with caution!)
aws secretsmanager delete-secret \
  --secret-id cloudfront-private-key \
  --force-delete-without-recovery \
  --region us-west-2
```

## Restore Deleted Secret

```bash
# Restore a deleted secret (within recovery window)
aws secretsmanager restore-secret \
  --secret-id cloudfront-private-key \
  --region us-west-2
```

## Lambda IAM Policy

Lambda execution role needs this policy to access the secret:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:*:secret:cloudfront-private-key-*"
    }
  ]
}
```

## Lambda Code Example

```javascript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-west-2' });

async function getPrivateKey() {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: process.env.CLOUDFRONT_PRIVATE_KEY_SECRET_NAME || 'cloudfront-private-key',
      })
    );
    
    return response.SecretString;
  } catch (error) {
    console.error('Failed to retrieve private key from Secrets Manager:', error);
    throw error;
  }
}

// Usage in cookie generation
const privateKey = await getPrivateKey();
// Use privateKey for signing CloudFront cookies
```

## Cost Information

**AWS Secrets Manager Pricing (us-west-2):**
- Storage: $0.40 per secret per month
- API calls: $0.05 per 10,000 API calls

**Estimated Monthly Cost:**
- 1 secret: $0.40
- 2,000 Lambda invocations: ~$0.01
- **Total: ~$0.41/month**

## Security Best Practices

✅ **DO:**
- Use IAM policies to restrict access to specific Lambda functions
- Enable CloudTrail logging for audit trails
- Rotate keys every 90 days
- Use the same region as your Lambda functions (us-west-2)
- Test secret retrieval before deploying Lambda

❌ **DON'T:**
- Store private keys in environment variables
- Log private key values to CloudWatch
- Share secret ARNs publicly
- Use overly permissive IAM policies (e.g., `secretsmanager:*`)

## Troubleshooting

### Error: "ResourceExistsException"
Secret already exists. Use `put-secret-value` to update or delete and recreate.

### Error: "AccessDeniedException"
Your IAM user/role lacks Secrets Manager permissions. Add the required policy.

### Error: "ResourceNotFoundException"
Secret doesn't exist or wrong region. Verify secret name and region.

### Error: "InvalidRequestException"
Check that the secret value is valid (e.g., file path is correct).

## Monitoring

```bash
# Check when secret was last accessed
aws secretsmanager describe-secret \
  --secret-id cloudfront-private-key \
  --region us-west-2 \
  --query 'LastAccessedDate' \
  --output text

# List all secrets in the region
aws secretsmanager list-secrets \
  --region us-west-2 \
  --query 'SecretList[*].[Name,Description,LastChangedDate]' \
  --output table
```

## CloudWatch Logs

Lambda will log secret access attempts. Monitor for:
- Failed retrieval attempts (IAM permission issues)
- Unusual access patterns (security concern)
- High latency (Secrets Manager performance)

Example CloudWatch Insights query:
```
fields @timestamp, @message
| filter @message like /Secrets Manager/
| sort @timestamp desc
| limit 100
```

## Key Rotation Process

When rotating the CloudFront key pair:

1. Generate new key pair in AWS Console
2. Download new private key
3. Update secret in Secrets Manager:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id cloudfront-private-key \
     --secret-string file://.keys/cloudfront-private-key-new.pem \
     --region us-west-2
   ```
4. Update `CLOUDFRONT_KEY_PAIR_ID` environment variable in Lambda
5. Deploy Lambda with new key pair ID
6. Verify cookie generation works with new key
7. Delete old key pair from CloudFront Console
8. Update documentation with new key pair ID

## Related Documentation

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [CloudFront Signed Cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-cookies.html)
- Task 1.3 Instructions: `TASK_1.3_INSTRUCTIONS.md`
- Verification Script: `scripts/verify-secrets-manager.sh`

---

**Last Updated**: 2024-01-15  
**Region**: us-west-2  
**Secret Name**: cloudfront-private-key

