# Requirements Document: Database State Terminology Migration

## Introduction

This specification defines the migration of database tables from "observation" terminology to "state" terminology, and updates the Lambda function to work with the new table names. This change aligns the backend infrastructure with Reinforcement Learning (RL) concepts (Actions, Policy, State) and accurately represents the generic state capture system.

**Scope**: Database tables and Lambda function only. Frontend code remains unchanged and continues using "observation" terminology.

## Glossary

- **State** (Backend): A captured record of system state at a point in time, with optional photos and text
- **State_Photo**: A photo associated with a state capture (backend table name)
- **State_Link**: A polymorphic link connecting a state to an entity (backend table name)
- **RL (Reinforcement Learning)**: The conceptual framework guiding backend design (Actions, Policy, State, Rewards)
- **System**: The CWF asset management and accountability system

## Terminology Mapping

| Layer | Old Term | New Term |
|-------|----------|----------|
| Database Tables | `observations` | `states` |
| Database Tables | `observation_photos` | `state_photos` |
| Database Tables | `observation_links` | `state_links` |
| Database Columns | `observation_id` | `state_id` |
| Database Columns | `observation_text` | `state_text` |
| Database Columns | `observed_by` | `captured_by` |
| Database Columns | `observed_at` | `captured_at` |
| Lambda Function | `lambda/observations/` | `lambda/states/` |
| Lambda Function Name | `cwf-observations-lambda` | `cwf-states-lambda` |
| API Endpoints | `/observations` | `/states` |
| Frontend | **NO CHANGES** | **NO CHANGES** |

## Requirements

### Requirement 1: Rename Database Tables

**User Story:** As a database administrator, I want database tables renamed to use "state" terminology, so that the schema aligns with RL concepts.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL rename `observations` table to `states`
2. WHEN the migration runs, THE System SHALL rename `observation_photos` table to `state_photos`
3. WHEN the migration runs, THE System SHALL rename `observation_links` table to `state_links`
4. WHEN the migration completes, THE System SHALL verify all data is preserved
5. WHEN the migration encounters an error, THE System SHALL rollback all changes

### Requirement 2: Rename Database Columns

**User Story:** As a database administrator, I want database columns renamed to match the new table names, so that the schema is consistent.

#### Acceptance Criteria

1. WHEN renaming columns, THE System SHALL rename `observation_id` to `state_id` in `state_photos` table
2. WHEN renaming columns, THE System SHALL rename `observation_id` to `state_id` in `state_links` table
3. WHEN renaming columns, THE System SHALL rename `observation_text` to `state_text` in `states` table
4. WHEN renaming columns, THE System SHALL rename `observed_by` to `captured_by` in `states` table
5. WHEN renaming columns, THE System SHALL rename `observed_at` to `captured_at` in `states` table
6. WHEN the migration completes, THE System SHALL verify all foreign key relationships work correctly

### Requirement 3: Update Database Indexes

**User Story:** As a database administrator, I want indexes renamed to match the new table names, so that query performance is maintained.

#### Acceptance Criteria

1. WHEN updating indexes, THE System SHALL rename `idx_observations_org` to `idx_states_org`
2. WHEN updating indexes, THE System SHALL rename `idx_observations_observed_at` to `idx_states_captured_at`
3. WHEN updating indexes, THE System SHALL rename `idx_observation_photos_observation` to `idx_state_photos_state`
4. WHEN updating indexes, THE System SHALL rename `idx_observation_links_observation` to `idx_state_links_state`
5. WHEN updating indexes, THE System SHALL rename `idx_observation_links_entity` to `idx_state_links_entity`
6. WHEN the migration completes, THE System SHALL verify all indexes exist and are being used

### Requirement 4: Update Foreign Key Constraints

**User Story:** As a database administrator, I want foreign key constraints updated to reference the new table and column names, so that referential integrity is maintained.

#### Acceptance Criteria

1. WHEN updating constraints, THE System SHALL update foreign key from `state_photos.observation_id` to `state_photos.state_id`
2. WHEN updating constraints, THE System SHALL update foreign key reference from `observations(id)` to `states(id)`
3. WHEN updating constraints, THE System SHALL update foreign key from `state_links.observation_id` to `state_links.state_id`
4. WHEN updating constraints, THE System SHALL maintain CASCADE DELETE behavior
5. WHEN the migration completes, THE System SHALL verify all foreign keys work correctly

### Requirement 5: Update Table and Column Comments

**User Story:** As a developer, I want table and column comments updated to use "state" terminology, so that database documentation is accurate.

#### Acceptance Criteria

1. WHEN updating comments, THE System SHALL update table comment for `states` to reference "state capture"
2. WHEN updating comments, THE System SHALL update table comment for `state_photos` to reference "state photos"
3. WHEN updating comments, THE System SHALL update table comment for `state_links` to reference "state links"
4. WHEN updating comments, THE System SHALL update column comments to use "state" terminology
5. WHEN querying table metadata, THE System SHALL show updated comments

### Requirement 6: Rename Lambda Function Directory

**User Story:** As a backend developer, I want the Lambda function directory renamed to match the new terminology, so that the codebase is organized correctly.

#### Acceptance Criteria

1. WHEN renaming the Lambda, THE System SHALL rename `lambda/observations/` to `lambda/states/`
2. WHEN renaming the Lambda, THE System SHALL move `lambda/observations/index.js` to `lambda/states/index.js`
3. WHEN renaming the Lambda, THE System SHALL update any package.json or configuration files
4. WHEN the Lambda is deployed, THE System SHALL use the new directory structure

### Requirement 7: Update Lambda Code to Use New Table Names

**User Story:** As a backend developer, I want Lambda code updated to query the new table names, so that the API continues working.

#### Acceptance Criteria

1. WHEN the Lambda queries data, THE System SHALL query `states` table instead of `observations`
2. WHEN the Lambda queries data, THE System SHALL query `state_photos` table instead of `observation_photos`
3. WHEN the Lambda queries data, THE System SHALL query `state_links` table instead of `observation_links`
4. WHEN the Lambda queries data, THE System SHALL use column names: `state_id`, `state_text`, `captured_by`, `captured_at`
5. WHEN the Lambda returns responses, THE System SHALL return field names matching the database schema
6. WHEN the Lambda handles errors, THE System SHALL return appropriate error messages

### Requirement 8: Update Lambda Function Name

**User Story:** As a DevOps engineer, I want the Lambda function name updated to match the new terminology, so that AWS resources are clearly named.

#### Acceptance Criteria

1. WHEN deploying the Lambda, THE System SHALL use function name `cwf-states-lambda`
2. WHEN deploying the Lambda, THE System SHALL update CloudFormation/SAM template
3. WHEN deploying the Lambda, THE System SHALL update IAM role names to include "states"
4. WHEN deploying the Lambda, THE System SHALL update CloudWatch log group to `/aws/lambda/cwf-states-lambda`
5. WHEN the Lambda is deployed, THE System SHALL verify the function is accessible

### Requirement 9: Update API Gateway Endpoints

**User Story:** As a backend developer, I want API Gateway endpoints updated to use `/states` paths, so that the API is consistent with the domain model.

#### Acceptance Criteria

1. WHEN updating API Gateway, THE System SHALL create new resource `/states`
2. WHEN updating API Gateway, THE System SHALL create new resource `/states/{id}`
3. WHEN updating API Gateway, THE System SHALL configure methods: GET, POST, PUT, DELETE, OPTIONS
4. WHEN updating API Gateway, THE System SHALL point integrations to `cwf-states-lambda`
5. WHEN updating API Gateway, THE System SHALL configure CORS headers
6. WHEN updating API Gateway, THE System SHALL deploy changes to prod stage
7. WHEN API Gateway is updated, THE System SHALL test all endpoints return correct responses

### Requirement 10: Preserve All Existing Data

**User Story:** As a system administrator, I want all existing data preserved during migration, so that no historical data is lost.

#### Acceptance Criteria

1. WHEN the migration runs, THE System SHALL preserve all 20 existing observation records
2. WHEN the migration runs, THE System SHALL preserve all photo records and S3 URLs
3. WHEN the migration runs, THE System SHALL preserve all link records connecting to entities
4. WHEN the migration runs, THE System SHALL preserve all timestamps: created_at, updated_at
5. WHEN the migration runs, THE System SHALL preserve all user references
6. WHEN the migration runs, THE System SHALL preserve organization_id for multi-tenancy
7. WHEN the migration completes, THE System SHALL verify record counts match before and after

### Requirement 11: Maintain Zero Downtime During Migration

**User Story:** As a system administrator, I want the system to remain operational during migration, so that users experience no service interruption.

#### Acceptance Criteria

1. WHEN the migration is in progress, THE System SHALL continue serving requests
2. WHEN deploying database changes, THE System SHALL use a transaction to ensure atomicity
3. WHEN deploying Lambda changes, THE System SHALL deploy new version before removing old function
4. WHEN the migration fails, THE System SHALL rollback to previous state without data loss
5. WHEN users access the system during migration, THE System SHALL return valid responses

### Requirement 12: Update Migration File Documentation

**User Story:** As a developer, I want migration files documented clearly, so that the codebase history is understandable.

#### Acceptance Criteria

1. WHEN creating the migration, THE System SHALL create file `002-rename-observations-to-states.sql`
2. WHEN creating the migration, THE System SHALL include comments explaining the terminology change
3. WHEN creating the migration, THE System SHALL include comments explaining the RL alignment rationale
4. WHEN creating the migration, THE System SHALL keep original `001-create-observations-schema.sql` for history
5. WHEN reviewing migrations, THE System SHALL have clear documentation of the schema evolution
