# Implementation Plan: Exploration Data Collection Flow

## Overview

This implementation plan converts the exploration data collection flow design into discrete coding tasks. The approach focuses on incremental development, starting with database schema extensions, then API endpoints, and finally UI integration. Each task builds on previous work and includes validation through both unit tests and property-based tests.

## Tasks

- [ ] 1. Database Schema Setup
  - Extend existing action table with new columns (summary_policy_text, policy_id)
  - Create new exploration, policy, and embedding tables
  - Add indexes and constraints for performance and data integrity
  - Map logical field names to existing action schema columns where appropriate
  - _Requirements: 1.4, 1.5, 2.4, 7.1, 7.2, 7.3, 7.4_

- [ ] 1.1 Write property test for database constraints
  - **Property 4: Exploration-Action Relationship**
  - **Validates: Requirements 2.4**

- [ ] 1.2 Write property test for exploration code uniqueness
  - **Property 18: Exploration Code Uniqueness**
  - **Validates: Requirements 7.2**

- [ ] 1.3 Write property test for referential integrity
  - **Property 19: Referential Integrity**
  - **Validates: Requirements 7.3**

- [ ] 2. Exploration Code Generation Service
  - [ ] 2.1 Implement ExplorationCodeGenerator class
    - Generate codes in format SF<mmddyy>EX<number>
    - Support auto-increment and user override functionality
    - Ensure uniqueness validation
    - _Requirements: 2.2, 2.3, 7.2_

  - [ ] 2.2 Write property test for exploration code format
    - **Property 3: Exploration Code Generation**
    - **Validates: Requirements 2.2, 2.3**

  - [ ] 2.3 Implement exploration code validation and uniqueness checking
    - Validate format and check database for existing codes
    - Handle concurrent code generation scenarios
    - _Requirements: 2.3, 7.2_

- [ ] 3. Action Service Extensions
  - [ ] 3.1 Extend action creation to support exploration fields
    - Add is_exploration flag handling
    - Integrate exploration code generation
    - Maintain backward compatibility with existing action creation
    - _Requirements: 2.1, 2.2, 6.1_

  - [ ] 3.2 Write property test for action data persistence
    - **Property 1: Action Data Persistence**
    - **Validates: Requirements 1.4**

  - [ ] 3.3 Write property test for backward compatibility
    - **Property 16: Backward Compatibility**
    - **Validates: Requirements 6.1**

  - [ ] 3.4 Implement summary policy text handling
    - Store and retrieve summary_policy_text field
    - Support optional AI-assisted generation
    - _Requirements: 1.4, 8.1_

- [ ] 4. Exploration Management API
  - [ ] 4.1 Create ExplorationService with CRUD operations
    - Implement createExploration, updateExploration, getExploration
    - Handle one-to-one relationship with actions
    - Support exploration_notes_text, metrics_text, public_flag fields
    - _Requirements: 2.4, 2.6, 2.7, 2.8, 6.6_

  - [ ] 4.2 Write property test for exploration data mutability
    - **Property 17: Data Mutability**
    - **Validates: Requirements 6.6**

  - [ ] 4.3 Implement exploration filtering and listing
    - Support filters by date range, location, explorer, public_flag
    - Return exploration data with associated action information
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 4.4 Write property test for exploration filtering
    - **Property 13: Exploration Filtering**
    - **Validates: Requirements 5.2**

  - [ ] 4.5 Write property test for exploration display data
    - **Property 14: Exploration Display Data**
    - **Validates: Requirements 5.3**

- [ ] 5. Policy Management System
  - [ ] 5.1 Create PolicyService with CRUD operations
    - Implement createPolicy, updatePolicy, getPolicy, listPolicies
    - Support status management (draft, active, deprecated)
    - Handle effective date ranges and validation
    - _Requirements: 3.1, 3.3, 3.4, 3.6, 7.5_

  - [ ] 5.2 Write property test for policy status validation
    - **Property 7: Policy Status Validation**
    - **Validates: Requirements 3.3**

  - [ ] 5.3 Write property test for policy lifecycle management
    - **Property 21: Policy Lifecycle Management**
    - **Validates: Requirements 7.5**

  - [ ] 5.4 Write property test for metadata population
    - **Property 9: Metadata Population**
    - **Validates: Requirements 3.6**

  - [ ] 5.5 Implement policy linking functionality
    - Link actions to existing policies
    - Support policy promotion from explorations
    - Maintain referential integrity
    - _Requirements: 3.5, 7.3_

  - [ ] 5.6 Write property test for policy linking operations
    - **Property 8: Policy Linking Operation**
    - **Validates: Requirements 3.5**

  - [ ] 5.7 Write property test for policy linking integrity
    - **Property 2: Policy Linking Integrity**
    - **Validates: Requirements 1.5**

- [ ] 6. Checkpoint - Core CRUD Services Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Asynchronous Embedding Processing
  - [ ] 7.1 Implement EmbeddingQueue and EmbeddingWorker
    - Create background job processing for embedding generation
    - Support action, exploration, and policy text embedding
    - Ensure jobs are enqueued after DB transaction commits
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 7.2 Write property test for embedding generation
    - **Property 10: Embedding Generation**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ] 7.3 Write property test for embedding table structure
    - **Property 20: Embedding Table Structure**
    - **Validates: Requirements 7.4**

  - [ ] 7.4 Implement embedding type and model support
    - Support multiple embedding types (state, policy_text, summary_policy_text, etc.)
    - Handle different embedding models
    - Store embeddings in separate tables with proper foreign keys
    - _Requirements: 4.4, 4.5, 7.4_

  - [ ] 7.5 Write property test for embedding type support
    - **Property 11: Embedding Type Support**
    - **Validates: Requirements 4.5**

- [ ] 8. Semantic Search Implementation
  - [ ] 8.1 Implement vector search functionality
    - Create dense vector search with structured filters
    - Support search across action, exploration, and policy embeddings
    - Enable entity type filtering (actions vs explorations vs policies)
    - _Requirements: 4.6, 5.6_

  - [ ] 8.2 Write property test for semantic search coverage
    - **Property 12: Semantic Search Coverage**
    - **Validates: Requirements 4.6, 5.6**

  - [ ] 8.3 Implement analytics query support
    - Calculate exploration percentages by date range
    - Support pattern analysis across actions and explorations (percentages, counts, semantic groupings)
    - Note: Analytics are non-RL focused - numeric reward functions are out of scope
    - _Requirements: 5.5_

  - [ ] 8.4 Write property test for analytics queries
    - **Property 15: Analytics Query Support**
    - **Validates: Requirements 5.5**

- [ ] 9. AI-Assisted Content Generation
  - [ ] 9.1 Implement AI summary policy generation
    - Generate summary_policy_text suggestions from state_text and policy_text
    - Provide optional AI assistance in action creation flow
    - Handle AI service unavailability gracefully
    - _Requirements: 8.1, 8.6_

  - [ ] 9.2 Write property test for AI content generation
    - **Property 22: AI Content Generation**
    - **Validates: Requirements 8.1**

  - [ ] 9.3 Write property test for AI feature optionality
    - **Property 26: AI Feature Optionality**
    - **Validates: Requirements 8.6**

  - [ ] 9.4 Implement AI exploration suggestions
    - Generate exploration_notes_text and metrics_text suggestions
    - Use action context for relevant suggestions
    - _Requirements: 8.2, 8.5_

  - [ ] 9.5 Write property test for AI exploration suggestions
    - **Property 23: AI Exploration Suggestions**
    - **Validates: Requirements 8.2**

  - [ ] 9.6 Write property test for AI context utilization
    - **Property 25: AI Context Utilization**
    - **Validates: Requirements 8.5**

  - [ ] 9.7 Implement AI policy draft generation
    - Generate policy drafts from exploration data
    - Support policy promotion workflow
    - _Requirements: 3.2, 8.3_

  - [ ] 9.8 Write property test for policy draft generation
    - **Property 6: Policy Draft Generation**
    - **Validates: Requirements 3.2**

  - [ ] 9.9 Write property test for AI policy promotion
    - **Property 24: AI Policy Promotion**
    - **Validates: Requirements 8.3**

- [ ] 10. Checkpoint - Backend Services Complete
  - Ensure all tests pass, ask the user if questions arise.

## Frontend & UX Milestone

- [ ] 11. Action Creation UI Extensions
  - [ ] 11.1 Add exploration fields to action creation form
    - Add is_exploration checkbox
    - Add exploration_code input (pre-filled, user-editable)
    - Add summary_policy_text textarea with AI assist button
    - Maintain existing action creation workflow
    - _Requirements: 2.1, 6.1, 6.2, 6.4_

  - [ ] 11.2 Implement exploration code auto-generation in UI
    - Auto-fill exploration_code when is_exploration is checked
    - Allow user override of generated code
    - Validate code uniqueness in real-time
    - _Requirements: 2.2, 2.3_

  - [ ] 11.3 Write unit tests for action creation form
    - Test form validation and submission
    - Test exploration checkbox behavior
    - Test AI assist button functionality
    - _Requirements: 2.1, 6.2_

- [ ] 12. Exploration Tab Implementation
  - [ ] 12.1 Create ExplorationTab component
    - Display exploration-specific fields (notes, metrics, public_flag)
    - Show tab only for actions with exploration records
    - Support editing without changing exploration status
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 6.3_

  - [ ] 12.2 Write property test for conditional UI display
    - **Property 5: Conditional UI Display**
    - **Validates: Requirements 2.5, 6.3**

  - [ ] 12.3 Implement AI suggestions in exploration tab
    - Add "Suggest from AI" button
    - Generate suggestions for exploration_notes_text and metrics_text
    - Allow user to accept, edit, or discard suggestions
    - _Requirements: 8.2, 8.4_

  - [ ] 12.4 Write unit tests for exploration tab
    - Test field editing and saving
    - Test AI suggestion functionality
    - Test conditional display logic
    - _Requirements: 2.6, 2.7, 2.8_

- [ ] 13. Review Explorations Page
  - [ ] 13.1 Create exploration review interface
    - Display filterable list of explorations
    - Show exploration_code, state_text, summary_policy_text, key photos
    - Support filtering by date range, location, explorer, public_flag
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 13.2 Implement policy creation and linking actions
    - Add "Create policy from this" action buttons
    - Add "Link to existing policy" action buttons
    - Integrate with policy promotion workflow
    - _Requirements: 3.1, 3.5, 5.4_

  - [ ] 13.3 Write unit tests for review page
    - Test filtering functionality
    - Test policy action buttons
    - Test exploration list display
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 14. Policy Promotion Workflow
  - [ ] 14.1 Implement policy creation from exploration
    - Collect exploration and action data
    - Generate AI policy draft with title and description
    - Allow user editing of generated policy
    - Support status selection and effective dates
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ] 14.2 Implement existing policy linking
    - Create policy selector with search/filtering
    - Set action.policy_id when policy is selected
    - Maintain referential integrity
    - _Requirements: 3.5, 7.3_

  - [ ] 14.3 Write unit tests for policy promotion
    - Test policy draft generation
    - Test policy creation workflow
    - Test existing policy linking
    - _Requirements: 3.2, 3.5_

- [ ] 15. Photo and Asset Management
  - [ ] 15.1 Extend photo upload for explorations
    - Support optional photos of treated/exploration areas
    - Support optional photos of comparison areas
    - Allow photo updates after initial creation
    - _Requirements: 6.5, 6.6_

  - [ ] 15.2 Write unit tests for photo management
    - Test photo upload functionality
    - Test photo display in exploration lists
    - Test photo updates
    - _Requirements: 6.5, 6.6_

- [ ] 16. Final Integration and Testing
  - [ ] 16.1 Integration testing across all components
    - Test complete exploration creation workflow
    - Test policy promotion end-to-end
    - Test search and analytics functionality
    - Verify backward compatibility with existing actions
    - _Requirements: All requirements_

  - [ ] 16.2 Write integration tests
    - Test cross-component workflows
    - Test error handling and edge cases
    - Test AI service integration and fallbacks
    - _Requirements: All requirements_

- [ ] 17. Final Checkpoint - Complete System
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- AI-related tests check for non-empty, context-sensitive output rather than exact content
- Background embedding processing must not block user saves
- All exploration features maintain backward compatibility with existing action workflows