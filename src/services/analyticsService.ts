/**
 * AnalyticsService
 * 
 * Provides analytics queries for exploration data collection
 * Calculates exploration percentages by date range
 * Supports pattern analysis across actions and explorations
 * Note: Analytics are non-RL focused - numeric reward functions are out of scope
 * 
 * Requirements: 5.5
 */

import { apiService } from '../lib/apiService';
import { semanticSearchService } from './semanticSearchService';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ExplorationAnalytics {
  total_actions: number;
  total_explorations: number;
  exploration_percentage: number;
  date_range: DateRange;
  breakdown_by_period?: {
    period: 'day' | 'week' | 'month';
    data: Array<{
      period_start: string;
      period_end: string;
      total_actions: number;
      total_explorations: number;
      exploration_percentage: number;
    }>;
  };
}

export interface PatternAnalysis {
  common_themes: Array<{
    theme: string;
    frequency: number;
    entity_type: 'action' | 'exploration' | 'policy';
    examples: string[];
  }>;
  exploration_trends: Array<{
    exploration_code_pattern: string;
    count: number;
    date_range: DateRange;
  }>;
  policy_adoption: Array<{
    policy_id: number;
    policy_title: string;
    linked_actions_count: number;
    adoption_percentage: number;
  }>;
}

export interface SemanticGrouping {
  group_id: string;
  group_theme: string;
  similarity_threshold: number;
  entities: Array<{
    entity_id: string;
    entity_type: 'action' | 'exploration' | 'policy';
    similarity_score: number;
    title?: string;
    description?: string;
  }>;
  group_size: number;
}

export interface AnalyticsFilters {
  date_range?: DateRange;
  location?: string;
  explorer?: string;
  status?: string;
  public_flag?: boolean;
  organization_id?: string;
}

export class AnalyticsService {
  /**
   * Calculate exploration percentages by date range
   * @param dateRange - Date range for analysis
   * @param filters - Additional filters
   * @returns Promise<ExplorationAnalytics> - Exploration analytics data
   */
  async getExplorationPercentages(
    dateRange: DateRange,
    filters: AnalyticsFilters = {}
  ): Promise<ExplorationAnalytics> {
    try {
      const { start, end } = dateRange;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.explorer) queryParams.append('explorer', filters.explorer);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/exploration-percentages?${queryParams.toString()}`);
      return response.data || response;
    } catch (error) {
      console.error('Failed to get exploration percentages:', error);
      throw error;
    }
  }

  /**
   * Get exploration percentages with period breakdown
   * @param dateRange - Date range for analysis
   * @param period - Breakdown period (day, week, month)
   * @param filters - Additional filters
   * @returns Promise<ExplorationAnalytics> - Exploration analytics with breakdown
   */
  async getExplorationPercentagesWithBreakdown(
    dateRange: DateRange,
    period: 'day' | 'week' | 'month' = 'week',
    filters: AnalyticsFilters = {}
  ): Promise<ExplorationAnalytics> {
    try {
      const { start, end } = dateRange;
      
      const queryParams = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        period
      });
      
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.explorer) queryParams.append('explorer', filters.explorer);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/exploration-percentages-breakdown?${queryParams.toString()}`);
      return response.data || response;
    } catch (error) {
      console.error('Failed to get exploration percentages with breakdown:', error);
      throw error;
    }
  }

  /**
   * Analyze patterns across actions and explorations
   * @param dateRange - Date range for analysis
   * @param filters - Additional filters
   * @returns Promise<PatternAnalysis> - Pattern analysis results
   */
  async analyzePatterns(
    dateRange: DateRange,
    filters: AnalyticsFilters = {}
  ): Promise<PatternAnalysis> {
    try {
      const { start, end } = dateRange;
      
      const queryParams = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.explorer) queryParams.append('explorer', filters.explorer);
      if (filters.public_flag !== undefined) queryParams.append('public_flag', String(filters.public_flag));
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/pattern-analysis?${queryParams.toString()}`);
      return response.data || response;
    } catch (error) {
      console.error('Failed to analyze patterns:', error);
      throw error;
    }
  }

  /**
   * Create semantic groupings of similar content
   * @param entityType - Type of entities to group
   * @param similarityThreshold - Minimum similarity threshold for grouping
   * @param filters - Additional filters
   * @returns Promise<SemanticGrouping[]> - Array of semantic groupings
   */
  async createSemanticGroupings(
    entityType: 'actions' | 'explorations' | 'policies',
    similarityThreshold: number = 0.8,
    filters: AnalyticsFilters = {}
  ): Promise<SemanticGrouping[]> {
    try {
      const queryParams = new URLSearchParams({
        entity_type: entityType,
        similarity_threshold: similarityThreshold.toString()
      });
      
      if (filters.date_range) {
        queryParams.append('start_date', filters.date_range.start.toISOString());
        queryParams.append('end_date', filters.date_range.end.toISOString());
      }
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.public_flag !== undefined) queryParams.append('public_flag', String(filters.public_flag));
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/semantic-groupings?${queryParams.toString()}`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to create semantic groupings:', error);
      return [];
    }
  }

  /**
   * Get exploration trends over time
   * @param dateRange - Date range for analysis
   * @param groupBy - Grouping period (day, week, month)
   * @param filters - Additional filters
   * @returns Promise<ExplorationTrend[]> - Exploration trends data
   */
  async getExplorationTrends(
    dateRange: DateRange,
    groupBy: 'day' | 'week' | 'month' = 'week',
    filters: AnalyticsFilters = {}
  ): Promise<Array<{
    period_start: string;
    period_end: string;
    exploration_count: number;
    action_count: number;
    exploration_percentage: number;
    top_exploration_codes: string[];
  }>> {
    try {
      const { start, end } = dateRange;
      
      const queryParams = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        group_by: groupBy
      });
      
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.explorer) queryParams.append('explorer', filters.explorer);
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/exploration-trends?${queryParams.toString()}`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to get exploration trends:', error);
      return [];
    }
  }

  /**
   * Analyze policy adoption rates
   * @param dateRange - Date range for analysis
   * @param filters - Additional filters
   * @returns Promise<PolicyAdoptionAnalysis> - Policy adoption analysis
   */
  async analyzePolicyAdoption(
    dateRange: DateRange,
    filters: AnalyticsFilters = {}
  ): Promise<{
    total_policies: number;
    active_policies: number;
    total_linked_actions: number;
    policy_adoption_rate: number;
    top_policies: Array<{
      policy_id: number;
      policy_title: string;
      linked_actions_count: number;
      adoption_percentage: number;
      created_at: string;
    }>;
  }> {
    try {
      const { start, end } = dateRange;
      
      const queryParams = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString()
      });
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/policy-adoption?${queryParams.toString()}`);
      return response.data || response;
    } catch (error) {
      console.error('Failed to analyze policy adoption:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   * @param dateRange - Date range for analysis
   * @param filters - Additional filters
   * @returns Promise<AnalyticsDashboard> - Complete dashboard data
   */
  async getDashboardData(
    dateRange: DateRange,
    filters: AnalyticsFilters = {}
  ): Promise<{
    exploration_analytics: ExplorationAnalytics;
    pattern_analysis: PatternAnalysis;
    exploration_trends: Array<{
      period_start: string;
      period_end: string;
      exploration_count: number;
      action_count: number;
      exploration_percentage: number;
    }>;
    policy_adoption: {
      total_policies: number;
      active_policies: number;
      total_linked_actions: number;
      policy_adoption_rate: number;
    };
    summary_stats: {
      total_actions: number;
      total_explorations: number;
      total_policies: number;
      avg_exploration_percentage: number;
      date_range: DateRange;
    };
  }> {
    try {
      const [
        explorationAnalytics,
        patternAnalysis,
        explorationTrends,
        policyAdoption
      ] = await Promise.all([
        this.getExplorationPercentages(dateRange, filters),
        this.analyzePatterns(dateRange, filters),
        this.getExplorationTrends(dateRange, 'week', filters),
        this.analyzePolicyAdoption(dateRange, filters)
      ]);

      const summaryStats = {
        total_actions: explorationAnalytics.total_actions,
        total_explorations: explorationAnalytics.total_explorations,
        total_policies: policyAdoption.total_policies,
        avg_exploration_percentage: explorationAnalytics.exploration_percentage,
        date_range: dateRange
      };

      return {
        exploration_analytics: explorationAnalytics,
        pattern_analysis: patternAnalysis,
        exploration_trends: explorationTrends,
        policy_adoption: {
          total_policies: policyAdoption.total_policies,
          active_policies: policyAdoption.active_policies,
          total_linked_actions: policyAdoption.total_linked_actions,
          policy_adoption_rate: policyAdoption.policy_adoption_rate
        },
        summary_stats: summaryStats
      };
    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Find content clusters using semantic similarity
   * @param entityType - Type of entities to cluster
   * @param clusterCount - Number of clusters to create
   * @param filters - Additional filters
   * @returns Promise<ContentCluster[]> - Array of content clusters
   */
  async findContentClusters(
    entityType: 'actions' | 'explorations' | 'policies',
    clusterCount: number = 5,
    filters: AnalyticsFilters = {}
  ): Promise<Array<{
    cluster_id: number;
    cluster_theme: string;
    entity_count: number;
    representative_entities: Array<{
      entity_id: string;
      title?: string;
      description?: string;
      similarity_to_centroid: number;
    }>;
    cluster_keywords: string[];
  }>> {
    try {
      const queryParams = new URLSearchParams({
        entity_type: entityType,
        cluster_count: clusterCount.toString()
      });
      
      if (filters.date_range) {
        queryParams.append('start_date', filters.date_range.start.toISOString());
        queryParams.append('end_date', filters.date_range.end.toISOString());
      }
      if (filters.location) queryParams.append('location', filters.location);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.organization_id) queryParams.append('organization_id', filters.organization_id);
      
      const response = await apiService.get(`/analytics/content-clusters?${queryParams.toString()}`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to find content clusters:', error);
      return [];
    }
  }
}

// Export a singleton instance for convenience
export const analyticsService = new AnalyticsService();