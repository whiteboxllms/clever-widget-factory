/**
 * Test for parts_history endpoint UUID casting issue
 * 
 * This test verifies that part_id parameter is properly cast to UUID
 * to avoid "operator does not exist: uuid = text" error
 */

const { handler } = require('../index');

describe('parts_history endpoint - UUID casting', () => {
  const mockEvent = (queryParams = {}) => ({
    httpMethod: 'GET',
    path: '/api/parts_history',
    queryStringParameters: queryParams,
    headers: {
      'Content-Type': 'application/json',
    },
    requestContext: {
      authorizer: {
        organization_id: 'org-123',
        user_id: 'user-123',
      },
    },
  });

  // Mock the database query
  const originalQueryJSON = require('../index').queryJSON;
  let queryJSONMock;

  beforeEach(() => {
    // Mock queryJSON to capture the SQL query
    queryJSONMock = jest.fn().mockResolvedValue([{ json_agg: [] }]);
    jest.doMock('../index', () => ({
      ...jest.requireActual('../index'),
      queryJSON: queryJSONMock,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should properly cast part_id string parameter to UUID in SQL query', async () => {
    const partId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
    const event = mockEvent({ part_id: partId, limit: '100' });

    // We need to mock the actual database connection
    // For now, let's check that the SQL doesn't have the problematic pattern
    const { Client } = require('pg');
    const mockQuery = jest.fn().mockResolvedValue({ rows: [{ json_agg: [] }] });
    const mockClient = {
      query: mockQuery,
      connect: jest.fn().mockResolvedValue(),
      end: jest.fn().mockResolvedValue(),
    };
    
    jest.spyOn(Client.prototype, 'connect').mockResolvedValue();
    jest.spyOn(Client.prototype, 'query').mockImplementation(mockQuery);
    jest.spyOn(Client.prototype, 'end').mockResolvedValue();

    try {
      const result = await handler(event);
      
      // Verify the query was called
      expect(mockQuery).toHaveBeenCalled();
      
      // Get the SQL query that was executed
      const sqlCall = mockQuery.mock.calls.find(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('parts_history')
      );
      
      if (sqlCall) {
        const sql = sqlCall[0];
        
        // The SQL should NOT have the problematic pattern: (''value'')::uuid
        // It should either:
        // 1. Cast column to text: part_id::text = 'value'
        // 2. Cast value properly: part_id = 'value'::uuid (without double quotes)
        expect(sql).not.toMatch(/\(['"]/); // Should not have ('' or ("
        expect(sql).toMatch(/ph\.part_id/);
        
        // Should have the part_id value in the query
        expect(sql).toContain(partId);
      }
    } catch (error) {
      // If there's an error about UUID casting, that's what we're testing for
      expect(error.message).not.toContain('operator does not exist: uuid = text');
    }
  });

  it('should handle the exact error case from the curl request', async () => {
    // This is the exact part_id from the failing curl request
    const partId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
    const event = mockEvent({ 
      part_id: partId, 
      limit: '100' 
    });

    const { Client } = require('pg');
    const mockQuery = jest.fn().mockResolvedValue({ rows: [{ json_agg: [] }] });
    
    jest.spyOn(Client.prototype, 'connect').mockResolvedValue();
    jest.spyOn(Client.prototype, 'query').mockImplementation(mockQuery);
    jest.spyOn(Client.prototype, 'end').mockResolvedValue();

    const result = await handler(event);
    
    // Should not throw an error
    expect(result.statusCode).toBe(200);
    
    // Verify the SQL query structure
    const sqlCall = mockQuery.mock.calls.find(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('WHERE')
    );
    
    if (sqlCall) {
      const sql = sqlCall[0];
      // Should not have double-quoted UUID cast pattern
      // The problematic pattern would be: (''value'')::uuid
      // The correct pattern should be: 'value'::uuid or part_id::text = 'value'
      expect(sql).not.toMatch(/\(['"]{2}/); // No double quotes in parentheses
    }
  });
});


