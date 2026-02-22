# CloudFront Cookie Generator Lambda (cwf-image-auth)

Generates CloudFront signed cookies after validating Cognito authentication. Implements organization-scoped access control for secure image delivery via CloudFront CDN.

## Purpose

This Lambda function is part of the CloudFront Image Security system. It:
1. Validates user authentication via API Gateway Cognito authorizer
2. Extracts organization_id from Cognito token claims
3. Generates CloudFront signed cookies with organization-scoped policies
4. Returns Set-Cookie headers for browser to use in CloudFront requests

## Architecture

```
User → API Gateway (Cognito Auth) → Lambda → Secrets Manager → CloudFront Cookies
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLOUDFRONT_DOMAIN` | Yes | - | CloudFront distribution domain (e.g., d1234567890.cloudfront.net) |
| `CLOUDFRONT_KEY_PAIR_ID` | Yes | - | CloudFront public key ID (starts with APKA) |
| `CLOUDFRONT_PRIVATE_KEY_SECRET_NAME` | No | `cloudfront-private-key` | Secrets Manager secret name |
| `COOKIE_EXPIRATION_SECONDS` | No | `3600` | Cookie expiration time (1 hour) |
| `AWS_REGION` | No | `us-west-2` | AWS region for Secrets Manager |

## API Endpoint

**POST** `/api/images/auth`

### Request

```http
POST /api/images/auth HTTP/1.1
Authorization: Bearer <cognito-jwt-token>
Content-Type: application/json
```

### Response (Success)

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: CloudFront-Policy=<base64-policy>; Domain=.cloudfront.net; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600
Set-Cookie: CloudFront-Signature=<signature>; Domain=.cloudfront.net; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600
Set-Cookie: CloudFront-Key-Pair-Id=<key-pair-id>; Domain=.cloudfront.net; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600

{
  "success": true,
  "expiresAt": "2024-01-15T12:00:00Z",
  "message": "CloudFront cookies generated successfully",
  "correlationId": "a3f5b8c9-d2e1-f4a7-b6c5-d8e9f1a2b3c4"
}
```

### Response (Error - Missing organization_id)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Bad Request",
  "message": "organization_id not found in authentication token",
  "correlationId": "a3f5b8c9-d2e1-f4a7-b6c5-d8e9f1a2b3c4"
}
```

### Response (Error - Internal Server Error)

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Internal Server Error",
  "message": "Failed to generate CloudFront cookies",
  "correlationId": "a3f5b8c9-d2e1-f4a7-b6c5-d8e9f1a2b3c4"
}
```

## CloudFront Policy Structure

The Lambda generates a CloudFront policy that restricts access to the user's organization:

```json
{
  "Statement": [
    {
      "Resource": "https://d1234567890.cloudfront.net/organizations/<org_id>/*",
      "Condition": {
        "DateLessThan": {
          "AWS:EpochTime": 1705320000
        }
      }
    }
  ]
}
```

This ensures users can only access images in their organization's S3 path.

## Security Features

1. **Organization Isolation**: Cookie policy restricts access to `organizations/{org_id}/*` path only
2. **HttpOnly Cookies**: Prevents JavaScript access to cookies (XSS protection)
3. **Secure Cookies**: Requires HTTPS (prevents MITM attacks)
4. **SameSite=Strict**: Prevents CSRF attacks
5. **Private Key in Secrets Manager**: Never exposed in environment variables or logs
6. **Correlation IDs**: All requests tracked for debugging and security auditing

## Deployment

### Prerequisites

1. CloudFront key pair created and private key stored in Secrets Manager
2. API Gateway endpoint configured with Cognito authorizer
3. Lambda execution role with Secrets Manager read permissions

### Deploy Lambda

```bash
# Install dependencies
cd lambda/image-auth
npm install

# Package Lambda
zip -r cwf-image-auth.zip index.js node_modules package.json

# Deploy to AWS
aws lambda create-function \
  --function-name cwf-image-auth \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://cwf-image-auth.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment Variables="{
    CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net,
    CLOUDFRONT_KEY_PAIR_ID=APKATEST123456,
    CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=cloudfront-private-key,
    COOKIE_EXPIRATION_SECONDS=3600
  }" \
  --region us-west-2
```

### Update Lambda

```bash
# Package and update
zip -r cwf-image-auth.zip index.js node_modules package.json
aws lambda update-function-code \
  --function-name cwf-image-auth \
  --zip-file fileb://cwf-image-auth.zip \
  --region us-west-2
```

### Configure API Gateway

```bash
# Add POST endpoint
./scripts/add-api-endpoint.sh /api/images/auth POST cwf-image-auth

# Deploy API Gateway
aws apigateway create-deployment \
  --rest-api-id 0720au267k \
  --stage-name prod \
  --region us-west-2
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Test

```bash
# Get Cognito token
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPassword123! \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Request cookies
curl -X POST https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/images/auth \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

## Monitoring

### CloudWatch Logs

Logs are written to `/aws/lambda/cwf-image-auth` log group.

Key log messages:
- `Fetching private key from Secrets Manager` - Private key fetch
- `Built CloudFront policy` - Policy generation
- `Policy signed successfully` - Signature creation
- `Successfully generated cookies` - Success
- `Failed to fetch private key` - Secrets Manager error
- `Missing organization_id` - Authentication error

### CloudWatch Metrics

Monitor these metrics:
- **Invocations**: Total requests
- **Errors**: Failed requests (target: <1%)
- **Duration**: Processing time (target: <500ms)
- **Throttles**: Rate limiting (should be 0)

### Alarms

Create alarms for:
- Error rate >5% for 5 minutes
- Duration >1000ms (p95)
- Throttles >0

## Troubleshooting

### Error: "CLOUDFRONT_DOMAIN environment variable is required"

**Cause**: Missing environment variable  
**Solution**: Set `CLOUDFRONT_DOMAIN` in Lambda configuration

### Error: "Secrets Manager fetch failed"

**Cause**: Lambda execution role lacks Secrets Manager permissions  
**Solution**: Add `secretsmanager:GetSecretValue` permission to Lambda role

### Error: "organization_id not found in authentication token"

**Cause**: Cognito token missing `custom:organization_id` claim  
**Solution**: Verify Cognito user pool has custom attribute configured

### Error: "Invalid private key format (must be PEM)"

**Cause**: Private key in Secrets Manager is not PEM format  
**Solution**: Store private key as PEM-formatted text in Secrets Manager

## Performance

- **Cold start**: ~500ms (includes Secrets Manager fetch)
- **Warm start**: ~50ms (uses cached private key)
- **Memory usage**: ~80MB
- **Timeout**: 10 seconds (actual: <1s)

## Cost

- **Lambda invocations**: $0.20 per 1M requests
- **Secrets Manager**: $0.40/month + $0.05 per 10k API calls
- **Total**: ~$0.50/month for 10k cookie requests

## Related Documentation

- [CloudFront Image Security Spec](.kiro/specs/cloudfront-image-security/)
- [Requirements Document](.kiro/specs/cloudfront-image-security/requirements.md)
- [Design Document](.kiro/specs/cloudfront-image-security/design.md)
- [AWS CloudFront Signed Cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-cookies.html)
