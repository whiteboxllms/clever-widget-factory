# Implementation Plan: Maxwell Unified Search

## Overview

Replace the `SearchFinancialRecords` and `SuggestStorageLocation` action groups with a single `UnifiedSearch` action group that searches across all 9 entity types in the `unified_embeddings` table. The new `cwf-maxwell-unified-search` Lambda follows the exact pattern of `maxwell-expenses` (parseActionGroupParams, buildActionGroupResponse, sessionAttributes org extraction, shared/embeddings.js). After deployment, the old action groups are removed and the system prompt is updated.

## Tasks

- [x] 1. Scaffold maxwell-unified-search Lambda directory
  - [x] 1.1 Create `lambda/maxwell-unified-search/package.json` and shared module
    - Create `lambda/maxwell-unified-search/package.json` with name `maxwell-unified-search`, same dependencies as `maxwell-expenses` (`@aws-sdk/client-bedrock-runtime`, `pg`)
    - Copy `lambda/maxwell-expenses/shared/embeddings.js` to `lambda/maxwell-unified-search/shared/embeddings.js` (identical local copy)
    - Run `npm install` in the new directory
    - _Requirements: 5.5_

- [x] 2. Implement maxwell-unified-search Lambda handler
  - [x] 2.1 Implement `lambda/maxwell-unified-search/index.js` core handler
    - Import `getDbClient` from `/opt/nodejs/db`, `escapeLiteral` from `/opt/nodejs/sqlUtils`, `generateEmbeddingV1` from `./shared/embeddings`
    - Implement `parseActionGroupParams(event)` and `buildActionGroupResponse(actionGroup, apiPath, httpMethod, statusCode, body)` — identical to `maxwell-expenses`
    - Define `VALID_ENTITY_TYPES` array: `['part', 'tool', 'action', 'issue', 'policy', 'financial_record', 'state', 'action_existing_state', 'state_space_model']`
    - Implement `exports.handler`:
      1. Extract `actionGroup` (default `UnifiedSearch`), `apiPath` (default `/unifiedSearch`), `httpMethod` (default `POST`)
      2. Extract `organization_id` from `event.sessionAttributes`
      3. Parse parameters: `query` (required), `entity_types` (optional, comma-separated), `per_type_limit` (optional, default 3)
      4. Validate: return 400 if `query` missing/empty or `organization_id` missing
      5. Parse `entity_types` — split by comma, trim, filter to only `VALID_ENTITY_TYPES` members; if empty after filtering or omitted, use all types
      6. Generate embedding via `generateEmbeddingV1(query)`
      7. Build UNION ALL SQL: one subquery per active entity type with per-type JOIN and `LIMIT per_type_limit`, wrapped in outer `ORDER BY similarity DESC`
      8. Execute query, format results with `details` object per type
      9. Compute `result_counts` by counting results per entity type
      10. Build `instructions` string with entity type presentation guidance, financial record conventions (₱, amount sign, referenced_records tag)
      11. Return `{ results, result_counts, message, instructions }` via `buildActionGroupResponse`
    - Per-type subquery JOINs as specified in design:
      - `part` → `parts` (name, description, category, storage_location, current_quantity, unit, cost_per_unit, sellable)
      - `tool` → `tools` (name, description, category, storage_location, status)
      - `action` → `actions` (title, description, status, created_at, completed_at)
      - `issue` → `issues` (description, issue_type, status, resolution_notes)
      - `policy` → `policy` (title, description_text, status, effective_from)
      - `financial_record` → `financial_records` + `state_links` + `states` + `organization_members` (description from state_text, amount, transaction_date, payment_method, created_by_name)
      - `state`, `action_existing_state`, `state_space_model` → no source table JOIN, use `embedding_source` as description
    - Error handling: catch embedding failures (500), DB failures (500), same pattern as `maxwell-expenses`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 2.2 Write property test for response completeness (Property 1)
    - **Property 1: Response completeness**
    - Generate random valid query strings and mock database results with random entity types and type-specific detail fields
    - Call the result formatting logic with the generated data
    - Assert every result object has all required fields: `entity_type`, `entity_id`, `embedding_source`, `similarity`, `details`
    - Assert the response includes non-empty `instructions` and `message` strings
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.5, 8.1**

  - [ ]* 2.3 Write property test for similarity ordering (Property 2)
    - **Property 2: Similarity ordering**
    - Generate random arrays of result objects with random similarity scores (0-1)
    - Apply the sorting logic used by the Lambda
    - Assert the output array has similarity scores in non-increasing order (each >= next)
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.4, 2.3**

  - [ ]* 2.4 Write property test for per-type diversity quota (Property 3)
    - **Property 3: Per-type diversity quota**
    - Generate random `per_type_limit` values (1-10) and random result sets with varying entity types from `VALID_ENTITY_TYPES`
    - Apply the per-type limiting logic
    - Assert no entity type has more results than `per_type_limit`
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.2**

  - [ ]* 2.5 Write property test for result counts consistency (Property 4)
    - **Property 4: Result counts consistency**
    - Generate random result arrays with random entity types from `VALID_ENTITY_TYPES`
    - Compute `result_counts` using the Lambda's logic
    - Assert `result_counts[t]` equals the actual count of results with `entity_type == t` for every type
    - Assert every entity type present in results has a corresponding key in `result_counts`
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.4**

  - [ ]* 2.6 Write property test for entity type filtering (Property 5)
    - **Property 5: Entity type filtering**
    - Generate random comma-separated strings mixing valid entity types with random invalid strings
    - Parse using the Lambda's entity type parsing logic
    - Assert all parsed types are members of `VALID_ENTITY_TYPES`
    - Assert no invalid types survive parsing
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 2.7 Write property test for organization scoping (Property 6)
    - **Property 6: Organization scoping**
    - Generate random organization IDs and entity type filters
    - Call the SQL-building logic
    - Assert every per-type subquery in the generated SQL contains the `organization_id` filter
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.3**

  - [ ]* 2.8 Write unit tests for maxwell-unified-search handler
    - Test missing `query` → 400 response with `{ error: 'Missing required parameter: query' }`
    - Test empty/whitespace `query` → 400 response
    - Test missing `organization_id` → 400 response with `{ error: 'Missing organization context in session attributes' }`
    - Test embedding generation failure → 500 response
    - Test database query failure → 500 response
    - Test `entity_types` parsing: valid types only, mixed valid/invalid, all invalid defaults to all types
    - Test `per_type_limit` defaults to 3 when omitted
    - Test response format matches Bedrock Action Group envelope (`messageVersion`, `response.actionGroup`, etc.)
    - Test per-type detail fields contain correct keys for each entity type
    - Test instructions include financial record conventions when results present
    - Test instructions suggest different search terms when no results found
    - _Requirements: 1.1, 1.5, 2.1, 2.4, 3.2, 3.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.3, 8.5_

- [x] 3. Create OpenAPI schema for Bedrock Agent registration
  - [x] 3.1 Create `lambda/maxwell-unified-search/openapi.json`
    - Define `/unifiedSearch` POST endpoint with parameters: `query` (required, string), `entity_types` (optional, string — comma-separated), `per_type_limit` (optional, integer, default 3)
    - Set `operationId` to `unifiedSearch`
    - Set description to instruct the agent to use this as the PRIMARY search tool for any question requiring organizational data
    - Define response schema with `results` array (entity_type, entity_id, embedding_source, similarity, details), `result_counts` object, `message`, `instructions`
    - Follow the same OpenAPI 3.0 structure as `lambda/maxwell-expenses/openapi.json`
    - _Requirements: 5.1, 5.2_

- [x] 4. Checkpoint - Verify Lambda implementation and OpenAPI schema
  - Ensure all tests pass, ask the user if questions arise.

> **⏸ PAUSE HERE** — Tasks 1–4 are safe to run. They only create new files and tests — nothing touches the existing Maxwell agent or its action groups. After verifying everything works locally, proceed to task 5 to deploy and cut over. Task 5 modifies the live Bedrock Agent (adds new action group, removes old ones, updates system prompt). Run 5.2–5.4 first to deploy the new Lambda alongside existing tools for testing, then 5.1/5.5/5.6 together as the final cutover.

- [x] 5. Update system prompt and deploy
  - [x] 5.1 Update `lambda/maxwell-chat/maxwell-instruction.txt`
    - Rewrote system prompt for Sonnet 4.6 with eudaimonia framing, multi-search strategy, data model context, and data transparency
    - Updated `maxwell-tone.txt` and `maxwell-general.txt` for Sonnet-class behavior
    - _Requirements: 6.3_

  - [x] 5.2 Deploy maxwell-unified-search Lambda
    - Deployed via `./scripts/deploy/deploy-lambda-with-layer.sh maxwell-unified-search cwf-maxwell-unified-search`
    - Lambda created with `cwf-common-nodejs` layer (v14), env vars, 30s timeout, 512 MB memory
    - Fixed policy subquery (policy table has no organization_id column — org scoping via unified_embeddings only)
    - Redeployed with fix
    - _Requirements: 5.5_

  - [x] 5.3 Add Lambda resource policy for Bedrock Agent invocation
    - Added `AllowBedrockAgent` permission for `bedrock.amazonaws.com` with source ARN `arn:aws:bedrock:us-west-2:131745734428:agent/*`
    - _Requirements: 5.4_

  - [x] 5.4 Configure Bedrock Agent: add UnifiedSearch action group
    - Registered `UnifiedSearch` action group (ID: `4QWKVYQFRA`) with OpenAPI schema pointing to `cwf-maxwell-unified-search` Lambda
    - Agent ID: `CNV04Q1OAZ`, Region: `us-west-2`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 5.5 Configure Bedrock Agent: remove old action groups
    - **Not yet done** — `SearchFinancialRecords` (YBLY7M4HJU) and `SuggestStorageLocation` (ZNUBEKL8LN) still present alongside UnifiedSearch
    - Can be removed once UnifiedSearch is fully validated
    - _Requirements: 6.1, 6.2_

  - [x] 5.6 Update agent instruction and prepare new version
    - Updated agent to Sonnet 4.6 (`us.anthropic.claude-sonnet-4-6` inference profile)
    - Updated IAM role with Marketplace subscription permissions and broad Bedrock model/inference profile access
    - Prepared agent and deployed via alias update (auto-versioned to v16)
    - _Requirements: 6.3_

- [ ] 6. Final checkpoint - Verify end-to-end
  - System prompt rewrite for Sonnet 4.6 pending deployment (maxwell-instruction.txt + tone/mode prompts updated locally, need Lambda redeploy + agent update)
  - Old action groups pending removal (task 5.5)
  - Maxwell button added to dashboard (GlobalMaxwellFAB + Dashboard header)
  - Bedrock Agent skill created at `.kiro/skills/update-bedrock-agent.md`
  - TODO note for policy table org_id at `docs/TODO-POLICY-ORG-ID.md`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Lambda follows the exact pattern of `maxwell-expenses`: `parseActionGroupParams`, `buildActionGroupResponse`, `sessionAttributes` org extraction, local `shared/embeddings.js` copy
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations via `npm run test:run` (Vitest)
- Deploy tasks (5.2–5.6) are manual — require AWS CLI commands run by the user
- Checkpoints ensure incremental validation
- The UNION ALL approach with per-type LIMIT ensures diversity without letting one entity type dominate results
