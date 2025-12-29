# Integration Test Setup Guide

This guide walks you through setting up proper test user credentials for running integration tests against real Lambda endpoints.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Cognito User Pool** already set up (from your existing app)
3. **Environment variables** from your main application

## Step 1: Install Dependencies

Install the required AWS SDK packages for test user management:

```bash
npm install --save-dev @aws-sdk/client-cognito-identity-provider @aws-sdk/credential-providers
```

## Step 2: Set Up Environment Variables

Make sure you have these environment variables available (from your existing `.env` file):

```bash
# Required for test user creation
VITE_AWS_COGNITO_USER_POOL_ID=your_user_pool_id
VITE_USER_POOL_CLIENT_ID=your_client_id
VITE_AWS_REGION=us-west-2

# Required for API calls
VITE_API_BASE_URL=https://your-api-gateway-url.com/prod
```

## Step 3: Create Test User

Run the setup script to create a test user in your Cognito User Pool:

```bash
npm run setup:test-user
```

This script will:
- Create a test user named `integration-test-user`
- Set a permanent password
- Add the user to a test group (if it exists)
- Generate a `.env.test` file with test configuration

## Step 4: Configure Test Environment

The setup script creates a `.env.test` file. You need to complete it by copying values from your main `.env`:

```bash
# Copy these values from your main .env file to .env.test
VITE_USER_POOL_CLIENT_ID=your_client_id_here
VITE_API_BASE_URL=https://your-api-gateway-url.com/prod
```

## Step 5: Run Integration Tests

Now you can run the integration tests:

```bash
# Run all integration tests
npm run test:integration

# Run integration tests in watch mode
npm run test:integration:watch

# Run specific integration test
npm run test:integration -- assetCheckoutValidation.test.tsx
```

## Step 6: Verify Test User Setup

You can verify the test user was created correctly by checking your Cognito User Pool in the AWS Console:

1. Go to AWS Console → Cognito → User Pools
2. Select your user pool
3. Go to "Users" tab
4. Look for user: `integration-test-user`

## Troubleshooting

### Authentication Errors

If you see `401 Unauthorized` errors:

1. **Check environment variables**: Ensure all required variables are set in `.env.test`
2. **Verify user pool configuration**: Make sure the user pool ID and client ID are correct
3. **Check user status**: The test user should have status "CONFIRMED" in Cognito
4. **Verify permissions**: Ensure your AWS credentials have permission to create users

### Test User Creation Fails

If the setup script fails:

1. **Check AWS credentials**: Run `aws sts get-caller-identity` to verify
2. **Verify permissions**: Your AWS user needs `cognito-idp:AdminCreateUser` permission
3. **Check user pool exists**: Verify the `VITE_AWS_COGNITO_USER_POOL_ID` is correct

### API Connection Issues

If tests fail to connect to API:

1. **Check API URL**: Verify `VITE_API_BASE_URL` is correct and accessible
2. **Check CORS**: Ensure your API allows requests from test environment
3. **Verify endpoints**: Test endpoints manually with curl or Postman

## Environment Variables Reference

### Required for Test User Creation
```bash
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_xxxxxxxxx
VITE_AWS_REGION=us-west-2
```

### Required for Integration Tests
```bash
INTEGRATION_TESTS=true
NODE_ENV=test
INTEGRATION_TEST_USERNAME=integration-test-user
INTEGRATION_TEST_PASSWORD=TempPassword123!
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod
```

### Optional Configuration
```bash
INTEGRATION_TEST_EMAIL=integration-test@example.com
INTEGRATION_TEST_GROUP=integration-testers
```

## Security Notes

1. **Test credentials**: Use a dedicated test user, not production credentials
2. **Environment isolation**: Run tests against staging/test environment, not production
3. **Cleanup**: The test framework automatically cleans up test data
4. **Permissions**: Test user should have minimal required permissions

## Test Structure

The integration tests are organized as follows:

```
src/hooks/__tests__/integration/
├── config.ts                          # Test configuration
├── testAuth.ts                         # Authentication service
├── testDataManager.ts                  # Test data management
├── assetCheckoutValidation.test.tsx    # Your specific test case
├── realApiValidation.test.tsx          # Basic API validation
├── errorScenarios.test.tsx             # Error handling tests
├── toolCheckoutWorkflows.test.tsx      # Tool checkout tests
└── offlineOnlineWorkflows.test.tsx     # Offline/online tests
```

## Next Steps

Once setup is complete:

1. **Run the asset checkout test**: This will help identify the specific issue you reported
2. **Review test results**: The tests provide detailed logging to help debug issues
3. **Fix any issues**: Use the test results to identify and fix the checkout problem
4. **Add more tests**: Extend the test suite to cover additional scenarios

## Support

If you encounter issues:

1. Check the test logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure the test user has proper permissions in your system
4. Review the AWS CloudWatch logs for your Lambda functions