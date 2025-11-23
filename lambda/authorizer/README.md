# Lambda Authorizer

Lambda Authorizer for API Gateway that validates Cognito JWT tokens and extracts organization context.

## Setup

### 1. Install Dependencies

```bash
cd lambda/authorizer
npm install
```

### 2. Create Lambda Function

```bash
# Zip the function
zip -qr authorizer.zip index.js node_modules/

# Create Lambda function
aws lambda create-function \
  --function-name cwf-api-authorizer \
  --runtime nodejs18.x \
  --role arn:aws:iam::131745734428:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://authorizer.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment Variables="{
    DB_PASSWORD=YOUR_DB_PASSWORD,
    COGNITO_USER_POOL_ID=YOUR_USER_POOL_ID,
    COGNITO_CLIENT_ID=YOUR_CLIENT_ID,
    COGNITO_REGION=us-west-2
  }" \
  --region us-west-2
```

### 3. Configure API Gateway Authorizer

```bash
# Get API Gateway ID
API_ID=0720au267k

# Create authorizer
aws apigateway create-authorizer \
  --rest-api-id $API_ID \
  --name cwf-cognito-authorizer \
  --type TOKEN \
  --authorizer-uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:131745734428:function:cwf-api-authorizer/invocations \
  --identity-source method.request.header.Authorization \
  --authorizer-result-ttl-in-seconds 300 \
  --region us-west-2
```

### 4. Attach Authorizer to Methods

```bash
# Example: Attach to /api/actions GET method
# First, get the resource ID
RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query "items[?path=='/api/actions'].id" \
  --output text \
  --region us-west-2)

# Update method to use authorizer
aws apigateway update-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method GET \
  --authorization-type CUSTOM \
  --authorizer-id <AUTHORIZER_ID> \
  --region us-west-2
```

### 5. Deploy API Gateway

```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --region us-west-2
```

## Environment Variables

- `DB_PASSWORD`: PostgreSQL database password
- `COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `COGNITO_CLIENT_ID`: Cognito App Client ID
- `COGNITO_REGION`: AWS region (default: us-west-2)

## Testing

### Unit Tests

Run the authorizer unit tests:

```bash
cd lambda/authorizer
npm test
```

Tests cover:
- Token validation (valid, invalid, missing)
- Organization context extraction
- Multi-organization membership support
- Permission calculation
- Partner access handling
- Caching behavior

### Integration Testing

Test the authorizer with a real Cognito token:

```bash
# Test with a valid token
node -e "
const { handler } = require('./index.js');
handler({
  authorizationToken: 'Bearer YOUR_ID_TOKEN',
  methodArn: 'arn:aws:execute-api:us-west-2:131745734428:0720au267k/prod/GET/api/actions'
}).then(console.log);
"
```

### Test Authorizer Context Helper

Test the shared authorizer context helper:

```bash
cd lambda/shared
node --test authorizerContext.test.js
```

Tests cover:
- Context extraction from API Gateway event
- Permission checking
- Organization access validation
- SQL filter generation
- Role lookup in organizations

## Context Variables

The authorizer returns these context variables to Lambda functions (snake_case - AWS convention):

- `organization_id`: User's primary organization UUID (first/oldest membership)
- `organization_memberships`: JSON array of all direct memberships `[{organization_id, role, is_superadmin}, ...]`
- `accessible_organization_ids`: JSON array of all orgs user can access (direct memberships + partners)
- `partner_access`: JSON array of partner relationships with roles
- `cognito_user_id`: Cognito user ID (sub claim)
- `is_superadmin`: "true" or "false" (true if superadmin in any org)
- `user_role`: User's role in primary organization (admin, leadership, contributor, viewer)
- `permissions`: JSON array of system permissions (e.g., `["data:read", "data:write", "organizations:read"]`)

### Permission System

Permissions are calculated based on user role:
- **admin**: `organizations:read`, `organizations:update`, `members:manage`, `data:read`, `data:write`
- **leadership**: `organizations:read`, `data:read`, `data:write`
- **contributor**: `data:read`, `data:write`
- **viewer**: `data:read`
- **superadmin**: `system:admin` (grants all permissions)

## Caching

- In-memory cache with 5-minute TTL
- Reduces database calls from every request to once per 5 minutes per user
- Cache key: `cognito_user_id`
- Cache automatically expires after TTL

## Cost

- Lambda Authorizer: $0.20 per million invocations
- With caching: ~1 DB call per 5 minutes per user (very low cost)
- Total cost: Negligible for typical usage

