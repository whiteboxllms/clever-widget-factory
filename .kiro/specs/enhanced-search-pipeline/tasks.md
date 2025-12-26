# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for pipeline components (QueryRewriter, FilterMapper, HybridRetriever, ResultFormatter)
  - Define TypeScript/Python interfaces for all core data models (QueryComponents, SqlFilterParams, SearchResponse)
  - Set up testing framework with fast-check for property-based testing
  - Configure build and deployment pipeline for AWS Lambda
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 2. Implement core data models and validation
  - [x] 2.1 Create QueryComponents data model
    - Implement QueryComponents dataclass/interface with semantic_query, price_min, price_max fields
    - Add validation for semantic_query (non-empty string requirement)
    - Add validation for price constraints (non-negative values, min <= max)
    - _Requirements: 12.1, 12.2_

  - [x]* 2.2 Write property test for QueryComponents validation
    - **Property 2: Query rewriting consistency**
    - **Validates: Requirements 1.2, 12.1, 12.2**

  - [x] 2.3 Create SqlFilterParams data model
    - Implement SqlFilterParams dataclass with min_price, max_price optional fields
    - Add validation for price range consistency
    - _Requirements: 12.3_

  - [x] 2.4 Create SearchResponse and ProductResult models
    - Implement complete response structure with results array, filters_applied, debug sections
    - Add ProductResult model with all required fields (id, name, description, price, stock_level, in_stock, status_label, similarity_score)
    - Add FiltersApplied and DebugInfo models
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x]* 2.5 Write property test for response model completeness
    - **Property 17: Complete product information**
    - **Validates: Requirements 7.2**

- [x] 3. Implement QueryRewriter component
  - [x] 3.1 Create QueryRewriter class with LLM integration
    - Implement QueryRewriter class with LLM client dependency injection
    - Create prompt templates for extracting semantic queries and price constraints
    - Add fallback logic for when LLM extraction fails
    - _Requirements: 2.1, 12.1, 12.2_

  - [x] 3.2 Implement price pattern extraction
    - Add regex patterns for "under X pesos", "above X pesos", "between X and Y pesos"
    - Implement numeric extraction and validation
    - Handle edge cases like "less than", "more than", "from X to Y"
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.3 Write property test for price constraint extraction
    - **Property 6: Price constraint extraction**
    - **Validates: Requirements 2.1**

  - [ ]* 3.4 Write unit tests for specific price patterns
    - Test "under 20 pesos" → price_max = 20
    - Test "above 50 pesos" → price_min = 50
    - Test "between 20 and 50 pesos" → price_min = 20, price_max = 50
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.5 Add negation detection and extraction
    - Implement logic to detect negation phrases ("no", "not", "avoid", "without")
    - Extract negated terms and characteristics from natural language
    - Add negated_terms field to QueryComponents output
    - _Requirements: 14.1_

  - [ ]* 3.6 Write property test for negation detection
    - **Property 27: Negation detection and extraction**
    - **Validates: Requirements 14.1**

  - [x] 3.7 Add semantic query extraction and cleaning
    - Implement logic to extract product-related terms from natural language
    - Remove price-related terms and negated terms from semantic query
    - Add query normalization and cleaning
    - _Requirements: 1.2, 6.1_

  - [ ]* 3.8 Write property test for no price condition handling
    - **Property 8: No price condition when none specified**
    - **Validates: Requirements 3.4**

- [x] 4. Implement FilterMapper component
  - [x] 4.1 Create FilterMapper class
    - Implement mapping from QueryComponents to SqlFilterParams including negated terms
    - Add validation for price range consistency
    - Handle None values correctly for optional price constraints and negations
    - _Requirements: 1.3, 12.3, 14.2_

  - [ ]* 4.2 Write property test for filter mapping reliability
    - **Property 3: Filter mapping reliability**
    - **Validates: Requirements 1.3, 12.3**

- [x] 5. Implement database service and connection management
  - [x] 5.1 Create DatabaseService class
    - Implement PostgreSQL connection with pgvector support
    - Add connection pooling for Lambda environment
    - Create parameterized query execution methods
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 5.2 Add database schema validation
    - Verify existing products table structure
    - Check for required columns (id, name, description, price, stock_level, is_active, embedding)
    - Validate pgvector extension availability
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ]* 5.3 Write property test for database schema compatibility
    - **Property 24: Database schema compatibility**
    - **Validates: Requirements 11.1, 11.2, 11.4**

- [ ] 6. Implement embedding service
  - [x] 6.1 Create EmbeddingService class
    - Implement embedding generation using Amazon Bedrock Titan or similar
    - Add caching for frequently used queries
    - Handle embedding service failures gracefully
    - _Requirements: 6.1, 6.2_

  - [ ]* 6.2 Write property test for embedding generation consistency
    - **Property 14: Embedding generation consistency**
    - **Validates: Requirements 6.1**

- [ ] 7. Implement HybridRetriever component
  - [x] 7.1 Create HybridRetriever class with SQL generation
    - Implement parameterized SQL query generation with vector similarity
    - Add mandatory is_active = TRUE filter to all queries
    - Implement price filtering with NULL-safe conditions
    - Add stock level boosting in ORDER BY clause
    - _Requirements: 1.4, 5.1, 5.3, 6.3, 6.4, 12.4_

  - [ ]* 7.2 Write property test for active product filtering
    - **Property 12: Active product filtering**
    - **Validates: Requirements 5.1, 5.2, 5.4, 9.2**

  - [ ]* 7.3 Write property test for SQL active filter inclusion
    - **Property 13: SQL active filter inclusion**
    - **Validates: Requirements 5.3**

  - [x] 7.4 Implement vector similarity search
    - Add pgvector cosine similarity using <=> operator
    - Implement proper index usage for performance
    - Add similarity score calculation (1 - distance)
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ]* 7.5 Write property test for vector similarity ranking
    - **Property 15: Vector similarity ranking**
    - **Validates: Requirements 6.3**

  - [ ] 7.6 Add price filtering logic
    - Implement NULL-safe price range filtering in SQL
    - Ensure price boundaries are inclusive
    - Add logging for applied price filters
    - _Requirements: 3.5, 9.1_

  - [ ]* 7.7 Write property test for price filtering accuracy
    - **Property 7: Price filtering accuracy**
    - **Validates: Requirements 3.5, 9.1**

  - [ ] 7.8 Implement negation filtering logic
    - Add semantic similarity checking for negated terms against product descriptions
    - Exclude products that match negated characteristics above similarity threshold
    - Add logging for negation filtering decisions and excluded products
    - _Requirements: 14.2, 14.3, 14.4, 14.5_

  - [ ]* 7.9 Write property test for negation filtering accuracy
    - **Property 28: Negation filtering accuracy**
    - **Validates: Requirements 14.2, 14.3, 14.4**

  - [ ] 7.10 Implement stock level handling
    - Include products with stock_level = 0 in results
    - Add stock level boosting in ranking (in-stock products first)
    - Ensure out-of-stock products still appear in results
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ]* 7.11 Write property test for zero stock inclusion
    - **Property 9: Zero stock inclusion**
    - **Validates: Requirements 4.1, 4.4**

  - [ ]* 7.12 Write property test for stock level ranking boost
    - **Property 10: Stock level ranking boost**
    - **Validates: Requirements 4.2, 4.5, 6.4**

- [ ] 8. Implement ResultFormatter component
  - [ ] 8.1 Create ResultFormatter class
    - Implement SQL row to ProductResult conversion
    - Add proper stock level labeling ("In stock" vs "Out of stock – available for pre-order")
    - Include similarity scores in results
    - _Requirements: 4.3, 4.4, 6.5, 7.2, 12.5_

  - [ ]* 8.2 Write property test for in-stock labeling accuracy
    - **Property 11: In-stock labeling accuracy**
    - **Validates: Requirements 4.3**

  - [ ] 8.3 Add response metadata generation
    - Create filters_applied object with applied price constraints and negation filters
    - Add debug information when requested including excluded characteristics
    - Ensure consistent JSON schema for all responses
    - Add negation transparency messaging for customer feedback
    - _Requirements: 7.3, 7.4, 7.5, 14.5_

  - [ ]* 8.4 Write property test for negation transparency
    - **Property 29: Negation transparency**
    - **Validates: Requirements 14.5**

  - [ ]* 8.5 Write property test for filter metadata inclusion
    - **Property 18: Filter metadata inclusion**
    - **Validates: Requirements 7.3**

  - [ ]* 8.6 Write property test for debug information completeness
    - **Property 19: Debug information completeness**
    - **Validates: Requirements 7.4**

- [ ] 9. Create main SearchPipeline orchestrator
  - [ ] 9.1 Implement SearchPipeline class
    - Create main pipeline orchestration with all 5 steps
    - Add error handling and logging for each step
    - Implement request ID generation for tracing
    - _Requirements: 1.1, 1.5_

  - [ ]* 9.2 Write property test for pipeline input acceptance
    - **Property 1: Pipeline input acceptance**
    - **Validates: Requirements 1.1**

  - [ ]* 9.3 Write property test for complete pipeline response
    - **Property 5: Complete pipeline response**
    - **Validates: Requirements 1.5, 7.1, 7.5**

  - [ ] 9.4 Add comprehensive logging
    - Log raw user query, parsed query object, filter parameters, SQL query
    - Add execution time logging for each pipeline step
    - Implement structured logging with request correlation
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 9.5 Write property test for comprehensive query logging
    - **Property 23: Comprehensive query logging**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

  - [ ]* 9.6 Write property test for performance logging
    - **Property 20: Performance logging**
    - **Validates: Requirements 8.4, 10.5**

- [ ] 10. Implement error handling and validation
  - [ ] 10.1 Add input validation
    - Validate JSON request format and required fields
    - Add query length and content validation
    - Implement parameter type checking
    - _Requirements: 9.5, 13.5_

  - [ ] 10.2 Implement error response handling
    - Create structured error responses with appropriate HTTP status codes
    - Add meaningful error messages for validation failures
    - Ensure no internal details are exposed in error responses
    - _Requirements: 9.3, 9.4, 13.4_

  - [ ]* 10.3 Write property test for error logging and safe responses
    - **Property 21: Error logging and safe responses**
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 10.4 Write property test for validation error messages
    - **Property 22: Validation error messages**
    - **Validates: Requirements 9.5**

  - [ ]* 10.5 Write property test for HTTP error handling
    - **Property 26: HTTP error handling**
    - **Validates: Requirements 13.4, 13.5**

- [ ] 11. Create AWS Lambda API endpoint
  - [ ] 11.1 Implement Lambda handler function
    - Create AWS Lambda handler with proper event parsing
    - Add CORS headers for web application integration
    - Implement request/response transformation
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 11.2 Write property test for API endpoint compliance
    - **Property 25: API endpoint compliance**
    - **Validates: Requirements 13.2, 13.3**

  - [ ] 11.3 Add environment configuration
    - Configure database connection parameters from environment variables
    - Add LLM service configuration
    - Set up logging levels and debug modes
    - _Requirements: 11.1, 11.3_

  - [ ] 11.4 Implement deployment configuration
    - Create AWS Lambda deployment package
    - Configure API Gateway integration
    - Set up CloudWatch logging and monitoring
    - _Requirements: 8.4, 10.5_

- [ ] 12. Checkpoint - Core pipeline complete
  - **VERIFY**: All pipeline components implemented and tested
  - **TEST**: End-to-end pipeline processing with sample queries
  - **CONFIRM**: Price filtering, stock handling, and active product filtering working correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Add performance optimization and monitoring
  - [ ] 13.1 Implement query optimization
    - Add database query performance monitoring
    - Optimize vector similarity queries with proper indexes
    - Add query result caching for popular searches
    - _Requirements: 8.5_

  - [ ] 13.2 Add comprehensive monitoring
    - Implement CloudWatch metrics for request count, latency, errors
    - Add database connection pool monitoring
    - Create performance dashboards
    - _Requirements: 8.4, 10.5_

  - [ ] 13.3 Implement graceful degradation
    - Add fallback mechanisms for LLM service failures
    - Implement text-based search fallback when vector search fails
    - Add circuit breaker patterns for external service calls
    - _Requirements: 9.3, 9.4_

- [ ] 14. Integration testing and validation
  - [ ] 14.1 Create end-to-end integration tests
    - Test complete pipeline with realistic product datasets
    - Validate price filtering accuracy with known product catalogs
    - Test stock level handling and pre-order functionality
    - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 14.2 Performance and load testing
    - Test 100 queries/minute throughput requirement
    - Validate <2 second 95th percentile latency requirement
    - Test database connection pooling under load
    - _Requirements: 8.1, 8.2_

  - [ ] 14.3 Database integration validation
    - Test with existing RDS schema without modifications
    - Verify pgvector operations and index performance
    - Test connection recovery and error handling
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 15. Final deployment and documentation
  - [ ] 15.1 Deploy to production environment
    - Set up production AWS Lambda and API Gateway
    - Configure production database connections
    - Deploy monitoring and alerting
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 15.2 Create API documentation
    - Document search endpoint specification
    - Provide example requests and responses
    - Create error code reference
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [ ] 15.3 Create operational documentation
    - Document monitoring and alerting procedures
    - Create troubleshooting guides
    - Document performance tuning procedures
    - _Requirements: 8.4, 10.5_

- [ ] 16. Final checkpoint - Complete system verification
  - **VERIFY**: Enhanced search pipeline fully functional end-to-end
  - **TEST**: All price filtering patterns working correctly
  - **VERIFY**: Stock level handling and pre-order functionality operational
  - **CONFIRM**: Performance requirements met (100 queries/min, <2s latency)
  - **VERIFY**: All logging and monitoring operational
  - Ensure all tests pass, ask the user if questions arise.