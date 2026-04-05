# Requirements Document: Cash Tracking

## Introduction

This feature introduces a petty cash and expense tracking system into CWF, replacing the existing Google Sheet workflow. The system tracks purchase transactions with receipt photos, computes a running petty cash balance, distinguishes between petty cash and externally-funded purchases, and uses AI to generate category tags and extract per-unit pricing from transaction descriptions. The feature supports the existing RBAC model where all org members can create transactions and leadership can view the full history.

## Glossary

- **Transaction**: A single purchase or cash reload record with amount, description, photos, and metadata
- **Petty_Cash**: A shared funding pool whose running balance is computed from transaction history
- **External_Funding**: A funding source outside petty cash (personal cards, Wise transfers, etc.) that is tracked for records but does not affect the petty cash balance
- **Funding_Source**: The origin of funds for a transaction, either Petty_Cash or External_Funding
- **Running_Balance**: The cumulative petty cash balance computed server-side from all petty cash transactions in chronological order
- **Receipt_Photo**: A required photograph of the receipt or handwritten acknowledgment for a transaction
- **Evidence_Photo**: An optional photograph of the purchased item or completed work (e.g., the door, gas meter reading, weeded area)
- **Category_Tag**: An AI-generated label describing the type of purchase (e.g., "Food", "Construction", "Agriculture")
- **Per_Unit_Price**: An AI-extracted price per individual item when a transaction involves multiple units
- **Purchaser**: The org member who made the purchase, auto-set to the logged-in user
- **Edit_History**: An audit trail recording changes made to a transaction after initial creation
- **System**: The Clever Widget Factory asset management application
- **Dashboard**: The main landing page of the CWF application displaying feature cards

## Requirements

### Requirement 1: Transaction Data Model

**User Story:** As a system architect, I want a dedicated transactions table that captures all financial transaction data, so that it serves as the source of truth for cash flow tracking across petty cash, credit cards, and other funding sources.

#### Acceptance Criteria

1. THE System SHALL persist financial transactions with the following data: organization, creator, transaction date, description, amount, and funding source
2. THE System SHALL treat positive amount values as expenses (money going out) and negative amount values as income or reloads (money coming in)
3. THE System SHALL support funding source values of 'petty_cash' and 'external'
4. WHEN funding source is 'external', THE System SHALL allow an optional note describing the funding origin (e.g., "Stefan credit card", "Wise transfer")
5. THE System SHALL require organization, creator, transaction date, description, amount, and funding source for every transaction
6. THE System SHALL scope all transactions to an organization for multi-tenancy isolation
7. THE System SHALL track both the user-entered transaction date and the system-recorded creation timestamp

### Requirement 2: Transaction Photo Storage

**User Story:** As a purchaser, I want to attach receipt and evidence photos to each transaction, so that there is visual proof of every purchase.

#### Acceptance Criteria

1. THE System SHALL reuse the existing photo upload infrastructure for attaching photos to transactions
2. THE System SHALL distinguish between receipt photos and evidence photos for each transaction
3. WHEN a transaction is created, THE System SHALL require at least one receipt photo
4. THE System SHALL allow zero or more evidence photos per transaction
5. WHEN a transaction is deleted, THE System SHALL remove all associated photo records

### Requirement 3: Running Balance Computation

**User Story:** As a team leader, I want to see the current petty cash balance computed from transaction history, so that I know how much cash is available.

#### Acceptance Criteria

1. THE System SHALL compute the petty cash running balance from all petty cash transactions for the organization
2. THE System SHALL exclude external-funded transactions from the running balance
3. THE System SHALL allow the running balance to be negative (representing overspending before a reload)
4. THE System SHALL include the current running balance when displaying transaction data

### Requirement 4: AI-Generated Metadata

*Deferred — AI metadata generation (category tags, per-unit price extraction, funding source inference) will be addressed in a follow-up spec.*

### Requirement 5: Transaction Creation

**User Story:** As an org member, I want to record a new transaction through a data collection screen similar to observations, so that I can upload photos and enter the cost in a familiar workflow.

#### Acceptance Criteria

1. WHEN a user clicks "Record Transaction" on the Finances card, THE System SHALL present a data collection screen similar to the observation workflow
2. THE System SHALL allow the user to upload photos (receipt and evidence) using the existing photo upload flow
3. THE System SHALL display a "Total Cost" field for entering the transaction amount
4. THE System SHALL allow negative amounts to represent income or reloads
5. THE System SHALL allow the user to enter a description of the transaction
6. THE System SHALL allow the user to select the funding source (petty cash or external)
7. WHEN funding source is external, THE System SHALL allow an optional note describing the source
8. THE System SHALL allow the user to enter the transaction date (defaulting to today)
9. WHEN a transaction is created, THE System SHALL auto-set the creator to the authenticated user
10. THE System SHALL require at least one receipt photo before allowing save

### Requirement 6: Transaction Listing and Retrieval

**User Story:** As a team member, I want to view transaction history with filtering and the current balance, so that I can review spending and track cash flow.

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint to list transactions for the authenticated user's organization
2. THE System SHALL return transactions sorted by transaction_date descending, then created_at descending
3. THE System SHALL include the current petty cash running balance in the list response
4. THE System SHALL support pagination for the transaction list
5. THE System SHALL include all transaction fields, associated photo URLs, and AI-generated metadata in each list item
6. THE System SHALL support filtering transactions by funding_source
7. THE System SHALL support filtering transactions by date range (start_date, end_date)
8. THE System SHALL support filtering transactions by created_by (purchaser)

### Requirement 7: Transaction Editing and Audit Trail

**User Story:** As a purchaser, I want to edit my own transactions and have changes tracked, so that corrections are possible while maintaining accountability.

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint to update an existing transaction
2. THE System SHALL allow editing of transaction_date, description, amount, funding_source, external_source_note, and AI-generated metadata fields
3. WHEN a transaction is updated, THE System SHALL record the change in a `cash_transaction_edits` table with edit_id, transaction_id, edited_by, edited_at, field_changed, old_value, and new_value
4. THE System SHALL allow users to edit only transactions where created_by matches the authenticated user's ID
5. WHEN a user with data:write:all permission edits a transaction, THE System SHALL allow the edit regardless of created_by
6. WHEN a transaction amount or funding_source is edited, THE System SHALL recompute the running balance
7. THE System SHALL update the updated_at timestamp on the transaction record after each edit
8. THE System SHALL allow adding or removing photos from an existing transaction, provided at least one receipt photo remains

### Requirement 8: Permissions and Access Control

**User Story:** As an organization administrator, I want transaction access to follow the existing RBAC model, so that data visibility is consistent with the rest of the application.

#### Acceptance Criteria

1. THE System SHALL allow all authenticated org members to create transactions within their organization
2. THE System SHALL allow users to view and edit their own transactions (where created_by matches the authenticated user)
3. WHEN a user has the data:read:all permission, THE System SHALL allow the user to view all transactions within the organization
4. WHEN a user has the data:read:all permission, THE System SHALL allow the user to view the full petty cash running balance
5. WHEN a user does not have data:read:all permission, THE System SHALL restrict the user to viewing only transactions where created_by matches the authenticated user
6. WHEN a user does not have data:read:all permission, THE System SHALL still display the current running balance (balance is organizational, not personal)
7. THE System SHALL enforce organization_id scoping on all transaction queries to maintain multi-tenancy isolation

### Requirement 9: Dashboard Entry Point

**User Story:** As a user, I want to access financial transactions from the main dashboard, so that I can quickly see recent activity and navigate to the full transaction interface.

#### Acceptance Criteria

1. THE System SHALL display a "Finances" card on the dashboard
2. THE System SHALL display the current petty cash running balance on the Finances card
3. THE System SHALL display a table of the last 30 days of transactions on the Finances card
4. THE System SHALL filter the transaction table based on the user's permissions (own transactions for regular users, all transactions for leadership)
5. WHEN a user clicks a transaction row, THE System SHALL navigate to the transaction detail/edit view
6. THE System SHALL provide a way to create a new transaction from the Finances card

### Requirement 10: Transaction Embeddings for Semantic Search

**User Story:** As a user, I want to search transactions using natural language, so that I can find past purchases without remembering exact descriptions.

#### Acceptance Criteria

1. WHEN a transaction is created or updated, THE System SHALL generate a unified embedding from the transaction description and AI category tags
2. THE System SHALL store the embedding in the unified_embeddings table with entity_type='cash_transaction'
3. THE System SHALL compose the embedding_source from: description, AI category tags, and external_source_note (if present)
4. THE System SHALL scope embedding queries by organization_id for multi-tenancy
5. WHEN a transaction is deleted, THE System SHALL cascade delete the associated embedding record

### Requirement 11: Photo Upload Workflow

**User Story:** As a purchaser, I want to upload receipt and evidence photos during transaction creation, so that visual proof is attached before the transaction is saved.

#### Acceptance Criteria

1. THE System SHALL use the existing cwf-presigned-upload Lambda to generate S3 presigned URLs for photo uploads
2. WHEN a user initiates a photo upload, THE System SHALL request a presigned URL with the appropriate content type
3. THE System SHALL support uploading multiple photos per transaction (one or more receipts, zero or more evidence photos)
4. THE System SHALL compress photos client-side before upload using the existing browser-image-compression library
5. WHEN all required photos are uploaded, THE System SHALL enable the transaction save action
6. THE System SHALL display photo previews during the upload process

