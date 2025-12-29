# Requirements Document

## Introduction

Enhance the existing TanStack Query action mutations to properly handle server responses and update the cache according to the offline-first architecture patterns outlined in the ENGINEERING_GUIDE. The server already returns `affectedResources` data, but the current `useActionMutations.ts` implementation is not fully utilizing this system for optimal cache management.

## Glossary

- **Action_Mutation**: TanStack Query mutation for updating action data
- **Affected_Resources**: Server response containing updated related data (tools, checkouts)
- **Cache_Update**: Process of updating TanStack Query cache with server-computed data
- **Optimistic_Update**: Immediate UI update before server response
- **Server_Response**: API response containing both updated action and affected resources
- **Test_Suite**: Integration test framework that validates against real Lambda endpoints
- **Lambda_API**: AWS Lambda functions that handle action CRUD operations and business logic

## Requirements

### Requirement 1: Enhanced Action Update Mutation

**User Story:** As a developer, I want action updates to follow TanStack Query best practices for optimistic updates and cache management, so that the UI stays consistent with server-computed data.

#### Acceptance Criteria

1. WHEN an action is updated, THE Action_Mutation SHALL use TanStack Query `onMutate` to optimistically update the action in cache immediately
2. WHEN the server responds with affected resources, THE Action_Mutation SHALL use TanStack Query `onSuccess` to update related caches with server-computed data
3. WHEN an action update affects tools, THE Action_Mutation SHALL follow TanStack Query patterns to update the tools cache with checkout status changes
4. WHEN an action update fails, THE Action_Mutation SHALL use TanStack Query `onError` to rollback the optimistic update and restore previous state
5. WHEN action status changes to 'completed', THE Action_Mutation SHALL use TanStack Query cache updates to reflect tool checkout changes immediately

### Requirement 2: TanStack Query Cache Invalidation Strategy

**User Story:** As a user, I want the UI to show accurate checkout status and related data after action updates using TanStack Query invalidation patterns, so that I can see the current state of tools and checkouts.

#### Acceptance Criteria

1. WHEN action updates affect checkouts, THE Action_Mutation SHALL use TanStack Query `invalidateQueries` for background refresh of checkout data
2. WHEN action updates change tool assignments, THE Action_Mutation SHALL use TanStack Query `setQueryData` to update tool cache with new checkout status
3. WHEN server returns affected resources, THE Action_Mutation SHALL follow TanStack Query patterns to prioritize server data over optimistic updates
4. WHEN multiple resources are affected, THE Action_Mutation SHALL use TanStack Query batch updates to update all relevant caches efficiently
5. THE Action_Mutation SHALL follow TanStack Query non-blocking patterns and NOT await invalidation queries

### Requirement 3: TanStack Query Offline Support and Retry Handling

**User Story:** As a user, I want to be able to update actions without an internet connection and have changes automatically sync when connectivity is restored, so that I can work seamlessly regardless of network status.

#### Acceptance Criteria

1. WHEN internet connection is unavailable, THE Action_Mutation SHALL use TanStack Query offline capabilities to queue mutations for later execution
2. WHEN connectivity is restored, THE Action_Mutation SHALL use TanStack Query automatic retry mechanisms to execute queued mutations in order
3. WHEN mutations are queued offline, THE Action_Mutation SHALL preserve optimistic updates in the UI without timeout-based failures
4. WHEN server returns validation errors after retry, THE Action_Mutation SHALL use TanStack Query error handling to display appropriate error messages and allow user correction
5. THE Action_Mutation SHALL use TanStack Query `onError` with context to handle permanent failures (non-network errors) by restoring previous state

### Requirement 4: TanStack Query Error Handling and Rollback

**User Story:** As a user, I want the UI to handle different types of action update failures appropriately, so that I can understand what went wrong and take corrective action.

#### Acceptance Criteria

1. WHEN network errors occur, THE Action_Mutation SHALL NOT rollback optimistic updates and SHALL queue the mutation for retry
2. WHEN validation errors occur, THE Action_Mutation SHALL use TanStack Query `onError` to rollback optimistic updates and display error details
3. WHEN server errors occur, THE Action_Mutation SHALL distinguish between retryable and non-retryable errors using TanStack Query retry logic
4. THE Action_Mutation SHALL follow TanStack Query patterns to NOT affect related resource caches during rollback scenarios
5. THE Action_Mutation SHALL use TanStack Query context patterns to handle partial failures gracefully without corrupting cache state

### Requirement 5: TanStack Query Integration with Existing API Service

**User Story:** As a developer, I want to leverage the existing `apiServiceWithCache` system with TanStack Query patterns, so that cache updates follow established patterns and don't duplicate logic.

#### Acceptance Criteria

1. THE Action_Mutation SHALL use TanStack Query `useMutation` with the existing `apiServiceWithCache.put` method for server communication
2. WHEN server returns `affectedResources`, THE Action_Mutation SHALL coordinate TanStack Query cache updates with `apiServiceWithCache` automatic updates
3. THE Action_Mutation SHALL follow TanStack Query patterns and NOT duplicate cache update logic that already exists in `apiServiceWithCache`
4. WHEN using `apiServiceWithCache`, THE Action_Mutation SHALL use TanStack Query `onMutate` for optimistic updates while letting the service handle server responses
5. THE Action_Mutation SHALL use TanStack Query context and timing patterns to coordinate optimistic updates with automatic cache updates to prevent conflicts

### Requirement 6: Debugging and Observability

**User Story:** As a developer, I want comprehensive debugging information about mutation states, timing, and failures, so that I can troubleshoot offline-first behavior and performance issues.

#### Acceptance Criteria

1. THE Action_Mutation SHALL track and expose mutation timing metrics including request duration, retry delays, and total time to completion
2. WHEN mutations fail and retry, THE Action_Mutation SHALL log retry attempts with error details, attempt count, and next retry time
3. WHEN rollbacks occur, THE Action_Mutation SHALL log rollback events with the reason, affected cache keys, and restored data
4. THE Action_Mutation SHALL provide mutation status indicators that show current state (pending, retrying, failed, succeeded)
5. WHEN mutations are queued offline, THE Action_Mutation SHALL track queue depth, queue time, and execution order for debugging

### Requirement 7: Integration Testing with Real Lambda Functions

**User Story:** As a developer, I want comprehensive integration tests that validate the action mutation system against actual Lambda endpoints, so that I can prevent regressions and ensure the system works correctly in production-like scenarios.

#### Acceptance Criteria

1. WHEN integration tests run, THE Test_Suite SHALL create real actions through the actual Lambda API endpoints
2. WHEN testing action updates, THE Test_Suite SHALL verify that server-computed affected resources are properly handled and cached
3. WHEN testing error scenarios, THE Test_Suite SHALL trigger actual validation errors from the Lambda and verify proper rollback behavior
4. WHEN testing offline scenarios, THE Test_Suite SHALL simulate network failures and verify that mutations queue properly and execute when connectivity is restored
5. WHEN testing tool checkout workflows, THE Test_Suite SHALL verify that action completion properly updates tool checkout status through the real API
6. THE Test_Suite SHALL validate that cache invalidation works correctly with real server responses containing affected resources
7. THE Test_Suite SHALL test concurrent action updates to ensure proper cache coordination and conflict resolution
8. WHEN testing performance, THE Test_Suite SHALL measure actual response times and verify that optimistic updates provide immediate feedback
9. THE Test_Suite SHALL verify that the mutation debug information accurately reflects real Lambda execution timing and retry behavior
10. WHEN integration tests complete, THE Test_Suite SHALL clean up any test data created during the test run