const FilterMapper = require('../src/pipeline/FilterMapper');
const { QueryComponents, SqlFilterParams } = require('../src/models');

describe('FilterMapper', () => {
    let filterMapper;

    beforeEach(() => {
        filterMapper = new FilterMapper();
    });

    describe('Basic functionality', () => {
        test('should create FilterMapper instance', () => {
            expect(filterMapper).toBeInstanceOf(FilterMapper);
        });

        test('should validate required QueryComponents', () => {
            expect(() => filterMapper.map(null)).toThrow('QueryComponents is required');
            expect(() => filterMapper.map(undefined)).toThrow('QueryComponents is required');
        });

        test('should validate QueryComponents structure', () => {
            const invalidQC = { semantic_query: null };
            expect(() => filterMapper.map(invalidQC)).toThrow('QueryComponents must have a valid semantic_query string');
        });
    });

    describe('Price constraint mapping', () => {
        test('should map price_min correctly', () => {
            const qc = new QueryComponents('test query', 10, null);
            const result = filterMapper.map(qc);
            
            expect(result).toBeInstanceOf(SqlFilterParams);
            expect(result.min_price).toBe(10);
            expect(result.max_price).toBeNull();
            expect(result.excluded_terms).toBeNull();
        });

        test('should map price_max correctly', () => {
            const qc = new QueryComponents('test query', null, 50);
            const result = filterMapper.map(qc);
            
            expect(result.min_price).toBeNull();
            expect(result.max_price).toBe(50);
            expect(result.excluded_terms).toBeNull();
        });

        test('should map both price constraints', () => {
            const qc = new QueryComponents('test query', 10, 50);
            const result = filterMapper.map(qc);
            
            expect(result.min_price).toBe(10);
            expect(result.max_price).toBe(50);
        });

        test('should handle null price constraints', () => {
            const qc = new QueryComponents('test query', null, null);
            const result = filterMapper.map(qc);
            
            expect(result.min_price).toBeNull();
            expect(result.max_price).toBeNull();
        });

        test('should validate price range consistency', () => {
            // QueryComponents constructor will catch this, so we test the FilterMapper validation
            const invalidQC = { 
                semantic_query: 'test query', 
                price_min: 50, 
                price_max: 10, 
                negated_terms: null 
            };
            expect(() => filterMapper.map(invalidQC)).toThrow('price_min cannot be greater than price_max');
        });

        test('should handle edge case where prices are equal', () => {
            const qc = new QueryComponents('test query', 25, 25);
            const result = filterMapper.map(qc);
            
            expect(result.min_price).toBe(25);
            expect(result.max_price).toBe(25);
        });
    });

    describe('Exclusion terms mapping', () => {
        test('should map negated terms to excluded terms', () => {
            const qc = new QueryComponents('test query', null, null, ['spicy', 'dairy']);
            const result = filterMapper.map(qc);
            
            expect(result.excluded_terms).toEqual(['spicy', 'dairy']);
        });

        test('should handle null negated terms', () => {
            const qc = new QueryComponents('test query', null, null, null);
            const result = filterMapper.map(qc);
            
            expect(result.excluded_terms).toBeNull();
        });

        test('should handle empty negated terms array', () => {
            const qc = new QueryComponents('test query', null, null, []);
            const result = filterMapper.map(qc);
            
            expect(result.excluded_terms).toBeNull();
        });

        test('should clean and normalize exclusion terms', () => {
            const qc = new QueryComponents('test query', null, null, ['  SPICY  ', 'Dairy', 'spicy']); // Duplicates and whitespace
            const result = filterMapper.map(qc);
            
            expect(result.excluded_terms).toEqual(['spicy', 'dairy']);
        });

        test('should filter out empty strings from negated terms', () => {
            const qc = new QueryComponents('test query', null, null, ['spicy', '', '   ', 'dairy']);
            const result = filterMapper.map(qc);
            
            expect(result.excluded_terms).toEqual(['spicy', 'dairy']);
        });
    });

    describe('Complex mapping scenarios', () => {
        test('should map all constraints together', () => {
            const qc = new QueryComponents('instant noodles', 10, 50, ['spicy', 'dairy']);
            const result = filterMapper.map(qc);
            
            expect(result.min_price).toBe(10);
            expect(result.max_price).toBe(50);
            expect(result.excluded_terms).toEqual(['spicy', 'dairy']);
        });

        test('should handle mixed null and valid constraints', () => {
            const qc = new QueryComponents('test query', 10, null, ['spicy']);
            const result = filterMapper.map(qc);
            
            expect(result.min_price).toBe(10);
            expect(result.max_price).toBeNull();
            expect(result.excluded_terms).toEqual(['spicy']);
        });

        test('should create valid SqlFilterParams that pass validation', () => {
            const qc = new QueryComponents('test query', 10, 50, ['spicy']);
            const result = filterMapper.map(qc);
            
            // Should not throw when creating new SqlFilterParams with same values
            expect(() => new SqlFilterParams(result.min_price, result.max_price, result.excluded_terms)).not.toThrow();
        });
    });

    describe('Validation options', () => {
        test('should respect validateRanges option', () => {
            const strictMapper = new FilterMapper({ validateRanges: true });
            const lenientMapper = new FilterMapper({ validateRanges: false });
            
            // This should work with both since the validation happens in QueryComponents constructor
            const qc = new QueryComponents('test query', 10, 50);
            
            expect(() => strictMapper.map(qc)).not.toThrow();
            expect(() => lenientMapper.map(qc)).not.toThrow();
        });

        test('should create strict FilterMapper', () => {
            const strictMapper = FilterMapper.strict();
            expect(strictMapper).toBeInstanceOf(FilterMapper);
            expect(strictMapper.options.validateRanges).toBe(true);
            expect(strictMapper.options.allowNullFilters).toBe(false);
        });

        test('should create lenient FilterMapper', () => {
            const lenientMapper = FilterMapper.lenient();
            expect(lenientMapper).toBeInstanceOf(FilterMapper);
            expect(lenientMapper.options.validateRanges).toBe(false);
            expect(lenientMapper.options.allowNullFilters).toBe(true);
        });

        test('should create FilterMapper with custom options', () => {
            const customMapper = FilterMapper.withOptions({ validateRanges: false });
            expect(customMapper.options.validateRanges).toBe(false);
        });
    });

    describe('Utility methods', () => {
        test('should detect filterable constraints', () => {
            const qcWithPrice = new QueryComponents('test', 10, null);
            const qcWithExclusions = new QueryComponents('test', null, null, ['spicy']);
            const qcWithBoth = new QueryComponents('test', 10, 50, ['spicy']);
            const qcWithNone = new QueryComponents('test', null, null, null);

            expect(FilterMapper.hasFilterableConstraints(qcWithPrice)).toBe(true);
            expect(FilterMapper.hasFilterableConstraints(qcWithExclusions)).toBe(true);
            expect(FilterMapper.hasFilterableConstraints(qcWithBoth)).toBe(true);
            expect(FilterMapper.hasFilterableConstraints(qcWithNone)).toBe(false);
            expect(FilterMapper.hasFilterableConstraints(null)).toBe(false);
        });

        test('should generate filter summary', () => {
            const qc = new QueryComponents('test', 10, 50, ['spicy', 'dairy']);
            const summary = FilterMapper.getFilterSummary(qc);

            expect(summary.hasPriceFilters).toBe(true);
            expect(summary.hasExclusionFilters).toBe(true);
            expect(summary.filterCount).toBe(3); // min, max, exclusions
            expect(summary.priceRange).toEqual({ min: 10, max: 50 });
            expect(summary.exclusionCount).toBe(2);
        });

        test('should generate summary for query with no filters', () => {
            const qc = new QueryComponents('test', null, null, null);
            const summary = FilterMapper.getFilterSummary(qc);

            expect(summary.hasPriceFilters).toBe(false);
            expect(summary.hasExclusionFilters).toBe(false);
            expect(summary.filterCount).toBe(0);
            expect(summary.priceRange).toBeNull();
            expect(summary.exclusionCount).toBe(0);
        });

        test('should handle null QueryComponents in summary', () => {
            const summary = FilterMapper.getFilterSummary(null);
            expect(summary.hasPriceFilters).toBe(false);
            expect(summary.hasExclusionFilters).toBe(false);
            expect(summary.filterCount).toBe(0);
        });
    });

    describe('Error handling', () => {
        test('should validate price_min type', () => {
            const invalidQC = { 
                semantic_query: 'test', 
                price_min: 'invalid', 
                price_max: null, 
                negated_terms: null 
            };
            expect(() => filterMapper.map(invalidQC)).toThrow('price_min must be a valid number or null');
        });

        test('should validate price_max type', () => {
            const invalidQC = { 
                semantic_query: 'test', 
                price_min: null, 
                price_max: 'invalid', 
                negated_terms: null 
            };
            expect(() => filterMapper.map(invalidQC)).toThrow('price_max must be a valid number or null');
        });

        test('should validate negative prices', () => {
            const invalidQC = { 
                semantic_query: 'test', 
                price_min: -10, 
                price_max: null, 
                negated_terms: null 
            };
            expect(() => filterMapper.map(invalidQC)).toThrow('price_min must be non-negative');
        });

        test('should validate negated_terms array', () => {
            const invalidQC = { 
                semantic_query: 'test', 
                price_min: null, 
                price_max: null, 
                negated_terms: 'not an array' 
            };
            expect(() => filterMapper.map(invalidQC)).toThrow('negated_terms must be an array or null');
        });

        test('should validate negated_terms content', () => {
            const invalidQC = { 
                semantic_query: 'test', 
                price_min: null, 
                price_max: null, 
                negated_terms: ['valid', 123, 'also valid'] 
            };
            expect(() => filterMapper.map(invalidQC)).toThrow('All negated_terms must be strings');
        });
    });

    describe('Integration with QueryComponents', () => {
        test('should work seamlessly with QueryComponents instances', () => {
            const qc = new QueryComponents('instant noodles', 10, 50, ['spicy']);
            const result = filterMapper.map(qc);
            
            expect(result).toBeInstanceOf(SqlFilterParams);
            expect(result.min_price).toBe(10);
            expect(result.max_price).toBe(50);
            expect(result.excluded_terms).toEqual(['spicy']);
        });

        test('should preserve QueryComponents validation', () => {
            // QueryComponents constructor should catch this
            expect(() => new QueryComponents('', 10, 50)).toThrow();
            
            // But if we somehow get invalid data, FilterMapper should catch it too
            const invalidQC = { semantic_query: '', price_min: 10, price_max: 50 };
            expect(() => filterMapper.map(invalidQC)).toThrow();
        });
    });
});