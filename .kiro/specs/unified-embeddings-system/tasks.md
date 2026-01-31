# Implementation Plan: Unified Embeddings System

## Overview

This plan implements the unified embeddings system in phases, starting with database schema and core infrastructure, then extending existing Lambdas to support new entity types, and finally adding new API endpoints for unified search and observability.

## Tasks

- [x] 1. Create database schema and migration
  - Create unified_embeddings table with proper indexes
  - Create cascade delete triggers for all entity types
  - Test migration on development database
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.5_

- [x] 2. Implement embedding source composition functions
  - [x] 2.1 Create shared/embedding-composition.js module
    - Implement composePartEmbeddingSource(part)
    - Implement composeToolEmbeddingSource(tool)
    - Implement composeActionEmbeddingSource(action)
    - Implement composeIssueEmbeddingSource(issue)
    - Implement composePolicyEmbeddingSource(policy)
    - Export all composition functions
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_
  
  - [ ]* 2.2 Write property test for embedding source composition
    - **Property 9: Embedding Source Composition**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.6**
  
  - [ ]* 2.3 Write unit tests for composition functions
    - Test each entity type with all fields populated
    - Test with missing optional fields
    - Test empty/null field handling
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Modify embeddings-processor Lambda
  - [x] 3.1 Update embeddings-processor to support all entity types
    - Add support for 'action', 'issue', 'policy' entity types
    - Implement writeToUnifiedTable() function
    - Add configuration flags (WRITE_TO_UNIFIED, WRITE_TO_INLINE)
    - Update message validation to accept new entity types
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_
  
  - [ ]* 3.2 Write property test for embedding dimension consistency
    - **Property 11: Embedding Dimension Consistency**
    - **Validates: Requirements 5.3**
  
  - [ ]* 3.3 Write unit tests for embeddings-processor
    - Test writeToUnifiedTable with valid data
    - Test writeToInlineColumns for parts/tools
    - Test configuration flag behavior
    - Test error handling for empty embedding_source
    - _Requirements: 5.3, 5.4, 5.6, 5.7_

- [x] 4. Checkpoint - Verify embeddings-processor works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Modify Core Lambda for parts and tools
  - [x] 5.1 Update Core Lambda to use embedding composition functions
    - Import composePartEmbeddingSource and composeToolEmbeddingSource
    - Update PUT /parts/:id handler to send SQS message
    - Update PUT /tools/:id handler to send SQS message
    - Update POST /parts handler to send SQS message
    - Update POST /tools handler to send SQS message
    - _Requirements: 5.1_
  
  - [ ]* 5.2 Write property test for SQS message triggering
    - **Property 10: SQS Message Triggering**
    - **Validates: Requirements 5.1, 5.2**
  
  - [ ]* 5.3 Write unit tests for Core Lambda SQS integration
    - Test SQS message format
    - Test message sent on create/update
    - Test error handling when SQS fails
    - _Requirements: 5.1_

- [x] 6. Modify Actions Lambda for actions
  - [x] 6.1 Update Actions Lambda to use embedding composition
    - Import composeActionEmbeddingSource
    - Update POST /actions handler to send SQS message
    - Update PUT /actions/:id handler to send SQS message
    - _Requirements: 5.2_
  
  - [ ]* 6.2 Write unit tests for Actions Lambda SQS integration
    - Test SQS message format for actions
    - Test message sent on create/update
    - _Requirements: 5.2_

- [x] 7. Add embedding support for issues and policies
  - [x] 7.1 Update Core Lambda for issues
    - Import composeIssueEmbeddingSource
    - Update POST /issues handler to send SQS message
    - Update PUT /issues/:id handler to send SQS message
    - _Requirements: 5.2_
  
  - [x] 7.2 Update Core Lambda for policies
    - Import composePolicyEmbeddingSource
    - Update POST /policies handler to send SQS message
    - Update PUT /policies/:id handler to send SQS message
    - _Requirements: 5.2_
  
  - [ ]* 7.3 Write unit tests for issues and policies SQS integration
    - Test SQS message format for issues
    - Test SQS message format for policies
    - _Requirements: 5.2_

- [x] 8. Checkpoint - Verify all entity types trigger embeddings
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create unified search Lambda
  - [x] 9.1 Implement lambda/unified-search/index.js
    - Implement POST handler for semantic search
    - Generate query embedding via Bedrock
    - Build SQL query with organization and entity_type filters
    - Execute vector similarity search
    - Return results with entity_type, entity_id, embedding_source, similarity
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.1, 10.2, 10.3_
  
  - [ ]* 9.2 Write property test for query embedding generation
    - **Property 3: Query Embedding Generation**
    - **Validates: Requirements 2.1**
  
  - [ ]* 9.3 Write property test for search result completeness
    - **Property 4: Search Result Completeness**
    - **Validates: Requirements 2.3**
  
  - [ ]* 9.4 Write property test for organization data isolation
    - **Property 5: Organization Data Isolation**
    - **Validates: Requirements 2.4, 9.2, 9.3**
  
  - [ ]* 9.5 Write property test for entity type filtering
    - **Property 6: Entity Type Filtering**
    - **Validates: Requirements 2.5**
  
  - [ ]* 9.6 Write property test for result ordering
    - **Property 7: Result Ordering by Similarity**
    - **Validates: Requirements 2.6**
  
  - [ ]* 9.7 Write property test for result limit enforcement
    - **Property 8: Result Limit Enforcement**
    - **Validates: Requirements 2.7**
  
  - [ ]* 9.8 Write unit tests for unified search Lambda
    - Test with valid query
    - Test with missing query (400 error)
    - Test with limit > 100 (400 error)
    - Test with entity_types filter
    - Test with unauthorized request (401 error)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 10. Create coverage endpoint Lambda
  - [x] 10.1 Implement lambda/embeddings-coverage/index.js
    - Implement GET handler for coverage statistics
    - Query unified_embeddings for counts by entity_type and model_version
    - Query source tables for total entity counts
    - Calculate coverage percentages
    - Return formatted response
    - _Requirements: 7.7, 10.6, 10.7, 11.3_
  
  - [ ]* 10.2 Write unit tests for coverage endpoint
    - Test response format
    - Test with no embeddings
    - Test with partial coverage
    - Test with 100% coverage
    - _Requirements: 10.6, 10.7_

- [x] 11. Create regenerate endpoint Lambda
  - [x] 11.1 Implement lambda/embeddings-regenerate/index.js
    - Implement POST handler for single entity regeneration
    - Fetch entity from appropriate table
    - Compose embedding_source
    - Send SQS message for regeneration
    - Return success response
    - _Requirements: 7.3, 7.4, 10.4, 10.5_
  
  - [ ]* 11.2 Write property test for regeneration timestamp update
    - **Property 12: Regeneration Timestamp Update**
    - **Validates: Requirements 7.5**
  
  - [ ]* 11.3 Write unit tests for regenerate endpoint
    - Test single entity regeneration
    - Test with invalid entity_type
    - Test with non-existent entity_id
    - _Requirements: 7.3, 10.4, 10.5_

- [x] 12. Checkpoint - Verify all API endpoints work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Add API Gateway endpoints
  - [x] 13.1 Add POST /api/semantic-search/unified endpoint
    - Run ./scripts/add-api-endpoint.sh /api/semantic-search/unified POST
    - Configure Lambda integration for unified-search
    - Configure authorizer
    - Deploy API Gateway changes
    - _Requirements: 10.1_
  
  - [x] 13.2 Add GET /api/embeddings/coverage endpoint
    - Run ./scripts/add-api-endpoint.sh /api/embeddings/coverage GET
    - Configure Lambda integration for embeddings-coverage
    - Configure authorizer
    - Deploy API Gateway changes
    - _Requirements: 10.6_
  
  - [x] 13.3 Add POST /api/embeddings/regenerate endpoint
    - Run ./scripts/add-api-endpoint.sh /api/embeddings/regenerate POST
    - Configure Lambda integration for embeddings-regenerate
    - Configure authorizer
    - Deploy API Gateway changes
    - _Requirements: 10.4_

- [ ] 14. Create backfill script
  - [ ] 14.1 Implement scripts/backfill-unified-embeddings.sh
    - Query all parts, tools, actions, issues, policies
    - For each entity, compose embedding_source
    - Send SQS message for embedding generation
    - Log progress and errors
    - _Requirements: 4.3_
  
  - [ ]* 14.2 Test backfill script on development database
    - Run script with small dataset
    - Verify embeddings created in unified_embeddings table
    - Verify coverage endpoint shows correct statistics
    - _Requirements: 4.3_

- [ ] 15. Create end-to-end test script
  - [ ] 15.1 Implement scripts/test-unified-embeddings-e2e.sh
    - Create test part with name, description, policy
    - Wait for embedding generation (poll SQS/database)
    - Execute semantic search for related query
    - Verify part appears in results
    - Clean up test data
    - _Requirements: 11.4_
  
  - [ ]* 15.2 Write integration test for end-to-end flow
    - Test complete flow from entity creation to search
    - Test backward compatibility with inline embeddings
    - Test migration flow
    - _Requirements: 4.2, 4.3, 11.4_

- [ ] 16. Add property tests for database constraints
  - [ ]* 16.1 Write property test for embedding storage completeness
    - **Property 1: Embedding Storage Completeness**
    - **Validates: Requirements 1.2, 1.3**
  
  - [ ]* 16.2 Write property test for cascade delete integrity
    - **Property 2: Cascade Delete Integrity**
    - **Validates: Requirements 1.4**
  
  - [ ]* 16.3 Write property test for organization cascade delete
    - **Property 13: Organization Cascade Delete**
    - **Validates: Requirements 9.4**

- [ ] 17. Update CloudFormation template
  - [ ] 17.1 Add unified-search Lambda to cloudformation/cwf-infrastructure.yaml
    - Add Lambda function definition
    - Add IAM permissions for Bedrock and RDS
    - Add VPC configuration
    - _Requirements: 10.1_
  
  - [ ] 17.2 Add embeddings-coverage Lambda to CloudFormation
    - Add Lambda function definition
    - Add IAM permissions for RDS
    - Add VPC configuration
    - _Requirements: 10.6_
  
  - [ ] 17.3 Add embeddings-regenerate Lambda to CloudFormation
    - Add Lambda function definition
    - Add IAM permissions for SQS and RDS
    - Add VPC configuration
    - _Requirements: 10.4_
  
  - [ ] 17.4 Update embeddings-processor environment variables
    - Add WRITE_TO_UNIFIED environment variable (default: true)
    - Add WRITE_TO_INLINE environment variable (default: true)
    - _Requirements: 5.7_

- [ ] 18. Update deployment scripts
  - [ ] 18.1 Create ./scripts/deploy-unified-search.sh
    - Package and deploy unified-search Lambda
    - _Requirements: 10.1_
  
  - [ ] 18.2 Create ./scripts/deploy-embeddings-coverage.sh
    - Package and deploy embeddings-coverage Lambda
    - _Requirements: 10.6_
  
  - [ ] 18.3 Create ./scripts/deploy-embeddings-regenerate.sh
    - Package and deploy embeddings-regenerate Lambda
    - _Requirements: 10.4_
  
  - [ ] 18.4 Update ./scripts/deploy-embeddings-processor.sh
    - Update to deploy modified embeddings-processor
    - _Requirements: 5.1, 5.2_

- [ ] 19. Add logging and observability
  - [ ] 19.1 Add CloudWatch logging to embeddings-processor
    - Log embedding generation events with entity_type, entity_id, status
    - Log errors with entity details
    - _Requirements: 11.1, 11.5_
  
  - [ ] 19.2 Add CloudWatch logging to unified-search
    - Log search queries with query text, result count, execution time
    - _Requirements: 11.2_
  
  - [ ] 19.3 Add CloudWatch metrics for SQS queue
    - Track messages sent, processed, failed
    - _Requirements: 11.6_

- [ ] 20. Final checkpoint - Run full test suite
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Documentation and deployment
  - [ ] 21.1 Update README with unified embeddings documentation
    - Document new API endpoints
    - Document migration process
    - Document backfill script usage
    - _Requirements: 4.3, 10.1, 10.4, 10.6_
  
  - [ ] 21.2 Create migration runbook
    - Document Phase 1-5 deployment steps
    - Document rollback procedures
    - Document monitoring and verification steps
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ] 21.3 Deploy to production
    - Execute Phase 1: Deploy infrastructure
    - Execute Phase 2: Enable dual writes
    - Execute Phase 3: Backfill existing data
    - Execute Phase 4: Switch to unified search
    - Monitor CloudWatch logs and metrics
    - _Requirements: 4.1, 4.2, 4.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- Migration is phased to minimize risk and allow rollback
