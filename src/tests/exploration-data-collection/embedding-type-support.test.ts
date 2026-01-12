/**
 * Property-Based Tests for Embedding Type Support
 * 
 * Tests universal properties for different embedding types and models
 * 
 * Feature: exploration-data-collection-flow, Property 11: Embedding Type Support
 * Validates: Requirements 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingService } from '../../services/embeddingService';
import { EmbeddingQueue } from '../../services/embeddingQueue';
import { EmbeddingWorker } from '../../services/embeddingWorker';
import { apiService } from '../../lib/apiService';

// Mock the API service
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Embedding Type Support Property Tests', () => {
  let embeddingService: EmbeddingService;
  let embeddingQueue: EmbeddingQueue;
  let embeddingWorker: EmbeddingWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingService = new EmbeddingService();
    embeddingQueue = new EmbeddingQueue('test-queue-url');
    embeddingWorker = new EmbeddingWorker();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 11: Embedding Type Support
   * For any valid embedding type and model combination, the system should handle 
   * generation, storage, and retrieval consistently across all entity types
   * Validates: Requirements 4.5
   */
  describe('Property 11: Embedding Type Support', () => {
    it('should support all defined embedding types for actions', async () => {
      // Property: For any action embedding type, the system should process it correctly
      
      const actionEmbeddingTypes = [
        'state',
        'policy_text', 
        'summary_policy_text'
      ];

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      // Mock API responses
      (apiService.post as any).mockImplementation((endpoint: string) => {
        if (endpoint === '/ai/generate-embedding') {
          return Promise.resolve({ embedding: mockEmbedding });
        }
        if (endpoint.includes('/embeddings/')) {
          return Promise.resolve({ 
            data: { 
              id: 'test-id', 
              entity_id: 'action-123',
              embedding_type: 'state',
              model: 'text-embedding-3-small',
              created_at: new Date().toISOString()
            }
          });
        }
        return Promise.resolve({ success: true });
      });

      const actionId = 'action-123';
      const testTexts = {
        state_text: 'Testing irrigation system efficiency',
        policy_text: 'Follow safety protocols during testing',
        summary_policy_text: 'Use PPE and document all findings'
      };

      // Test each embedding type
      for (const embeddingType of actionEmbeddingTypes) {
        const textField = embeddingType === 'state' ? 'state_text' :
                         embeddingType === 'policy_text' ? 'policy_text' :
                         'summary_policy_text';
        
        const text = testTexts[textField as keyof typeof testTexts];
        
        // Property: Each embedding type should be enqueueable
        await embeddingQueue.enqueueActionEmbeddings(actionId, { [textField]: text });
        
        // Property: Each embedding type should be processable
        const job = {
          id: actionId,
          table: 'actions' as const,
          text: text,
          embedding_type: embeddingType,
          model: 'text-embedding-3-small'
        };
        
        const result = await embeddingWorker.processJob(job);
        expect(result).toBeDefined();
      }

      // Property: All embedding types should result in API calls
      const enqueueCalls = (apiService.post as any).mock.calls.filter(
        (call: any[]) => call[0] === '/embeddings/enqueue'
      );
      expect(enqueueCalls.length).toBe(actionEmbeddingTypes.length);

      // Property: All embedding types should result in generation calls
      const generationCalls = (apiService.post as any).mock.calls.filter(
        (call: any[]) => call[0] === '/ai/generate-embedding'
      );
      expect(generationCalls.length).toBe(actionEmbeddingTypes.length);
    });

    it('should support all defined embedding types for explorations', async () => {
      // Property: For any exploration embedding type, the system should process it correctly
      
      const explorationEmbeddingTypes = [
        'exploration_notes',
        'metrics'
      ];

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      (apiService.post as any).mockImplementation((endpoint: string) => {
        if (endpoint === '/ai/generate-embedding') {
          return Promise.resolve({ embedding: mockEmbedding });
        }
        if (endpoint.includes('/embeddings/')) {
          return Promise.resolve({ 
            data: { 
              id: 'test-id',
              entity_id: 'exploration-456',
              embedding_type: 'exploration_notes',
              model: 'text-embedding-3-small',
              created_at: new Date().toISOString()
            }
          });
        }
        return Promise.resolve({ success: true });
      });

      const explorationId = 'exploration-456';
      const testTexts = {
        exploration_notes_text: 'Comparing water usage between drip and sprinkler irrigation',
        metrics_text: 'Water consumption: 50L/m², Yield: 2.5kg/m², Efficiency: 85%'
      };

      // Test each embedding type
      for (const embeddingType of explorationEmbeddingTypes) {
        const textField = embeddingType === 'exploration_notes' ? 'exploration_notes_text' : 'metrics_text';
        const text = testTexts[textField as keyof typeof testTexts];
        
        // Property: Each embedding type should be enqueueable
        await embeddingQueue.enqueueExplorationEmbeddings(explorationId, { [textField]: text });
        
        // Property: Each embedding type should be processable
        const job = {
          id: explorationId,
          table: 'exploration' as const,
          text: text,
          embedding_type: embeddingType,
          model: 'text-embedding-3-small'
        };
        
        const result = await embeddingWorker.processJob(job);
        expect(result).toBeDefined();
      }

      // Property: All embedding types should result in correct API calls
      const enqueueCalls = (apiService.post as any).mock.calls.filter(
        (call: any[]) => call[0] === '/embeddings/enqueue'
      );
      expect(enqueueCalls.length).toBe(explorationEmbeddingTypes.length);
    });

    it('should support all defined embedding types for policies', async () => {
      // Property: For any policy embedding type, the system should process it correctly
      
      const policyEmbeddingTypes = [
        'policy_description'
      ];

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      (apiService.post as any).mockImplementation((endpoint: string) => {
        if (endpoint === '/ai/generate-embedding') {
          return Promise.resolve({ embedding: mockEmbedding });
        }
        if (endpoint.includes('/embeddings/')) {
          return Promise.resolve({ 
            data: { 
              id: 'test-id',
              entity_id: 'policy-789',
              embedding_type: 'policy_description',
              model: 'text-embedding-3-small',
              created_at: new Date().toISOString()
            }
          });
        }
        return Promise.resolve({ success: true });
      });

      const policyId = 'policy-789';
      const policyText = 'Standard safety procedures for field work including PPE requirements and documentation protocols';

      // Test policy embedding type
      for (const embeddingType of policyEmbeddingTypes) {
        // Property: Policy embedding type should be enqueueable
        await embeddingQueue.enqueuePolicyEmbedding(policyId, embeddingType, policyText);
        
        // Property: Policy embedding type should be processable
        const job = {
          id: policyId,
          table: 'policy' as const,
          text: policyText,
          embedding_type: embeddingType,
          model: 'text-embedding-3-small'
        };
        
        const result = await embeddingWorker.processJob(job);
        expect(result).toBeDefined();
      }

      // Property: Policy embedding should result in correct API calls
      const enqueueCalls = (apiService.post as any).mock.calls.filter(
        (call: any[]) => call[0] === '/embeddings/enqueue'
      );
      expect(enqueueCalls.length).toBe(policyEmbeddingTypes.length);
    });

    it('should support multiple embedding models consistently', async () => {
      // Property: For any supported embedding model, the system should handle it consistently
      
      const supportedModels = [
        'text-embedding-3-small',
        'text-embedding-3-large', 
        'text-embedding-ada-002'
      ];

      const modelDimensions = {
        'text-embedding-3-small': 1536,
        'text-embedding-3-large': 3072,
        'text-embedding-ada-002': 1536
      };

      for (const model of supportedModels) {
        const expectedDimensions = modelDimensions[model as keyof typeof modelDimensions];
        const mockEmbedding = Array.from({ length: expectedDimensions }, () => Math.random());
        
        (apiService.post as any).mockImplementation((endpoint: string, body: any) => {
          if (endpoint === '/ai/generate-embedding') {
            // Property: Model should be passed correctly to AI service
            expect(body.model).toBe(model);
            return Promise.resolve({ embedding: mockEmbedding });
          }
          if (endpoint.includes('/embeddings/')) {
            // Property: Model should be stored with embedding
            expect(body.model).toBe(model);
            return Promise.resolve({ 
              data: { 
                id: 'test-id',
                entity_id: 'test-entity',
                embedding_type: 'state',
                model: model,
                created_at: new Date().toISOString()
              }
            });
          }
          return Promise.resolve({ success: true });
        });

        const job = {
          id: 'test-entity',
          table: 'actions' as const,
          text: 'Test text for model compatibility',
          embedding_type: 'state',
          model: model
        };

        const result = await embeddingWorker.processJob(job);
        
        // Property: Result should be consistent regardless of model
        expect(result).toBeDefined();
        
        // Property: Generation should be called with correct model
        const generationCalls = (apiService.post as any).mock.calls.filter(
          (call: any[]) => call[0] === '/ai/generate-embedding' && call[1].model === model
        );
        expect(generationCalls.length).toBeGreaterThan(0);

        vi.clearAllMocks();
      }
    });

    it('should handle embedding storage with correct table mapping', async () => {
      // Property: For any entity type, embeddings should be stored in the correct table
      
      const entityTableMappings = [
        { table: 'actions', embeddingTable: 'action_embedding' },
        { table: 'exploration', embeddingTable: 'exploration_embedding' },
        { table: 'policy', embeddingTable: 'policy_embedding' }
      ];

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      for (const mapping of entityTableMappings) {
        (apiService.post as any).mockImplementation((endpoint: string) => {
          if (endpoint === '/ai/generate-embedding') {
            return Promise.resolve({ embedding: mockEmbedding });
          }
          if (endpoint === `/embeddings/${mapping.embeddingTable}`) {
            return Promise.resolve({ 
              data: { 
                id: 'test-id',
                entity_id: 'test-entity',
                embedding_type: 'test_type',
                model: 'text-embedding-3-small',
                created_at: new Date().toISOString()
              }
            });
          }
          return Promise.resolve({ success: true });
        });

        const job = {
          id: 'test-entity',
          table: mapping.table as any,
          text: 'Test text for table mapping',
          embedding_type: 'test_type',
          model: 'text-embedding-3-small'
        };

        const result = await embeddingWorker.processJob(job);
        
        // Property: Result should be defined for all table types
        expect(result).toBeDefined();
        
        // Property: Storage should use correct embedding table
        const storageCalls = (apiService.post as any).mock.calls.filter(
          (call: any[]) => call[0] === `/embeddings/${mapping.embeddingTable}`
        );
        expect(storageCalls.length).toBe(1);

        vi.clearAllMocks();
      }
    });

    it('should validate embedding type constraints per entity', async () => {
      // Property: For any invalid embedding type/entity combination, the system should reject it
      
      const invalidCombinations = [
        { table: 'actions', embeddingType: 'exploration_notes' }, // exploration type on action
        { table: 'actions', embeddingType: 'metrics' }, // exploration type on action
        { table: 'actions', embeddingType: 'policy_description' }, // policy type on action
        { table: 'exploration', embeddingType: 'state' }, // action type on exploration
        { table: 'exploration', embeddingType: 'policy_text' }, // action type on exploration
        { table: 'exploration', embeddingType: 'policy_description' }, // policy type on exploration
        { table: 'policy', embeddingType: 'state' }, // action type on policy
        { table: 'policy', embeddingType: 'exploration_notes' }, // exploration type on policy
        { table: 'policy', embeddingType: 'metrics' } // exploration type on policy
      ];

      for (const combination of invalidCombinations) {
        const job = {
          id: 'test-entity',
          table: combination.table as any,
          text: 'Test text for validation',
          embedding_type: combination.embeddingType,
          model: 'text-embedding-3-small'
        };

        // Property: Invalid combinations should be rejected
        await expect(embeddingWorker.processJob(job))
          .rejects
          .toThrow(/Invalid embedding type.*for.*table/);
      }
    });

    it('should handle embedding retrieval by type and model', async () => {
      // Property: For any stored embedding, it should be retrievable by type and model filters
      
      const testEntityId = 'test-entity-123';
      const embeddingTypes = ['state', 'policy_text', 'summary_policy_text'];
      const models = ['text-embedding-3-small', 'text-embedding-3-large'];
      
      // Mock stored embeddings
      const mockStoredEmbeddings = [];
      for (const embeddingType of embeddingTypes) {
        for (const model of models) {
          mockStoredEmbeddings.push({
            id: `embedding-${embeddingType}-${model}`,
            entity_id: testEntityId,
            embedding_type: embeddingType,
            model: model,
            embedding: Array.from({ length: 1536 }, () => Math.random()),
            created_at: new Date().toISOString()
          });
        }
      }

      (apiService.get as any).mockImplementation((endpoint: string) => {
        if (endpoint.includes(`/embeddings/action_embedding/${testEntityId}`)) {
          return Promise.resolve({ data: mockStoredEmbeddings });
        }
        return Promise.resolve({ data: [] });
      });

      // Property: Should retrieve all embeddings for entity
      const allEmbeddings = await embeddingService.getEntityEmbeddings(testEntityId, 'actions');
      expect(allEmbeddings.length).toBe(embeddingTypes.length * models.length);

      // Property: Should filter by embedding type
      for (const embeddingType of embeddingTypes) {
        const typeFilteredEmbeddings = allEmbeddings.filter(e => e.embedding_type === embeddingType);
        expect(typeFilteredEmbeddings.length).toBe(models.length);
        
        // Property: All filtered embeddings should have correct type
        typeFilteredEmbeddings.forEach(embedding => {
          expect(embedding.embedding_type).toBe(embeddingType);
        });
      }

      // Property: Should filter by model
      for (const model of models) {
        const modelFilteredEmbeddings = allEmbeddings.filter(e => e.model === model);
        expect(modelFilteredEmbeddings.length).toBe(embeddingTypes.length);
        
        // Property: All filtered embeddings should have correct model
        modelFilteredEmbeddings.forEach(embedding => {
          expect(embedding.model).toBe(model);
        });
      }
    });

    it('should support embedding updates and versioning', async () => {
      // Property: For any existing embedding, updates should create new versions while maintaining history
      
      const entityId = 'test-entity-versioning';
      const embeddingType = 'state';
      const model = 'text-embedding-3-small';
      
      const originalEmbedding = Array.from({ length: 1536 }, () => Math.random());
      const updatedEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      let callCount = 0;
      (apiService.post as any).mockImplementation((endpoint: string, body: any) => {
        if (endpoint === '/ai/generate-embedding') {
          callCount++;
          return Promise.resolve({ 
            embedding: callCount === 1 ? originalEmbedding : updatedEmbedding 
          });
        }
        if (endpoint.includes('/embeddings/')) {
          return Promise.resolve({ 
            data: { 
              id: `embedding-${callCount}`,
              entity_id: entityId,
              embedding_type: embeddingType,
              model: model,
              embedding: callCount === 1 ? originalEmbedding : updatedEmbedding,
              created_at: new Date().toISOString()
            }
          });
        }
        return Promise.resolve({ success: true });
      });

      // Property: First embedding should be stored successfully
      const job1 = {
        id: entityId,
        table: 'actions' as const,
        text: 'Original text content',
        embedding_type: embeddingType,
        model: model
      };
      
      const result1 = await embeddingWorker.processJob(job1);
      expect(result1).toBeDefined();

      // Property: Updated embedding should be stored successfully
      const job2 = {
        id: entityId,
        table: 'actions' as const,
        text: 'Updated text content',
        embedding_type: embeddingType,
        model: model
      };
      
      const result2 = await embeddingWorker.processJob(job2);
      expect(result2).toBeDefined();

      // Property: Both embeddings should have been generated
      const generationCalls = (apiService.post as any).mock.calls.filter(
        (call: any[]) => call[0] === '/ai/generate-embedding'
      );
      expect(generationCalls.length).toBe(2);

      // Property: Both embeddings should have been stored
      const storageCalls = (apiService.post as any).mock.calls.filter(
        (call: any[]) => call[0].includes('/embeddings/')
      );
      expect(storageCalls.length).toBe(2);
    });
  });
});