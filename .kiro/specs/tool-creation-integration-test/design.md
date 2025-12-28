# Design Document

## Overview

This design outlines the implementation of an integration test that can successfully create tools through real Lambda API endpoints. The test will serve as a foundation for validating the tool checkout state consistency bug fix and provide a reliable way to test tool-related workflows.

## Architecture

### Test Structure
```
toolCreationIntegration.test.tsx
├── Authentication Setup
├── Tool Creation Tests
├── Permission Validation Tests
├── Checkout State Validation Tests
└── Cleanup and Teardown
```

### Authentication Flow
1. **Cognito Authentication**: Use AWS Cognito to authenticate the test user
2. **Token Management**: Handle JWT token lifecycle and refresh
3. **API Authorization**: Include Bearer tokens in all API requests
4. **Session Cleanup**: Properly sign out after tests complete

### Tool Creation Workflow
1. **Generate Unique Tool Data**: Create tool with test-specific naming
2. **POST to Lambda**: Send creation request to `/api/tools` endpoint
3. **Validate Response**: Verify 201 status and complete tool object
4. **State Verification**: Confirm tool exists in database
5. **Cleanup**: Delete test tool after validation

## Components and Interfaces

### TestToolCreator Class
```typescript
class TestToolCreator {
  private authService: TestAuthService;
  private apiService: ApiService;
  private createdTools: string[] = [];

  async createTestTool(toolData: Partial<ToolData>): Promise<ToolData>
  async validateToolExists(toolId: string): Promise<boolean>
  async cleanupCreatedTools(): Promise<void>
  private generateUniqueToolName(): string
}
```

### PermissionValidator Class
```typescript
class PermissionValidator {
  async validateToolCreationPermission(): Promise<boolean>
  async validateToolReadPermission(): Promise<boolean>
  async validateToolUpdatePermission(): Promise<boolean>
  async validateToolDeletePermission(): Promise<boolean>
  async diagnosePermissionIssues(): Promise<PermissionDiagnostic>
}
```

### CheckoutStateValidator Class
```typescript
class CheckoutStateValidator {
  async validateInitialToolState(toolId: string): Promise<void>
  async validateCheckoutStateConsistency(toolId: string, actionId: string): Promise<void>
  async validateStatusComputation(toolId: string): Promise<void>
  async compareEndpointResponses(toolId: string): Promise<ConsistencyReport>
}
```

## Data Models

### ToolCreationRequest
```typescript
interface ToolCreationRequest {
  name: string;
  description?: string;
  category: string;
  status: 'available' | 'maintenance' | 'retired';
  serial_number?: string;
  storage_location?: string;
}
```

### ToolCreationResponse
```typescript
interface ToolCreationResponse {
  data: {
    id: string;
    name: string;
    description: string;
    category: string;
    status: string;
    serial_number: string;
    storage_location: string;
    organization_id: string;
    created_at: string;
    updated_at: string;
  };
}
```

### PermissionDiagnostic
```typescript
interface PermissionDiagnostic {
  hasToolCreatePermission: boolean;
  hasToolReadPermission: boolean;
  hasToolUpdatePermission: boolean;
  hasToolDeletePermission: boolean;
  organizationAccess: string[];
  suggestedFixes: string[];
  errorDetails: any;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tool Creation Consistency
*For any* valid tool creation request with proper authentication, the API should successfully create the tool and return a complete tool object with all required fields populated.
**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Permission Enforcement
*For any* authenticated test user with proper permissions, tool creation requests should succeed, while requests without proper permissions should fail with appropriate error codes.
**Validates: Requirements 2.1, 2.2**

### Property 3: Test Data Isolation
*For any* test tool created with the integration test prefix, the tool should be properly scoped to the test organization and not interfere with production data.
**Validates: Requirements 3.1, 3.3**

### Property 4: Checkout State Computation
*For any* tool that is added to an action, the tool's status should be computed as "checked_out" when queried through any API endpoint, ensuring consistency across the system.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 5: Authentication Token Validity
*For any* API request made by the integration test, the request should include a valid JWT token that is accepted by the Lambda authorizer.
**Validates: Requirements 5.1, 5.2**

### Property 6: Error Diagnostic Completeness
*For any* error that occurs during tool creation, the integration test should capture and report sufficient diagnostic information to enable quick issue resolution.
**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

### Permission Errors (403 Forbidden)
- **Detection**: Check for 403 status codes in API responses
- **Diagnosis**: Run permission validation to identify missing permissions
- **Remediation**: Provide specific instructions for granting required permissions
- **Fallback**: Skip tests that require unavailable permissions with clear messaging

### Authentication Errors (401 Unauthorized)
- **Detection**: Monitor for 401 status codes and authentication failures
- **Diagnosis**: Validate token presence, format, and expiration
- **Remediation**: Attempt token refresh or re-authentication
- **Fallback**: Fail fast with clear authentication setup instructions

### Network Errors
- **Detection**: Catch network timeouts, connection refused, and DNS errors
- **Diagnosis**: Distinguish between temporary and permanent network issues
- **Remediation**: Implement retry logic with exponential backoff
- **Fallback**: Skip tests with network dependency warnings

### Validation Errors (400 Bad Request)
- **Detection**: Check for 400 status codes and validation error messages
- **Diagnosis**: Parse error response to identify specific validation failures
- **Remediation**: Adjust test data to meet API validation requirements
- **Fallback**: Update test data generation logic

## Testing Strategy

### Integration Test Configuration
- **Framework**: Vitest with real API endpoints
- **Authentication**: AWS Cognito with test user credentials
- **Environment**: Separate test environment variables
- **Cleanup**: Automatic cleanup of test data after each test

### Test Categories

#### Permission Validation Tests
- Verify test user has required permissions
- Test permission boundary enforcement
- Validate organization-scoped access

#### Tool Creation Tests
- Test successful tool creation with minimal data
- Test tool creation with complete data
- Test validation error handling
- Test duplicate name handling

#### Checkout State Tests
- Create tool and verify initial state
- Add tool to action and verify checkout state
- Query tool through different endpoints
- Validate status computation consistency

#### Error Handling Tests
- Test authentication failure scenarios
- Test permission denial scenarios
- Test network error scenarios
- Test malformed request scenarios

### Test Data Management
- **Naming Convention**: All test tools prefixed with "integration-test-"
- **Unique Identifiers**: Include timestamp and random suffix
- **Cleanup Strategy**: Delete test tools in teardown phase
- **Isolation**: Use test-specific organization scope

## Implementation Notes

### Environment Setup
1. Ensure test user exists in Cognito with proper permissions
2. Configure environment variables for test authentication
3. Set up test organization with appropriate access controls
4. Verify Lambda endpoints are accessible from test environment

### Permission Requirements
The test user needs the following permissions:
- `tools:create` - Create new tools
- `tools:read` - Read tool data
- `tools:update` - Update tool properties
- `tools:delete` - Delete test tools
- `actions:create` - Create test actions for checkout testing
- `actions:update` - Update actions to test tool assignment

### Security Considerations
- Test user should have minimal required permissions
- Test data should be clearly marked and isolated
- Authentication tokens should be handled securely
- Test cleanup should be thorough to prevent data leakage