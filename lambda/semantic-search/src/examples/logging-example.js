/**
 * Example demonstrating comprehensive logging capabilities
 * Shows how filters and decisions are logged throughout the pipeline
 */

const { 
    QueryComponents, 
    SqlFilterParams, 
    ProductResult, 
    FiltersApplied, 
    DebugInfo, 
    SearchResponse,
    SearchLogger
} = require('../models');

/**
 * Example of comprehensive logging throughout a search pipeline
 */
function demonstrateLogging() {
    console.log('=== Enhanced Search Pipeline Logging Example ===\n');

    // 1. Initialize logger for request
    const logger = new SearchLogger('req-20241221-001', true);
    
    // 2. Log initial search request
    logger.logSearchRequest('instant noodles under 20 pesos no spicy', {
        store_id: 'store-123',
        user_id: 'user-456'
    });

    // 3. Create query components (simulating QueryRewriter output)
    const queryComponents = new QueryComponents(
        'instant noodles',
        null,
        20,
        ['spicy']
    );

    // 4. Log query rewriting results
    logger.logQueryRewriting(queryComponents, 'instant noodles under 20 pesos no spicy', {
        price_patterns_found: ['under 20 pesos'],
        negation_patterns_found: ['no spicy'],
        semantic_terms_extracted: ['instant', 'noodles']
    });

    // 5. Create SQL filter parameters (simulating FilterMapper output)
    const sqlFilters = new SqlFilterParams(null, 20, ['spicy']);

    // 6. Log filter mapping
    logger.logFilterMapping(sqlFilters, queryComponents);

    // 7. Create debug info and log filter decisions
    const debugInfo = new DebugInfo(
        'instant noodles',
        'SELECT * FROM products WHERE is_active = TRUE AND price <= $1 ORDER BY embedding <=> $2',
        {
            price_max: 20,
            negated_terms: ['spicy']
        }
    );

    // 8. Log specific filter decisions
    debugInfo.logFilterDecision(
        'price',
        'applied',
        'Maximum price filter applied from user query "under 20 pesos"',
        {
            extracted_value: 20,
            filter_type: 'maximum_only',
            sql_condition: 'price <= $1'
        }
    );

    debugInfo.logFilterDecision(
        'active',
        'applied',
        'Active product filter always applied for customer searches',
        {
            sql_condition: 'is_active = TRUE',
            reason: 'business_rule'
        }
    );

    // 9. Simulate negation filtering decisions
    const evaluatedProducts = [
        { id: 'prod-1', name: 'Mild Instant Noodles', description: 'Gentle flavor noodles' },
        { id: 'prod-2', name: 'Spicy Hot Noodles', description: 'Extra spicy chili flavor noodles' },
        { id: 'prod-3', name: 'Regular Noodles', description: 'Classic chicken flavor' }
    ];

    // Log negation decisions for each product
    evaluatedProducts.forEach(product => {
        const similarity = product.description.toLowerCase().includes('spicy') ? 0.9 : 0.1;
        const excluded = similarity > 0.7;
        
        debugInfo.logNegationDecision(
            'spicy',
            product.id,
            product.description,
            similarity,
            excluded,
            excluded ? 'High similarity to negated term "spicy"' : 'Low similarity, product included'
        );

        if (excluded) {
            debugInfo.logExcludedProduct(
                product.id,
                product.name,
                'negation filter: spicy',
                {
                    similarity_score: similarity,
                    negated_term: 'spicy',
                    threshold: 0.7
                }
            );
        }
    });

    // 10. Log negation filtering summary
    const excludedProducts = evaluatedProducts.filter(p => 
        p.description.toLowerCase().includes('spicy')
    );
    
    logger.logNegationFiltering(
        'spicy',
        evaluatedProducts,
        excludedProducts,
        0.7
    );

    // 11. Log SQL execution
    logger.logSqlExecution(
        'SELECT * FROM products WHERE is_active = TRUE AND price <= $1 ORDER BY embedding <=> $2 LIMIT 20',
        { price_max: 20, query_embedding: '[vector data]' },
        2,
        45
    );

    // 12. Create final results
    const results = [
        new ProductResult('prod-1', 'Mild Instant Noodles', 'Gentle flavor noodles', 15, 10, true, 'In stock', 0.92),
        new ProductResult('prod-3', 'Regular Noodles', 'Classic chicken flavor', 18, 5, true, 'In stock', 0.88)
    ];

    const filtersApplied = new FiltersApplied(null, 20, ['spicy']);
    
    // Log filter application
    filtersApplied.logFilterApplication(debugInfo, 'filter_mapper');

    // 13. Create search response
    const searchResponse = new SearchResponse(results, filtersApplied, debugInfo);

    // 14. Log final results
    logger.logSearchResults(searchResponse, 150);

    // 15. Demonstrate transparency message
    console.log('\n=== Negation Transparency Message ===');
    console.log(debugInfo.getNegationTransparencyMessage());

    // 16. Show filter decision summary
    console.log('\n=== Filter Decision Summary ===');
    console.log(JSON.stringify(debugInfo.getFilterDecisionSummary(), null, 2));

    // 17. Show detailed filter info
    console.log('\n=== Detailed Filter Information ===');
    console.log(JSON.stringify(filtersApplied.getDetailedFilterInfo(), null, 2));

    // 18. Show complete debug info
    console.log('\n=== Complete Debug Information ===');
    console.log(JSON.stringify(debugInfo.toObject(), null, 2));

    console.log('\n=== Logging Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
    demonstrateLogging();
}

module.exports = { demonstrateLogging };