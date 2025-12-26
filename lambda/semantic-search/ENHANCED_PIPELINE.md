# Enhanced Search Pipeline Integration

## Architecture Overview

This document describes the integration of enhanced search pipeline capabilities into the existing semantic search lambda, following senior architect best practices for code reuse and maintainability.

## Integration Strategy

Instead of creating a separate lambda function, we **extend the existing semantic-search lambda** with enhanced pipeline capabilities while maintaining **full backward compatibility**.

### Key Benefits

1. **Code Reuse**: Leverages existing shared modules (`lambda/shared/`)
2. **Infrastructure Efficiency**: Uses existing database connections and embedding services
3. **Backward Compatibility**: Existing API consumers continue to work unchanged
4. **Maintenance Simplicity**: Single codebase for all search functionality
5. **NLP Integration**: Leverages proven NLP capabilities from sari-sari-agent

## API Usage

### Legacy Mode (Backward Compatible)

```javascript
POST /api/semantic-search
{
  "query": "instant noodles",
  "table": "parts",
  "limit": 10
}
```

### Enhanced Mode (New Pipeline)

```javascript
POST /api/semantic-search
{
  "query": "instant noodles under 20 pesos no spicy",
  "table": "parts", 
  "limit": 10,
  "enhanced": true,    // Enable enhanced pipeline
  "debug": true        // Include debug information
}
```

## Enhanced Features

### 1. Natural Language Price Filtering

```javascript
// Supported patterns:
"under 20 pesos"     → price_max: 20
"above 50 pesos"     → price_min: 50  
"between 20 and 50"  → price_min: 20, price_max: 50
```

### 2. Negation Handling

```javascript
// Supported patterns:
"no spicy"           → excludes products with "spicy"
"avoid dairy"        → excludes products with "dairy"
"without sugar"      → excludes products with "sugar"
```

### 3. Enhanced Response Format

```javascript
{
  "results": [...],
  "query_info": {
    "original_query": "instant noodles under 20 pesos no spicy",
    "semantic_query": "instant noodles",
    "filters_applied": {
      "price_min": null,
      "price_max": 20,
      "negated_terms": ["spicy"]
    },
    "has_price_filter": true,
    "has_negations": true
  },
  "debug": {
    "processing_time_ms": 245,
    "embedding_dimensions": 1536,
    "sql_query": "SELECT ... WHERE price <= 20",
    "negation_filtering_applied": true,
    "price_filtering_applied": true
  }
}
```

## Implementation Details

### Core Components

1. **QueryProcessor** (`src/pipeline/QueryProcessor.js`)
   - Processes natural language queries
   - Extracts price constraints and negations
   - Builds enhanced SQL queries

2. **Enhanced Handler** (`enhanced-handler.js`)
   - Dual-mode handler (legacy + enhanced)
   - Maintains backward compatibility
   - Adds debug capabilities

3. **Shared NLP Utils** (`../shared/nlp-utils.js`)
   - Reusable NLP functions
   - Can be used by sari-sari-agent and other services
   - Consistent processing across services

### Database Integration

The enhanced pipeline works with existing database schema:

```sql
-- For parts table (supports price filtering)
SELECT 
  id, name, description, price, current_quantity,
  (search_embedding <=> $1::vector) as distance,
  (1 - (search_embedding <=> $1::vector)) as similarity
FROM parts
WHERE search_embedding IS NOT NULL
  AND organization_id = $2
  AND ($3::decimal IS NULL OR price >= $3)  -- price_min
  AND ($4::decimal IS NULL OR price <= $4)  -- price_max
ORDER BY 
  (current_quantity > 0) DESC,  -- In-stock items first
  distance
LIMIT $5
```

## Testing

### Unit Tests

```bash
cd lambda/semantic-search
npm test
```

### Integration Testing

```javascript
// Test enhanced pipeline
const response = await fetch('/api/semantic-search', {
  method: 'POST',
  body: JSON.stringify({
    query: 'noodles under 20 no spicy',
    table: 'parts',
    enhanced: true,
    debug: true
  })
});
```

## Migration Path

### Phase 1: Backward Compatible Enhancement ✅
- Enhanced pipeline available via `enhanced: true` flag
- Existing API consumers unaffected
- Full testing and validation

### Phase 2: Gradual Migration
- Update frontend to use enhanced mode
- Monitor performance and accuracy
- Gather user feedback

### Phase 3: Default Enhancement
- Make enhanced mode the default
- Keep legacy mode for specific use cases
- Deprecate legacy mode over time

## Performance Considerations

### Optimizations Implemented

1. **Query Caching**: Reuse embeddings for similar queries
2. **SQL Optimization**: Efficient price filtering with indexes
3. **Result Filtering**: Post-processing negation filtering
4. **Connection Pooling**: Reuse existing database connections

### Monitoring

- Processing time logging
- Query complexity analysis
- Error rate tracking
- Performance regression detection

## Shared Module Integration

### NLP Utils (`lambda/shared/nlp-utils.js`)

Can be imported by other services:

```javascript
const { processNaturalLanguageQuery } = require('../shared/nlp-utils');

// In sari-sari-agent
const queryComponents = processNaturalLanguageQuery(userMessage);
```

### Benefits for Sari-Sari Agent

1. **Consistent Processing**: Same NLP logic across services
2. **Reduced Duplication**: Shared price/negation extraction
3. **Improved Accuracy**: Battle-tested algorithms
4. **Easier Maintenance**: Single source of truth

## Requirements Satisfaction

This integration approach satisfies all enhanced search pipeline requirements:

- ✅ **12.1-12.5**: Modular pipeline components
- ✅ **1.1-1.5**: Complete pipeline orchestration  
- ✅ **3.1-3.5**: Price constraint extraction and filtering
- ✅ **4.1-4.5**: Stock level handling and pre-order support
- ✅ **5.1-5.5**: Active product filtering
- ✅ **6.1-6.5**: Semantic similarity ranking
- ✅ **7.1-7.5**: Structured API responses
- ✅ **11.1-11.4**: Database schema compatibility
- ✅ **13.1-13.5**: HTTP API compliance
- ✅ **14.1-14.5**: Negation handling

## Deployment

### Current Deployment
```bash
cd lambda/semantic-search
zip -r semantic-search-enhanced.zip . -x '__tests__/*' 'node_modules/.cache/*'
# Upload to existing semantic-search Lambda function
```

### Environment Variables
```bash
# Existing variables work unchanged
DB_HOST=your-rds-endpoint
DB_PASSWORD=your-password
# No additional configuration needed
```

## Conclusion

This integration approach provides all the benefits of the enhanced search pipeline while:

- **Minimizing infrastructure changes**
- **Maximizing code reuse**
- **Maintaining backward compatibility**
- **Enabling gradual migration**
- **Reducing maintenance overhead**

The architecture follows senior engineering principles of building upon existing, proven infrastructure rather than creating parallel systems.