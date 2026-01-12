/**
 * EmbeddingService
 * 
 * Comprehensive service for managing embeddings across different types and models
 * Supports multiple embedding types, models, and provides search capabilities
 * 
 * Requirements: 4.4, 4.5, 7.4
 */

import { apiService } from '../lib/apiService';

export type EmbeddingType = 
  | 'state' 
  | 'policy_text' 
  | 'summary_policy_text' 
  | 'exploration_notes' 
  | 'metrics' 
  | 'policy_description';

export type EmbeddingModel = 
  | 'text-embedding-3-small' 
  | 'text-embedding-3-large' 
  | 'text-embedding-ada-002';

export type EmbeddingTable = 'action_embedding' | 'exploration_embedding' | 'policy_embedding';

export interface EmbeddingRecord {
  id: number;
  entity_id: string;
  embedding_type: EmbeddingType;
  embedding: number[];
  model: EmbeddingModel;
  text_length: number;
  created_at: string;
  updated_at: string;
}

export interface EmbeddingSearchResult {
  entity_id: string;
  embedding_type: EmbeddingType;
  similarity: number;
  model: EmbeddingModel;
  text_length: number;
  created_at: string;
}

export interface EmbeddingSearchOptions {
  limit?: number;
  threshold?: number;
  embedding_types?: EmbeddingType[];
  models?: EmbeddingModel[];
}

export class EmbeddingService {
  /**
   * Get all embeddings for an entity
   * @param entityId - Entity ID
   * @param table - Embedding table to search
   * @returns Promise<EmbeddingRecord[]> - Array of embeddings
   */
  async getEmbeddings(entityId: string, table: EmbeddingTable): Promise<EmbeddingRecord[]> {
    try {
      const response = await apiService.get(`/embeddings/${table}/${entityId}`);
      return response.data || [];
    } catch (error) {
      console.error(`Failed to get embeddings for ${table}:${entityId}:`, error);
      return [];
    }
  }

  /**
   * Get embeddings by type for an entity
   * @param entityId - Entity ID
   * @param table - Embedding table to search
   * @param embeddingType - Type of embedding to retrieve
   * @returns Promise<EmbeddingRecord[]> - Array of embeddings of the specified type
   */
  async getEmbeddingsByType(
    entityId: string, 
    table: EmbeddingTable, 
    embeddingType: EmbeddingType
  ): Promise<EmbeddingRecord[]> {
    try {
      const allEmbeddings = await this.getEmbeddings(entityId, table);
      return allEmbeddings.filter(embedding => embedding.embedding_type === embeddingType);
    } catch (error) {
      console.error(`Failed to get embeddings by type for ${table}:${entityId}:${embeddingType}:`, error);
      return [];
    }
  }

  /**
   * Get the latest embedding for a specific type and model
   * @param entityId - Entity ID
   * @param table - Embedding table to search
   * @param embeddingType - Type of embedding
   * @param model - Embedding model (optional, defaults to latest)
   * @returns Promise<EmbeddingRecord | null> - Latest embedding or null
   */
  async getLatestEmbedding(
    entityId: string,
    table: EmbeddingTable,
    embeddingType: EmbeddingType,
    model?: EmbeddingModel
  ): Promise<EmbeddingRecord | null> {
    try {
      const embeddings = await this.getEmbeddingsByType(entityId, table, embeddingType);
      
      if (embeddings.length === 0) {
        return null;
      }

      // Filter by model if specified
      const filteredEmbeddings = model 
        ? embeddings.filter(e => e.model === model)
        : embeddings;

      if (filteredEmbeddings.length === 0) {
        return null;
      }

      // Sort by created_at descending and return the latest
      return filteredEmbeddings.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    } catch (error) {
      console.error(`Failed to get latest embedding for ${table}:${entityId}:${embeddingType}:`, error);
      return null;
    }
  }

  /**
   * Search for similar embeddings using vector similarity
   * @param queryEmbedding - Query embedding vector
   * @param table - Embedding table to search
   * @param options - Search options
   * @returns Promise<EmbeddingSearchResult[]> - Array of similar embeddings
   */
  async searchSimilarEmbeddings(
    queryEmbedding: number[],
    table: EmbeddingTable,
    options: EmbeddingSearchOptions = {}
  ): Promise<EmbeddingSearchResult[]> {
    try {
      const {
        limit = 10,
        threshold = 0.7,
        embedding_types,
        models
      } = options;

      const searchParams = new URLSearchParams({
        limit: limit.toString(),
        threshold: threshold.toString()
      });

      if (embedding_types && embedding_types.length > 0) {
        searchParams.append('embedding_types', embedding_types.join(','));
      }

      if (models && models.length > 0) {
        searchParams.append('models', models.join(','));
      }

      const response = await apiService.post(`/embeddings/${table}/search?${searchParams.toString()}`, {
        query_embedding: queryEmbedding
      });

      return response.data || [];
    } catch (error) {
      console.error(`Failed to search similar embeddings in ${table}:`, error);
      return [];
    }
  }

  /**
   * Search for similar content by text (generates embedding first)
   * @param queryText - Text to search for
   * @param table - Embedding table to search
   * @param model - Model to use for generating query embedding
   * @param options - Search options
   * @returns Promise<EmbeddingSearchResult[]> - Array of similar embeddings
   */
  async searchSimilarContent(
    queryText: string,
    table: EmbeddingTable,
    model: EmbeddingModel = 'text-embedding-3-small',
    options: EmbeddingSearchOptions = {}
  ): Promise<EmbeddingSearchResult[]> {
    try {
      // Generate embedding for the query text
      const queryEmbedding = await this.generateEmbedding(queryText, model);
      
      // Search for similar embeddings
      return await this.searchSimilarEmbeddings(queryEmbedding, table, options);
    } catch (error) {
      console.error(`Failed to search similar content in ${table}:`, error);
      return [];
    }
  }

  /**
   * Get embedding statistics for an entity
   * @param entityId - Entity ID
   * @param table - Embedding table to search
   * @returns Promise<EmbeddingStats> - Embedding statistics
   */
  async getEmbeddingStats(entityId: string, table: EmbeddingTable): Promise<{
    total_embeddings: number;
    embedding_types: EmbeddingType[];
    models: EmbeddingModel[];
    latest_created_at: string | null;
    total_text_length: number;
  }> {
    try {
      const embeddings = await this.getEmbeddings(entityId, table);
      
      if (embeddings.length === 0) {
        return {
          total_embeddings: 0,
          embedding_types: [],
          models: [],
          latest_created_at: null,
          total_text_length: 0
        };
      }

      const embeddingTypes = [...new Set(embeddings.map(e => e.embedding_type))];
      const models = [...new Set(embeddings.map(e => e.model))];
      const latestCreatedAt = embeddings.reduce((latest, current) => 
        new Date(current.created_at) > new Date(latest) ? current.created_at : latest,
        embeddings[0].created_at
      );
      const totalTextLength = embeddings.reduce((sum, e) => sum + (e.text_length || 0), 0);

      return {
        total_embeddings: embeddings.length,
        embedding_types: embeddingTypes,
        models: models,
        latest_created_at: latestCreatedAt,
        total_text_length: totalTextLength
      };
    } catch (error) {
      console.error(`Failed to get embedding stats for ${table}:${entityId}:`, error);
      return {
        total_embeddings: 0,
        embedding_types: [],
        models: [],
        latest_created_at: null,
        total_text_length: 0
      };
    }
  }

  /**
   * Delete embeddings for an entity
   * @param entityId - Entity ID
   * @param table - Embedding table
   * @param embeddingType - Optional: specific embedding type to delete
   * @param model - Optional: specific model to delete
   * @returns Promise<number> - Number of deleted embeddings
   */
  async deleteEmbeddings(
    entityId: string,
    table: EmbeddingTable,
    embeddingType?: EmbeddingType,
    model?: EmbeddingModel
  ): Promise<number> {
    try {
      const params = new URLSearchParams({ entity_id: entityId });
      
      if (embeddingType) {
        params.append('embedding_type', embeddingType);
      }
      
      if (model) {
        params.append('model', model);
      }

      const response = await apiService.delete(`/embeddings/${table}?${params.toString()}`);
      return response.deleted_count || 0;
    } catch (error) {
      console.error(`Failed to delete embeddings for ${table}:${entityId}:`, error);
      return 0;
    }
  }

  /**
   * Generate embedding using AI service
   * @param text - Text to embed
   * @param model - Embedding model to use
   * @returns Promise<number[]> - Generated embedding vector
   */
  async generateEmbedding(text: string, model: EmbeddingModel = 'text-embedding-3-small'): Promise<number[]> {
    try {
      const response = await apiService.post('/ai/generate-embedding', {
        text: text.trim(),
        model
      });

      const embedding = response.embedding || response.data?.embedding;
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from AI service');
      }

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Get supported embedding models and their configurations
   * @returns EmbeddingModelConfig[] - Array of supported models
   */
  getSupportedModels(): Array<{
    model: EmbeddingModel;
    dimensions: number;
    max_tokens: number;
    description: string;
  }> {
    return [
      {
        model: 'text-embedding-3-small',
        dimensions: 1536,
        max_tokens: 8191,
        description: 'Most capable small embedding model for english and non-english tasks'
      },
      {
        model: 'text-embedding-3-large',
        dimensions: 3072,
        max_tokens: 8191,
        description: 'Most capable large embedding model for english and non-english tasks'
      },
      {
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        max_tokens: 8191,
        description: 'Legacy embedding model (deprecated, use text-embedding-3-small instead)'
      }
    ];
  }

  /**
   * Get supported embedding types and their descriptions
   * @returns EmbeddingTypeConfig[] - Array of supported embedding types
   */
  getSupportedEmbeddingTypes(): Array<{
    type: EmbeddingType;
    description: string;
    applicable_tables: EmbeddingTable[];
  }> {
    return [
      {
        type: 'state',
        description: 'Embedding of action state/situation description',
        applicable_tables: ['action_embedding']
      },
      {
        type: 'policy_text',
        description: 'Embedding of action policy text',
        applicable_tables: ['action_embedding']
      },
      {
        type: 'summary_policy_text',
        description: 'Embedding of action summary policy text',
        applicable_tables: ['action_embedding']
      },
      {
        type: 'exploration_notes',
        description: 'Embedding of exploration notes text',
        applicable_tables: ['exploration_embedding']
      },
      {
        type: 'metrics',
        description: 'Embedding of exploration metrics text',
        applicable_tables: ['exploration_embedding']
      },
      {
        type: 'policy_description',
        description: 'Embedding of policy description text',
        applicable_tables: ['policy_embedding']
      }
    ];
  }

  /**
   * Validate embedding type for a given table
   * @param embeddingType - Embedding type to validate
   * @param table - Target embedding table
   * @returns boolean - True if valid combination
   */
  isValidEmbeddingTypeForTable(embeddingType: EmbeddingType, table: EmbeddingTable): boolean {
    const supportedTypes = this.getSupportedEmbeddingTypes();
    const typeConfig = supportedTypes.find(config => config.type === embeddingType);
    
    return typeConfig ? typeConfig.applicable_tables.includes(table) : false;
  }
}

// Export a singleton instance for convenience
export const embeddingService = new EmbeddingService();