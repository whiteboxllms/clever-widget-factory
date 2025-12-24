# Implementation Plan

- [x] 1. Set up project structure and database safety procedures
  - Create directory structure for agent, inventory, pricing, and personality components
  - Define TypeScript interfaces for all core services and data models
  - Set up testing framework with Vitest and fast-check
  - Configure build and deployment pipeline
  - **ESTABLISH**: Create database backup and rollback procedures
  - **DOCUMENT**: Database change approval workflow and safety checklist
  - _Requirements: 8.1, 8.3, 8.5_

- [ ] 2. Implement core data models and database schema
  - [x] 2.1 Create enhanced Product model with sellability field
    - Add sellable boolean field to Product interface
    - Implement validation for sellable field
    - _Requirements: 5.3, 5.4_

  - [x] 2.2 Add semantic search fields to Product model
    - Add embedding_text field for enhanced product descriptions
    - Add embedding_vector field for vector storage
    - Create ProductSearchTerm and SemanticSearchResult interfaces
    - _Requirements: 8.1, 8.3_

  - [ ]* 2.3 Write property test for product model validation
    - **Property 24: Sellability filtering**
    - **Validates: Requirements Enhanced inventory**

  - [x] 2.4 Create RDS database migration for MVP agent features
    - **BACKUP FIRST**: Create logical backup of products table structure and data
    - Add sellable boolean column to existing products table (with DEFAULT true for safety)
    - Create new tables for Sessions, Customers, Transactions
    - Set up database indexes for efficient querying
    - **VERIFY**: Ensure existing application functionality remains intact
    - **ROLLBACK PLAN**: Document exact steps to revert changes if needed
    - _Requirements: 5.1, 5.2_

  - [x] 2.5 Add semantic search database schema
    - **BACKUP FIRST**: Create backup before adding pgvector extension
    - Enable pgvector extension in existing RDS database
    - Add embedding_text and embedding_vector columns to products table
    - Create search_logs table for analytics
    - Create vector similarity search indexes
    - **TEST**: Verify vector operations work correctly
    - _Requirements: 8.2, 8.3, 3.6_

  - [x] 2.6 Implement ConversationContext with personality and negotiation tracking
    - Add personality insights, negotiation history, and upsell tracking
    - Add search history tracking for semantic search operations
    - Create session state management
    - _Requirements: 3.3, 3.5, 3.6_

- [ ] 3. Build inventory service with sellability controls and semantic search
  - [x] 3.1 Implement enhanced inventory service interface
    - Create getSellableProducts method with filtering
    - Add toggleSellability functionality
    - Implement getBargainableItems method
    - _Requirements: 2.1, 5.1, 5.3_

  - [ ] 3.2 Add semantic search integration to inventory service
    - Implement searchProductsSemantically method with mandatory sellability filtering
    - **CRITICAL**: Ensure all customer-facing searches use sellableOnly=true by default
    - Integrate with SemanticSearchService for product discovery
    - Add result filtering and ranking logic
    - _Requirements: 8.3, 8.4, 11.1, 11.2_

  - [ ]* 3.3 Write property test for inventory filtering
    - **Property 11: Real-time inventory synchronization**
    - **Validates: Requirements 5.1**

  - [ ]* 3.4 Write property test for sellability filtering
    - **Property 24: Sellability filtering**
    - **Validates: Requirements Enhanced inventory**

  - [ ]* 3.4.1 Write property test for customer-facing sellability filtering
    - **Property 39: Customer-facing sellability filtering**
    - **Validates: Requirements 11.2, 11.4**

  - [ ]* 3.5 Write property test for semantic search functionality
    - **Property 30: Semantic search functionality**
    - **Validates: Requirements 8.3**

  - [x] 3.6 Integrate with existing RDS farm inventory system
    - Create database connection service for existing RDS instance
    - Implement queries for extended product table with new sellability fields
    - Add connection pooling and error handling for RDS
    - **TEST**: Verify all existing inventory operations still work correctly
    - **FALLBACK**: Ensure graceful degradation if new fields are missing
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 4. Implement semantic search service
  - [x] 4.1 Create SemanticSearchService interface and core functionality
    - Implement vector embedding generation using Amazon Bedrock Titan
    - Create semantic similarity search using pgvector with sellability filtering
    - **CRITICAL**: Add `WHERE sellable = true` to ALL customer-facing search queries
    - Add product embedding management and updates
    - **ADD**: Debug logging for embedding generation, search queries, similarity scores, and sellability filtering
    - _Requirements: 8.3, 11.1, 11.3_

  - [ ]* 4.2 Write property test for embedding generation
    - **Property 30: Semantic search functionality**
    - **Validates: Requirements 8.3**

  - [ ] 4.3 Implement search logging and analytics
    - Create search operation logging to search_logs table
    - Add analytics tracking for search terms and results
    - Implement search performance monitoring
    - Add negation filter logging for analytics
    - **ADD**: Log sellability filtering status and excluded product counts
    - _Requirements: 8.2, 3.6, 10.2, 11.5_

  - [ ] 4.3.1 Implement negation filtering in semantic search
    - Add filterNegatedProducts method to SemanticSearchService
    - Create semantic similarity checking for negated terms
    - Implement exclusion logic for products matching negated characteristics
    - **ADD**: Debug logging for negation filtering decisions and excluded products
    - _Requirements: 10.3, 10.4_

  - [ ]* 4.4 Write property test for search logging
    - **Property 32: Search operation logging**
    - **Validates: Requirements 3.6**

  - [ ]* 4.4.1 Write property test for negation logging
    - **Property 34: Negation logging consistency**
    - **Validates: Requirements 10.2**

  - [ ]* 4.4.2 Write property test for semantic negation filtering
    - **Property 35: Semantic negation filtering**
    - **Validates: Requirements 10.3**

  - [ ]* 4.4.3 Write property test for spicy product exclusion
    - **Property 36: Spicy product exclusion**
    - **Validates: Requirements 10.4**

  - [ ]* 4.4.4 Write property test for sellable products only in search results
    - **Property 38: Sellable products only in search results**
    - **Validates: Requirements 11.1, 11.3**

  - [ ]* 4.4.5 Write property test for sellability filter logging
    - **Property 40: Sellability filter logging**
    - **Validates: Requirements 11.5**

  - [ ] 4.5 Create product embedding initialization and updates
    - Generate initial embeddings for existing products
    - Implement batch embedding update processes
    - Add embedding refresh mechanisms for product changes
    - _Requirements: 8.3_

- [ ] 5. Implement basic agent personality (MVP approach)
  - [x] 5.1 Create simple personality interface with single default personality
    - Implement basic "Friendly Farmer" personality as default
    - Create simple response tone and style configuration
    - _Requirements: 4.1_

  - [x] 5.2 Add basic upselling and negotiation responses
    - Create simple upsell suggestion logic
    - Add basic price negotiation responses (accept/decline/counter)
    - _Requirements: 2.5_

- [ ] 6. Build NLP service with pluggable AI backends and product description extraction
  - [x] 6.1 Create NLP service interface with AI router
    - Implement pluggable backend architecture
    - Create AI router for cloud vs local decision making
    - _Requirements: 1.1, 1.2_

  - [ ] 6.2 Add product description extraction functionality
    - Implement extractProductDescription method in NLP service
    - Create logic to identify product search terms from natural language
    - Add confidence scoring for extracted terms
    - **ADD**: Debug logging for extraction process, confidence scores, and decision logic
    - _Requirements: 8.1_

  - [x] 6.2.1 Implement negation detection and extraction
    - Add extractNegations method to NLP service
    - Create logic to identify negation phrases ("don't like", "no", "not", "avoid", "without")
    - Extract negated terms and categorize them (characteristic, ingredient, category, attribute)
    - **ADD**: Debug logging for negation detection, extracted terms, and confidence scores
    - _Requirements: 10.1_

  - [ ]* 6.3 Write property test for product description extraction
    - **Property 28: Product description extraction reliability**
    - **Validates: Requirements 8.1**

  - [ ]* 6.3.1 Write property test for negation term extraction
    - **Property 33: Negation term extraction**
    - **Validates: Requirements 10.1**

  - [ ]* 6.4 Write property test for message processing
    - **Property 1: Message processing reliability**
    - **Validates: Requirements 1.1**

  - [x] 6.5 Implement Amazon Bedrock integration
    - Set up Claude API integration for cloud AI processing
    - Implement intent classification and entity extraction
    - _Requirements: 1.1, 2.1, 2.2_

  - [ ] 6.6 Add semantic search result formatting
    - Implement formatSearchResults method with negation support
    - Create logic to select most relevant products from search results
    - Add contextual response generation for search results
    - Add explanation generation for negation filtering
    - **ADD**: Debug logging for result filtering decisions and response generation logic
    - _Requirements: 8.4, 10.5_

  - [ ]* 6.7 Write property test for result filtering and formatting
    - **Property 31: Result filtering and formatting**
    - **Validates: Requirements 8.4**

  - [ ]* 6.7.1 Write property test for negation explanation transparency
    - **Property 37: Negation explanation transparency**
    - **Validates: Requirements 10.5**

  - [x] 6.8 Prepare local AI integration architecture
    - Design interface for future Ollama/LM Studio integration
    - Create local AI service stub for RTX 4060 support
    - _Requirements: 7.1, 7.4_

  - [x] 6.9 Implement basic response generation with simple personality
    - Create friendly, helpful response generation
    - Add basic upselling and negotiation response capabilities
    - _Requirements: 2.5, 4.1_

- [ ] 7. Develop enhanced pricing calculator with negotiation support
  - [ ] 7.1 Implement base pricing calculation with negotiation bounds
    - Create price calculation with min/max ranges
    - Add seasonal and promotional pricing
    - _Requirements: 2.3, 6.1, 6.3_

  - [ ]* 7.2 Write property test for pricing calculation
    - **Property 5: Pricing calculation correctness**
    - **Validates: Requirements 2.3, 6.1**

  - [ ] 7.3 Build negotiation engine
    - Implement price negotiation logic with personality-based strategies
    - Create counter-offer evaluation system
    - Add profit margin protection
    - _Requirements: 6.2, 6.4_

  - [ ]* 7.4 Write property test for negotiation bounds
    - **Property 25: Negotiation bounds**
    - **Validates: Requirements Enhanced pricing**

  - [ ] 7.5 Implement upselling recommendation system
    - Create context-aware product suggestions
    - Add bundle and cross-sell opportunities
    - _Requirements: 2.5_

  - [ ]* 7.6 Write property test for upsell appropriateness
    - **Property 27: Upsell appropriateness**
    - **Validates: Requirements Enhanced agent personality**

- [ ] 8. Create agent core orchestration service
  - [x] 8.1 Implement main Agent Core interface
    - Create conversation orchestration logic
    - Integrate NLP, inventory, pricing, and personality services
    - **ADD**: Comprehensive debug logging for all service interactions and decision points
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 8.2 Write property test for response display
    - **Property 2: Response display consistency**
    - **Validates: Requirements 1.2**

  - [ ] 8.3 Implement session management
    - Create session initialization and cleanup
    - Add conversation state persistence
    - **ADD**: Debug logging for session lifecycle events and state changes
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 8.4 Write property test for session isolation
    - **Property 8: Session isolation**
    - **Validates: Requirements 3.3**

  - [ ] 8.5 Add analytics and logging
    - Implement interaction logging for analytics
    - Create cost monitoring and alerts
    - **ADD**: Structured logging with correlation IDs for troubleshooting
    - _Requirements: 3.5, 7.4_

- [ ] 9. Build web interface and chat component
  - [ ] 9.1 Create React-based chat interface
    - Build responsive chat UI component
    - Implement message display and input handling
    - **ADD**: Client-side logging for user interactions and errors
    - _Requirements: 1.1, 1.2_

  - [ ] 9.2 Implement product display and cart functionality
    - Create product browsing interface
    - Add shopping cart with negotiation support
    - **ADD**: Debug logging for product selection and cart operations
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 9.3 Add screensaver and idle state management
    - Implement 10-minute idle timeout with screensaver
    - Maintain system responsiveness during idle
    - **ADD**: Logging for idle state transitions and user activity
    - _Requirements: 3.2_

- [ ] 10. Implement AWS Lambda functions and API Gateway
  - [ ] 10.1 Create Lambda functions for core services
    - Deploy agent core, inventory, and pricing services as Lambda functions
    - Set up API Gateway endpoints
    - **ADD**: CloudWatch logging with structured JSON logs for all Lambda functions
    - **ADD**: Request/response logging with correlation IDs for tracing
    - _Requirements: 7.1, 7.2_

  - [ ] 10.2 Set up RDS database connections (Redis deferred for MVP)
    - Configure RDS database connections with proper security groups
    - Implement connection pooling and error handling for RDS
    - **TEST**: Verify database connectivity and query performance
    - **MONITOR**: Set up basic CloudWatch monitoring for database connections
    - **ADD**: Database query logging with execution times and error tracking
    - _Requirements: 5.1, 5.2_

  - [ ] 10.3 Deploy static assets to S3 and CloudFront
    - Set up web hosting for React application
    - Configure CDN for optimal performance
    - **ADD**: Access logging for static asset requests
    - _Requirements: 7.1_

- [ ] 11. Checkpoint - Database changes complete
  - **VERIFY**: All database migrations completed successfully
  - **TEST**: Existing farm applications still function normally
  - **CONFIRM**: New agent tables created and accessible
  - **VERIFY**: Debug logging is working for all database operations
  - Ensure all tests pass, ask the user if questions arise.
  - **HUMAN APPROVAL REQUIRED** before proceeding to integration tasks

- [ ] 12. Implement error handling and graceful degradation
  - [ ] 12.1 Add comprehensive error handling
    - Implement error response strategies for system, business, and user errors
    - Create fallback mechanisms for service failures
    - **ADD**: Detailed error logging with stack traces and context information
    - **ADD**: Error correlation tracking across service boundaries
    - _Requirements: 5.5_

  - [ ]* 12.2 Write property test for error logging
    - **Property 15: Synchronization error handling**
    - **Validates: Requirements 5.5**

  - [ ] 12.3 Implement caching and performance optimization
    - Add response caching to reduce AI API costs
    - Optimize database queries and Lambda performance
    - **ADD**: Cache hit/miss logging and performance metrics
    - _Requirements: 7.1, 7.4_

- [ ] 13. Add cost monitoring and optimization
  - [ ] 13.1 Implement cost tracking and alerts
    - Set up CloudWatch metrics for service usage
    - Create budget alerts at 80% threshold
    - **ADD**: Detailed cost logging by service and operation type
    - **ADD**: Real-time cost tracking dashboard with debug information
    - _Requirements: 7.1, 7.4_

  - [ ]* 13.2 Write property test for cost monitoring
    - **Property 20: Cost monitoring alerts**
    - **Validates: Requirements 7.4**

  - [ ] 13.3 Optimize for cost efficiency
    - Implement intelligent caching strategies
    - Add request batching and connection pooling
    - **ADD**: Performance logging for optimization decisions
    - _Requirements: 7.1, 7.5_

- [ ] 14. Final integration and deployment
  - [ ] 14.1 End-to-end integration testing
    - Test complete customer journey from greeting to purchase
    - Verify personality switching and negotiation flows
    - **ADD**: Comprehensive test logging with detailed trace information
    - **ADD**: Semantic search testing with query/result logging
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 8.1, 8.3, 8.4_

  - [ ] 14.2 Deploy to production environment
    - Set up production AWS infrastructure
    - Configure monitoring and logging
    - **ADD**: Production-grade logging configuration with log retention policies
    - **ADD**: Centralized log aggregation and search capabilities
    - _Requirements: 7.1, 7.2_

  - [ ] 14.3 Create admin documentation and configuration guides
    - Document personality configuration process
    - Create troubleshooting and maintenance guides
    - **ADD**: Debug logging guide and troubleshooting playbook
    - **ADD**: Log analysis procedures for semantic search optimization
    - _Requirements: 8.1_

- [ ] 15. Final checkpoint - Complete system verification
  - **VERIFY**: Sari sari agent fully functional end-to-end
  - **TEST**: All existing farm systems remain operational
  - **VERIFY**: Semantic search working correctly with "hot" query returning vinegar products
  - **VERIFY**: All debug logging is functioning and providing useful troubleshooting information
  - **DOCUMENT**: Deployment procedures and monitoring setup
  - **DOCUMENT**: Log analysis procedures and troubleshooting workflows
  - Ensure all tests pass, ask the user if questions arise.
  - **HUMAN APPROVAL REQUIRED** for production deployment

- [ ] 16. Implement AWS Bedrock Agent infrastructure
  - [ ] 16.1 Create CDK templates for Bedrock Agent deployment
    - Create CDK stack for Lambda functions with proper IAM roles
    - Define BedrockExecutionRole with Lambda invoke permissions
    - Set up LambdaBasicExecution roles for each tool function
    - Configure RDS connection permissions for Lambda functions
    - **ADD**: CloudWatch log groups and monitoring configuration
    - _Requirements: 12.4, 13.1_

  - [ ]* 16.2 Write property test for infrastructure deployment speed
    - **Property 48: Infrastructure deployment speed**
    - **Validates: Requirements 13.1**

  - [x] 16.3 Implement conversational pgvector Search Tool Lambda function
    - Create Lambda function that connects to RDS with pgvector
    - Implement semantic search with conversational result formatting
    - Add product context, selling points, and relevance reasons to results
    - Include product stories, origins, and complementary item suggestions
    - Add sellability filtering (sellable=true) to all customer queries
    - Return ConversationalSearchResult format for agent storytelling
    - **ADD**: Comprehensive logging for search queries, results, and conversation context
    - _Requirements: 12.3, 14.3, 11.1, 11.3_

  - [ ]* 16.4 Write property test for Bedrock Agent tool invocation
    - **Property 41: Bedrock Agent tool invocation**
    - **Validates: Requirements 12.3**

  - [ ] 16.5 Implement conversational Inventory Tool Lambda function
    - Create Lambda function for product availability with storytelling context
    - Add detailed product information including freshness, origin, and tips
    - Implement alternative product recommendations with similarity reasons
    - Include stock descriptions ("plenty in stock", "only a few left")
    - Add upsell opportunities and complementary product suggestions
    - Integrate with existing RDS inventory tables
    - **ADD**: Detailed logging for inventory operations and recommendation logic
    - _Requirements: 12.2, 14.5, 14.7, 5.1, 5.2_

  - [ ] 16.6 Implement conversational Pricing Tool Lambda function
    - Create Lambda function for dynamic pricing with value explanations
    - Add conversational negotiation responses and friendly bargaining
    - Include value proposition explanations for each price point
    - Implement budget-based product recommendations
    - Add alternative offers and bundle suggestions for negotiations
    - Integrate with existing pricing rules and promotions
    - **ADD**: Logging for pricing calculations, negotiations, and conversation context
    - _Requirements: 12.2, 14.4, 14.6, 6.1, 6.2_

  - [ ]* 16.7 Write property test for Lambda tool execution
    - **Property 43: Lambda tool execution**
    - **Validates: Requirements 12.2**

- [ ] 17. Configure AWS Bedrock Agent
  - [ ] 17.1 Create Bedrock Agent with Claude 3 Haiku model
    - Set up agent in AWS Console with anthropic.claude-3-haiku model
    - Configure agent name, description, and basic settings
    - Set up agent IAM role with proper permissions
    - **ADD**: Agent configuration logging and validation
    - _Requirements: 12.1, 12.4_

  - [ ]* 17.2 Write property test for Claude model integration
    - **Property 42: Claude model integration**
    - **Validates: Requirements 12.1**

  - [ ] 17.3 Configure agent personality and conversational instructions
    - Add detailed "Aling Maria" personality instructions to agent
    - Configure conversational dialog patterns and storytelling approach
    - Set up product recommendation guidelines with reasoning explanations
    - Add follow-up question templates for vague customer requests
    - Configure friendly negotiation and alternative suggestion patterns
    - **ADD**: Personality validation and conversation flow testing
    - _Requirements: 12.6, 14.1, 14.2, 14.3_

  - [ ] 17.4 Create and attach action groups
    - Create ProductSearch action group linked to pgvector Search Tool
    - Create InventoryManagement action group linked to Inventory Tool
    - Create PricingCalculation action group linked to Pricing Tool
    - Configure action group descriptions and parameters
    - **ADD**: Action group validation and testing
    - _Requirements: 12.5_

  - [ ]* 17.5 Write property test for agent configuration completeness
    - **Property 45: Agent configuration completeness**
    - **Validates: Requirements 12.5**

  - [ ]* 17.6 Write property test for IAM permission validation
    - **Property 44: IAM permission validation**
    - **Validates: Requirements 12.4**

- [ ] 18. Test and validate Bedrock Agent functionality
  - [ ] 18.1 Test basic agent responses and tool invocation
    - Test simple queries like "What products do you have?"
    - Verify agent can invoke search tools correctly
    - Test inventory checking and pricing calculations
    - **ADD**: Comprehensive test logging and result validation
    - _Requirements: 12.2, 12.3_

  - [ ] 18.2 Test semantic search with specific queries
    - Test "Noodles under 30 pesos" query for price filtering
    - Test "hot items" query for semantic search functionality
    - Test negation queries like "no spicy items"
    - Verify sellability filtering works correctly
    - **ADD**: Query analysis logging and result verification
    - _Requirements: 12.6, 8.3, 10.3, 11.1_

  - [ ]* 18.3 Write property test for API functionality verification
    - **Property 46: API functionality verification**
    - **Validates: Requirements 12.6**

  - [ ] 18.4 Test negotiation and pricing functionality
    - Test price negotiation scenarios with different products
    - Verify counter-offer logic and minimum price protection
    - Test bulk pricing and promotional discounts
    - **ADD**: Negotiation logging and decision tracking
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 18.5 Validate monitoring and tracing
    - Verify CloudWatch logs capture all agent interactions
    - Test Bedrock traces for tool invocations and responses
    - Set up alerts for errors and performance issues
    - **ADD**: Monitoring dashboard and alert configuration
    - _Requirements: 12.7_

  - [ ]* 18.7 Write property test for conversational product suggestions
    - **Property 53: Conversational product suggestions**
    - **Validates: Requirements 12.2, 14.3**

  - [ ]* 18.8 Write property test for follow-up question engagement
    - **Property 54: Follow-up question engagement**
    - **Validates: Requirements 14.2**

  - [ ]* 18.9 Write property test for personality-driven responses
    - **Property 55: Personality-driven responses**
    - **Validates: Requirements 14.1**

  - [ ]* 18.10 Write property test for conversational test responses
    - **Property 60: Conversational test responses**
    - **Validates: Requirements 13.3**

- [ ] 19. Integrate Bedrock Agent with frontend
  - [ ] 19.1 Update React chat interface for Bedrock API
    - Modify chat component to use Bedrock retrieveAndGenerate API
    - Add proper error handling for agent responses
    - Implement session management for conversation continuity
    - **ADD**: Frontend logging for API calls and responses
    - _Requirements: 13.4, 1.1, 1.2_

  - [ ] 19.2 Configure Amplify for Bedrock integration
    - Set up AWS Amplify configuration for Bedrock access
    - Configure authentication and authorization for agent access
    - Add environment variables for agent ID and region
    - **ADD**: Amplify deployment logging and validation
    - _Requirements: 13.4_

  - [ ]* 19.3 Write property test for frontend integration speed
    - **Property 51: Frontend integration speed**
    - **Validates: Requirements 13.4**

  - [ ] 19.4 Test end-to-end customer journey
    - Test complete customer interaction from greeting to purchase
    - Verify product search, selection, and pricing flows
    - Test negotiation and alternative product suggestions
    - **ADD**: End-to-end journey logging and analytics
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

- [ ] 20. Performance optimization and deployment validation
  - [ ] 20.1 Optimize Lambda function performance
    - Implement connection pooling for RDS connections
    - Add response caching for frequently accessed data
    - Optimize vector search queries for better performance
    - **ADD**: Performance metrics logging and optimization tracking
    - _Requirements: 7.1, 7.4_

  - [ ] 20.2 Validate deployment timing requirements
    - Measure and document actual deployment times for each phase
    - Optimize CDK templates for faster deployment
    - Create deployment automation scripts
    - **ADD**: Deployment timing logs and optimization recommendations
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 20.3 Write property test for query response performance
    - **Property 50: Query response performance**
    - **Validates: Requirements 13.3**

  - [ ]* 20.4 Write property test for agent creation efficiency
    - **Property 49: Agent creation efficiency**
    - **Validates: Requirements 13.2**

  - [ ]* 20.5 Write property test for total deployment time
    - **Property 52: Total deployment time**
    - **Validates: Requirements 13.5**

- [ ] 21. Final Bedrock Agent deployment and documentation
  - [ ] 21.1 Create deployment automation and documentation
    - Create step-by-step deployment guide for 15-minute setup
    - Document CDK deployment commands and configuration
    - Create troubleshooting guide for common issues
    - **ADD**: Deployment checklist and validation procedures
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 21.2 Set up production monitoring and alerts
    - Configure CloudWatch dashboards for agent performance
    - Set up cost monitoring alerts for budget management
    - Create operational runbooks for maintenance
    - **ADD**: Monitoring configuration documentation
    - _Requirements: 12.7, 7.4_

  - [ ] 21.3 Validate complete system functionality
    - Test all customer interaction scenarios end-to-end
    - Verify integration with existing farm inventory systems
    - Confirm cost optimization and budget compliance
    - **ADD**: System validation checklist and test results
    - _Requirements: 7.1, 5.1, 5.2_

- [ ] 22. Final checkpoint - Bedrock Agent system complete
  - **VERIFY**: Bedrock Agent fully functional with all Lambda tools
  - **TEST**: 15-minute deployment process works reliably
  - **VERIFY**: "Noodles under 30 pesos" query returns proper filtered results
  - **VERIFY**: All monitoring and logging systems operational
  - **DOCUMENT**: Complete deployment guide and troubleshooting procedures
  - **DOCUMENT**: Cost optimization strategies and budget monitoring
  - Ensure all tests pass, ask the user if questions arise.
  - **HUMAN APPROVAL REQUIRED** for production deployment