const { 
    QueryComponents, 
    SqlFilterParams, 
    ProductResult, 
    FiltersApplied, 
    DebugInfo, 
    SearchResponse,
    SearchLogger
} = require('../src/models');

describe('Data Models', () => {
    describe('QueryComponents', () => {
        test('should create valid QueryComponents instance', () => {
            const qc = new QueryComponents('instant noodles', 10, 50, ['spicy']);
            expect(qc.semantic_query).toBe('instant noodles');
            expect(qc.price_min).toBe(10);
            expect(qc.price_max).toBe(50);
            expect(qc.negated_terms).toEqual(['spicy']);
        });

        test('should validate semantic_query is required', () => {
            expect(() => new QueryComponents('')).toThrow('semantic_query is required and must be a non-empty string');
            expect(() => new QueryComponents(null)).toThrow('semantic_query is required and must be a non-empty string');
            expect(() => new QueryComponents('   ')).toThrow('semantic_query cannot be empty or whitespace only');
        });

        test('should validate price constraints are non-negative', () => {
            expect(() => new QueryComponents('test', -1)).toThrow('price_min must be non-negative');
            expect(() => new QueryComponents('test', null, -1)).toThrow('price_max must be non-negative');
        });

        test('should validate price range consistency', () => {
            expect(() => new QueryComponents('test', 50, 10)).toThrow('price_min cannot be greater than price_max');
        });
    });

    describe('SqlFilterParams', () => {
        test('should create valid SqlFilterParams instance', () => {
            const sfp = new SqlFilterParams(10, 50, ['dairy']);
            expect(sfp.min_price).toBe(10);
            expect(sfp.max_price).toBe(50);
            expect(sfp.excluded_terms).toEqual(['dairy']);
        });

        test('should validate price range consistency', () => {
            expect(() => new SqlFilterParams(50, 10)).toThrow('min_price cannot be greater than max_price');
        });

        test('should check if filters are applied', () => {
            const sfp1 = new SqlFilterParams(10, null);
            expect(sfp1.hasPriceFilters()).toBe(true);
            expect(sfp1.hasFilters()).toBe(true);

            const sfp2 = new SqlFilterParams();
            expect(sfp2.hasPriceFilters()).toBe(false);
            expect(sfp2.hasFilters()).toBe(false);
        });
    });

    describe('ProductResult', () => {
        test('should create valid ProductResult instance', () => {
            const pr = new ProductResult(
                'prod-123',
                'Instant Noodles',
                'Delicious instant noodles',
                25.50,
                10,
                true,
                'In stock',
                0.85
            );
            expect(pr.id).toBe('prod-123');
            expect(pr.name).toBe('Instant Noodles');
            expect(pr.price).toBe(25.50);
            expect(pr.in_stock).toBe(true);
        });

        test('should validate stock consistency', () => {
            expect(() => new ProductResult(
                'prod-123', 'Test', null, 25, 0, true, 'In stock', 0.5
            )).toThrow('in_stock must be consistent with stock_level');
        });

        test('should validate status label consistency', () => {
            expect(() => new ProductResult(
                'prod-123', 'Test', null, 25, 5, true, 'Wrong label', 0.5
            )).toThrow('status_label must be "In stock"');
        });

        test('should create from database row', () => {
            const row = {
                id: 'prod-123',
                name: 'Test Product',
                description: 'Test description',
                price: '25.50',
                stock_level: '0',
                similarity_score: '0.75'
            };
            const pr = ProductResult.fromDatabaseRow(row);
            expect(pr.price).toBe(25.50);
            expect(pr.stock_level).toBe(0);
            expect(pr.in_stock).toBe(false);
            expect(pr.status_label).toBe('Out of stock – available for pre-order');
        });
    });

    describe('SearchResponse', () => {
        test('should create valid SearchResponse instance', () => {
            const results = [
                new ProductResult('1', 'Product 1', null, 10, 5, true, 'In stock', 0.9),
                new ProductResult('2', 'Product 2', null, 20, 0, false, 'Out of stock – available for pre-order', 0.8)
            ];
            const filters = new FiltersApplied(null, 50);
            const debug = new DebugInfo('test query', 'SELECT * FROM products', {});

            const response = new SearchResponse(results, filters, debug);
            expect(response.results).toHaveLength(2);
            expect(response.getResultCount()).toBe(2);
            expect(response.getInStockResults()).toHaveLength(1);
            expect(response.getOutOfStockResults()).toHaveLength(1);
        });

        test('should validate results array', () => {
            const filters = new FiltersApplied();
            expect(() => new SearchResponse('not array', filters)).toThrow('results must be an array');
            expect(() => new SearchResponse([{}], filters)).toThrow('must be a ProductResult instance');
        });

        test('should generate summary statistics', () => {
            const results = [
                new ProductResult('1', 'Product 1', null, 10, 5, true, 'In stock', 0.9),
                new ProductResult('2', 'Product 2', null, 30, 0, false, 'Out of stock – available for pre-order', 0.8)
            ];
            const filters = new FiltersApplied();
            const response = new SearchResponse(results, filters);
            
            const summary = response.getSummary();
            expect(summary.total_results).toBe(2);
            expect(summary.in_stock_count).toBe(1);
            expect(summary.out_of_stock_count).toBe(1);
            expect(summary.price_range.min).toBe(10);
            expect(summary.price_range.max).toBe(30);
            expect(summary.price_range.average).toBe(20);
        });
    });

    describe('DebugInfo Enhanced Logging', () => {
        test('should log filter decisions', () => {
            const debug = new DebugInfo('test query', 'SELECT * FROM products', {});
            
            debug.logFilterDecision('price', 'applied', 'Price filter from user query', {
                min_price: 10,
                max_price: 50
            });

            expect(debug.filter_decisions).toHaveLength(1);
            expect(debug.filter_decisions[0].filter_type).toBe('price');
            expect(debug.filter_decisions[0].decision).toBe('applied');
        });

        test('should log negation decisions', () => {
            const debug = new DebugInfo('test query', 'SELECT * FROM products', {});
            
            debug.logNegationDecision('spicy', 'prod-123', 'Hot sauce with chili', 0.85, true, 'High similarity to negated term');

            expect(debug.negation_decisions).toHaveLength(1);
            expect(debug.negation_decisions[0].excluded).toBe(true);
            expect(debug.negation_decisions[0].similarity_score).toBe(0.85);
        });

        test('should generate negation transparency message', () => {
            const debug = new DebugInfo('test query', 'SELECT * FROM products', {});
            
            debug.logNegationDecision('spicy', 'prod-1', 'Hot sauce', 0.9, true, 'Excluded');
            debug.logExcludedProduct('prod-1', 'Hot sauce', 'negation filter: spicy');
            
            const message = debug.getNegationTransparencyMessage();
            expect(message).toContain('We excluded');
            expect(message).toContain('spicy');
        });
    });

    describe('SearchLogger', () => {
        test('should create logger with request ID', () => {
            const logger = new SearchLogger('req-123', true);
            expect(logger.request_id).toBe('req-123');
            expect(logger.debug_enabled).toBe(true);
        });

        test('should log pipeline steps', () => {
            const logger = new SearchLogger('req-123');
            
            // Mock console.log to capture output
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            logger.logPipelineStep('query_rewriting', 'completed', 50, { extracted_terms: 2 });
            
            expect(consoleSpy).toHaveBeenCalled();
            const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
            expect(loggedData.event_type).toBe('pipeline_step');
            expect(loggedData.step_name).toBe('query_rewriting');
            expect(loggedData.duration_ms).toBe(50);
            
            consoleSpy.mockRestore();
        });
    });

    describe('FiltersApplied Enhanced Logging', () => {
        test('should provide detailed filter information', () => {
            const filters = new FiltersApplied(10, 50, ['spicy', 'dairy']);
            const info = filters.getDetailedFilterInfo();
            
            expect(info.price_filtering.enabled).toBe(true);
            expect(info.price_filtering.range_type).toBe('range');
            expect(info.negation_filtering.enabled).toBe(true);
            expect(info.negation_filtering.exclusion_count).toBe(2);
        });

        test('should log filter application', () => {
            const filters = new FiltersApplied(null, 100);
            const debug = new DebugInfo('test', 'SELECT * FROM products', {});
            
            filters.logFilterApplication(debug, 'query_rewriter');
            
            expect(debug.filter_decisions).toHaveLength(1);
            expect(debug.filter_decisions[0].filter_type).toBe('price');
        });
    });
});