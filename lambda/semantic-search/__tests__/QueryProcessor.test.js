/**
 * Tests for QueryProcessor integration
 */

const QueryProcessor = require('../src/pipeline/QueryProcessor');

describe('QueryProcessor Integration', () => {
  let queryProcessor;
  
  beforeEach(() => {
    queryProcessor = new QueryProcessor();
  });
  
  describe('Price constraint extraction', () => {
    test('should extract "under X" price constraints', () => {
      const result = queryProcessor.processQuery('noodles under 20 pesos');
      
      expect(result.semantic_query).toBeTruthy();
      expect(result.price_max).toBe(20);
      expect(result.price_min).toBeNull();
      expect(result.has_price_filter).toBe(true);
    });
    
    test('should extract "above X" price constraints', () => {
      const result = queryProcessor.processQuery('rice cooker above 50 pesos');
      
      expect(result.semantic_query).toBeTruthy();
      expect(result.price_min).toBe(50);
      expect(result.price_max).toBeNull();
      expect(result.has_price_filter).toBe(true);
    });
    
    test('should extract "between X and Y" price constraints', () => {
      const result = queryProcessor.processQuery('tools between 20 and 50 pesos');
      
      expect(result.semantic_query).toBeTruthy();
      expect(result.price_min).toBe(20);
      expect(result.price_max).toBe(50);
      expect(result.has_price_filter).toBe(true);
    });
    
    test('should handle queries without price constraints', () => {
      const result = queryProcessor.processQuery('instant noodles');
      
      expect(result.semantic_query).toBe('instant noodles');
      expect(result.price_min).toBeNull();
      expect(result.price_max).toBeNull();
      expect(result.has_price_filter).toBe(false);
    });
  });
  
  describe('Negation extraction', () => {
    test('should extract negated terms', () => {
      const result = queryProcessor.processQuery('noodles no spicy avoid dairy');
      
      expect(result.negated_terms).toContain('spicy');
      expect(result.negated_terms).toContain('dairy');
      expect(result.has_negations).toBe(true);
    });
    
    test('should handle queries without negations', () => {
      const result = queryProcessor.processQuery('instant noodles');
      
      expect(result.negated_terms).toEqual([]);
      expect(result.has_negations).toBe(false);
    });
  });
  
  describe('Semantic query extraction', () => {
    test('should clean price terms from semantic query', () => {
      const result = queryProcessor.processQuery('instant noodles under 20 pesos');
      
      expect(result.semantic_query).not.toContain('under');
      expect(result.semantic_query).not.toContain('20');
      expect(result.semantic_query).toContain('noodles');
    });
    
    test('should clean negation terms from semantic query', () => {
      const result = queryProcessor.processQuery('noodles no spicy');
      
      expect(result.semantic_query).not.toContain('no spicy');
      expect(result.semantic_query).toContain('noodles');
    });
  });
  
  describe('Negation filtering', () => {
    test('should filter out products with negated terms', () => {
      const mockResults = [
        { name: 'Spicy Noodles', description: 'Hot and spicy instant noodles' },
        { name: 'Mild Noodles', description: 'Gentle flavor noodles' },
        { name: 'Sweet Noodles', description: 'Sweet flavored noodles' }
      ];
      
      const filtered = queryProcessor.applyNegationFiltering(mockResults, ['spicy']);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.find(r => r.name === 'Spicy Noodles')).toBeUndefined();
      expect(filtered.find(r => r.name === 'Mild Noodles')).toBeDefined();
    });
    
    test('should return all results when no negations', () => {
      const mockResults = [
        { name: 'Product 1', description: 'Description 1' },
        { name: 'Product 2', description: 'Description 2' }
      ];
      
      const filtered = queryProcessor.applyNegationFiltering(mockResults, []);
      
      expect(filtered).toHaveLength(2);
      expect(filtered).toEqual(mockResults);
    });
  });
  
  describe('Input validation', () => {
    test('should throw error for empty query', () => {
      expect(() => queryProcessor.processQuery('')).toThrow();
    });
    
    test('should throw error for non-string query', () => {
      expect(() => queryProcessor.processQuery(null)).toThrow();
    });
  });
});