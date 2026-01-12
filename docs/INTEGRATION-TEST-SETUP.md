# Integration Test Setup Guide

## Overview

Some tests in the `src/tests/exploration-data-collection/` directory are integration tests that require:
- Real AWS API calls
- Authentication tokens
- Database access

These tests are currently failing with authorization errors because they're not properly configured as integration tests.

## Quick Fix: Skip Integration Tests

To run tests without integration tests, the failing tests need to be marked with `describe.skip()` or properly mocked.

### Tests That Need Integration Setup

The following tests call real API services and need either:
1. Integration test setup with authentication
2. Proper mocking of API services

Files:
- `exploration-flag-consistency.test.ts` ✅ (already fixed)
- `metadata-population.test.ts`
- `policy-linking-integrity.test.ts`
- `policy-linking-operations.test.ts`
- `policy-lifecycle-management.test.ts`
- `policy-status-validation.test.ts`
- `action-data-persistence.test.ts`
- `analytics-queries.test.ts`
- `backward-compatibility.test.ts`
- And others that call `actionService`, `explorationService`, or `policyService` without mocks

## Integration Test Setup (For Running Real Tests)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Test User

```bash
node scripts/_temp/setup-test-user.js
```

This will:
- Create a test user in AWS Cognito
- Generate `.env.test` file with credentials
- Configure authentication for integration tests

### 3. Configure Environment

Edit `.env.test` and add:
```bash
VITE_USER_POOL_CLIENT_ID=your_client_id
VITE_API_BASE_URL=https://your-api.execute-api.us-west-2.amazonaws.com/prod
```

### 4. Run Integration Tests

```bash
# Source the test environment
source .env.test

# Run integration tests
INTEGRATION_TESTS=true npm test
```

## Recommended Fix: Mock API Services

For unit tests, mock the API services instead of calling real APIs:

```typescript
import { vi } from 'vitest';

// Mock API service
vi.mock('@/lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock service responses
beforeEach(() => {
  vi.mocked(apiService.post).mockResolvedValue({ data: mockData });
});
```

## Test Organization

Tests should be organized as:

1. **Unit Tests** - Mock all external dependencies
   - Fast execution
   - No network calls
   - No authentication required

2. **Integration Tests** - Use real services
   - Marked with `INTEGRATION_TESTS` environment check
   - Require authentication setup
   - Slower execution
   - Located in `src/hooks/__tests__/integration/`

## Current Status

- ✅ Database stub created (`src/lib/database.ts`)
- ✅ Offline config test fixed
- ✅ Integration test infrastructure exists
- ⚠️ Many exploration tests need mocking or integration setup
- ⚠️ Some tests have JSX syntax errors (SWC compiler issues)

## Next Steps

1. **Short term**: Add `describe.skip()` to tests that need integration setup
2. **Medium term**: Add proper mocks to make them unit tests
3. **Long term**: Move integration tests to proper integration test directory with auth setup
