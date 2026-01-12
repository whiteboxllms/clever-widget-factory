/**
 * EmbeddingWorker
 * 
 * Processes embedding jobs from the queue
 * Generates embeddings using OpenAI API and stores them in database
 * Handles different embedding types and models
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.4
 */

import { apiService } from '../lib/apiService';
import { EmbeddingJob } from './embeddingQueue';

export interface EmbeddingResult {
  id: string;
  table: string;
  embedding_type: string;
  embedding: number[];
  model: string;
  text_length: number;
  created_at: string;
}

export interface EmbeddingWorkerConfig {
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  openaiApiKey?: string;
}

export class EmbeddingWorker {
  private config: EmbeddingWorkerConfig;
  private isProcessing: boolean = false;

  constructor(config: EmbeddingWorkerConfig = {}) {
    this.config = {
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      ...config
    };
  }

  /**
   * Process a single embedding job
   * @param job - Embedding job to process
   * @returns Promise<EmbeddingResult> - Generated embedding result
   */
  async processJob(job: EmbeddingJob): Promise<EmbeddingResult> {
    try {
      console.log(`Processing embedding job: ${job.table}:${job.id}:${job.embedding_type}`);

      // Generate embedding using OpenAI API
      const embedding = await this.generateEmbedding(job.text, job.model);

      // Store embedding in database
      const result = await this.storeEmbedding({
        id: job.id,
        table: job.table,
        embedding_type: job.embedding_type,
        embedding,
        model: job.model || 'text-embedding-3-small',
        text_length: job.text.length
      });

      console.log(`Successfully processed embedding job: ${job.table}:${job.id}:${job.embedding_type}`);
      return result;
    } catch (error) {
      console.error(`Failed to process embedding job ${job.table}:${job.id}:${job.embedding_type}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple embedding jobs in batch
   * @param jobs - Array of embedding jobs to process
   * @returns Promise<EmbeddingResult[]> - Array of generated embedding results
   */
  async processBatch(jobs: EmbeddingJob[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const errors: Error[] = [];

    // Process jobs in parallel with controlled concurrency
    const batchSize = this.config.batchSize || 10;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (job) => {
        try {
          return await this.processJob(job);
        } catch (error) {
          errors.push(error as Error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null) as EmbeddingResult[]);
    }

    if (errors.length > 0) {
      console.warn(`Processed ${jobs.length} jobs with ${errors.length} errors`);
    }

    return results;
  }

  /**
   * Start processing jobs from the queue
   * @param pollIntervalMs - Polling interval in milliseconds
   */
  async startProcessing(pollIntervalMs: number = 5000): Promise<void> {
    if (this.isProcessing) {
      console.log('Embedding worker is already processing');
      return;
    }

    this.isProcessing = true;
    console.log('Starting embedding worker...');

    while (this.isProcessing) {
      try {
        // Poll for jobs from the queue
        const jobs = await this.pollQueue();
        
        if (jobs.length > 0) {
          console.log(`Processing ${jobs.length} embedding jobs`);
          await this.processBatch(jobs);
        }

        // Wait before next poll
        await this.sleep(pollIntervalMs);
      } catch (error) {
        console.error('Error in embedding worker processing loop:', error);
        await this.sleep(pollIntervalMs * 2); // Wait longer on error
      }
    }

    console.log('Embedding worker stopped');
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    console.log('Stopping embedding worker...');
    this.isProcessing = false;
  }

  /**
   * Generate embedding using OpenAI API
   * @param text - Text to embed
   * @param model - Embedding model to use
   * @returns Promise<number[]> - Generated embedding vector
   */
  private async generateEmbedding(text: string, model?: string): Promise<number[]> {
    try {
      const response = await apiService.post('/ai/generate-embedding', {
        text: text.trim(),
        model: model || 'text-embedding-3-small'
      });

      const embedding = response.embedding || response.data?.embedding;
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from API');
      }

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Store embedding in database
   * @param data - Embedding data to store
   * @returns Promise<EmbeddingResult> - Stored embedding result
   */
  private async storeEmbedding(data: {
    id: string;
    table: string;
    embedding_type: string;
    embedding: number[];
    model: string;
    text_length: number;
  }): Promise<EmbeddingResult> {
    try {
      // Determine which embedding table to use based on source table
      let embeddingTable: string;
      switch (data.table) {
        case 'actions':
          embeddingTable = 'action_embedding';
          break;
        case 'exploration':
          embeddingTable = 'exploration_embedding';
          break;
        case 'policy':
          embeddingTable = 'policy_embedding';
          break;
        default:
          throw new Error(`Unknown table: ${data.table}`);
      }

      const response = await apiService.post(`/embeddings/${embeddingTable}`, {
        entity_id: data.id,
        embedding_type: data.embedding_type,
        embedding: data.embedding,
        model: data.model,
        text_length: data.text_length
      });

      return response.data || response;
    } catch (error) {
      console.error('Failed to store embedding:', error);
      throw error;
    }
  }

  /**
   * Poll the queue for new jobs
   * @returns Promise<EmbeddingJob[]> - Array of jobs to process
   */
  private async pollQueue(): Promise<EmbeddingJob[]> {
    try {
      const response = await apiService.get('/embeddings/poll-queue', {
        max_messages: this.config.batchSize || 10
      });

      return response.jobs || response.data?.jobs || [];
    } catch (error) {
      console.error('Failed to poll embedding queue:', error);
      return [];
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get worker status and metrics
   * @returns Worker status information
   */
  getStatus(): {
    isProcessing: boolean;
    config: EmbeddingWorkerConfig;
  } {
    return {
      isProcessing: this.isProcessing,
      config: this.config
    };
  }
}

// Export a singleton instance for convenience
export const embeddingWorker = new EmbeddingWorker();