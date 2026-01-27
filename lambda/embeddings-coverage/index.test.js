const { handler } = require('./index');

// Mock dependencies
jest.mock('../shared/db');
jest.mock('../shared/auth');

const { query } = require('../shared/db');
const { getAuthorizerContext } = require('../shared/auth');

describe('Embeddings Coverage Lambda', () => {
  const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174000';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    getAuthorizerContext.mockReturnValue({
      organization_id: mockOrganizationId,
      user_id: 'user-123'
    });
  });

  describe('HTTP Method Handling', () => {
    test('should handle OPTIONS request with CORS response', async () => {
      const event = { httpMethod: 'OPTIONS' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    test('should reject non-GET requests', async () => {
      const event = { httpMethod: 'POST' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Authorization', () => {
    test('should return 401 when organization_id is missing', async () => {
      getAuthorizerContext.mockReturnValue({});
      
      const event = { httpMethod: 'GET' };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Response Format', () => {
    test('should return correct format with embeddings data', async () => {
      // Mock embedding counts by entity_type and model_version
      const mockCounts = [
        { entity_type: 'part', model_version: 'titan-v1', count: '50' },
        { entity_type: 'tool', model_version: 'titan-v1', count: '30' },
        { entity_type: 'action', model_version: 'titan-v1', count: '20' }
      ];
      
      // Mock total entity counts from source tables
      const mockTotals = [
        { entity_type: 'part', total: '100' },
        { entity_type: 'tool', total: '60' },
        { entity_type: 'action', total: '40' },
        { entity_type: 'issue', total: '10' },
        { entity_type: 'policy', total: '5' }
      ];
      
      // First call returns counts, second call returns totals
      query
        .mockResolvedValueOnce(mockCounts)
        .mockResolvedValueOnce(mockTotals);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify response structure
      expect(body.data).toHaveProperty('counts');
      expect(body.data).toHaveProperty('coverage');
      expect(body.data).toHaveProperty('total_embeddings');
      
      // Verify counts format
      expect(body.data.counts).toHaveLength(3);
      expect(body.data.counts[0]).toEqual({
        entity_type: 'part',
        model_version: 'titan-v1',
        count: 50
      });
      
      // Verify coverage format
      expect(body.data.coverage).toHaveLength(5);
      expect(body.data.coverage[0]).toEqual({
        entity_type: 'part',
        total_entities: 100,
        embeddings_count: 50,
        coverage_percentage: 50.00
      });
      
      // Verify total embeddings
      expect(body.data.total_embeddings).toBe(100); // 50 + 30 + 20
    });

    test('should handle no embeddings case', async () => {
      query
        .mockResolvedValueOnce([]) // No embeddings
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '100' },
          { entity_type: 'tool', total: '60' },
          { entity_type: 'action', total: '40' },
          { entity_type: 'issue', total: '10' },
          { entity_type: 'policy', total: '5' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.data.counts).toEqual([]);
      expect(body.data.total_embeddings).toBe(0);
      
      // All coverage should be 0%
      body.data.coverage.forEach(c => {
        expect(c.embeddings_count).toBe(0);
        expect(c.coverage_percentage).toBe(0.00);
      });
    });

    test('should handle partial coverage', async () => {
      query
        .mockResolvedValueOnce([
          { entity_type: 'part', model_version: 'titan-v1', count: '25' }
        ])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '100' },
          { entity_type: 'tool', total: '60' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Part has 25% coverage
      const partCoverage = body.data.coverage.find(c => c.entity_type === 'part');
      expect(partCoverage.coverage_percentage).toBe(25.00);
      
      // Tool has 0% coverage
      const toolCoverage = body.data.coverage.find(c => c.entity_type === 'tool');
      expect(toolCoverage.coverage_percentage).toBe(0.00);
    });

    test('should handle 100% coverage', async () => {
      query
        .mockResolvedValueOnce([
          { entity_type: 'part', model_version: 'titan-v1', count: '100' },
          { entity_type: 'tool', model_version: 'titan-v1', count: '60' },
          { entity_type: 'action', model_version: 'titan-v1', count: '40' },
          { entity_type: 'issue', model_version: 'titan-v1', count: '10' },
          { entity_type: 'policy', model_version: 'titan-v1', count: '5' }
        ])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '100' },
          { entity_type: 'tool', total: '60' },
          { entity_type: 'action', total: '40' },
          { entity_type: 'issue', total: '10' },
          { entity_type: 'policy', total: '5' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // All entity types should have 100% coverage
      body.data.coverage.forEach(c => {
        expect(c.coverage_percentage).toBe(100.00);
      });
      
      expect(body.data.total_embeddings).toBe(215); // 100 + 60 + 40 + 10 + 5
    });
  });

  describe('Coverage Calculation', () => {
    test('should calculate coverage percentage correctly', async () => {
      query
        .mockResolvedValueOnce([
          { entity_type: 'part', model_version: 'titan-v1', count: '33' }
        ])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '100' },
          { entity_type: 'tool', total: '0' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      const partCoverage = body.data.coverage.find(c => c.entity_type === 'part');
      expect(partCoverage.coverage_percentage).toBe(33.00);
    });

    test('should handle multiple model versions for same entity type', async () => {
      query
        .mockResolvedValueOnce([
          { entity_type: 'part', model_version: 'titan-v1', count: '30' },
          { entity_type: 'part', model_version: 'titan-v2', count: '20' }
        ])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '100' },
          { entity_type: 'tool', total: '0' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should sum embeddings across all model versions
      const partCoverage = body.data.coverage.find(c => c.entity_type === 'part');
      expect(partCoverage.embeddings_count).toBe(50); // 30 + 20
      expect(partCoverage.coverage_percentage).toBe(50.00);
      
      // Total embeddings should include both versions
      expect(body.data.total_embeddings).toBe(50);
    });

    test('should handle zero total entities gracefully', async () => {
      query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '0' },
          { entity_type: 'tool', total: '0' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // All coverage should be 0% when there are no entities
      body.data.coverage.forEach(c => {
        expect(c.total_entities).toBe(0);
        expect(c.embeddings_count).toBe(0);
        expect(c.coverage_percentage).toBe(0.00);
      });
    });
  });

  describe('Database Queries', () => {
    test('should query unified_embeddings with organization filter', async () => {
      query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '0' },
          { entity_type: 'tool', total: '0' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      await handler(event);
      
      // First query should be for embedding counts
      const countsQuery = query.mock.calls[0][0];
      expect(countsQuery).toContain('unified_embeddings');
      expect(countsQuery).toContain(mockOrganizationId);
      expect(countsQuery).toContain('GROUP BY entity_type, model_version');
      
      // Second query should be for total entity counts
      const totalsQuery = query.mock.calls[1][0];
      expect(totalsQuery).toContain('FROM parts');
      expect(totalsQuery).toContain('FROM tools');
      expect(totalsQuery).toContain('FROM actions');
      expect(totalsQuery).toContain('FROM issues');
      expect(totalsQuery).toContain('FROM policy');
      expect(totalsQuery).toContain(mockOrganizationId);
    });
  });

  describe('Error Handling', () => {
    test('should handle database query errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Database connection failed');
    });

    test('should provide specific error for missing embeddings table', async () => {
      query.mockRejectedValue(new Error('relation "unified_embeddings" does not exist'));
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Embeddings table not found');
      expect(body.error).toContain('unified_embeddings table is created');
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should escape single quotes in organization_id', async () => {
      getAuthorizerContext.mockReturnValue({
        organization_id: "test'org"
      });
      
      query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '0' },
          { entity_type: 'tool', total: '0' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      await handler(event);
      
      // Both queries should escape the organization_id
      const countsQuery = query.mock.calls[0][0];
      expect(countsQuery).toContain("test''org");
      
      const totalsQuery = query.mock.calls[1][0];
      expect(totalsQuery).toContain("test''org");
    });
  });

  describe('Response Headers', () => {
    test('should include CORS headers', async () => {
      query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { entity_type: 'part', total: '0' },
          { entity_type: 'tool', total: '0' },
          { entity_type: 'action', total: '0' },
          { entity_type: 'issue', total: '0' },
          { entity_type: 'policy', total: '0' }
        ]);
      
      const event = { httpMethod: 'GET' };
      const response = await handler(event);
      
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Content-Type');
    });
  });
});
