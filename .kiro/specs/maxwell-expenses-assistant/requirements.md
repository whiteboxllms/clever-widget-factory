# Requirements Document: Maxwell Expenses Assistant

## Introduction

Maxwell is the AI assistant (Bedrock Agent) that helps users understand their farm data. Currently, Maxwell can answer questions about tools, parts, and actions via dedicated action group Lambdas (`maxwell-observations`, `maxwell-storage-advisor`). Financial record embeddings (3,285 records, `entity_type: 'financial_record'`) already exist in the `unified_embeddings` table, and the unified search endpoint already supports them.

This feature adds a Maxwell button to the Finances page and a new `maxwell-expenses` action group Lambda that combines semantic embedding search with SQL filters to answer questions about money and expenses. The agent receives raw matched records and uses its quantitative reasoning prompt to aggregate, compare, and present financial data however the question demands.

## Glossary

- **Maxwell**: The Bedrock Agent-based AI assistant accessible via the prism FAB button throughout the application
- **Maxwell_Chat_Lambda**: The `cwf-maxwell-chat` Lambda that proxies user messages to the Bedrock Agent with prompt routing and session management
- **Action_Group_Lambda**: A Lambda function registered with the Bedrock Agent via an OpenAPI schema, invoked by the agent to retrieve domain-specific data
- **Maxwell_Expenses_Lambda**: The new `maxwell-expenses` action group Lambda that searches and filters financial records
- **GlobalMaxwellFAB**: The floating action button component that opens the Maxwell chat panel, currently visible on entity detail pages and the dashboard
- **Finances_Page**: The `/finances` route displaying the transaction list with filters and running balance
- **Financial_Record**: A transaction record in the `financial_records` table (id, organization_id, created_by, transaction_date, amount, payment_method)
- **Unified_Embeddings_Table**: The `unified_embeddings` table storing embedding vectors for all entity types including `financial_record`
- **Quantitative_Prompt**: The `maxwell-quantitative.txt` prompt fragment used when Maxwell detects financial/quantitative questions
- **Organization_Members**: The `organization_members` table containing user profiles with `full_name` and `cognito_user_id`

## Requirements

### Requirement 1: Maxwell FAB Visibility on Finances Page

**User Story:** As a user on the Finances page, I want to see the Maxwell button, so that I can ask questions about my expenses without navigating away.

#### Acceptance Criteria

1. WHEN a user navigates to the `/finances` route, THE GlobalMaxwellFAB SHALL be visible as a floating action button
2. WHEN the user clicks the Maxwell FAB on the Finances page, THE GlobalMaxwellFAB SHALL open the Maxwell chat panel in general mode without entity-specific context
3. THE GlobalMaxwellFAB SHALL continue to appear on all previously supported pages (entity detail pages and dashboard) without change

### Requirement 2: Maxwell Expenses Action Group Lambda

**User Story:** As a user, I want Maxwell to search and retrieve financial records using both semantic search and structured filters, so that Maxwell can answer questions about my expenses accurately.

#### Acceptance Criteria

1. THE Maxwell_Expenses_Lambda SHALL accept a `query` parameter (required) containing the user's search text for semantic matching against financial record embeddings
2. THE Maxwell_Expenses_Lambda SHALL accept optional filter parameters: `created_by_name` (string), `payment_method` (string, one of Cash/SCash/GCash/Wise), `start_date` (string, ISO date), `end_date` (string, ISO date), `sort_by` (string, one of amount_desc/amount_asc/date_desc/date_asc), and `limit` (integer, default 20)
3. WHEN no `start_date` is provided, THE Maxwell_Expenses_Lambda SHALL default to 6 months before the current date
4. WHEN no `end_date` is provided, THE Maxwell_Expenses_Lambda SHALL default to the current date
5. THE Maxwell_Expenses_Lambda SHALL generate an embedding vector for the `query` parameter using Bedrock Titan v1
6. THE Maxwell_Expenses_Lambda SHALL search the Unified_Embeddings_Table filtering by `entity_type = 'financial_record'` and the requesting user's `organization_id`
7. THE Maxwell_Expenses_Lambda SHALL join matched embeddings to the `financial_records` table and the linked `states` table (via `state_links`) to retrieve: description (state_text), amount, transaction_date, payment_method, and created_by_name
8. WHEN `created_by_name`, `payment_method`, `start_date`, or `end_date` filters are provided, THE Maxwell_Expenses_Lambda SHALL apply those as SQL WHERE clauses on the joined financial records before returning results
9. THE Maxwell_Expenses_Lambda SHALL return each matched record with: description, amount, transaction_date, payment_method, created_by_name, and similarity score
10. THE Maxwell_Expenses_Lambda SHALL return a `total_count` indicating the total number of matching records (before the limit is applied)
11. THE Maxwell_Expenses_Lambda SHALL return self-contained `instructions` telling the agent how to present the financial data, following the pattern used by existing action group Lambdas

### Requirement 3: Name Resolution for Created By Filter

**User Story:** As a user, I want to ask Maxwell about expenses by person name (e.g., "what did Mae buy?"), so that I don't need to know internal user IDs.

#### Acceptance Criteria

1. WHEN the `created_by_name` parameter is provided, THE Maxwell_Expenses_Lambda SHALL look up matching users in the Organization_Members table using a case-insensitive partial match (ILIKE) on the `full_name` column, scoped to the requesting user's organization
2. WHEN exactly one user matches the `created_by_name`, THE Maxwell_Expenses_Lambda SHALL filter financial records by that user's `cognito_user_id`
3. WHEN multiple users match the `created_by_name`, THE Maxwell_Expenses_Lambda SHALL filter financial records by all matching user IDs and include the matched names in the response
4. WHEN no users match the `created_by_name`, THE Maxwell_Expenses_Lambda SHALL return an empty result set with a message indicating no matching user was found

### Requirement 4: Quantitative Keyword Expansion

**User Story:** As a user asking expense-related questions, I want Maxwell to route my question to the quantitative prompt, so that I get data-driven answers with calculations.

#### Acceptance Criteria

1. THE Maxwell_Chat_Lambda SHALL detect the following additional keywords as quantitative: spend, spent, purchase, purchased, bought, transaction, payment, balance
2. WHEN any of the expanded quantitative keywords are detected in the user's message, THE Maxwell_Chat_Lambda SHALL prepend the Quantitative_Prompt fragment to the message sent to the Bedrock Agent
3. THE Maxwell_Chat_Lambda SHALL continue to detect all previously supported quantitative keywords (ROI, cost, revenue, profit, price, expense, budget, investment, how much, per month, per day, per week, earnings, income, margin, break-even) without change

### Requirement 5: Bedrock Agent Configuration

**User Story:** As a developer, I want the Bedrock Agent configured with the new expenses action group, so that the agent can invoke the Maxwell_Expenses_Lambda when users ask about financial records.

#### Acceptance Criteria

1. THE Bedrock Agent SHALL have an OpenAPI schema registered for the Maxwell_Expenses_Lambda defining the `/searchFinancialRecords` endpoint with all accepted parameters, their types, descriptions, and the response schema
2. THE Bedrock Agent SHALL have the `maxwell-expenses` action group configured to invoke the Maxwell_Expenses_Lambda
3. THE Maxwell_Expenses_Lambda SHALL have a resource-based policy allowing the Bedrock Agent to invoke it
4. THE Maxwell_Expenses_Lambda SHALL be deployed with the `cwf-common-nodejs` layer for shared utilities (db, authorizerContext, sqlUtils)

### Requirement 6: Error Handling

**User Story:** As a user, I want Maxwell to handle errors gracefully when searching financial records, so that I get a helpful response instead of a failure.

#### Acceptance Criteria

1. IF the embedding generation fails for the query, THEN THE Maxwell_Expenses_Lambda SHALL return a 500 status with a descriptive error message
2. IF the database query fails, THEN THE Maxwell_Expenses_Lambda SHALL return a 500 status with a generic error message and log the detailed error
3. IF the `organization_id` is missing from session attributes, THEN THE Maxwell_Expenses_Lambda SHALL return a 400 status indicating missing organization context
4. IF the required `query` parameter is missing or empty, THEN THE Maxwell_Expenses_Lambda SHALL return a 400 status indicating the missing parameter
