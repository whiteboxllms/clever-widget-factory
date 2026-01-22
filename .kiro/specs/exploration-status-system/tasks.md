# Implementation Tasks: Exploration Association System

## Phase 1: Backend API Implementation

- [ ] 1.1 Create exploration list endpoint
  - [ ] 1.1.1 Implement GET /explorations/list with status filtering
  - [ ] 1.1.2 Include action_count in response
  - [ ] 1.1.3 Add request logging and error handling
  - [ ] 1.1.4 Write unit tests for endpoint

- [ ] 1.2 Create exploration creation endpoint
  - [ ] 1.2.1 Implement POST /explorations with auto-generated code
  - [ ] 1.2.2 Validate exploration code uniqueness
  - [ ] 1.2.3 Add request logging and error handling
  - [ ] 1.2.4 Write unit tests for endpoint

- [ ] 1.3 Create exploration linking endpoint
  - [ ] 1.3.1 Implement POST /actions/{actionId}/exploration
  - [ ] 1.3.2 Validate action exists and exploration exists
  - [ ] 1.3.3 Validate exploration status != 'integrated'
  - [ ] 1.3.4 Check for existing exploration on action
  - [ ] 1.3.5 Return complete action + exploration in response
  - [ ] 1.3.6 Add request logging with correlation ID
  - [ ] 1.3.7 Write unit tests for endpoint

- [ ] 1.4 Create exploration unlinking endpoint
  - [ ] 1.4.1 Implement DELETE /actions/{actionId}/exploration
  - [ ] 1.4.2 Validate action exists
  - [ ] 1.4.3 Return updated action in response
  - [ ] 1.4.4 Write unit tests for endpoint

- [ ] 1.5 Add database migration
  - [ ] 1.5.1 Add status column to exploration table if not exists
  - [ ] 1.5.2 Add CHECK constraint for status values
  - [ ] 1.5.3 Set default status to 'in_progress'
  - [ ] 1.5.4 Add indexes for status filtering

## Phase 2: Frontend Service Layer

- [ ] 2.1 Implement ExplorationService
  - [ ] 2.1.1 Create listExplorations() method
  - [ ] 2.1.2 Create createExploration() method
  - [ ] 2.1.3 Create linkExploration() method
  - [ ] 2.1.4 Create unlinkExploration() method
  - [ ] 2.1.5 Add error handling and logging
  - [ ] 2.1.6 Write unit tests for service

- [ ] 2.2 Implement TanStack Query integration
  - [ ] 2.2.1 Define cache keys for explorations
  - [ ] 2.2.2 Create useExplorationsList hook
  - [ ] 2.2.3 Create useLinkExploration mutation hook
  - [ ] 2.2.4 Create useCreateExploration mutation hook
  - [ ] 2.2.5 Implement cache invalidation strategy
  - [ ] 2.2.6 Write unit tests for hooks

## Phase 3: Frontend UI Components

- [ ] 3.1 Create ExplorationAssociationDialog component
  - [ ] 3.1.1 Build dialog structure and layout
  - [ ] 3.1.2 Implement explorations list display
  - [ ] 3.1.3 Add "Create New Exploration" button
  - [ ] 3.1.4 Implement selection state management
  - [ ] 3.1.5 Add loading states for list and linking
  - [ ] 3.1.6 Implement error display
  - [ ] 3.1.7 Add action count display per exploration
  - [ ] 3.1.8 Write component tests

- [ ] 3.2 Integrate dialog with action form
  - [ ] 3.2.1 Add "This is an exploration" checkbox to action form
  - [ ] 3.2.2 Trigger dialog when checkbox is checked
  - [ ] 3.2.3 Show current exploration if already linked
  - [ ] 3.2.4 Handle dialog close and confirmation
  - [ ] 3.2.5 Show success feedback after linking
  - [ ] 3.2.6 Write integration tests

- [ ] 3.3 Add exploration display in action detail
  - [ ] 3.3.1 Show exploration code if linked
  - [ ] 3.3.2 Show exploration status indicator
  - [ ] 3.3.3 Add "Change Exploration" button
  - [ ] 3.3.4 Add "Remove Exploration" option
  - [ ] 3.3.5 Write component tests

## Phase 4: Testing and Validation

- [ ] 4.1 Write integration tests
  - [ ] 4.1.1 Test create exploration → appears in list
  - [ ] 4.1.2 Test select exploration → link saves immediately
  - [ ] 4.1.3 Test link fails → dialog stays open with error
  - [ ] 4.1.4 Test create new → auto-selects and can be linked
  - [ ] 4.1.5 Test unlink → removes association
  - [ ] 4.1.6 Test action count updates correctly

- [ ] 4.2 Write property-based tests
  - [ ] 4.2.1 For any action, linking creates valid association
  - [ ] 4.2.2 For any exploration, action_count matches database
  - [ ] 4.2.3 For any list response, all explorations have status != 'integrated'
  - [ ] 4.2.4 For any link operation, cache is updated consistently

- [ ] 4.3 Test error scenarios
  - [ ] 4.3.1 Test linking to non-existent exploration
  - [ ] 4.3.2 Test linking to integrated exploration
  - [ ] 4.3.3 Test linking when action already has exploration
  - [ ] 4.3.4 Test API failures and retries
  - [ ] 4.3.5 Test cache consistency on errors

- [ ] 4.4 Test TanStack Query integration
  - [ ] 4.4.1 Verify cache keys are correct
  - [ ] 4.4.2 Verify cache invalidation works
  - [ ] 4.4.3 Verify optimistic updates work
  - [ ] 4.4.4 Verify error handling preserves cache

## Phase 5: Documentation and Deployment

- [ ] 5.1 Documentation
  - [ ] 5.1.1 Document API endpoints with examples
  - [ ] 5.1.2 Document cache key strategy
  - [ ] 5.1.3 Document error codes and recovery
  - [ ] 5.1.4 Document troubleshooting guide

- [ ] 5.2 Deployment
  - [ ] 5.2.1 Deploy database migration
  - [ ] 5.2.2 Deploy Lambda functions
  - [ ] 5.2.3 Deploy frontend changes
  - [ ] 5.2.4 Verify all endpoints working
  - [ ] 5.2.5 Monitor error rates and performance

- [ ] 5.3 Monitoring and Observability
  - [ ] 5.3.1 Set up logging for all operations
  - [ ] 5.3.2 Set up alerts for error rates
  - [ ] 5.3.3 Set up performance monitoring
  - [ ] 5.3.4 Create runbook for troubleshooting

## Notes

- All API responses must include `requestId` for tracing
- All operations must be logged with correlation IDs
- Cache invalidation should be targeted, not broad
- Error messages should be user-friendly
- All tests should follow existing patterns in codebase
- Backward compatibility must be maintained with existing action system
