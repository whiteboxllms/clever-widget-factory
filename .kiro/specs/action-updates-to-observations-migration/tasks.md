# Implementation Plan: Action Updates to States Migration

## Overview

This implementation plan breaks down the migration from `action_implementation_updates` to the states system into discrete, testable tasks. The migration will be executed in phases to ensure zero downtime and data integrity.

## Tasks

- [x] 1. Update States Lambda for Optional Photos
  - Modify `createState` validation to require `state_text` OR `photos` (not both)
  - Modify `updateState` validation to maintain same rule
  - Add validation error messages for empty submissions
  - Test text-only state creation via API
  - Test photo-only state creation via API
  - Test empty submission rejection via API
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ]* 1.1 Write property test for text-only validation
  - **Property 1: Text-only observations are valid**
  - **Validates: Requirements 1.1**

- [ ]* 1.2 Write property test for photo-only validation
  - **Property 2: Photo-only observations are valid**
  - **Validates: Requirements 1.2**

- [ ]* 1.3 Write property test for at least one field required
  - **Property 3: At least one field required**
  - **Validates: Requirements 1.5**

- [x] 2. Update AddObservation Frontend Validation
  - Update validation logic to require `observationText` OR `photos`
  - Update submit button disabled state based on new validation
  - Update error message to "Please add observation text or at least one photo"
  - Test text-only submission in UI
  - Test photo-only submission in UI
  - Test empty submission rejection in UI
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Create Data Migration Script
  - [x] 3.1 Write migration SQL script
    - Create INSERT INTO states SELECT FROM action_implementation_updates
    - Create INSERT INTO state_links SELECT FROM action_implementation_updates
    - Include JOIN with actions table for organization_id
    - Preserve all timestamps (created_at, updated_at)
    - Wrap in transaction with BEGIN/COMMIT
    - Add rollback on error
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 Write property test for one-to-one migration mapping
    - **Property 4: One-to-one migration mapping**
    - **Validates: Requirements 2.1**

  - [ ]* 3.3 Write property test for timestamp preservation
    - **Property 5: Timestamp preservation**
    - **Validates: Requirements 2.2, 9.1, 9.2**

  - [ ]* 3.4 Write property test for link creation correctness
    - **Property 6: Link creation correctness**
    - **Validates: Requirements 2.3**

  - [ ]* 3.5 Write property test for text content preservation
    - **Property 7: Text content preservation**
    - **Validates: Requirements 2.4**

  - [ ]* 3.6 Write property test for user reference preservation
    - **Property 8: User reference preservation**
    - **Validates: Requirements 2.5, 9.3**

  - [ ]* 3.7 Write property test for organization assignment
    - **Property 9: Organization assignment correctness**
    - **Validates: Requirements 2.6**

- [x] 4. Checkpoint - Test Migration on Database
  - Run migration script on  database
  - Verify record counts match (states = action_implementation_updates)
  - Verify timestamps are preserved exactly
  - Verify text content matches exactly
  - Verify user references match exactly
  - Verify organization IDs are set correctly
  - Create backup of action_implementation_updates table
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 5. Create StatesInline Component
  - [x] 5.1 Create StatesInline.tsx component file
    - Define StatesInlineProps interface (entity_type, entity_id, onCountChange)
    - Set up TanStack Query for fetching states
    - Implement list view with state cards
    - Display state_text, photos, captured_by name, captured_at timestamp
    - Add loading and error states
    - Add empty state message
    - _Requirements: 3.1, 3.2, 3.8_

  - [ ]* 5.2 Write property test for entity filtering
    - **Property 10: Entity filtering correctness**
    - **Validates: Requirements 3.1, 3.8**

  - [ ]* 5.3 Write property test for required fields display
    - **Property 11: Required fields display**
    - **Validates: Requirements 3.2**

  - [x] 5.4 Implement inline add form
    - Add "Add Observation" button
    - Create inline form with text input and photo upload
    - Support text-only, photo-only, and combined submissions
    - Handle form submission with TanStack Query mutation
    - Create state_link record with entity_type and entity_id
    - Refresh states list after creation
    - Keep dialog open after creation
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 5.5 Write property test for inline creation with linking
    - **Property 12: Inline creation with linking**
    - **Validates: Requirements 3.3**

  - [ ]* 5.6 Write property test for multi-format support
    - **Property 13: Multi-format support**
    - **Validates: Requirements 3.4**

  - [ ]* 5.7 Write property test for list refresh without dialog close
    - **Property 14: List refresh without dialog close**
    - **Validates: Requirements 3.5, 3.6, 3.7**

  - [x] 5.8 Implement inline edit functionality
    - Add edit button to state cards
    - Show inline edit form
    - Handle update with TanStack Query mutation
    - Refresh states list after update
    - Keep dialog open after update
    - _Requirements: 3.6_

  - [x] 5.9 Implement inline delete functionality
    - Add delete button to state cards
    - Show confirmation dialog
    - Handle delete with TanStack Query mutation
    - Refresh states list after deletion
    - Keep dialog open after deletion
    - _Requirements: 3.7_

- [x] 6. Update Action Dialogs to Use StatesInline
  - [x] 6.1 Update UnifiedActionDialog
    - Replace ActionImplementationUpdates import with StatesInline
    - Replace component usage with <StatesInline entity_type="action" entity_id={action.id} />
    - Remove ActionImplementationUpdates component reference
    - Test that states display correctly
    - _Requirements: 4.1, 4.3_

  - [x] 6.2 Update ActionScoreDialog
    - Replace ActionImplementationUpdates import with StatesInline
    - Replace component usage with <StatesInline entity_type="action" entity_id={action.id} />
    - Remove ActionImplementationUpdates component reference
    - Test that states display correctly
    - _Requirements: 4.2, 4.3_

  - [ ]* 6.3 Write property test for action state retrieval
    - **Property 15: Action state retrieval**
    - **Validates: Requirements 4.3**

- [x] 7. Update implementation_update_count Calculation
  - [x] 7.1 Update actions Lambda query
    - Add subquery to calculate count from state_links
    - Filter by entity_type='action' and entity_id=action.id
    - Include count in action response
    - _Requirements: 5.1, 5.2, 5.5_

  - [ ]* 7.2 Write property test for count calculation
    - **Property 18: Count calculation correctness**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 7.3 Write property test for count in responses
    - **Property 21: Count included in responses**
    - **Validates: Requirements 5.5**

  - [x] 7.4 Update states Lambda to update count cache
    - On state creation with action link, increment cached count
    - On state deletion with action link, decrement cached count
    - Use database trigger or Lambda logic
    - _Requirements: 4.4, 4.5, 5.3, 5.4_

  - [ ]* 7.5 Write property test for count increment on creation
    - **Property 16: Count increment on creation**
    - **Validates: Requirements 4.4**

  - [ ]* 7.6 Write property test for count decrement on deletion
    - **Property 17: Count decrement on deletion**
    - **Validates: Requirements 4.5**

  - [ ]* 7.7 Write property test for cache update on creation
    - **Property 19: Cache update on creation**
    - **Validates: Requirements 5.3**

  - [ ]* 7.8 Write property test for cache update on deletion
    - **Property 20: Cache update on deletion**
    - **Validates: Requirements 5.4**

- [x] 8. Update TanStack Query Cache Invalidation
  - Update useObservationMutations hook to invalidate states query cache
  - Invalidate on state creation (invalidate states list for entity)
  - Invalidate on state update (invalidate specific state)
  - Invalidate on state deletion (invalidate states list for entity)
  - Invalidate actions query cache when implementation_update_count changes
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 8.1 Write property test for cache invalidation on creation
  - **Property 22: Cache invalidation on creation**
  - **Validates: Requirements 10.2**

- [ ]* 8.2 Write property test for cache invalidation on update
  - **Property 23: Cache invalidation on update**
  - **Validates: Requirements 10.3**

- [ ]* 8.3 Write property test for cache invalidation on deletion
  - **Property 24: Cache invalidation on deletion**
  - **Validates: Requirements 10.4**

- [ ]* 8.4 Write property test for action cache invalidation
  - **Property 25: Action cache invalidation on count change**
  - **Validates: Requirements 10.5**

- [ ] 9. Checkpoint - Integration Testing
  - Test complete flow: create action → add state → verify count updates
  - Test complete flow: edit state → verify updates appear
  - Test complete flow: delete state → verify count decrements
  - Test dialog remains open during all operations
  - Test cache consistency across operations
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.5, 3.6, 3.7, 4.4, 4.5, 10.2, 10.3, 10.4, 10.5_

- [ ] 10. Remove Legacy Code
  - [ ] 10.1 Remove action_implementation_updates endpoints from Lambda
    - Remove GET /action_implementation_updates handler
    - Remove POST /action_implementation_updates handler
    - Remove PUT /action_implementation_updates/:id handler
    - Remove DELETE /action_implementation_updates/:id handler
    - Remove all helper functions for action_implementation_updates
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

  - [ ] 10.2 Remove ActionImplementationUpdates component
    - Delete src/components/ActionImplementationUpdates.tsx file
    - Remove all imports of ActionImplementationUpdates
    - _Requirements: 6.5_

  - [ ] 10.3 Remove actionImplementationUpdatesQueryKey
    - Remove from src/lib/queryKeys.ts
    - Remove all references in codebase
    - _Requirements: 6.6_

  - [ ] 10.4 Verify no references remain
    - Search codebase for "action_implementation_updates"
    - Search codebase for "ActionImplementationUpdates"
    - Search codebase for "actionImplementationUpdatesQueryKey"
    - Ensure all references are removed
    - _Requirements: 6.7_

- [ ] 11. Drop Legacy Database Table
  - Verify all data is migrated and verified
  - Verify no foreign key constraints reference action_implementation_updates
  - Create final backup SQL file with all data
  - Drop action_implementation_updates table
  - Log operation with timestamp and record count
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Final Checkpoint - End-to-End Verification
  - Verify states display correctly in action dialogs
  - Verify text-only states can be created
  - Verify photo-only states can be created
  - Verify implementation_update_count updates correctly
  - Verify no errors in logs
  - Verify all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: All_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities to pause and verify
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Migration is designed for zero downtime with rollback capability at each phase
