# Implementation Plan: Sari-Sari Agent Migration

## Overview

Migrate the sari-sari store chat from the custom 5-step SearchPipeline Lambda to an AWS Bedrock Agent architecture following the Maxwell pattern. Two Lambdas: a new product search action group Lambda (`sari-sari-product-search/`) and a replacement chat Lambda deployed as the existing `cwf-sari-sari-chat` function (so API Gateway + frontend need zero changes). The product search Lambda is a new function that needs Bedrock Agent action group wiring.

## Tasks

- [x] 1. Create the Product Search Action Group Lambda
  - [x] 1.1 Scaffold `lambda/sari-sari-product-search/` directory with `index.js`, `package.json`, and `shared/embeddings.js`
    - Copy `shared/embeddings.js` from `lambda/maxwell-storage-advisor/shared/embeddings.js`
    - `package.json` dependencies: `@aws-sdk/client-bedrock-runtime`, `pg` (matching maxwell-storage-advisor)
    - _Requirements: 2.1, 2.4_

  - [x] 1.2 Implement `parseActionGroupParams` and `buildActionGroupResponse` helpers in `index.js`
    - Follow the exact pattern from `maxwell-storage-advisor/index.js`
    - _Requirements: 2.4, 5.1_

  - [x] 1.3 Implement the `handler` function for product search
    - Extract `query` from action group parameters via `parseActionGroupParams`
    - Extract `organization_id` from `event.sessionAttributes`
    - Validate: return 400 if query is empty/missing, return 400 if organization_id is missing
    - Generate embedding via `generateEmbeddingV1(query)`
    - Execute SQL: `unified_embeddings` JOIN `parts` WHERE `sellable = true` AND org-scoped, ORDER BY cosine similarity DESC, LIMIT 10
    - Return each product with: id, name, description, policy, cost_per_unit (as price), unit, current_quantity, image_url, similarity score
    - Include `instructions` text guiding the agent to present products in Philippine Pesos (₱) conversational format
    - Return via `buildActionGroupResponse` with 200 status
    - Handle embedding failure (500) and database errors (500)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 5.1_

  - [ ]* 1.4 Write property test: Empty query rejection (Property 3)
    - Generate arbitrary whitespace-only strings (including empty string, null, undefined) using `fast-check`
    - Verify the Lambda returns a 400 response envelope and does not execute a database query
    - **Property 3: Empty query rejection**
    - **Validates: Requirements 2.6**

- [x] 2. Create the Sari-Sari Agent Chat Lambda
  - [x] 2.1 Scaffold `lambda/sari-sari-agent-chat/` directory with `index.js` and `package.json`
    - `package.json` dependency: `@aws-sdk/client-bedrock-agent-runtime` (matching maxwell-chat)
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Implement request validation and auth context extraction
    - Parse `message`, `sessionId`, `conversationHistory` from request body
    - Extract `organization_id` from Lambda authorizer context via `/opt/nodejs/authorizerContext`
    - Return 400 if `message` missing, 401 if no `organization_id`, 500 if agent env vars not set
    - Generate session ID if not provided: `sari-sari-session-{timestamp}-{random}`
    - _Requirements: 3.1, 3.7, 3.8, 3.9, 3.10_

  - [x] 2.3 Implement Bedrock Agent invocation via `InvokeAgentCommand`
    - Read `SARI_SARI_AGENT_ID` and `SARI_SARI_AGENT_ALIAS_ID` from env vars
    - Forward `organization_id` as session attribute (stringified)
    - Collect streamed response chunks into a single string
    - Handle `ThrottlingException` → 429, `ServiceQuotaExceededException`/504 → 504, catch-all → 500
    - Include CORS headers on all responses matching the Maxwell pattern
    - _Requirements: 1.5, 3.2, 3.3, 3.11_

  - [x] 2.4 Implement `extractProducts` function for delimiter-based product extraction
    - Parse `<!-- PRODUCTS [...] -->` delimiter from agent response text
    - Extract product JSON array from inside the delimiter
    - Strip the delimiter block from the response text
    - Return `{ text, products }` — graceful degradation: if no delimiter or parse failure, return original text + empty array
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.2_

  - [x] 2.5 Implement `transformProduct` function for frontend shape mapping
    - Map `cost_per_unit` → `price` (parseFloat), `current_quantity` → `stock_level`
    - Derive `in_stock` from `current_quantity > 0`, `status_label` from stock level
    - Ensure all 10 frontend fields present: id, name, description, price, stock_level, in_stock, status_label, similarity_score, unit, image_url
    - _Requirements: 3.5, 4.3_

  - [x] 2.6 Implement `buildConversationHistory` function
    - Append current user message and assistant response to incoming history
    - Cap at 6 messages (last 3 exchanges)
    - _Requirements: 3.6_

  - [x] 2.7 Wire the handler: validate → invoke agent → extract products → transform → build history → return response
    - Return `{ response, products, conversationHistory, sessionId }` matching the existing frontend shape exactly
    - _Requirements: 3.4, 5.3_

  - [ ]* 2.8 Write property test: Product field transformation correctness (Property 5)
    - Generate random product objects with arbitrary `cost_per_unit` (non-negative numbers) and `current_quantity` (non-negative integers) using `fast-check`
    - Verify `price === parseFloat(cost_per_unit)`, `stock_level === current_quantity`, `in_stock === (current_quantity > 0)`, `status_label` correctness, and all 10 fields present
    - **Property 5: Product field transformation correctness**
    - **Validates: Requirements 3.5, 4.3**

  - [ ]* 2.9 Write property test: Conversation history append and cap (Property 6)
    - Generate random conversation history arrays (0-20 messages) and a new message pair using `fast-check`
    - Verify output ends with the new pair and length ≤ 6
    - **Property 6: Conversation history append and cap**
    - **Validates: Requirements 3.6**

  - [ ]* 2.10 Write property test: Product delimiter extraction and stripping (Property 7)
    - Generate random text strings and random product arrays, embed them in `<!-- PRODUCTS [...] -->` format
    - Verify extracted text is clean (no delimiter) and products match parsed JSON
    - Also generate strings without delimiters and verify empty products returned
    - **Property 7: Product delimiter extraction and stripping**
    - **Validates: Requirements 4.2, 4.4, 4.5**

- [x] 3. Checkpoint — Both Lambdas code-complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Deploy the Product Search Lambda and create the Bedrock Agent
  - [x] 4.1 Deploy the product search Lambda as a new function `cwf-sari-sari-product-search`
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh sari-sari-product-search cwf-sari-sari-product-search`
    - Verify the function is created with the common layer attached
    - _Requirements: 2.1, 2.4_

  - [x] 4.2 Add a resource-based policy to allow Bedrock to invoke the product search Lambda
    - Use `aws lambda add-permission` with principal `bedrock.amazonaws.com`
    - _Requirements: 1.4_

  - [x] 4.3 Create the Sari-Sari Bedrock Agent via AWS CLI
    - Use `aws bedrock-agent create-agent` with the system instructions from the design document (friendly store assistant persona, bilingual, 1-2 sentence responses, `<!-- PRODUCTS [...] -->` delimiter format)
    - Set foundation model to `anthropic.claude-3-5-haiku-20241022-v1:0`
    - _Requirements: 1.1, 1.2, 1.3, 4.1_

  - [x] 4.4 Create the ProductSearch action group on the agent
    - Use `aws bedrock-agent create-agent-action-group` with an inline API schema defining the `/searchProducts` POST endpoint with `query` string parameter
    - Point the action group executor at the `cwf-sari-sari-product-search` Lambda ARN
    - _Requirements: 1.4, 5.1_

  - [x] 4.5 Prepare and create an agent alias
    - Use `aws bedrock-agent prepare-agent` then `aws bedrock-agent create-agent-alias`
    - Record the agent ID and alias ID for environment variable configuration
    - _Requirements: 1.1, 1.5_

- [x] 5. Deploy the Chat Lambda as the existing `cwf-sari-sari-chat` function
  - [x] 5.1 Update `deploy-lambda-with-layer.sh` to support `SARI_SARI_AGENT_ID` and `SARI_SARI_AGENT_ALIAS_ID` env vars
    - Add the two new env var lines to the ENV_VARS block in the deploy script (both the update and create branches)
    - _Requirements: 1.5_

  - [x] 5.2 Deploy the new chat Lambda code as `cwf-sari-sari-chat`
    - Run: `./scripts/deploy/deploy-lambda-with-layer.sh sari-sari-agent-chat cwf-sari-sari-chat`
    - This replaces the old SearchPipeline code with the new Bedrock Agent proxy — the API Gateway route `/api/sari-sari/chat` stays the same, frontend needs zero changes
    - Verify the function is updated and the agent env vars are set
    - _Requirements: 3.1, 3.4, 5.3_

- [x] 6. Checkpoint — End-to-end validation
  - Verify the product search Lambda responds correctly when invoked directly with a test event
  - Verify the Bedrock Agent can invoke the ProductSearch action group and return results
  - Verify the chat Lambda returns the correct `{ response, products, conversationHistory, sessionId }` shape via the existing API Gateway endpoint
  - Verify the frontend (`SariSariChat.tsx`) works without any changes — product cards render, conversation history persists
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The simplest migration path: deploy new chat Lambda code AS the existing `cwf-sari-sari-chat` function name, so API Gateway + frontend need zero changes
- The product search Lambda is a new function (`cwf-sari-sari-product-search`) that needs Bedrock Agent action group wiring
- Property tests use `fast-check` and validate universal correctness properties from the design document
- All code is JavaScript/Node.js following the Maxwell pattern exactly
