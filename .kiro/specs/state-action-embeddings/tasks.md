# Implementation Plan: State-Based Action Recommendations

## Overview

This implementation adds state-based search and asset-aware action recommendations by generating dedicated embeddings from the `actions.description` field. The approach extends the existing unified embeddings infrastructure with minimal changes, adding an `embedding_type` field to distinguish state embeddings from full-context embeddings.

## Tasks

- [x] 1. Extend unified_embeddings schema to support action_existing_state
  - Update CHECK constraint to allow 'action_existing_state' entity_type
  - Update cascade delete trigger to handle action variants (pattern matching)
  - Add documentation comments
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 10.1_
  - _Note: Using entity_type (not separate embedding_type column) per design decision_
  - _Completed: Migration executed and verified_

- [ ]* 1.1 Write property test for schema extension
  - **Property 20: Entity Type Distinguishes State Embeddings**
  - **Validates: Requirements 10.1**

- [x] 2. Extend embeddings system to generate action_existing_state embeddings
  - [x] 2.1 Update Actions Lambda to send dual SQS messages
    - When action is created/updated with non-empty description
    - Send first message: entity_type='action' (full context, existing behavior)
    - Send second message: entity_type='action_existing_state' (description only)
    - _Requirements: 1.1, 1.2, 1.4_
    - _Completed: Actions Lambda updated and deployed_
  
  - [x] 2.2 Verify embeddings-processor handles new entity_type
    - Confirm processor accepts entity_type from SQS message
    - Confirm writeToUnifiedTable uses entity_type correctly
    - Added 'action_existing_state' to validTypes array
    - _Requirements: 8.1, 8.3, 10.1_
    - _Completed: Embeddings-processor updated and deployed_

- [ ]* 2.4 Write property test for dual embeddings
  - **Property 21: Dual Embeddings Per Action**
  - **Validates: Requirements 10.4**

- [ ] 3. Create action recommendations Lambda function
  - [ ] 3.1 Set up Lambda function structure
    - Create lambda/action-recommendations directory
    - Create index.js with handler
    - Create package.json with dependencies
    - Add README.md with API documentation
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 3.2 Implement query embedding generation
    - Parse request body (query, available_tools, available_parts, limit, similarity_threshold)
    - Validate required parameters
    - Generate query embedding via Bedrock
    - _Requirements: 2.1, 7.1_
  
  - [ ] 3.3 Implement state-based search query
    - Build SQL query filtering by embedding_type='action_existing_state'
    - Filter by organization_id for multi-tenancy
    - Calculate cosine similarity
    - Apply similarity threshold
    - Order by similarity descending
    - _Requirements: 2.1, 2.4, 2.5, 5.1_
  
  - [ ] 3.4 Implement action details fetching with assets
    - Join actions table on entity_id
    - Join checkouts table to get required tools
    - Join tools table to get tool names
    - Handle actions with no checkouts
    - _Requirements: 2.2, 6.1, 6.2, 6.5_
  
  - [ ] 3.5 Implement feasibility calculation
    - Calculate asset availability percentage
    - Determine feasibility status (available/partial/unavailable)
    - Mark each asset as available or not
    - Handle empty asset lists
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.3_
  
  - [ ] 3.6 Implement combined scoring and ranking
    - Calculate combined_score = (similarity * 0.7) + (availability * 0.3)
    - Sort by combined_score descending
    - Apply limit to results
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 3.7 Implement response formatting
    - Format recommendations with all required fields
    - Include state, action_details, similarity_score, feasibility, combined_score
    - Handle empty results with appropriate message
    - Add error handling for all failure modes
    - _Requirements: 2.3, 7.3, 7.4, 7.5_

- [ ]* 3.8 Write property test for search results structure
  - **Property 4: Search Results Include Complete Action Data**
  - **Validates: Requirements 2.2**

- [ ]* 3.9 Write property test for result ordering
  - **Property 6: Results Ordered By Similarity**
  - **Validates: Requirements 2.4**

- [ ]* 3.10 Write property test for asset filtering
  - **Property 8: Asset Filtering Works Correctly**
  - **Validates: Requirements 3.2**

- [ ]* 3.11 Write property test for feasibility calculation
  - **Property 10: Feasibility Status Matches Availability**
  - **Validates: Requirements 3.5**

- [ ]* 3.12 Write property test for combined scoring
  - **Property 11: Combined Score Formula**
  - **Validates: Requirements 4.1**

- [ ]* 3.13 Write property test for multi-tenancy isolation
  - **Property 14: Multi-Tenancy Isolation**
  - **Validates: Requirements 5.1**

- [ ] 4. Deploy and wire action recommendations Lambda
  - [ ] 4.1 Create deployment script
    - Create lambda/action-recommendations/deploy.sh
    - Install dependencies
    - Zip Lambda package
    - Update Lambda function code
    - _Requirements: 7.1_
  
  - [ ] 4.2 Create API Gateway wiring script
    - Create lambda/action-recommendations/wire-api-gateway.sh
    - Create POST /api/action-recommendations endpoint
    - Configure Lambda integration
    - Deploy API Gateway changes
    - _Requirements: 7.1_
  
  - [ ] 4.3 Test deployed endpoint
    - Create scripts/test-action-recommendations.sh
    - Test with sample state query
    - Test with available assets filtering
    - Test error cases (missing query, invalid limit)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Create migration script for existing actions
  - [x] 5.1 Create backfill script
    - Created scripts/backfill-action-state-embeddings.sh
    - Queries all actions with non-empty descriptions
    - Sends to embeddings queue for processing
    - _Requirements: 9.1, 9.2_
    - _Completed: Script created and tested with 5 actions, then full backfill run_
  
  - [x] 5.2 Fix backfill-actions-embeddings.sh script
    - Removed non-existent action_assets table reference
    - Simplified query to use only actions table fields
    - Removed assets parameter from SQS message
    - _Completed: Script fixed and 385 messages sent to queue_
  
  - [x] 5.3 Test migration on sample data
    - Ran backfill on small batch (5 actions)
    - Verified state embeddings created (222/276 processed so far)
    - Verified embedding_source contains only description
    - Verified entity_type='action_existing_state'
    - _Requirements: 9.1, 9.2, 9.4_
    - _Completed: Sample verified, full backfill in progress_
  
  - [x] 5.4 Run full backfill for action_existing_state embeddings
    - Sent 276 messages to SQS queue
    - 222 embeddings generated so far (async processing)
    - _Completed: Backfill initiated_
  
  - [x] 5.5 Run full backfill for full-context action embeddings
    - Sent 385 messages to SQS queue for missing action embeddings
    - Will bring total from 5 to 390 full-context action embeddings
    - _Completed: Backfill initiated_

- [ ] 6. Integration testing and documentation
  - [ ] 6.1 Create end-to-end integration test
    - Create action with description
    - Wait for state embedding generation
    - Search with similar query
    - Verify action returned in results
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_
  
  - [ ] 6.2 Create asset-aware ranking test
    - Create multiple actions with different tool requirements
    - Search with specific available tools
    - Verify actions with available tools ranked higher
    - _Requirements: 3.2, 3.4, 4.1_
  
  - [ ] 6.3 Update API documentation
    - Document POST /api/action-recommendations endpoint
    - Document request/response schemas
    - Add example queries
    - Document error codes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 6.4 Update embeddings system documentation
    - Document embedding_type field usage
    - Document state embedding generation logic
    - Update unified embeddings spec
    - _Requirements: 8.1, 8.2, 8.3, 10.1_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Integration tests validate end-to-end workflows
- The implementation extends existing patterns (unified_embeddings, embeddings-processor, Lambda functions)
- Backward compatibility maintained: existing embeddings have embedding_type=NULL
- State embeddings only generated when actions.description is non-empty
