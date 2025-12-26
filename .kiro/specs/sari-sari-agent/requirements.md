# Requirements Document

## Introduction

A self-serve sari sari store interface that enables customers to interact with an AI agent through voice or text to browse products, get information, and complete purchases. The system integrates with existing farm inventory tracking and includes sensor-based customer detection with multilingual support.

## Glossary

- **Sari_Sari_System**: The complete self-serve store interface including agent, sensors, and payment processing
- **Agent_Core**: The AI conversational component that handles customer interactions and product queries
- **Bedrock_Agent**: AWS managed AI agent service that orchestrates conversations and tool usage using Claude models
- **pgvector_Search_Tool**: Lambda-based tool that performs semantic search using PostgreSQL with pgvector extension
- **Inventory_Service**: The existing farm produce tracking system that manages stock and product information
- **Sensor_Module**: Future hardware component for detecting customer presence (not implemented in initial version)
- **Price_Calculator**: Component that computes product pricing based on quantity, promotions, and inventory data
- **Voice_Interface**: Speech-to-text and text-to-speech capabilities for verbal customer interactions
- **Language_Service**: Multilingual translation and localization component
- **Semantic_Search_Service**: Vector-based search system that understands product descriptions and customer queries semantically rather than through exact text matching
- **BedrockExecutionRole**: IAM role that allows Bedrock Agent to invoke Lambda functions and access required AWS services
- **CDK_Infrastructure**: AWS Cloud Development Kit templates for deploying Lambda functions, IAM roles, and database resources

## Requirements

### Requirement 1

**User Story:** As a customer, I want to interact with the store agent using text, so that I can browse and purchase products without needing staff assistance.

#### Acceptance Criteria

1. WHEN a customer types a message THEN the Agent_Core SHALL process the text input and provide appropriate responses
2. WHEN the Agent_Core responds THEN the system SHALL display text responses to the customer
3. WHEN a conversation is initiated THEN the Agent_Core SHALL greet the customer with a welcome message
4. WHERE voice capabilities are implemented THEN the system SHALL support speech-to-text input processing
5. WHERE voice capabilities are implemented THEN the system SHALL provide text-to-speech output alongside text display

### Requirement 2

**User Story:** As a customer, I want to ask about available products using natural language, so that I can find items even when I don't know exact product names.

#### Acceptance Criteria

1. WHEN a customer uses descriptive language about products THEN the Agent_Core SHALL use semantic search to find relevant items based on meaning rather than exact text matches
2. WHEN a customer asks about product characteristics THEN the Agent_Core SHALL filter semantic search results using intelligent agent reasoning to return contextually appropriate items
3. WHEN a customer requests product details THEN the Agent_Core SHALL provide description, origin, freshness, and nutritional information
4. WHEN a customer asks about pricing THEN the Price_Calculator SHALL compute and display current prices including any applicable discounts
5. WHEN inventory levels are low THEN the Agent_Core SHALL inform customers of limited availability
6. WHEN a product is out of stock THEN the Agent_Core SHALL suggest similar available alternatives using semantic similarity

### Requirement 3

**User Story:** As a customer, I want to easily access the store interface, so that I can begin shopping immediately when I visit.

#### Acceptance Criteria

1. WHEN a customer accesses the store interface THEN the Agent_Core SHALL display a welcome message and enable text interaction
2. WHEN the interface is idle for 10 minutes THEN the system SHALL display a screensaver while remaining responsive
3. WHEN multiple customers use the system THEN the system SHALL handle sequential interactions appropriately
4. WHERE sensor capabilities are implemented THEN the system SHALL support automatic presence detection and activation
5. WHEN a customer interaction begins THEN the system SHALL log the session timestamp for analytics
6. WHEN a semantic search is performed THEN the system SHALL log the extracted product search term and search results for analytics and improvement

### Requirement 4

**User Story:** As a customer, I want to interact with the agent in English initially, with the system designed to support multiple languages in the future.

#### Acceptance Criteria

1. WHEN a customer interacts with the system THEN the Agent_Core SHALL respond in English by default
2. WHERE multilingual capabilities are implemented THEN the Language_Service SHALL detect customer language and respond appropriately
3. WHERE multilingual capabilities are implemented THEN customers SHALL be able to specify their preferred language
4. WHERE multilingual capabilities are implemented THEN the Agent_Core SHALL adapt to language changes seamlessly during conversation
5. WHERE multilingual capabilities are implemented THEN product information SHALL display in the customer's selected language

### Requirement 5

**User Story:** As a farm owner, I want the system to integrate with my existing inventory tracking, so that product information and stock levels remain synchronized.

#### Acceptance Criteria

1. WHEN inventory levels change in the farm system THEN the Sari_Sari_System SHALL update product availability in real-time
2. WHEN a customer purchases items THEN the system SHALL update inventory counts in the Inventory_Service immediately
3. WHEN new products are added to farm inventory THEN the Agent_Core SHALL include them in available product listings
4. WHEN product details are modified THEN the system SHALL reflect changes in customer-facing information
5. WHEN inventory synchronization fails THEN the system SHALL log errors and alert farm management

### Requirement 6

**User Story:** As a farm owner, I want the system to calculate accurate pricing automatically, so that customers receive consistent and fair pricing without manual intervention.

#### Acceptance Criteria

1. WHEN a customer inquires about pricing THEN the Price_Calculator SHALL compute costs based on current market rates and farm pricing rules
2. WHEN quantity discounts apply THEN the system SHALL automatically calculate and display bulk pricing options
3. WHEN seasonal promotions are active THEN the Price_Calculator SHALL apply appropriate discounts to eligible products
4. WHEN pricing rules change THEN the system SHALL update calculations immediately for new customer interactions
5. WHEN payment is processed THEN the system SHALL generate accurate receipts with itemized pricing

### Requirement 7

**User Story:** As a farm owner, I want to operate the system within a $50/month budget, so that the solution remains economically viable for my small business.

#### Acceptance Criteria

1. WHEN the system is deployed THEN the total monthly operational costs SHALL not exceed $50 including cloud services, AI processing, and data storage
2. WHEN usage scales with customer volume THEN the cost structure SHALL remain predictable and within budget constraints
3. WHEN selecting cloud services THEN the system SHALL prioritize cost-effective solutions that meet performance requirements
4. WHEN monitoring resource usage THEN the system SHALL provide alerts if costs approach budget limits
5. WHEN optimizing for cost THEN the system SHALL use efficient algorithms and caching to minimize computational expenses

### Requirement 8

**User Story:** As a customer, I want to search for products using natural descriptions like "something hot" or "spicy items", so that I can find products based on characteristics rather than exact names.

#### Acceptance Criteria

1. WHEN a customer asks a question THEN the Agent_Core SHALL identify and extract the product description from the natural language query
2. WHEN a product description is identified THEN the system SHALL log the extracted search term used for semantic search
3. WHEN the extracted search term is processed THEN the Semantic_Search_Service SHALL convert it into vector embeddings and search product descriptions semantically
4. WHEN semantic search returns results THEN the Agent_Core SHALL select the most relevant items and form an appropriate response
5. WHEN a customer asks for "hot" items THEN the system SHALL return products like "Long neck vinegar spice" and "Spiced vinegar lipid" based on semantic understanding

### Requirement 10

**User Story:** As a customer, I want to express what I don't want using natural language like "I don't like spicy" or "no hot items", so that the system excludes those products from my search results.

#### Acceptance Criteria

1. WHEN a customer uses negation phrases like "don't like", "no", "not", "avoid", or "without" THEN the Agent_Core SHALL identify and extract the negated terms from the query
2. WHEN negated terms are identified THEN the system SHALL log both the positive search intent and the negation filters for analytics
3. WHEN performing semantic search with negations THEN the Semantic_Search_Service SHALL filter out products that semantically match the negated characteristics
4. WHEN a customer says "I don't like spicy" THEN the system SHALL exclude products containing chili, hot sauce, spiced items, and other semantically similar spicy products
5. WHEN negation filtering is applied THEN the Agent_Core SHALL explain to the customer that spicy items have been excluded from the results

### Requirement 11

**User Story:** As a customer, I want to only see products that are available for purchase, so that I don't waste time looking at items that aren't for sale.

#### Acceptance Criteria

1. WHEN performing any product search THEN the Semantic_Search_Service SHALL only return products where the sellable field is true
2. WHEN a customer browses products THEN the Agent_Core SHALL filter all results to exclude non-sellable items before displaying them
3. WHEN semantic search queries the database THEN the system SHALL include sellable=true as a mandatory filter condition
4. WHEN non-sellable products exist in the database THEN they SHALL never appear in customer-facing search results or product listings
5. WHEN debugging search issues THEN the system SHALL log whether sellability filtering was applied and how many products were excluded

### Requirement 9

**User Story:** As a farm owner, I want the system to be extensible for future enhancements, so that I can add new capabilities as my business grows.

#### Acceptance Criteria

1. WHEN new features are developed THEN the Agent_Core SHALL support plugin-based extensions without core system modifications
2. WHEN integrating additional sensors THEN the Sensor_Module SHALL accommodate new hardware through standardized interfaces
3. WHEN adding payment methods THEN the system SHALL support multiple payment processors through modular integration
4. WHEN expanding to multiple locations THEN the architecture SHALL support distributed deployment with centralized management
5. WHEN third-party services are integrated THEN the system SHALL maintain loose coupling through well-defined APIs

### Requirement 12

**User Story:** As a farm owner, I want to deploy the system using AWS Bedrock Agent service with a conversational personality, so that customers have engaging dialogs with product suggestions rather than just filtered search results.

#### Acceptance Criteria

1. WHEN the system is deployed THEN the Bedrock_Agent SHALL be configured with Claude 3 Haiku model and a friendly sari-sari store personality
2. WHEN customers interact with the system THEN the Bedrock_Agent SHALL engage in natural dialog and provide 2-3 personalized product suggestions based on customer queries
3. WHEN the agent needs to search products THEN the pgvector_Search_Tool SHALL execute semantic searches and the agent SHALL format results as conversational recommendations with reasons
4. WHEN customers ask vague questions like "something hot" THEN the agent SHALL ask clarifying questions and suggest specific products with descriptions and benefits
5. WHEN Lambda functions are deployed THEN they SHALL have appropriate IAM roles including BedrockExecutionRole and LambdaBasicExecution permissions
6. WHEN the agent is configured THEN it SHALL include detailed personality instructions for engaging conversations, product storytelling, and cultural context
7. WHEN testing the deployment THEN queries like "Noodles under 30 pesos" SHALL return conversational responses with 2-3 specific product suggestions and reasons for each recommendation

### Requirement 13

**User Story:** As a developer, I want to deploy the Bedrock Agent system quickly and reliably, so that I can get the sari-sari store operational within 15 minutes.

#### Acceptance Criteria

1. WHEN deploying infrastructure THEN CDK SHALL deploy Lambda functions and IAM roles in under 5 minutes
2. WHEN creating the agent THEN the AWS Console SHALL allow agent creation, Lambda tool attachment, and personality configuration in under 5 minutes
3. WHEN testing functionality THEN queries like "Noodles under 30 pesos" SHALL return conversational responses with 2-3 specific product suggestions in under 2 minutes
4. WHEN integrating with frontend THEN Amplify SHALL successfully call the Bedrock API and display agent responses in under 3 minutes
5. WHEN the deployment is complete THEN the entire system SHALL be functional and ready for customer interactions within 15 minutes total

### Requirement 14

**User Story:** As a customer, I want to have engaging conversations with the sari-sari agent that feels personal and helpful, so that I enjoy the shopping experience and discover products I might not have found otherwise.

#### Acceptance Criteria

1. WHEN I ask about products THEN the agent SHALL respond conversationally with personality, not just list search results
2. WHEN I make vague requests like "something for cooking" THEN the agent SHALL ask follow-up questions to understand my needs better
3. WHEN the agent suggests products THEN it SHALL provide 2-3 specific recommendations with reasons why each product suits my request
4. WHEN I ask about price ranges THEN the agent SHALL suggest products within my budget and explain the value proposition of each
5. WHEN products are unavailable THEN the agent SHALL conversationally suggest alternatives and explain why they're good substitutes
6. WHEN I negotiate prices THEN the agent SHALL engage in friendly bargaining with personality while respecting business rules
7. WHEN I seem unsure THEN the agent SHALL offer to tell me more about products, their uses, or suggest complementary items