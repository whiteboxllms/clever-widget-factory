# Enhanced Search Pipeline - Comprehensive Logging Capabilities

## Overview

The enhanced search pipeline includes comprehensive logging for all filter decisions and pipeline steps, providing complete transparency and debugging capabilities as required by the specifications (Requirements 10.1-10.5, 14.5).

## Logging Components

### 1. SearchLogger - Structured Pipeline Logging

**Purpose**: Provides consistent, structured logging throughout the entire search pipeline.

**Key Features**:
- Request correlation with unique request IDs
- Step-by-step execution timing
- Structured JSON logging for CloudWatch integration
- Error logging with context
- Performance monitoring

**Logged Events**:
- `search_request` - Initial user query and parameters
- `query_rewriting` - Query parsing and constraint extraction
- `filter_mapping` - Filter parameter mapping decisions
- `sql_execution` - Generated SQL queries and execution metrics
- `negation_filtering` - Negation filter decisions and exclusions
- `pipeline_step` - Individual step execution and timing
- `search_results` - Final results and performance summary
- `error` - Error conditions with context

### 2. DebugInfo - Detailed Decision Tracking

**Purpose**: Captures detailed information about every filter decision and pipeline step for debugging.

**Enhanced Capabilities**:
- **Filter Decisions**: Logs every filter application with reasoning
- **Negation Decisions**: Tracks product-by-product negation filtering
- **Excluded Products**: Records what was filtered out and why
- **Pipeline Steps**: Monitors step execution and status
- **Execution Times**: Tracks performance per step
- **Transparency Messages**: Generates customer-friendly explanations

**Filter Decision Logging**:
```javascript
debugInfo.logFilterDecision(
    'price',                    // Filter type
    'applied',                  // Decision made
    'Price filter from query',  // Reasoning
    { min_price: 10, max_price: 50 }  // Context
);
```

**Negation Decision Logging**:
```javascript
debugInfo.logNegationDecision(
    'spicy',           // Negated term
    'prod-123',        // Product ID
    'Hot sauce...',    // Product description
    0.85,              // Similarity score
    true,              // Was excluded
    'High similarity'  // Reasoning
);
```

### 3. FiltersApplied - Filter Transparency

**Purpose**: Provides detailed information about what filters were actually applied.

**Enhanced Features**:
- Detailed filter breakdown by type
- Human-readable filter descriptions
- Filter application logging
- Integration with debug logging

## Logging Coverage

### Requirements Compliance

✅ **Requirement 10.1**: Raw user query logging
✅ **Requirement 10.2**: Parsed/rewritten query object logging  
✅ **Requirement 10.3**: Derived filter parameters logging
✅ **Requirement 10.4**: Generated SQL query logging
✅ **Requirement 10.5**: Execution time per step logging
✅ **Requirement 14.5**: Negation filtering transparency

### What Gets Logged

1. **Query Processing**:
   - Original user input
   - Extracted semantic terms
   - Identified price constraints
   - Detected negation phrases
   - Query rewriting decisions

2. **Filter Application**:
   - Price filter decisions and reasoning
   - Active product filtering (always applied)
   - Negation filter application
   - Filter mapping from QueryComponents to SqlFilterParams

3. **Database Operations**:
   - Generated SQL queries (sanitized)
   - Query parameters
   - Execution times
   - Result counts

4. **Negation Filtering**:
   - Product-by-product evaluation
   - Similarity scores to negated terms
   - Exclusion decisions with reasoning
   - Transparency messages for customers

5. **Performance Metrics**:
   - Step-by-step execution times
   - Total request duration
   - Database query performance
   - Pipeline bottleneck identification

## Example Logging Output

### Filter Decision Log
```json
{
  "timestamp": "2025-12-21T04:52:54.595Z",
  "filter_type": "price",
  "decision": "applied",
  "reasoning": "Maximum price filter applied from user query \"under 20 pesos\"",
  "context": {
    "extracted_value": 20,
    "filter_type": "maximum_only",
    "sql_condition": "price <= $1"
  }
}
```

### Negation Decision Log
```json
{
  "timestamp": "2025-12-21T04:52:54.595Z",
  "negated_term": "spicy",
  "product_id": "prod-2",
  "product_description": "Extra spicy chili flavor noodles",
  "similarity_score": 0.9,
  "excluded": true,
  "reasoning": "High similarity to negated term \"spicy\""
}
```

### Pipeline Step Log
```json
{
  "timestamp": "2025-12-21T04:52:54.594Z",
  "request_id": "req-20241221-001",
  "event_type": "query_rewriting",
  "level": "INFO",
  "original_query": "instant noodles under 20 pesos no spicy",
  "parsed_query": {
    "semantic_query": "instant noodles",
    "price_min": null,
    "price_max": 20,
    "negated_terms": ["spicy"]
  },
  "extraction_details": {
    "price_patterns_found": ["under 20 pesos"],
    "negation_patterns_found": ["no spicy"],
    "semantic_terms_extracted": ["instant", "noodles"]
  }
}
```

## Customer Transparency

### Negation Transparency Message
When negation filters are applied, customers receive clear explanations:

> "We excluded 1 products containing characteristics you wanted to avoid: spicy"

### Filter Summary
Applied filters are clearly communicated:

> "Price: up to ₱20; Excluded: spicy"

## Debug Response Structure

When debug mode is enabled, responses include comprehensive debugging information:

```json
{
  "results": [...],
  "filters_applied": {
    "price_min": null,
    "price_max": 20,
    "excluded_terms": ["spicy"]
  },
  "debug": {
    "semantic_query": "instant noodles",
    "raw_sql": "SELECT * FROM products WHERE is_active = TRUE AND price <= $1...",
    "parsed_constraints": {...},
    "execution_times": {...},
    "filter_decisions": [...],
    "negation_decisions": [...],
    "excluded_products": [...],
    "pipeline_steps": [...]
  }
}
```

## Production Considerations

### CloudWatch Integration
- Structured JSON logs for easy parsing
- Request correlation with unique IDs
- Performance metrics for monitoring
- Error tracking with context

### Performance Impact
- Logging is designed to be lightweight
- Debug mode can be enabled/disabled per request
- Sensitive data is sanitized before logging
- Log levels can be configured by environment

### Monitoring & Alerting
- Filter decision patterns can be monitored
- Performance degradation alerts
- Error rate monitoring
- Customer transparency metrics

## Usage in Pipeline Components

Each pipeline component integrates with the logging system:

1. **QueryRewriter**: Logs extraction decisions and patterns found
2. **FilterMapper**: Logs mapping decisions and validation
3. **HybridRetriever**: Logs SQL generation and execution
4. **ResultFormatter**: Logs formatting decisions and transparency messages

This comprehensive logging ensures complete visibility into every decision made by the search pipeline, enabling effective debugging, monitoring, and customer transparency as required by the specifications.