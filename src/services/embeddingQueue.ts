/**
 * EmbeddingQueue
 * 
 * Handles background job processing for embedding generation
 * Supports action, exploration, and policy text embedding
 * Ensures jobs are enqueued after DB transaction commits
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { apiService } from '../lib/apiService';
import { EmbeddingType, EmbeddingModel } from './embeddingService';

export interface EmbeddingJob {
  id: string;
  table: 'actions' | 'exploration' | 'policy';
  text: string;
  embedding_type: EmbeddingType;
  model?: EmbeddingModel;
}

export interface EmbeddingQueueOptions {
  delaySeconds?: number;
  retryCount?: number;
}

export class EmbeddingQueue {
  private queueUrl: string;
  
  constructor(queueUrl?: string) {
    // Use environment variable or default queue URL
    this.queueUrl = queueUrl || import.meta.env.VITE_EMBEDDINGS_QUEUE_URL || 
      'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';
  }

  /**
   * Enqueue an embedding job for an action
   * @param actionId - Action ID
   * @param embeddingType - Type of embedding to generate
   * @param text - Text content to embed
   * @param options - Queue options
   */
  async enqueueActionEmbedding(
    actionId: string, 
    embeddingType: Extract<EmbeddingType, 'state' | 'policy_text' | 'summary_policy_text'>,
    text: string,
    options: EmbeddingQueueOptions = {}
  ): Promise<void> {
    const job: EmbeddingJob = {
      id: actionId,
      table: 'actions',
      text: text.trim(),
      embedding_type: embeddingType,
      model: 'text-embedding-3-small' // Default model
    };

    await this.enqueueJob(job, options);
  }

  /**
   * Enqueue an embedding job for an exploration
   * @param explorationId - Exploration ID
   * @param embeddingType - Type of embedding to generate
   * @param text - Text content to embed
   * @param options - Queue options
   */
  async enqueueExplorationEmbedding(
    explorationId: string,
    embeddingType: Extract<EmbeddingType, 'exploration_notes' | 'metrics'>,
    text: string,
    options: EmbeddingQueueOptions = {}
  ): Promise<void> {
    const job: EmbeddingJob = {
      id: explorationId,
      table: 'exploration',
      text: text.trim(),
      embedding_type: embeddingType,
      model: 'text-embedding-3-small'
    };

    await this.enqueueJob(job, options);
  }

  /**
   * Enqueue an embedding job for a policy
   * @param policyId - Policy ID
   * @param embeddingType - Type of embedding to generate
   * @param text - Text content to embed
   * @param options - Queue options
   */
  async enqueuePolicyEmbedding(
    policyId: string,
    embeddingType: Extract<EmbeddingType, 'policy_description'>,
    text: string,
    options: EmbeddingQueueOptions = {}
  ): Promise<void> {
    const job: EmbeddingJob = {
      id: policyId,
      table: 'policy',
      text: text.trim(),
      embedding_type: embeddingType,
      model: 'text-embedding-3-small'
    };

    await this.enqueueJob(job, options);
  }

  /**
   * Enqueue multiple embedding jobs for an action (state, policy, summary)
   * @param actionId - Action ID
   * @param texts - Object containing text for different embedding types
   * @param options - Queue options
   */
  async enqueueActionEmbeddings(
    actionId: string,
    texts: {
      state_text?: string;
      policy_text?: string;
      summary_policy_text?: string;
    },
    options: EmbeddingQueueOptions = {}
  ): Promise<void> {
    const jobs: Promise<void>[] = [];

    if (texts.state_text && texts.state_text.trim()) {
      jobs.push(this.enqueueActionEmbedding(actionId, 'state', texts.state_text, options));
    }

    if (texts.policy_text && texts.policy_text.trim()) {
      jobs.push(this.enqueueActionEmbedding(actionId, 'policy_text', texts.policy_text, options));
    }

    if (texts.summary_policy_text && texts.summary_policy_text.trim()) {
      jobs.push(this.enqueueActionEmbedding(actionId, 'summary_policy_text', texts.summary_policy_text, options));
    }

    // Execute all jobs in parallel
    await Promise.all(jobs);
  }

  /**
   * Enqueue multiple embedding jobs for an exploration
   * @param explorationId - Exploration ID
   * @param texts - Object containing text for different embedding types
   * @param options - Queue options
   */
  async enqueueExplorationEmbeddings(
    explorationId: string,
    texts: {
      exploration_notes_text?: string;
      metrics_text?: string;
    },
    options: EmbeddingQueueOptions = {}
  ): Promise<void> {
    const jobs: Promise<void>[] = [];

    if (texts.exploration_notes_text && texts.exploration_notes_text.trim()) {
      jobs.push(this.enqueueExplorationEmbedding(explorationId, 'exploration_notes', texts.exploration_notes_text, options));
    }

    if (texts.metrics_text && texts.metrics_text.trim()) {
      jobs.push(this.enqueueExplorationEmbedding(explorationId, 'metrics', texts.metrics_text, options));
    }

    // Execute all jobs in parallel
    await Promise.all(jobs);
  }

  /**
   * Internal method to enqueue a job via API
   * @param job - Embedding job to enqueue
   * @param options - Queue options
   */
  private async enqueueJob(job: EmbeddingJob, options: EmbeddingQueueOptions = {}): Promise<void> {
    try {
      // Skip empty text
      if (!job.text || job.text.trim().length === 0) {
        console.log(`Skipping empty embedding job for ${job.table}:${job.id}:${job.embedding_type}`);
        return;
      }

      // Call the embedding queue API endpoint
      await apiService.post('/embeddings/enqueue', {
        ...job,
        delay_seconds: options.delaySeconds || 0,
        retry_count: options.retryCount || 3
      });

      console.log(`Enqueued embedding job: ${job.table}:${job.id}:${job.embedding_type}`);
    } catch (error) {
      console.error(`Failed to enqueue embedding job for ${job.table}:${job.id}:${job.embedding_type}:`, error);
      // Don't throw - embedding failures shouldn't block main operations
    }
  }

  /**
   * Get queue status and metrics
   * @returns Promise<QueueStatus> - Queue status information
   */
  async getQueueStatus(): Promise<{
    approximate_number_of_messages: number;
    approximate_number_of_messages_not_visible: number;
    approximate_number_of_messages_delayed: number;
  }> {
    try {
      const response = await apiService.get('/embeddings/queue-status');
      return response.data || response;
    } catch (error) {
      console.error('Failed to get queue status:', error);
      return {
        approximate_number_of_messages: 0,
        approximate_number_of_messages_not_visible: 0,
        approximate_number_of_messages_delayed: 0
      };
    }
  }
}

// Export a singleton instance for convenience
export const embeddingQueue = new EmbeddingQueue();