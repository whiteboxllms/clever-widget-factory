const QueryRewriter = require('../src/pipeline/QueryRewriter');
const { QueryComponents } = require('../src/models');

// Mock LLM client for testing
class MockLLMClient {
    constructor(shouldFail = false, response = null) {
        this.shouldFail = shouldFail;
        this.response = response;
    }

    async generate(options) {
        if (this.shouldFail) {
            throw new Error('LLM service unavailable');
        }
        return this.response || '{"semantic_query": "test product", "price_min": null, "price_max": null, "negated_terms": null}';
    }
}

describe('QueryRewriter', () => {
    let queryRewriter;
    let mockLLM;

    beforeEach(() => {
        mockLLM = new MockLLMClient();
        queryRewriter = new QueryRewriter(mockLLM);
    });

    describe('Basic functionality', () => {
        test('should create QueryRewriter instance', () => {
            expect(queryRewriter).toBeInstanceOf(QueryRewriter);
            expect(queryRewriter.llmClient).toBe(mockLLM);
        });

        test('should validate input query', async () => {
            await expect(queryRewriter.rewrite('')).rejects.toThrow('Raw query must be a non-empty string');
            await expect(queryRewriter.rewrite(null)).rejects.toThrow('Raw query must be a non-empty string');
            await expect(queryRewriter.rewrite('   ')).rejects.toThrow('Raw query cannot be empty or whitespace only');
        });
    });

    describe('Price pattern extraction', () => {
        beforeEach(() => {
            // Use fallback mode for predictable testing
            queryRewriter = new QueryRewriter(new MockLLMClient(true), { fallbackToRegex: true });
        });

        test('should extract "under X pesos" pattern', async () => {
            const result = await queryRewriter.rewrite('instant noodles under 20 pesos');
            expect(result.semantic_query).toBe('instant noodles');
            expect(result.price_min).toBeNull();
            expect(result.price_max).toBe(20);
        });

        test('should extract "above X pesos" pattern', async () => {
            const result = await queryRewriter.rewrite('rice above 50 pesos');
            expect(result.semantic_query).toBe('rice');
            expect(result.price_min).toBe(50);
            expect(result.price_max).toBeNull();
        });

        test('should extract "between X and Y pesos" pattern', async () => {
            const result = await queryRewriter.rewrite('tools between 20 and 50 pesos');
            expect(result.semantic_query).toBe('tools');
            expect(result.price_min).toBe(20);
            expect(result.price_max).toBe(50);
        });

        test('should handle "X to Y pesos" pattern', async () => {
            const result = await queryRewriter.rewrite('gadgets 100 to 200 pesos');
            expect(result.semantic_query).toBe('gadgets');
            expect(result.price_min).toBe(100);
            expect(result.price_max).toBe(200);
        });

        test('should handle reversed price ranges', async () => {
            const result = await queryRewriter.rewrite('items between 100 and 50 pesos');
            expect(result.price_min).toBe(50);
            expect(result.price_max).toBe(100);
        });

        test('should handle no price constraints', async () => {
            const result = await queryRewriter.rewrite('instant noodles');
            expect(result.semantic_query).toBe('instant noodles');
            expect(result.price_min).toBeNull();
            expect(result.price_max).toBeNull();
        });

        test('should handle currency symbols', async () => {
            const result = await queryRewriter.rewrite('snacks ₱25 to ₱50');
            expect(result.price_min).toBe(25);
            expect(result.price_max).toBe(50);
        });
    });

    describe('Negation detection', () => {
        beforeEach(() => {
            queryRewriter = new QueryRewriter(new MockLLMClient(true), { fallbackToRegex: true });
        });

        test('should extract "no X" negations', async () => {
            const result = await queryRewriter.rewrite('noodles no spicy');
            expect(result.semantic_query).toBe('noodles');
            expect(result.negated_terms).toContain('spicy');
        });

        test('should extract "not X" negations', async () => {
            const result = await queryRewriter.rewrite('food not hot');
            expect(result.semantic_query).toBe('food');
            expect(result.negated_terms).toContain('hot');
        });

        test('should extract "avoid X" negations', async () => {
            const result = await queryRewriter.rewrite('snacks avoid dairy');
            expect(result.semantic_query).toBe('snacks');
            expect(result.negated_terms).toContain('dairy');
        });

        test('should extract "without X" negations', async () => {
            const result = await queryRewriter.rewrite('drinks without sugar');
            expect(result.semantic_query).toBe('drinks');
            expect(result.negated_terms).toContain('sugar');
        });

        test('should handle compound negations', async () => {
            const result = await queryRewriter.rewrite('food no spicy or hot');
            expect(result.negated_terms).toContain('spicy');
            expect(result.negated_terms).toContain('hot');
        });

        test('should filter out stop words from negations', async () => {
            const result = await queryRewriter.rewrite('products no the and');
            expect(result.negated_terms).toBeNull();
        });
    });

    describe('Semantic query extraction', () => {
        beforeEach(() => {
            queryRewriter = new QueryRewriter(new MockLLMClient(true), { fallbackToRegex: true });
        });

        test('should clean price patterns from semantic query', async () => {
            const result = await queryRewriter.rewrite('instant noodles under 20 pesos');
            expect(result.semantic_query).toBe('instant noodles');
            expect(result.semantic_query).not.toContain('under');
            expect(result.semantic_query).not.toContain('20');
            expect(result.semantic_query).not.toContain('pesos');
        });

        test('should clean negation patterns from semantic query', async () => {
            const result = await queryRewriter.rewrite('instant noodles no spicy flavor');
            expect(result.semantic_query).toBe('instant noodles');
            expect(result.semantic_query).not.toContain('spicy');
            expect(result.negated_terms).toContain('spicy flavor');
        });

        test('should handle complex queries with multiple patterns', async () => {
            const result = await queryRewriter.rewrite('instant noodles under 25 pesos no spicy avoid dairy');
            expect(result.semantic_query).toBe('instant noodles');
            expect(result.price_max).toBe(25);
            expect(result.negated_terms).toContain('dairy');
            expect(result.negated_terms.some(term => term.includes('spicy'))).toBe(true);
        });

        test('should provide fallback for empty semantic queries', async () => {
            const result = await queryRewriter.rewrite('under 20 pesos');
            expect(result.semantic_query).toBe('products');
            expect(result.price_max).toBe(20);
        });

        test('should normalize semantic queries', async () => {
            const result = await queryRewriter.rewrite('INSTANT   NOODLE!!!');
            expect(result.semantic_query).toBe('instant noodles');
        });
    });

    describe('LLM integration', () => {
        test('should use LLM when available', async () => {
            const mockResponse = '{"semantic_query": "instant noodles", "price_min": null, "price_max": 20, "negated_terms": ["spicy"]}';
            const llmClient = new MockLLMClient(false, mockResponse);
            const rewriter = new QueryRewriter(llmClient);

            const result = await rewriter.rewrite('instant noodles under 20 pesos no spicy');
            expect(result.semantic_query).toBe('instant noodles');
            expect(result.price_max).toBe(20);
            expect(result.negated_terms).toContain('spicy');
        });

        test('should fallback to regex when LLM fails', async () => {
            const llmClient = new MockLLMClient(true); // Will fail
            const rewriter = new QueryRewriter(llmClient, { fallbackToRegex: true });

            const result = await rewriter.rewrite('noodles under 20 pesos');
            expect(result.semantic_query).toBe('noodles');
            expect(result.price_max).toBe(20);
        });

        test('should handle malformed LLM responses', async () => {
            const llmClient = new MockLLMClient(false, 'invalid json response');
            const rewriter = new QueryRewriter(llmClient, { fallbackToRegex: true });

            const result = await rewriter.rewrite('noodles under 20 pesos');
            expect(result.semantic_query).toBe('noodles');
            expect(result.price_max).toBe(20);
        });
    });

    describe('Edge cases', () => {
        beforeEach(() => {
            queryRewriter = new QueryRewriter(new MockLLMClient(true), { fallbackToRegex: true });
        });

        test('should handle queries with only whitespace and punctuation', async () => {
            const result = await queryRewriter.rewrite('!!! ??? ...');
            expect(result.semantic_query).toBe('products');
        });

        test('should handle very long queries', async () => {
            const longQuery = 'instant noodles with chicken flavor under 25 pesos no spicy no dairy avoid msg without preservatives exclude artificial colors skip unhealthy ingredients';
            const result = await queryRewriter.rewrite(longQuery);
            expect(result.semantic_query).toContain('instant noodles');
            expect(result.price_max).toBe(25);
            expect(result.negated_terms.length).toBeGreaterThan(0);
        });

        test('should handle queries with mixed languages', async () => {
            const result = await queryRewriter.rewrite('instant noodles hindi spicy under 20 pesos');
            expect(result.semantic_query).toContain('instant noodles');
            expect(result.price_max).toBe(20);
        });

        test('should return QueryComponents instance', async () => {
            const result = await queryRewriter.rewrite('test query');
            expect(result).toBeInstanceOf(QueryComponents);
        });
    });
});