/**
 * SemanticSearchService
 * 
 * Provides dense vector search with structured filters
 * Supports search across action, exploration, and policy embeddings
 * Enables entity type filtering and cross-entity search
 * 
 * Requirements: 4.6, 5.6
 */

import { apiService } from '../lib/apiService';
import { embeddingService, EmbeddingType, EmbeddingModel, EmbeddingTable } from './embeddingService';

export interface SemanticSearchQuery {
  text: string;
  model?: EmbeddingModel;
  limit?: number;
  threshold?: number;
}

export interface SemanticSearchFilters {
  entity_types?: ('actions' | 'explorations' | 'policies')[];
  embedding_types?: EmbeddingType[];
  models?: EmbeddingModel[];
  date_range?: {
    start: Date;
    end: Date;
  };
  public_flag?: boolean; // For explorations
  status?: string; // For actions and policies
}

export interface SemanticSearchResult {
  entity_id: string;
  entity_type: 'action' | 'exploration' | 'policy';
  embedding_type: EmbeddingType;
  similarity: number;
  model: EmbeddingModel;
  text_length: number;
  created_at: string;
  // Entity-specific data
  entity_data?: {
    title?: string;
    description?: string;
    state_text?: string;
    policy_text?: string;
    summary_policy_text?: string;
    exploration_code?: string;
    exploration_notes_text?: string;
    metrics_text?: string;
    public_flag?: boolean;
    status?: string;
  };
}

export interface CrossEntitySearchResult {
  actions: SemanticSearchResult[];
  explorations: SemanticSearchResult[];
  policies: SemanticSearchResult[];
  total_results: number;
  search_metadata: {
    query_text: string;
    model_used: EmbeddingModel;
    threshold: number;
    search_time_ms: number;
  };
}

export class SemanticSearchService {
  /**
   * Search for similar content across all entity types
   * @param query - Search query
   * @param filters - Search filters
   * @returns Promise<CrossEntitySearchResult> - Cross-entity search results
   */
  async searchAll(
    query: SemanticSearchQuery,
    filters: SemanticSearchFilters = {}
  ): Promise<CrossEntitySearchResult> {
    const startTime = Date.now();
    
    try {
      const {
        text,
        model = 'text-embedding-3-small',
        limit = 10,
        threshold = 0.7
      } = query;

      const {
        entity_types = ['actions', 'explorations', 'policies'],
        embedding_types,
        models,
        date_range,
        public_flag,
        status
      } = filters;

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(text, model);

      // Search across requested entity types
      const searchPromises: Promise<SemanticSearchResult[]>[] = [];

      if (entity_types.includes('actions')) {
        searchPromises.push(
          this.searchActions(queryEmbedding, {
            limit,
            threshold,
            embedding_types: embedding_types?.filter(type => 
              ['state', 'policy_text', 'summary_policy_text'].includes(type)
            ) as Extract<EmbeddingType, 'state' | 'policy_text' | 'summary_policy_text'>[],
            models,
            date_range,
            status
          })
        );
      }

      if (entity_types.includes('explorations')) {
        searchPromises.push(
          this.searchExplorations(queryEmbedding, {
            limit,
            threshold,
            embedding_types: embedding_types?.filter(type => 
              ['exploration_notes', 'metrics'].includes(type)
            ) as Extract<EmbeddingType, 'exploration_notes' | 'metrics'>[],
            models,
            date_range,
            public_flag
          })
        );
      }

      if (entity_types.includes('policies')) {
        searchPromises.push(
          this.searchPolicies(queryEmbedding, {
            limit,
            threshold,
            embedding_types: embedding_types?.filter(type => 
              type === 'policy_description'
            ) as Extract<EmbeddingType, 'policy_description'>[],
            models,
            date_range,
            status
          })
        );
      }

      const [actionsResults = [], explorationsResults = [], policiesResults = []] = 
        await Promise.all(searchPromises);

      const searchTime = Date.now() - startTime;

      return {
        actions: actionsResults,
        explorations: explorationsResults,
        policies: policiesResults,
        total_results: actionsResults.length + explorationsResults.length + policiesResults.length,
        search_metadata: {
          query_text: text,
          model_used: model,
          threshold,
          search_time_ms: searchTime
        }
      };
    } catch (error) {
      console.error('Failed to perform cross-entity semantic search:', error);
      throw error;
    }
  }

  /**
   * Search actions using semantic similarity
   * @param queryEmbedding - Query embedding vector
   * @param options - Search options
   * @returns Promise<SemanticSearchResult[]> - Action search results
   */
  async searchActions(
    queryEmbedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      embedding_types?: Extract<EmbeddingType, 'state' | 'policy_text' | 'summary_policy_text'>[];
      models?: EmbeddingModel[];
      date_range?: { start: Date; end: Date };
      status?: string;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      const searchResults = await embeddingService.searchSimilarEmbeddings(
        queryEmbedding,
        'action_embedding',
        {
          limit: options.limit,
          threshold: options.threshold,
          embedding_types: options.embedding_types,
          models: options.models
        }
      );

      // Enrich results with action data
      const enrichedResults: SemanticSearchResult[] = [];

      for (const result of searchResults) {
        try {
          // Get action data
          const actionResponse = await apiService.get(`/actions/${result.entity_id}`);
          const action = actionResponse.data || actionResponse;

          // Apply additional filters
          if (options.status && action.status !== options.status) {
            continue;
          }

          if (options.date_range) {
            const actionDate = new Date(action.created_at);
            if (actionDate < options.date_range.start || actionDate > options.date_range.end) {
              continue;
            }
          }

          enrichedResults.push({
            ...result,
            entity_type: 'action',
            entity_data: {
              title: action.title,
              description: action.description,
              state_text: action.description, // Mapped field
              policy_text: action.policy, // Mapped field
              summary_policy_text: action.summary_policy_text,
              status: action.status
            }
          });
        } catch (error) {
          console.warn(`Failed to enrich action result ${result.entity_id}:`, error);
          // Include result without enrichment
          enrichedResults.push({
            ...result,
            entity_type: 'action'
          });
        }
      }

      return enrichedResults;
    } catch (error) {
      console.error('Failed to search actions:', error);
      return [];
    }
  }

  /**
   * Search explorations using semantic similarity
   * @param queryEmbedding - Query embedding vector
   * @param options - Search options
   * @returns Promise<SemanticSearchResult[]> - Exploration search results
   */
  async searchExplorations(
    queryEmbedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      embedding_types?: Extract<EmbeddingType, 'exploration_notes' | 'metrics'>[];
      models?: EmbeddingModel[];
      date_range?: { start: Date; end: Date };
      public_flag?: boolean;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      const searchResults = await embeddingService.searchSimilarEmbeddings(
        queryEmbedding,
        'exploration_embedding',
        {
          limit: options.limit,
          threshold: options.threshold,
          embedding_types: options.embedding_types,
          models: options.models
        }
      );

      // Enrich results with exploration data
      const enrichedResults: SemanticSearchResult[] = [];

      for (const result of searchResults) {
        try {
          // Get exploration data
          const explorationResponse = await apiService.get(`/explorations/${result.entity_id}`);
          const exploration = explorationResponse.data || explorationResponse;

          // Apply additional filters
          if (options.public_flag !== undefined && exploration.public_flag !== options.public_flag) {
            continue;
          }

          if (options.date_range) {
            const explorationDate = new Date(exploration.created_at);
            if (explorationDate < options.date_range.start || explorationDate > options.date_range.end) {
              continue;
            }
          }

          enrichedResults.push({
            ...result,
            entity_type: 'exploration',
            entity_data: {
              exploration_code: exploration.exploration_code,
              exploration_notes_text: exploration.exploration_notes_text,
              metrics_text: exploration.metrics_text,
              public_flag: exploration.public_flag
            }
          });
        } catch (error) {
          console.warn(`Failed to enrich exploration result ${result.entity_id}:`, error);
          // Include result without enrichment
          enrichedResults.push({
            ...result,
            entity_type: 'exploration'
          });
        }
      }

      return enrichedResults;
    } catch (error) {
      console.error('Failed to search explorations:', error);
      return [];
    }
  }

  /**
   * Search policies using semantic similarity
   * @param queryEmbedding - Query embedding vector
   * @param options - Search options
   * @returns Promise<SemanticSearchResult[]> - Policy search results
   */
  async searchPolicies(
    queryEmbedding: number[],
    options: {
      limit?: number;
      threshold?: number;
      embedding_types?: Extract<EmbeddingType, 'policy_description'>[];
      models?: EmbeddingModel[];
      date_range?: { start: Date; end: Date };
      status?: string;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      const searchResults = await embeddingService.searchSimilarEmbeddings(
        queryEmbedding,
        'policy_embedding',
        {
          limit: options.limit,
          threshold: options.threshold,
          embedding_types: options.embedding_types,
          models: options.models
        }
      );

      // Enrich results with policy data
      const enrichedResults: SemanticSearchResult[] = [];

      for (const result of searchResults) {
        try {
          // Get policy data
          const policyResponse = await apiService.get(`/policies/${result.entity_id}`);
          const policy = policyResponse.data || policyResponse;

          // Apply additional filters
          if (options.status && policy.status !== options.status) {
            continue;
          }

          if (options.date_range) {
            const policyDate = new Date(policy.created_at);
            if (policyDate < options.date_range.start || policyDate > options.date_range.end) {
              continue;
            }
          }

          enrichedResults.push({
            ...result,
            entity_type: 'policy',
            entity_data: {
              title: policy.title,
              description: policy.description_text,
              status: policy.status
            }
          });
        } catch (error) {
          console.warn(`Failed to enrich policy result ${result.entity_id}:`, error);
          // Include result without enrichment
          enrichedResults.push({
            ...result,
            entity_type: 'policy'
          });
        }
      }

      return enrichedResults;
    } catch (error) {
      console.error('Failed to search policies:', error);
      return [];
    }
  }

  /**
   * Find similar actions to a given action
   * @param actionId - Source action ID
   * @param embeddingType - Type of embedding to use for similarity
   * @param options - Search options
   * @returns Promise<SemanticSearchResult[]> - Similar actions
   */
  async findSimilarActions(
    actionId: string,
    embeddingType: Extract<EmbeddingType, 'state' | 'policy_text' | 'summary_policy_text'> = 'state',
    options: {
      limit?: number;
      threshold?: number;
      exclude_self?: boolean;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      // Get the source action's embedding
      const sourceEmbedding = await embeddingService.getLatestEmbedding(
        actionId,
        'action_embedding',
        embeddingType
      );

      if (!sourceEmbedding) {
        console.warn(`No ${embeddingType} embedding found for action ${actionId}`);
        return [];
      }

      // Search for similar actions
      const results = await this.searchActions(sourceEmbedding.embedding, {
        limit: (options.limit || 10) + (options.exclude_self !== false ? 1 : 0), // Get extra to account for self-exclusion
        threshold: options.threshold,
        embedding_types: [embeddingType]
      });

      // Exclude the source action if requested
      const filteredResults = options.exclude_self !== false 
        ? results.filter(result => result.entity_id !== actionId)
        : results;

      return filteredResults.slice(0, options.limit || 10);
    } catch (error) {
      console.error(`Failed to find similar actions for ${actionId}:`, error);
      return [];
    }
  }

  /**
   * Find similar explorations to a given exploration
   * @param explorationId - Source exploration ID
   * @param embeddingType - Type of embedding to use for similarity
   * @param options - Search options
   * @returns Promise<SemanticSearchResult[]> - Similar explorations
   */
  async findSimilarExplorations(
    explorationId: string,
    embeddingType: Extract<EmbeddingType, 'exploration_notes' | 'metrics'> = 'exploration_notes',
    options: {
      limit?: number;
      threshold?: number;
      exclude_self?: boolean;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    try {
      // Get the source exploration's embedding
      const sourceEmbedding = await embeddingService.getLatestEmbedding(
        explorationId,
        'exploration_embedding',
        embeddingType
      );

      if (!sourceEmbedding) {
        console.warn(`No ${embeddingType} embedding found for exploration ${explorationId}`);
        return [];
      }

      // Search for similar explorations
      const results = await this.searchExplorations(sourceEmbedding.embedding, {
        limit: (options.limit || 10) + (options.exclude_self !== false ? 1 : 0),
        threshold: options.threshold,
        embedding_types: [embeddingType]
      });

      // Exclude the source exploration if requested
      const filteredResults = options.exclude_self !== false 
        ? results.filter(result => result.entity_id !== explorationId)
        : results;

      return filteredResults.slice(0, options.limit || 10);
    } catch (error) {
      console.error(`Failed to find similar explorations for ${explorationId}:`, error);
      return [];
    }
  }

  /**
   * Get search suggestions based on partial query
   * @param partialQuery - Partial search query
   * @param limit - Number of suggestions to return
   * @returns Promise<string[]> - Array of search suggestions
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    try {
      // This is a simplified implementation - in production you might want to use
      // a dedicated search suggestion service or maintain a search terms index
      
      if (partialQuery.length < 2) {
        return [];
      }

      // Search for similar content and extract common terms
      const searchResults = await this.searchAll(
        { text: partialQuery, limit: 20, threshold: 0.5 },
        { entity_types: ['actions', 'explorations', 'policies'] }
      );

      const suggestions = new Set<string>();

      // Extract terms from entity titles and descriptions
      searchResults.actions.forEach(result => {
        if (result.entity_data?.title) {
          suggestions.add(result.entity_data.title);
        }
      });

      searchResults.explorations.forEach(result => {
        if (result.entity_data?.exploration_code) {
          suggestions.add(result.entity_data.exploration_code);
        }
      });

      searchResults.policies.forEach(result => {
        if (result.entity_data?.title) {
          suggestions.add(result.entity_data.title);
        }
      });

      return Array.from(suggestions)
        .filter(suggestion => 
          suggestion.toLowerCase().includes(partialQuery.toLowerCase())
        )
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }
}

// Export a singleton instance for convenience
export const semanticSearchService = new SemanticSearchService();