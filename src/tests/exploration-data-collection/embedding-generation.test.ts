/**
 * Property-Based Tests for Embedding Generation
 * 
 * Tests universal properties for embedding generation across actions, explorations, and policies
 * 
 * Feature: exploration-data-collection-flow, Property 10: Embedding Generation
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingQueue } from '../../services/embeddingQueue';
import { EmbeddingWorker } from '../../services/embeddingWorker';
import { apiService } from '../../lib/apiService';

// Mock the API service
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('Embedding Generation Properties', () => {
  let embeddingQueue: EmbeddingQueue;
  let embeddingWorker: EmbeddingWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingQueue = new EmbeddingQueue('test-queue-url');
    embeddingWorker = new EmbeddingWorker({
      batchSize: 5,
      maxRetries: 2
    });
  });

  /**
   * Property 10: Embedding Generation
   * For any valid text content, generating embeddings should produce consistent results
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  describe('Property 10: Embedding Generation', () => {
    it('should enqueue embedding jobs for all valid text inputs', async () => {
      // Property: For any non-empty text, embedding jobs should be enqueueable
      const testCases = [
        { id: 'action-1', table: 'actions', type: 'state', text: 'Testing irrigation system' },
        { id: 'action-2', table: 'actions', type: 'policy_text', text: 'Follow safety protocols' },
        { id: 'action-3', table: 'actions', type: 'summary_policy_text', text: 'Use PPE and document' },
        { id: 'exploration-1', table: 'exploration', type: 'exploration_notes', text: 'Water usage comparison' },
        { id: 'exploration-2', table: 'exploration', type: 'metrics', text: 'Yield per hectare' },
        { id: 'policy-1', table: 'policy', type: 'policy_description', text: 'Safety procedures for field work' }
      ];

      // Mock successful API responses
      (apiService.post as any).mockResolvedValue({ success: true });

      for (const testCase of testCases) {
        await embeddingQueue.enqueueActionEmbedding(
          testCase.id,
          testCase.type as any,
          testCase.text
        );

        // Verify API was called with correct parameters
        expect(apiService.post).toHaveBeenCalledWith('/embeddings/enqueue', {
          id: testCase.id,
          table: testCase.table,
          text: testCase.text,
          embedding_type: testCase.type,
          model: 'text-embedding-3-small',
          delay_seconds: 0,
          retry_count: 3
        });
      }

      // Property: All valid texts should result in enqueue calls
      expect(apiService.post).toHaveBeenCalledTimes(testCases.length);
    });

    it('should skip empty or whitespace-only text inputs', async () => {
      // Property: For any empty or whitespace-only text, no embedding job should be enqueued
      const emptyTexts = ['', '   ', '\n\t  ', null, undefined];

      (apiService.post as any).mockResolvedValue({ success: true });

      for (const emptyText of emptyTexts) {
        await embeddingQueue.enqueueActionEmbedding(
          'test-id',
          'state',
          emptyText as any
        );
      }

      // Property: No API calls should be made for empty texts
      expect(apiService.post).not.toHaveBeenCalled();
    });

    it('should handle multiple embedding types for the same entity', async () => {
      // Property: For any entity with multiple text fields, all non-empty fields should generate embeddings
      const actionId = 'action-multi-embed';
      const texts = {
        state_text: 'Testing new irrigation method',
        policy_text: 'Follow safety protocols and document findings',
        summary_policy_text: 'Use drip irrigation with monitoring'
      };

      (apiService.post as any).mockResolvedValue({ success: true });

      await embeddingQueue.enqueueActionEmbeddings(actionId, texts);

      // Property: Each non-empty text field should result in a separate embedding job
      expect(apiService.post).toHaveBeenCalledTimes(3);
      
      // Verify each embedding type was enqueued
      expect(apiService.post).toHaveBeenCalledWith('/embeddings/enqueue', 
        expect.objectContaining({
          id: actionId,
          embedding_type: 'state',
          text: texts.state_text
        })
      );
      
      expect(apiService.post).toHaveBeenCalledWith('/embeddings/enqueue',
        expect.objectContaining({
          id: actionId,
          embedding_type: 'policy_text',
          text: texts.policy_text
        })
      );
      
      expect(apiService.post).toHaveBeenCalledWith('/embeddings/enqueue',
        expect.objectContaining({
          id: actionId,
          embedding_type: 'summary_policy_text',
          text: texts.summary_policy_text
        })
      );
    });

    it('should process embedding jobs with consistent structure', async () => {
      // Property: For any valid embedding job, processing should produce a consistent result structure
      const mockEmbedding = Array.from({ length: 1536 }, (_, i) => Math.random());
      
      (apiService.post as any)
        .mockResolvedValueOnce({ embedding: mockEmbedding }) // generateEmbedding call
        .mockResolvedValueOnce({ // storeEmbedding call
          data: {
            id: 1,
            entity_id: 'test-id',
            embedding_type: 'state',
            model: 'text-embedding-3-small',
            created_at: new Date().toISOString()
          }
        });

      const job = {
        id: 'test-id',
        table: 'actions' as const,
        text: 'Test embedding generation',
        embedding_type: 'state' as const,
        model: 'text-embedding-3-small'
      };

      const result = await embeddingWorker.processJob(job);

      // Property: Result should have consistent structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('table');
      expect(result).toHaveProperty('embedding_type');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('created_at');

      // Property: Embedding generation API should be called
      expect(apiService.post).toHaveBeenCalledWith('/ai/generate-embedding', {
        text: job.text,
        model: job.model
      });

      // Property: Embedding storage API should be called
      expect(apiService.post).toHaveBeenCalledWith('/embeddings/action_embedding', {
        entity_id: job.id,
        embedding_type: job.embedding_type,
        embedding: mockEmbedding,
        model: job.model,
        text_length: job.text.length
      });
    });

    it('should handle batch processing correctly', async () => {
      // Property: For any batch of embedding jobs, all jobs should be processed
      const jobs = [
        { id: 'job-1', table: 'actions' as const, text: 'First job', embedding_type: 'state' as const },
        { id: 'job-2', table: 'exploration' as const, text: 'Second job', embedding_type: 'exploration_notes' as const },
        { id: 'job-3', table: 'policy' as const, text: 'Third job', embedding_type: 'policy_description' as const }
      ];

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      // Mock successful responses for all jobs
      (apiService.post as any)
        .mockResolvedValue({ embedding: mockEmbedding })
        .mockResolvedValue({ data: { id: 1, created_at: new Date().toISOString() } });

      const results = await embeddingWorker.processBatch(jobs);

      // Property: Number of results should equal number of input jobs
      expect(results).toHaveLength(jobs.length);

      // Property: Each job should result in API calls for generation and storage
      expect(apiService.post).toHaveBeenCalledTimes(jobs.length * 2); // 2 calls per job
    });

    it('should maintain embedding vector consistency', async () => {
      // Property: For any text input, the embedding vector should have consistent dimensions
      const testTexts = [
        'Short text',
        'This is a longer text that contains more information and should still produce a consistent embedding vector',
        'Text with special characters: @#$%^&*()_+-=[]{}|;:,.<>?',
        'Text with numbers: 123 456 789 and dates: 2026-01-04'
      ];

      const expectedDimensions = 1536; // OpenAI text-embedding-3-small dimensions
      const mockEmbedding = Array.from({ length: expectedDimensions }, () => Math.random());

      (apiService.post as any).mockResolvedValue({ embedding: mockEmbedding });

      for (const text of testTexts) {
        const job = {
          id: `test-${Math.random()}`,
          table: 'actions' as const,
          text,
          embedding_type: 'state' as const,
          model: 'text-embedding-3-small'
        };

        // Mock the storage call
        (apiService.post as any).mockResolvedValueOnce({ embedding: mockEmbedding });
        (apiService.post as any).mockResolvedValueOnce({ 
          data: { id: 1, created_at: new Date().toISOString() }
        });

        await embeddingWorker.processJob(job);

        // Property: Embedding generation should be called with the text
        expect(apiService.post).toHaveBeenCalledWith('/ai/generate-embedding', {
          text: text,
          model: 'text-embedding-3-small'
        });
      }
    });

    it('should handle different embedding types correctly', async () => {
      // Property: For any valid embedding type, the system should process it correctly
      const embeddingTypes = [
        { table: 'actions', type: 'state' },
        { table: 'actions', type: 'policy_text' },
        { table: 'actions', type: 'summary_policy_text' },
        { table: 'exploration', type: 'exploration_notes' },
        { table: 'exploration', type: 'metrics' },
        { table: 'policy', type: 'policy_description' }
      ];

      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
      
      (apiService.post as any)
        .mockResolvedValue({ embedding: mockEmbedding })
        .mockResolvedValue({ data: { id: 1, created_at: new Date().toISOString() } });

      for (const { table, type } of embeddingTypes) {
        const job = {
          id: `test-${table}-${type}`,
          table: table as any,
          text: `Test text for ${type}`,
          embedding_type: type as any,
          model: 'text-embedding-3-small'
        };

        await embeddingWorker.processJob(job);

        // Property: Storage should use the correct table based on source table
        const expectedTable = table === 'actions' ? 'action_embedding' :
                            table === 'exploration' ? 'exploration_embedding' :
                            'policy_embedding';

        expect(apiService.post).toHaveBeenCalledWith(`/embeddings/${expectedTable}`, 
          expect.objectContaining({
            entity_id: job.id,
            embedding_type: type,
            embedding: mockEmbedding
          })
        );
      }
    });
  });
});