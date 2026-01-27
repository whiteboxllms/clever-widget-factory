const { handler } = require('./index');

// Mock dependencies
jest.mock('../shared/db');
jest.mock('../shared/auth');
jest.mock('../shared/embeddings');

const { query } = require('../shared/db');
const { getAuthorizerContext } = require('../shared/auth');
const { generateEmbeddingV1 } = require('../shared/embeddings');

describe('Unified Search Lambda', () => {
  const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEmbedding = new Array(1536).fill(0.1);
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    getAuthorizerContext.mockReturnValue({
      organization_id: mockOrganizationId,
      user_id: 'user-123'
    });
    
    generateEmbeddingV1.mockResolvedValue(mockEmbedding);
  });

  describe('HTTP Method Handling', () => {
    test('should handle OPTIONS request with CORS response', async () => {
      const event = { httpMethod: 'OPTIONS' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    test('should reject non-POST requests', async () => {
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Authorization', () => {
    test('should return 401 when organization_id is missing', async () => {
      getAuthorizerContext.mockReturnValue({});
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test query' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Request Validation', () => {
    test('should return 400 when query is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({})
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('query is required');
    });

    test('should return 400 when limit exceeds 100', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test', limit: 150 })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('limit cannot exceed 100');
    });
  });

  describe('Successful Search', () => {
    test('should perform search with valid query', async () => {
      const mockResults = [
        {
          entity_type: 'part',
          entity_id: 'part-123',
          embedding_source: 'Banana Wine. Fermented banana beverage.',
          distance: 0.1,
          similarity: 0.9
        },
        {
          entity_type: 'tool',
          entity_id: 'tool-456',
          embedding_source: 'Hammer. Tool for driving nails.',
          distance: 0.2,
          similarity: 0.8
        }
      ];
      
      query.mockResolvedValue(mockResults);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'banana wine' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.results).toEqual(mockResults);
      expect(body.data.query).toBe('banana wine');
      expect(body.data.count).toBe(2);
      expect(body.data.entity_types).toBe('all');
      
      // Verify embedding generation was called
      expect(generateEmbeddingV1).toHaveBeenCalledWith('banana wine');
      
      // Verify database query was called
      expect(query).toHaveBeenCalled();
      const sqlQuery = query.mock.calls[0][0];
      expect(sqlQuery).toContain('unified_embeddings');
      expect(sqlQuery).toContain(mockOrganizationId);
      expect(sqlQuery).toContain('ORDER BY distance');
      expect(sqlQuery).toContain('LIMIT 10');
    });

    test('should apply entity_types filter when specified', async () => {
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ 
          query: 'test', 
          entity_types: ['part', 'tool'] 
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.entity_types).toEqual(['part', 'tool']);
      
      // Verify SQL includes entity type filter
      const sqlQuery = query.mock.calls[0][0];
      expect(sqlQuery).toContain("entity_type IN ('part','tool')");
    });

    test('should respect custom limit parameter', async () => {
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test', limit: 50 })
      };
      
      await handler(event);
      
      const sqlQuery = query.mock.calls[0][0];
      expect(sqlQuery).toContain('LIMIT 50');
    });

    test('should use default limit of 10 when not specified', async () => {
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      await handler(event);
      
      const sqlQuery = query.mock.calls[0][0];
      expect(sqlQuery).toContain('LIMIT 10');
    });
  });

  describe('Error Handling', () => {
    test('should handle embedding generation errors', async () => {
      generateEmbeddingV1.mockRejectedValue(new Error('Bedrock API error'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Bedrock API error');
    });

    test('should handle database query errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Database connection failed');
    });

    test('should provide specific error for dimension mismatch', async () => {
      query.mockRejectedValue(new Error('Vector dimensions do not match'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Vector dimension mismatch');
    });

    test('should provide specific error for missing pgvector extension', async () => {
      query.mockRejectedValue(new Error('operator does not exist: vector <=> vector'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Vector search not available');
      expect(body.error).toContain('pgvector extension');
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should escape single quotes in organization_id', async () => {
      getAuthorizerContext.mockReturnValue({
        organization_id: "test'org"
      });
      
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      await handler(event);
      
      const sqlQuery = query.mock.calls[0][0];
      expect(sqlQuery).toContain("test''org");
    });

    test('should escape single quotes in entity_types', async () => {
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ 
          query: 'test', 
          entity_types: ["part'test"] 
        })
      };
      
      await handler(event);
      
      const sqlQuery = query.mock.calls[0][0];
      expect(sqlQuery).toContain("part''test");
    });
  });

  describe('Response Format', () => {
    test('should return all required fields in results', async () => {
      const mockResults = [
        {
          entity_type: 'part',
          entity_id: 'part-123',
          embedding_source: 'Test part',
          distance: 0.1,
          similarity: 0.9
        }
      ];
      
      query.mockResolvedValue(mockResults);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({ query: 'test' })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.data).toHaveProperty('results');
      expect(body.data).toHaveProperty('query');
      expect(body.data).toHaveProperty('entity_types');
      expect(body.data).toHaveProperty('count');
      
      const result = body.data.results[0];
      expect(result).toHaveProperty('entity_type');
      expect(result).toHaveProperty('entity_id');
      expect(result).toHaveProperty('embedding_source');
      expect(result).toHaveProperty('similarity');
    });
  });
});
