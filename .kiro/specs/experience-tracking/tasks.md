# Implementation Plan: Experience Tracking System (Phase 1)

## Overview

This implementation plan focuses on Phase 1 of the experience tracking system: establishing the database schema, Lambda function, API endpoints, and basic UI for manually creating and viewing experiences. This phase captures state transitions (S → S') for tools and parts without AI computation.

The implementation follows an incremental approach where each task builds on previous work, with checkpoints to ensure stability before proceeding.

## Tasks

- [ ] 1. Database schema setup
  - [ ] 1.1 Create experiences table migration
    - Write SQL migration for experiences table with all fields and constraints
    - Include indexes for entity lookup, organization filtering, and created_at sorting
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  
  - [ ] 1.2 Create experience_components table migration
    - Write SQL migration for experience_components junction table
    - Include CHECK constraints for component_type and state_id/action_id validation
    - Include indexes for experience_id, state_id, and action_id lookups
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  
  - [ ] 1.3 Execute database migrations
    - Run migrations via cwf-db-migration Lambda function
    - Verify table creation and constraints using information_schema queries
    - _Requirements: 1.1, 2.1_
  
  - [ ]* 1.4 Write unit tests for database constraints
    - Test CHECK constraint on entity_type values
    - Test CHECK constraint on component_type values
    - Test CHECK constraint on state_id/action_id mutual exclusivity
    - Test foreign key cascade deletes
    - _Requirements: 1.3, 2.4, 2.5, 2.9, 2.10_

- [ ] 2. Lambda function implementation
  - [ ] 2.1 Create cwf-experiences-lambda directory structure
    - Create lambda/experiences/ directory
    - Create index.js handler file
    - Create package.json with pg dependency
    - Run npm install to set up node_modules
    - Note: Shared utilities (authorizerContext, db) will be provided by cwf-common-nodejs layer
    - _Requirements: 5.1, 9.1, 10.1_
  
  - [ ] 2.2 Implement POST /api/experiences endpoint
    - Parse and validate request body (entity_type, entity_id, initial_state_id, action_id, final_state_id)
    - Extract organization_id and user_id from authorizer context
    - Create experience record in database
    - Create experience_components records for initial_state, action (if provided), and final_state
    - Return created experience with components
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [ ] 2.3 Implement GET /api/experiences endpoint
    - Parse query parameters (entity_type, entity_id, limit, offset)
    - Filter by organization_id from authorizer context
    - Query experiences with LEFT JOIN to experience_components and states/actions
    - Return paginated results with component details
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
  
  - [ ] 2.4 Implement GET /api/experiences/:id endpoint
    - Extract experience ID from path parameters
    - Filter by organization_id from authorizer context
    - Query single experience with all components and entity details
    - Return 404 if not found or wrong organization
    - _Requirements: 9.10, 10.1, 10.2_
  
  - [ ]* 2.5 Write unit tests for Lambda handlers
    - Test POST endpoint with valid inputs
    - Test POST endpoint with missing required fields
    - Test POST endpoint with invalid entity_type
    - Test GET list endpoint with filters
    - Test GET single endpoint with valid ID
    - Test GET single endpoint with invalid ID
    - Test organization isolation for all endpoints
    - _Requirements: 5.1, 9.1, 9.10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 3. Checkpoint - Database and Lambda function complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Lambda deployment and API Gateway integration
  - [ ] 4.1 Deploy Lambda function with layer
    - Use scripts/deploy/deploy-lambda-with-layer.sh script
    - Run: ./scripts/deploy/deploy-lambda-with-layer.sh experiences cwf-experiences-lambda
    - Script will create function if it doesn't exist, or update code if it does
    - Script will attach cwf-common-nodejs layer (version 13) for shared utilities
    - Verify deployment with CodeSha256 check
    - _Requirements: 5.1, 9.1, 10.1_
  
  - [ ] 4.2 Create API Gateway endpoints using add-api-endpoint.sh
    - Create POST /api/experiences endpoint
    - Run: ./scripts/add-api-endpoint.sh /api/experiences POST cwf-experiences-lambda
    - Create GET /api/experiences endpoint
    - Run: ./scripts/add-api-endpoint.sh /api/experiences GET cwf-experiences-lambda
    - Note: Path parameter endpoint (/api/experiences/{id}) requires manual setup or wire script
    - _Requirements: 5.1, 9.1_
  
  - [ ] 4.3 Create wire-api-gateway.sh script for experiences
    - Create lambda/experiences/wire-api-gateway.sh following explorations pattern
    - Configure script to wire POST /api/experiences, GET /api/experiences, and GET /api/experiences/{id}
    - Include deployment step at the end
    - Run script to wire integrations and deploy
    - _Requirements: 5.1, 9.1, 9.10_
  
  - [ ] 4.4 Verify API Gateway deployment
    - Test POST /api/experiences with curl or Postman
    - Test GET /api/experiences with query parameters
    - Test GET /api/experiences/{id} with valid ID
    - Verify authentication is required (401 without token)
    - _Requirements: 5.1, 9.1, 9.10_

- [ ] 5. Frontend API service integration
  - [ ] 5.1 Add experience types to TypeScript definitions
    - Create Experience and ExperienceComponent interfaces in src/types/
    - Match database schema and API response structure
    - _Requirements: 5.1, 9.1, 9.10_
  
  - [ ] 5.2 Implement experience API service methods
    - Add createExperience() method to apiService
    - Add listExperiences() method with query parameters
    - Add getExperience() method for single experience retrieval
    - _Requirements: 5.1, 9.1, 9.10_
  
  - [ ] 5.3 Create TanStack Query hooks for experiences
    - Create useCreateExperience mutation hook
    - Create useExperiences query hook with filters
    - Create useExperience query hook for single experience
    - Configure cache invalidation on mutations
    - _Requirements: 5.1, 9.1, 9.10_
  
  - [ ]* 5.4 Write unit tests for API service methods
    - Test createExperience with valid inputs
    - Test listExperiences with filters
    - Test getExperience with valid ID
    - Test error handling for all methods
    - _Requirements: 5.1, 9.1, 9.10_

- [ ] 6. Experience creation UI component
  - [ ] 6.1 Create ExperienceCreationDialog component
    - Create dialog component using shadcn-ui Dialog
    - Add form fields: entity (pre-filled), initial_state, action (optional), final_state
    - Use React Hook Form + Zod for validation
    - Implement state/action dropdowns with data from existing hooks
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 6.2 Integrate dialog with tool/part detail pages
    - Add "Create Experience" button to tool detail page
    - Add "Create Experience" button to part detail page
    - Pass entity_type and entity_id as props to dialog
    - Handle success/error states with toast notifications
    - _Requirements: 5.1, 5.5, 5.6_
  
  - [ ] 6.3 Implement state and action selection logic
    - Fetch prior states for the entity (captured_at < final_state.captured_at)
    - Fetch actions for the entity
    - Filter and sort options appropriately
    - Handle empty state (no prior states or actions available)
    - _Requirements: 5.2, 5.3, 5.7_
  
  - [ ]* 6.4 Write integration tests for experience creation flow
    - Test dialog opens with correct entity context
    - Test form validation (required fields)
    - Test successful experience creation
    - Test error handling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 7. Checkpoint - Experience creation UI complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Experience list view UI component
  - [ ] 8.1 Create ExperienceListView component
    - Create component to display list of experiences
    - Show initial_state, action (if present), final_state for each experience
    - Display created_by user name and created_at timestamp
    - Sort by created_at descending
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ] 8.2 Create ExperienceCard component
    - Create card component for individual experience display
    - Show state text and captured_at for initial and final states
    - Show action title and created_at if action exists
    - Include visual timeline representation (S → A → S')
    - _Requirements: 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 8.3 Integrate list view with tool/part detail pages
    - Add "Experiences" tab to tool detail page
    - Add "Experiences" tab to part detail page
    - Fetch experiences using useExperiences hook with entity filters
    - Handle loading and error states
    - _Requirements: 9.1, 9.6, 9.7, 9.8, 9.9_
  
  - [ ] 8.4 Implement experience detail view
    - Create modal or expanded view for single experience
    - Show full details including photos, descriptions, timestamps
    - Display entity details (name, category)
    - Add click handler to experience cards
    - _Requirements: 9.10, 9.2, 9.3, 9.4_
  
  - [ ]* 8.5 Write integration tests for experience list view
    - Test list renders with experiences
    - Test empty state (no experiences)
    - Test filtering by entity
    - Test experience detail view opens on click
    - _Requirements: 9.1, 9.6, 9.7, 9.8, 9.9, 9.10_

- [ ] 9. Final checkpoint and validation
  - [ ] 9.1 End-to-end testing
    - Test complete flow: create experience → view in list → view details
    - Test with different entity types (tool and part)
    - Test organization isolation (multi-tenancy)
    - Verify all API endpoints work correctly
    - _Requirements: 5.1, 9.1, 9.10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [ ] 9.2 Performance validation
    - Test experience queries with typical entity histories (< 100 experiences)
    - Verify response times are within 500ms
    - Check database query performance with EXPLAIN ANALYZE
    - _Requirements: Non-functional requirement: Performance_
  
  - [ ] 9.3 Documentation updates
    - Update API documentation with new endpoints
    - Document experience data model in codebase
    - Add comments to complex query logic
    - _Requirements: All_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Phase 1 focuses on manual experience creation; AI computation is deferred to Phase 2
- The implementation uses JavaScript/Node.js for Lambda functions and TypeScript/React for frontend
- Database migrations must be executed via cwf-db-migration Lambda and verified separately
- Lambda deployment uses scripts/deploy/deploy-lambda-with-layer.sh which:
  - Creates or updates the Lambda function
  - Attaches cwf-common-nodejs layer (version 13) for shared utilities (authorizerContext, db, response)
  - Configures environment variables (DB_PASSWORD) from .env.local
  - Sets timeout to 30 seconds and memory to 512 MB
- API endpoint creation uses scripts/add-api-endpoint.sh for POST and GET methods
- wire-api-gateway.sh script should be created to update integrations after Lambda redeployment
- All API endpoints require authentication via AWS Cognito authorizer (AUTHORIZER_ID: pjg8xs)
- Multi-tenancy is enforced at the database query level using organization_id filters
