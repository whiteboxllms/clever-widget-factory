# Implementation Plan: Maxwell Expenses Assistant

## Overview

Add expense-querying capabilities to Maxwell by creating a `maxwell-expenses` action group Lambda (following the `maxwell-storage-advisor` pattern), expanding GlobalMaxwellFAB visibility to `/finances`, and adding expense keywords to the quantitative prompt routing. The Lambda combines semantic embedding search on `unified_embeddings` with SQL filters on `financial_records`.

## Tasks

- [x] 1. Add GlobalMaxwellFAB visibility on Finances page
  - [x] 1.1 Update `src/components/GlobalMaxwellFAB.tsx` to show FAB on `/finances`
    - Add `const isFinances = location.pathname === '/finances';` following the `isDashboard` pattern
    - Update the visibility guard: `if (!entityContext && !isDashboard && !isFinances && !isPanelOpen) { return null; }`
    - Update the render condition: `{!isPanelOpen && (entityContext || isDashboard || isFinances) && (`
    - No entity context passed — FAB opens in general mode, same as dashboard
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.2 Write unit tests for GlobalMaxwellFAB visibility
    - Test FAB renders on `/finances`, `/dashboard`, `/`, and entity detail pages
    - Test FAB does not render on `/settings` or other unsupported routes
    - Test FAB opens panel in general mode (no entity context) on `/finances`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Expand quantitative keywords in maxwell-chat
  - [x] 2.1 Update `QUANTITATIVE_KEYWORDS` regex in `lambda/maxwell-chat/index.js`
    - Append `|spend|spent|purchase|purchased|bought|transaction|payment|balance` to the existing alternation
    - All existing keywords remain unchanged
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.2 Write property test for quantitative keyword detection (Property 5)
    - **Property 5: Quantitative keyword detection**
    - Generate random message strings with at least one quantitative keyword (from both old and new sets) injected at a random position
    - Assert `detectPromptMode` returns the `QUANTITATIVE_PROMPT` fragment
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 3. Checkpoint - Verify frontend and keyword changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create maxwell-expenses Lambda with core handler and helpers
  - [x] 4.1 Scaffold `lambda/maxwell-expenses/` directory and `package.json`
    - Create `lambda/maxwell-expenses/package.json` with name `maxwell-expenses` and dependencies matching `maxwell-storage-advisor`
    - Copy `lambda/maxwell-storage-advisor/shared/embeddings.js` to `lambda/maxwell-expenses/shared/embeddings.js` (identical local copy)
    - Run `npm install` in the new directory
    - _Requirements: 5.4_

  - [x] 4.2 Implement `lambda/maxwell-expenses/index.js` handler
    - Import `getDbClient` from `/opt/nodejs/db`, `escapeLiteral` from `/opt/nodejs/sqlUtils`, `generateEmbeddingV1` from `./shared/embeddings`
    - Implement `queryJSON`, `parseActionGroupParams`, `buildActionGroupResponse` — identical to `maxwell-storage-advisor`
    - Implement `resolveCreatedByName(client, organizationId, createdByName)` using ILIKE partial match on `organization_members.full_name` scoped to org
    - Implement `exports.handler`:
      1. Extract `actionGroup` (default `SearchFinancialRecords`), `apiPath` (default `/searchFinancialRecords`), `httpMethod` (default `POST`)
      2. Extract `organization_id` from `event.sessionAttributes`
      3. Parse params: `query` (required), `created_by_name`, `payment_method`, `start_date`, `end_date`, `sort_by`, `limit`
      4. Validate: return 400 if `query` missing/empty or `organization_id` missing
      5. Default `start_date` to 6 months ago, `end_date` to today
      6. If `created_by_name` provided, resolve to user IDs; if no match, return empty results with message
      7. Generate embedding via `generateEmbeddingV1(query)`
      8. Build hybrid SQL: embedding similarity on `unified_embeddings` joined to `financial_records` + `state_links` + `states` + `organization_members`, with WHERE clauses for date range, payment method, resolved user IDs
      9. Execute main query + parallel COUNT query for `total_count`
      10. Format results and return via `buildActionGroupResponse` with self-contained `instructions`
    - Follow error handling pattern from `maxwell-storage-advisor`: catch embedding failures (500) and DB failures (500) separately
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 4.3 Write property test for response completeness (Property 1)
    - **Property 1: Response completeness**
    - Generate random valid query strings and mock database results with random financial record data
    - Assert every result object has all required fields: `description`, `amount`, `transaction_date`, `payment_method`, `created_by_name`, `similarity`
    - Assert response includes non-empty `instructions` and `message` strings
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.7, 2.9, 2.11**

  - [ ]* 4.4 Write property test for filter correctness (Property 2)
    - **Property 2: Filter correctness**
    - Generate random filter combinations (payment_method from valid enum, random date ranges, random user IDs)
    - Generate mock database rows, some matching filters and some not
    - Assert all returned results satisfy every provided filter
    - Assert query always includes `entity_type = 'financial_record'` and correct `organization_id`
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.6, 2.8**

  - [ ]* 4.5 Write property test for total count invariant (Property 3)
    - **Property 3: Total count invariant**
    - Generate random query results with varying total counts and limits
    - Assert `total_count >= results.length` for every response
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.10**

  - [ ]* 4.6 Write property test for name resolution correctness (Property 4)
    - **Property 4: Name resolution correctness**
    - Generate random arrays of organization members with random `full_name` values
    - Generate random search name strings
    - Assert returned user IDs are exactly those whose `full_name` contains the search string (case-insensitive)
    - When zero members match, assert result set is empty
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 4.7 Write unit tests for maxwell-expenses handler
    - Test missing `query` → 400 response
    - Test missing `organization_id` → 400 response
    - Test embedding generation failure → 500 response
    - Test database query failure → 500 response
    - Test default date range (no start_date → 6 months ago, no end_date → today)
    - Test name resolution: single match, multiple matches, no matches
    - Test response format matches Bedrock Action Group envelope
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4_

- [x] 5. Create OpenAPI schema for Bedrock Agent registration
  - [x] 5.1 Create `lambda/maxwell-expenses/openapi.json`
    - Define `/searchFinancialRecords` POST endpoint with all parameters: `query` (required), `created_by_name`, `payment_method` (enum: Cash/SCash/GCash/Wise), `start_date`, `end_date`, `sort_by` (enum: amount_desc/amount_asc/date_desc/date_asc), `limit` (default 20)
    - Define response schema with `results` array, `total_count`, `message`, `instructions`
    - Follow the same OpenAPI 3.0 structure as existing action group schemas
    - _Requirements: 5.1_

- [x] 6. Checkpoint - Verify Lambda implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Deploy and configure
  - [x] 7.1 Deploy maxwell-expenses Lambda with layer
    - Run `./scripts/deploy/deploy-lambda-with-layer.sh maxwell-expenses cwf-maxwell-expenses` to deploy the Lambda with the `cwf-common-nodejs` layer
    - Configure environment variables: `DB_PASSWORD`, `BEDROCK_REGION`
    - _Requirements: 5.4_

  - [x] 7.2 Add Bedrock Agent resource policy and action group
    - Add resource-based policy allowing the Bedrock Agent to invoke `cwf-maxwell-expenses`
    - Register the `maxwell-expenses` action group with the Bedrock Agent using the OpenAPI schema
    - _Requirements: 5.2, 5.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Lambda follows the exact same pattern as `maxwell-storage-advisor`: `parseActionGroupParams`, `buildActionGroupResponse`, `queryJSON`, local `shared/embeddings.js` copy
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations
- Checkpoints ensure incremental validation
- Deploy task (7) is manual — requires AWS CLI commands run by the user
