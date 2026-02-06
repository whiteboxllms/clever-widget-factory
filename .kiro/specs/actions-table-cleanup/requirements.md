# Requirements Document

## Introduction

This specification defines the removal of obsolete fields from the actions table in the Clever Widget Factory database. Following the successful migration from inline observations to the states/state_links table system, several fields in the actions table are no longer used and should be removed to reduce technical debt, simplify the schema, and prevent confusion for future developers.

## Glossary

- **Actions_Table**: The PostgreSQL table storing work activity records in the CWF system
- **States_Table**: The new table storing structured observations (photos, timestamps, descriptions) that replaced inline observations
- **Migration_Script**: SQL script executed via cwf-db-migration Lambda function to modify database schema
- **TypeScript_Types**: Type definitions in the frontend codebase that mirror database schema
- **Obsolete_Field**: A database column that is no longer read or written by any part of the application

## Requirements

### Requirement 1: Remove Obsolete Observations Field

**User Story:** As a developer, I want to remove the obsolete observations field from the actions table, so that the schema reflects the current architecture using the states table.

#### Acceptance Criteria

1. WHEN the migration script executes, THE Migration_Script SHALL drop the observations column from the actions table
2. WHEN the observations column is dropped, THE Migration_Script SHALL use IF EXISTS to prevent errors if the column is already removed
3. WHEN the migration completes, THE Actions_Table SHALL no longer contain an observations column
4. WHEN TypeScript types are updated, THE Action type definition SHALL not include an observations field

### Requirement 2: Remove Obsolete Evidence Description Field

**User Story:** As a developer, I want to remove the unused evidence_description field from the actions table, so that the schema doesn't contain unimplemented features.

#### Acceptance Criteria

1. WHEN the migration script executes, THE Migration_Script SHALL drop the evidence_description column from the actions table
2. WHEN the evidence_description column is dropped, THE Migration_Script SHALL use IF EXISTS to prevent errors if the column is already removed
3. WHEN the migration completes, THE Actions_Table SHALL no longer contain an evidence_description column
4. WHEN TypeScript types are updated, THE Action type definition SHALL not include an evidence_description field

### Requirement 3: Remove Obsolete QA Approval Field

**User Story:** As a developer, I want to remove the unused qa_approved_at field from the actions table, so that the schema doesn't contain unused approval tracking.

#### Acceptance Criteria

1. WHEN the migration script executes, THE Migration_Script SHALL drop the qa_approved_at column from the actions table
2. WHEN the qa_approved_at column is dropped, THE Migration_Script SHALL use IF EXISTS to prevent errors if the column is already removed
3. WHEN the migration completes, THE Actions_Table SHALL no longer contain a qa_approved_at column
4. WHEN TypeScript types are updated, THE Action type definition SHALL not include a qa_approved_at field

### Requirement 4: Remove Obsolete Score Field

**User Story:** As a developer, I want to remove the legacy score field from the actions table, so that the schema reflects the current scoring system using scoring_data and action_scores.

#### Acceptance Criteria

1. WHEN the migration script executes, THE Migration_Script SHALL drop the score column from the actions table
2. WHEN the score column is dropped, THE Migration_Script SHALL use IF EXISTS to prevent errors if the column is already removed
3. WHEN the migration completes, THE Actions_Table SHALL no longer contain a score column
4. WHEN TypeScript types are updated, THE Action type definition SHALL not include a score field

### Requirement 5: Preserve Active Fields

**User Story:** As a developer, I want to ensure that actively used duration and scoring fields are preserved, so that existing functionality continues to work.

#### Acceptance Criteria

1. WHEN the migration script executes, THE Migration_Script SHALL NOT drop the estimated_duration column
2. WHEN the migration script executes, THE Migration_Script SHALL NOT drop the actual_duration column
3. WHEN the migration script executes, THE Migration_Script SHALL NOT drop the scoring_data column
4. WHEN the migration completes, THE Actions_Table SHALL retain all actively used fields

### Requirement 6: Safe Migration Execution

**User Story:** As a database administrator, I want the migration to execute safely without data loss, so that the system remains stable during deployment.

#### Acceptance Criteria

1. WHEN the migration script is created, THE Migration_Script SHALL use IF EXISTS clauses for all DROP COLUMN statements
2. WHEN the migration executes, THE Migration_Script SHALL complete without errors even if columns are already removed
3. WHEN the migration completes, THE Migration_Script SHALL be verified by querying the information_schema.columns table
4. IF any column still contains data, THEN THE Migration_Script SHALL document the data before dropping the column

### Requirement 7: Type System Consistency

**User Story:** As a frontend developer, I want TypeScript types to match the database schema, so that I don't reference non-existent fields.

#### Acceptance Criteria

1. WHEN TypeScript types are updated, THE Action type SHALL not include any of the four obsolete fields
2. WHEN TypeScript compilation runs, THE TypeScript_Compiler SHALL not report errors related to missing fields
3. WHEN the frontend code is reviewed, THE Codebase SHALL not contain references to the obsolete fields
4. WHEN API responses are typed, THE Response types SHALL match the updated Action type
