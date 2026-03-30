# Requirements Document

## Introduction

Migrate the sari-sari store chat backend from the custom SearchPipeline Lambda (which uses fragile regex-based JSON extraction from LLM responses) to an AWS Bedrock Agent with an action group Lambda. This follows the same proven pattern used by the Maxwell agent (`maxwell-chat/index.js` + `maxwell-storage-advisor/index.js`). The existing frontend (`SariSariChat.tsx`) remains unchanged — the new chat Lambda must return the exact same response shape so the migration is invisible to the UI.

## Glossary

- **Sari_Sari_Agent**: The new AWS Bedrock Agent configured as a friendly store assistant for the Stargazer Farm sari-sari store
- **Sari_Sari_Chat_Lambda**: The replacement for the current `sari-sari-chat` Lambda; a thin proxy that receives frontend HTTP requests, invokes the Sari_Sari_Agent via `InvokeAgentCommand`, and returns the response in the existing format expected by the frontend
- **Product_Search_Lambda**: An action group Lambda that the Sari_Sari_Agent invokes to search sellable parts using embedding similarity against the `unified_embeddings` table, following the same pattern as `maxwell-storage-advisor/index.js`
- **Action_Group**: A Bedrock Agent action group that defines a tool (API) the agent can invoke natively, with structured input/output — eliminating manual JSON parsing
- **Unified_Embeddings**: The `unified_embeddings` PostgreSQL table storing embedding vectors for cross-entity semantic search
- **Product**: A sellable part in the inventory (`parts` table where `sellable = true`) with fields: id, name, description, policy, cost_per_unit, unit, current_quantity, image_url
- **Frontend_Response_Shape**: The JSON structure the existing frontend expects from `POST /api/sari-sari/chat`: `{ response, products, conversationHistory, sessionId }`

## Requirements

### Requirement 1: Bedrock Agent Configuration

**User Story:** As a system administrator, I want a dedicated Bedrock Agent for the sari-sari store, so that the store assistant has its own persona and system instructions separate from Maxwell.

#### Acceptance Criteria

1. THE Sari_Sari_Agent SHALL be configured as a separate AWS Bedrock Agent with a unique agent ID and alias ID distinct from the Maxwell agent
2. THE Sari_Sari_Agent SHALL use system instructions that define a friendly, helpful store assistant persona for Stargazer Farm
3. THE Sari_Sari_Agent SHALL maintain a conversational tone: brief, direct responses (1-2 sentences) with natural product recommendations
4. THE Sari_Sari_Agent SHALL have one Action_Group named "ProductSearch" that maps to the Product_Search_Lambda
5. THE Sari_Sari_Agent SHALL read its agent ID and alias ID from environment variables `SARI_SARI_AGENT_ID` and `SARI_SARI_AGENT_ALIAS_ID`

### Requirement 2: Product Search Action Group Lambda

**User Story:** As the sari-sari agent, I want to search sellable products by semantic similarity, so that I can find relevant products for customer queries.

#### Acceptance Criteria

1. WHEN the Sari_Sari_Agent invokes the ProductSearch action group with a search query, THE Product_Search_Lambda SHALL generate an embedding for the query using Titan Text Embeddings v1
2. WHEN the Product_Search_Lambda receives a search request, THE Product_Search_Lambda SHALL query the `unified_embeddings` table joined with the `parts` table, filtering to `sellable = true` parts within the caller's organization
3. THE Product_Search_Lambda SHALL return up to 10 products ordered by embedding cosine similarity, each containing: id, name, description, policy, price (cost_per_unit), unit, current_quantity, image_url, and similarity score
4. THE Product_Search_Lambda SHALL use `parseActionGroupParams` and `buildActionGroupResponse` helper functions following the same pattern as `maxwell-storage-advisor/index.js`
5. THE Product_Search_Lambda SHALL read `organization_id` from the Bedrock session attributes (forwarded by the Sari_Sari_Chat_Lambda)
6. IF the search query is empty or missing, THEN THE Product_Search_Lambda SHALL return a 400 error with a descriptive message
7. IF the organization_id is missing from session attributes, THEN THE Product_Search_Lambda SHALL return a 400 error with a descriptive message
8. WHEN the Product_Search_Lambda returns results, THE Product_Search_Lambda SHALL include instructions text guiding the agent to present products in a friendly conversational format with prices in Philippine Pesos (₱)

### Requirement 3: Chat Lambda with Backward-Compatible Response Format

**User Story:** As a developer, I want the new chat Lambda to return the exact same response shape as the current one, so that the existing frontend works without any changes.

#### Acceptance Criteria

1. THE Sari_Sari_Chat_Lambda SHALL accept POST requests at the existing `/api/sari-sari/chat` endpoint with a JSON body containing: `message` (required), `sessionId` (optional), and `conversationHistory` (optional array)
2. WHEN a valid message is received, THE Sari_Sari_Chat_Lambda SHALL invoke the Sari_Sari_Agent using `InvokeAgentCommand` from `@aws-sdk/client-bedrock-agent-runtime`
3. THE Sari_Sari_Chat_Lambda SHALL forward the caller's `organization_id` (from the Lambda authorizer context) as a session attribute to the Sari_Sari_Agent
4. THE Sari_Sari_Chat_Lambda SHALL return a JSON response containing exactly these fields: `response` (string — the agent's text reply), `products` (array), `conversationHistory` (array — updated history), and `sessionId` (string)
5. WHEN the Sari_Sari_Chat_Lambda returns products, each product object SHALL contain: `id`, `name`, `description`, `price`, `stock_level`, `in_stock` (boolean), `status_label`, `similarity_score`, `unit`, and `image_url` — matching the existing Frontend_Response_Shape
6. THE Sari_Sari_Chat_Lambda SHALL build the `conversationHistory` array by appending the current user message and assistant response to the incoming `conversationHistory`, keeping the last 6 messages (3 exchanges)
7. THE Sari_Sari_Chat_Lambda SHALL generate a session ID if one is not provided in the request
8. IF the message field is missing, THEN THE Sari_Sari_Chat_Lambda SHALL return a 400 status with an error message
9. IF the caller has no organization context, THEN THE Sari_Sari_Chat_Lambda SHALL return a 401 status with an error message
10. IF the agent ID or alias ID environment variables are not configured, THEN THE Sari_Sari_Chat_Lambda SHALL return a 500 status with an error message
11. IF a ThrottlingException occurs, THEN THE Sari_Sari_Chat_Lambda SHALL return a 429 status with a user-friendly message

### Requirement 4: Product Data Extraction from Agent Response

**User Story:** As a developer, I want the chat Lambda to reliably extract structured product data from the Bedrock Agent's response, so that the frontend receives product cards without fragile regex parsing.

#### Acceptance Criteria

1. THE Sari_Sari_Agent system instructions SHALL direct the agent to embed product data in its response using a defined delimiter pattern (e.g., `<!-- PRODUCTS [...] -->`) when presenting products
2. THE Sari_Sari_Chat_Lambda SHALL parse the agent's response text to extract the product JSON from the delimiter pattern
3. WHEN product data is extracted, THE Sari_Sari_Chat_Lambda SHALL transform each product into the Frontend_Response_Shape format: mapping `cost_per_unit` to `price`, `current_quantity` to `stock_level`, deriving `in_stock` from `current_quantity > 0`, and deriving `status_label` from stock level
4. WHEN the agent response contains no product delimiter, THE Sari_Sari_Chat_Lambda SHALL return an empty `products` array
5. THE Sari_Sari_Chat_Lambda SHALL strip the product delimiter block from the `response` text field so the frontend displays only the conversational reply

### Requirement 5: Elimination of Fragile JSON Parsing

**User Story:** As a developer, I want the new architecture to eliminate the fragile JSON parsing from LLM text responses in the search pipeline, so that the system is reliable.

#### Acceptance Criteria

1. THE Product_Search_Lambda SHALL return structured data to the Sari_Sari_Agent via the Bedrock Action Group response envelope (`buildActionGroupResponse`), not as free-form text requiring JSON extraction
2. THE Sari_Sari_Chat_Lambda SHALL NOT use regex-based JSON extraction from LLM-generated text for intent parsing — the current `text.match(/\{[\s\S]*\}/)` pattern used in `sari-sari-chat/index.js` SHALL be eliminated
3. THE Sari_Sari_Agent SHALL receive product search results as structured tool call responses, replacing the current five-step SearchPipeline (QueryRewriter → FilterMapper → HybridRetriever → ResultFormatter → ResponseGenerator) with a single Bedrock Agent tool invocation
