# Requirements Document

## Introduction

An enhanced natural-language product search pipeline that processes user queries through a modular pipeline, supports price-based filtering, handles negation, includes items with zero inventory for pre-order, and uses existing RDS columns with vector embedding capabilities.

## Glossary

- **Search_Pipeline**: The complete modular query processing system that transforms natural language into structured search results
- **Query_Rewriter**: Component that transforms raw user queries into structured objects with semantic intent and constraints
- **Filter_Mapper**: Component that maps query constraints into SQL-ready filter parameters
- **Hybrid_Retriever**: Component that executes combined SQL and vector similarity searches
- **Result_Formatter**: Component that converts SQL rows into structured API response format
- **Price_Filter**: Constraint mechanism that filters products based on price ranges extracted from natural language
- **Negation_Filter**: Exclusion mechanism that removes products with characteristics explicitly rejected by the customer
- **Inventory_Handler**: System that manages both in-stock and out-of-stock products for pre-order functionality
- **Semantic_Ranking**: Vector-based similarity scoring system using existing embedding columns
- **Product_Eligibility**: Active product filtering system that ensures only is_active=TRUE products appear in results

## Requirements

### Requirement 1

**User Story:** As a customer, I want the system to process my natural language queries through a structured pipeline, so that I can get accurate and relevant product results.

#### Acceptance Criteria

1. WHEN a customer provides raw natural language input THEN the Search_Pipeline SHALL accept the input for processing
2. WHEN processing begins THEN the system SHALL rewrite and structure the query into intent and constraints
3. WHEN constraints are identified THEN the system SHALL map constraints into SQL-ready filters
4. WHEN filters are prepared THEN the system SHALL execute a hybrid query combining SQL and vector similarity
5. WHEN query execution completes THEN the system SHALL return ranked products with applied filters and stock status

### Requirement 2

**User Story:** As a customer, I want to search for products using natural language with price constraints, so that I can find items within my budget using conversational queries.

#### Acceptance Criteria

1. WHEN a customer enters a natural language query with price terms THEN the Query_Rewriter SHALL extract price constraints from the input
2. WHEN the Query_Rewriter processes input THEN the system SHALL structure the query into intent and constraints including price parameters
3. WHEN constraints are identified THEN the Filter_Mapper SHALL convert them into SQL-ready filter conditions
4. WHEN filters are prepared THEN the Hybrid_Retriever SHALL execute a combined SQL and vector similarity query
5. WHEN results are obtained THEN the Result_Formatter SHALL return ranked products with applied filters and stock status

### Requirement 3

**User Story:** As a customer, I want to specify price ranges using natural language, so that I can find products within my budget without needing to know exact syntax.

#### Acceptance Criteria

1. WHEN a customer says "under 20 pesos" or "<= 20" THEN the system SHALL create a price filter with price <= 20
2. WHEN a customer says "above 50 pesos" or "> 50" THEN the system SHALL create a price filter with price >= 50
3. WHEN a customer says "between 20 and 50 pesos" THEN the system SHALL create a price filter with price >= 20 AND price <= 50
4. WHEN no price constraint is detected THEN the system SHALL not add any price condition to the SQL query
5. WHEN price filtering is applied THEN the system SHALL never return products outside the requested price range

### Requirement 4

**User Story:** As a customer, I want to see both in-stock and out-of-stock products, so that I can place pre-orders for items I need even when they're not currently available.

#### Acceptance Criteria

1. WHEN performing product searches THEN the system SHALL include products with stock_level = 0 in results
2. WHEN displaying products THEN the system SHALL use stock_level as a ranking signal but not as a hard exclusion filter
3. WHEN a product has stock_level > 0 THEN the system SHALL label it as "In stock"
4. WHEN a product has stock_level = 0 THEN the system SHALL label it as "Out of stock – available for pre-order"
5. WHEN ranking results THEN the system SHALL boost in-stock products while still showing out-of-stock items

### Requirement 5

**User Story:** As a customer, I want to only see products that are currently available for purchase, so that I don't see discontinued or deactivated items.

#### Acceptance Criteria

1. WHEN performing any product search THEN the system SHALL apply a hard filter of is_active = TRUE
2. WHEN products have is_active = FALSE THEN they SHALL never appear in customer search results
3. WHEN generating SQL queries THEN the system SHALL always include the is_active = TRUE condition
4. WHEN deactivated products exist THEN the system SHALL exclude them completely from all customer-facing operations
5. WHEN debugging search issues THEN the system SHALL log how many products were excluded due to is_active = FALSE

### Requirement 6

**User Story:** As a customer, I want search results ranked by relevance, so that the most appropriate products appear first in my results.

#### Acceptance Criteria

1. WHEN processing search queries THEN the system SHALL compute query embeddings from the rewritten semantic_query string
2. WHEN executing searches THEN the system SHALL use the existing vector embedding column for semantic similarity calculation
3. WHEN ordering results THEN the system SHALL rank primarily by semantic similarity using cosine distance
4. WHEN products have different stock levels THEN the system SHALL boost in-stock products in the ranking
5. WHEN similarity scores are calculated THEN the system SHALL include them in the response payload for transparency

### Requirement 7

**User Story:** As a developer, I want structured JSON responses with complete product information, so that I can build rich user interfaces and provide debugging information.

#### Acceptance Criteria

1. WHEN returning search results THEN the system SHALL provide a results array with complete product information
2. WHEN each product is returned THEN it SHALL include id, name, description, price, stock_level, in_stock boolean, status_label, and similarity_score
3. WHEN filters are applied THEN the system SHALL return a filters_applied object with price_min and price_max values
4. WHEN debugging is enabled THEN the system SHALL include semantic_query, raw_sql, and parsed constraints in debug section
5. WHEN responses are generated THEN they SHALL follow a consistent JSON schema for all search operations

### Requirement 8

**User Story:** As a system administrator, I want the search pipeline to perform efficiently, so that customers receive fast responses and the system can handle expected load.

#### Acceptance Criteria

1. WHEN processing search requests THEN the system SHALL complete end-to-end processing in less than 2 seconds at 95th percentile
2. WHEN under normal load THEN the system SHALL support at least 100 queries per minute without performance degradation
3. WHEN using current infrastructure THEN the system SHALL operate within existing resource constraints
4. WHEN monitoring performance THEN the system SHALL log execution time per pipeline step and overall request duration
5. WHEN optimizing queries THEN the system SHALL use appropriate database indexes for vector similarity operations

### Requirement 9

**User Story:** As a system administrator, I want reliable error handling and safety measures, so that the system never returns incorrect results or crashes.

#### Acceptance Criteria

1. WHEN price filters are applied THEN the system SHALL never return products outside the requested price range
2. WHEN product eligibility is checked THEN the system SHALL never return products with is_active = FALSE
3. WHEN parsing or SQL errors occur THEN the system SHALL log errors and return safe error responses
4. WHEN database operations fail THEN the system SHALL handle failures gracefully without exposing internal details
5. WHEN validation fails THEN the system SHALL provide meaningful error messages to help users correct their queries

### Requirement 10

**User Story:** As a system administrator, I want comprehensive logging and observability, so that I can monitor system performance and troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN processing queries THEN the system SHALL log the raw user query for audit and analysis
2. WHEN rewriting queries THEN the system SHALL log the parsed/rewritten query object with extracted constraints
3. WHEN applying filters THEN the system SHALL log derived filter parameters including min_price and max_price
4. WHEN executing SQL THEN the system SHALL log the generated query string or parameterized template with parameters
5. WHEN completing requests THEN the system SHALL log execution time per step and overall request duration

### Requirement 11

**User Story:** As a developer, I want to use existing database schema without modifications, so that I can implement the enhanced search without disrupting current operations.

#### Acceptance Criteria

1. WHEN accessing product data THEN the system SHALL use the existing products table in RDS
2. WHEN querying products THEN the system SHALL use existing columns: id, name, description, price, stock_level, is_active, embedding
3. WHEN no schema changes are required THEN the system SHALL work with the current database structure
4. WHEN vector operations are needed THEN the system SHALL use the existing embedding column
5. WHEN integrating with current systems THEN the system SHALL maintain compatibility with existing applications

### Requirement 12

**User Story:** As a developer, I want modular components with clear interfaces, so that I can test, maintain, and extend the search pipeline effectively.

#### Acceptance Criteria

1. WHEN implementing QueryRewriter THEN it SHALL transform raw queries into structured QueryComponents objects
2. WHEN QueryRewriter processes input THEN it SHALL always produce a semantic_query string with optional price_min and price_max
3. WHEN implementing FilterMapper THEN it SHALL convert QueryComponents into SqlFilterParams for database queries
4. WHEN implementing HybridRetriever THEN it SHALL execute parameterized SQL queries with vector similarity and price filtering
5. WHEN implementing ResultFormatter THEN it SHALL convert SQL rows into structured API response format with proper labeling

### Requirement 13

**User Story:** As a developer, I want a well-defined HTTP API, so that I can integrate the search functionality into web and mobile applications.

#### Acceptance Criteria

1. WHEN defining the search endpoint THEN it SHALL accept POST requests to /search with JSON payloads
2. WHEN receiving requests THEN the system SHALL accept query string and optional store_id parameters
3. WHEN returning responses THEN the system SHALL provide results array, filters_applied object, and optional debug information
4. WHEN handling errors THEN the system SHALL return appropriate HTTP status codes with descriptive error messages
5. WHEN processing requests THEN the system SHALL validate input parameters and reject malformed requests with 400 status

### Requirement 14

**User Story:** As a customer, I want the system to respect negations in my queries, so that excluded characteristics do not appear in my search results.

#### Acceptance Criteria

1. WHEN a customer uses negation phrases like "no spicy", "not hot", "avoid dairy", or "without sugar" THEN the Query_Rewriter SHALL detect and extract the negated terms
2. WHEN negated terms are identified THEN the system SHALL map them to exclusion filters that remove products with those characteristics
3. WHEN applying negation filters THEN the system SHALL exclude products that semantically match the negated characteristics from search results
4. WHEN a customer says "no spicy food" THEN the system SHALL exclude products containing chili, hot sauce, spiced items, and other semantically similar spicy products
5. WHEN negation filtering is applied THEN the system SHALL log the excluded characteristics and inform the customer what was filtered out

### Requirement 15

**User Story:** As a quality assurance engineer, I want comprehensive test coverage, so that I can verify the search pipeline works correctly across all scenarios.

#### Acceptance Criteria

1. WHEN testing QueryRewriter THEN unit tests SHALL verify price extraction patterns like "under 20 pesos" and "between 10 and 30 pesos"
2. WHEN testing FilterMapper THEN unit tests SHALL verify correct passthrough behavior for price constraints
3. WHEN testing HybridRetriever THEN unit tests SHALL verify correct SQL generation with various price combinations
4. WHEN performing integration tests THEN end-to-end tests SHALL use seed datasets to verify complete pipeline functionality
5. WHEN validating results THEN tests SHALL confirm price filtering accuracy, active product filtering, and pre-order item inclusion