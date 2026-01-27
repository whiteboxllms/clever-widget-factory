// Mock dependencies BEFORE requiring the handler
jest.mock('../shared/db');
jest.mock('../shared/auth');

// Mock SQS with a proper implementation
const mockSqsSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-sqs', () => {
  return {
    SQSClient: jest.fn().mockImplementation(() => ({
      send: mockSqsSend
    })),
    SendMessageCommand: jest.fn().mockImplementation((input) => ({ input }))
  };
});

const { query } = require('../shared/db');
const { getAuthorizerContext } = require('../shared/auth');
const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const { handler } = require('./index');

describe('Embeddings Regenerate Lambda', () => {
  const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEntityId = '550e8400-e29b-41d4-a716-446655440000';
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockSqsSend.mockClear();
    mockSqsSend.mockResolvedValue({});
    
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
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('Request Validation', () => {
    test('should return 400 when entity_type is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('entity_type is required');
    });

    test('should return 400 when entity_id is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part'
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('entity_id is required');
    });

    test('should return 400 for invalid entity_type', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'invalid_type',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid entity_type');
      expect(body.error).toContain('part, tool, action, issue, policy');
    });
  });

  describe('Entity Fetching', () => {
    test('should fetch part from parts table', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Banana Wine',
        description: 'Fermented banana beverage',
        policy: 'Rich in potassium',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FROM parts');
      expect(sql).toContain(mockEntityId);
      expect(sql).toContain(mockOrganizationId);
    });

    test('should fetch tool from tools table', async () => {
      const mockTool = {
        id: mockEntityId,
        name: 'Hand Drill',
        description: 'Manual drilling tool',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockTool]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'tool',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FROM tools');
      expect(sql).toContain(mockEntityId);
      expect(sql).toContain(mockOrganizationId);
    });

    test('should fetch action from actions table', async () => {
      const mockAction = {
        id: mockEntityId,
        description: 'Applied compost',
        state_text: 'Completed',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockAction]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'action',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FROM actions');
    });

    test('should fetch issue from issues table', async () => {
      const mockIssue = {
        id: mockEntityId,
        title: 'Fermentation stopped',
        description: 'Issue description',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockIssue]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'issue',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FROM issues');
    });

    test('should fetch policy from policy table', async () => {
      const mockPolicy = {
        id: mockEntityId,
        title: 'Organic Pest Control',
        description_text: 'Use natural pesticides',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPolicy]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'policy',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain('FROM policy');
    });

    test('should return 404 when entity not found', async () => {
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found or access denied');
    });

    test('should return 404 when entity belongs to different organization', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Test Part',
        organization_id: 'different-org-id'
      };
      
      // Query returns empty because of organization filter
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Embedding Source Composition', () => {
    test('should compose embedding source for part', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Banana Wine',
        description: 'Fermented banana beverage',
        policy: 'Rich in potassium and B vitamins',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      
      // Verify SQS message contains composed embedding_source
      expect(mockSqsSend).toHaveBeenCalled();
      const sqsCommand = mockSqsSend.mock.calls[0][0];
      const messageBody = JSON.parse(sqsCommand.input.MessageBody);
      
      expect(messageBody.embedding_source).toContain('Banana Wine');
      expect(messageBody.embedding_source).toContain('Fermented banana beverage');
      expect(messageBody.embedding_source).toContain('Rich in potassium');
    });

    test('should compose embedding source for tool', async () => {
      const mockTool = {
        id: mockEntityId,
        name: 'Hand Drill',
        description: 'Manual drilling tool with adjustable chuck',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockTool]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'tool',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sqsCommand = mockSqsSend.mock.calls[0][0];
      const messageBody = JSON.parse(sqsCommand.input.MessageBody);
      
      expect(messageBody.embedding_source).toContain('Hand Drill');
      expect(messageBody.embedding_source).toContain('Manual drilling tool');
    });

    test('should return 400 when embedding_source is empty', async () => {
      const mockPart = {
        id: mockEntityId,
        name: '',
        description: null,
        policy: null,
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('no content to embed');
      
      // Should not send SQS message
      expect(mockSqsSend).not.toHaveBeenCalled();
    });
  });

  describe('SQS Message Format', () => {
    test('should send correct SQS message format', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Test Part',
        description: 'Test description',
        policy: 'Test policy',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      expect(mockSqsSend).toHaveBeenCalledTimes(1);
      
      const sqsCommand = mockSqsSend.mock.calls[0][0];
      expect(sqsCommand).toHaveProperty('input');
      expect(sqsCommand.input).toHaveProperty('QueueUrl');
      expect(sqsCommand.input).toHaveProperty('MessageBody');
      
      const messageBody = JSON.parse(sqsCommand.input.MessageBody);
      expect(messageBody).toHaveProperty('entity_type', 'part');
      expect(messageBody).toHaveProperty('entity_id', mockEntityId);
      expect(messageBody).toHaveProperty('embedding_source');
      expect(messageBody).toHaveProperty('organization_id', mockOrganizationId);
    });

    test('should use correct queue URL', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Test Part',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sqsCommand = mockSqsSend.mock.calls[0][0];
      expect(sqsCommand.input.QueueUrl).toContain('cwf-embeddings-queue');
    });
  });

  describe('Success Response', () => {
    test('should return success response with correct format', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Banana Wine',
        description: 'Fermented banana beverage',
        policy: 'Rich in potassium',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.data).toHaveProperty('message');
      expect(body.data.message).toContain('queued successfully');
      expect(body.data).toHaveProperty('entity_type', 'part');
      expect(body.data).toHaveProperty('entity_id', mockEntityId);
      expect(body.data).toHaveProperty('embedding_source_length');
      expect(body.data.embedding_source_length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle database query errors', async () => {
      query.mockRejectedValue(new Error('Database connection failed'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Database connection failed');
    });

    test('should provide specific error for missing table', async () => {
      query.mockRejectedValue(new Error('relation "parts" does not exist'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Entity table not found');
    });

    test('should handle SQS send errors', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Test Part',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      mockSqsSend.mockRejectedValue(new Error('SQS queue not available'));
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed to queue embedding generation');
    });

    test('should handle malformed JSON in request body', async () => {
      const event = {
        httpMethod: 'POST',
        body: 'invalid json'
      };
      
      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should escape single quotes in organization_id', async () => {
      getAuthorizerContext.mockReturnValue({
        organization_id: "test'org"
      });
      
      const mockPart = {
        id: mockEntityId,
        name: 'Test Part',
        organization_id: "test'org"
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain("test''org");
    });

    test('should escape single quotes in entity_id', async () => {
      const maliciousId = "test'id";
      
      query.mockResolvedValue([]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: maliciousId
        })
      };
      
      await handler(event);
      
      const sql = query.mock.calls[0][0];
      expect(sql).toContain("test''id");
    });
  });

  describe('Response Headers', () => {
    test('should include CORS headers', async () => {
      const mockPart = {
        id: mockEntityId,
        name: 'Test Part',
        organization_id: mockOrganizationId
      };
      
      query.mockResolvedValue([mockPart]);
      
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          entity_type: 'part',
          entity_id: mockEntityId
        })
      };
      
      const response = await handler(event);
      
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(response.headers).toHaveProperty('Content-Type');
    });
  });

  describe('All Entity Types', () => {
    const entityTypes = [
      {
        type: 'part',
        table: 'parts',
        entity: { id: mockEntityId, name: 'Test Part', organization_id: mockOrganizationId }
      },
      {
        type: 'tool',
        table: 'tools',
        entity: { id: mockEntityId, name: 'Test Tool', organization_id: mockOrganizationId }
      },
      {
        type: 'action',
        table: 'actions',
        entity: { id: mockEntityId, description: 'Test Action', organization_id: mockOrganizationId }
      },
      {
        type: 'issue',
        table: 'issues',
        entity: { id: mockEntityId, title: 'Test Issue', organization_id: mockOrganizationId }
      },
      {
        type: 'policy',
        table: 'policy',
        entity: { id: mockEntityId, title: 'Test Policy', organization_id: mockOrganizationId }
      }
    ];

    entityTypes.forEach(({ type, table, entity }) => {
      test(`should successfully regenerate ${type} embedding`, async () => {
        query.mockResolvedValue([entity]);
        
        const event = {
          httpMethod: 'POST',
          body: JSON.stringify({
            entity_type: type,
            entity_id: mockEntityId
          })
        };
        
        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.data.entity_type).toBe(type);
        
        // Verify correct table was queried
        const sql = query.mock.calls[0][0];
        expect(sql).toContain(`FROM ${table}`);
        
        // Verify SQS message was sent
        expect(mockSqsSend).toHaveBeenCalled();
        const messageBody = JSON.parse(mockSqsSend.mock.calls[0][0].input.MessageBody);
        expect(messageBody.entity_type).toBe(type);
      });
    });
  });
});
