import { useState, useEffect } from 'react';
import { apiService } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export interface AssetScore {
  id: string;
  asset_id: string;
  asset_name: string;
  source_type: 'issue' | 'action';
  source_id: string;
  prompt_id: string;
  scores: Array<{ score_name: string; score: number; reason: string; how_to_improve?: string }>;
  attributes?: Array<{ attribute_name: string; attribute_values: string[] }>;
  contexts?: Array<{ context_service: string; context_id: string }>;
  ai_response?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const useAssetScores = (assetId?: string) => {
  const [scores, setScores] = useState<AssetScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchScores = async (targetAssetId?: string) => {
    if (!targetAssetId && !assetId) return;
    
    try {
      setIsLoading(true);
      const assetContextId = targetAssetId || assetId;
      const response = await apiService.get<{ data: any[] }>(`/analysis/analyses?asset_context_id=${assetContextId}`);
      const data = response.data || [];
      
      setScores(data.map((item: any) => {
        const actionContext = item.contexts?.find((c: any) => c.context_service === 'action_score');
        const issueContext = item.contexts?.find((c: any) => c.context_service === 'issue_score');
        
        return {
          id: item.id,
          asset_id: assetContextId,
          asset_name: 'Asset',
          source_type: issueContext ? 'issue' : 'action',
          source_id: (issueContext || actionContext)?.context_id || '',
          prompt_id: item.prompt_id,
          scores: item.scores || [],
          attributes: item.attributes || [],
          contexts: item.contexts || [],
          ai_response: item.ai_response,
          created_at: item.created_at,
          updated_at: item.updated_at
        };
      }));
    } catch (error) {
      console.error('Error fetching asset scores:', error);
      toast({
        title: "Error",
        description: "Failed to fetch asset scores",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createScore = async (scoreData: {
    asset_id: string;
    asset_name: string;
    source_type: 'issue' | 'action';
    source_id: string;
    prompt_id: string;
    scores: Array<{ score_name: string; score: number; reason: string; how_to_improve?: string }>;
    ai_response?: Record<string, any>;
    attributes?: Array<{ attribute_name: string; attribute_values: string[] }>;
  }) => {
    try {
      const contextService = scoreData.source_type === 'issue' ? 'issue_score' : 'action_score';
      
      const response = await apiService.post('/analysis/analyses', {
        prompt_id: scoreData.prompt_id,
        scores: scoreData.scores,
        ai_response: scoreData.ai_response,
        attributes: scoreData.attributes,
        contexts: [{ context_service: contextService, context_id: scoreData.source_id }]
      });
      const data = response.data;

      if (!data) {
        throw new Error('Failed to create action score');
      }

      await fetchScores(scoreData.asset_id);
      toast({
        title: "Success",
        description: "Asset score created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating asset score:', error);
      toast({
        title: "Error",
        description: "Failed to create asset score",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateScore = async (id: string, updates: Partial<AssetScore>) => {
    console.warn('Update not implemented for new analysis schema');
    throw new Error('Update not implemented');
  };

  const getScoreForIssue = async (issueId: string) => {
    try {
      const response = await apiService.get<{ data: any[] }>(`/analysis/analyses?context_service=issue_score&context_id=${issueId}`);
      const data = response.data?.[0];
      
      if (!data) return null;
      
      return {
        id: data.id,
        asset_id: '',
        asset_name: 'Asset',
        source_type: 'issue' as const,
        source_id: issueId,
        prompt_id: data.prompt_id,
        scores: data.scores || [],
        attributes: data.attributes || [],
        contexts: data.contexts || [],
        ai_response: data.ai_response,
        created_at: data.created_at,
        updated_at: data.updated_at
      } as AssetScore;
    } catch (error) {
      console.error('Error fetching score for issue:', error);
      return null;
    }
  };

  const getScoreForAction = async (actionId: string) => {
    try {
      const response = await apiService.get<{ data: any[] }>(`/analysis/analyses?context_service=action_score&context_id=${actionId}`);
      const data = response.data?.[0];
      
      if (!data) return null;
      
      return {
        id: data.id,
        asset_id: '',
        asset_name: 'Asset',
        source_type: 'action' as const,
        source_id: actionId,
        prompt_id: data.prompt_id,
        scores: data.scores || [],
        attributes: data.attributes || [],
        contexts: data.contexts || [],
        ai_response: data.ai_response,
        created_at: data.created_at,
        updated_at: data.updated_at
      } as AssetScore;
    } catch (error) {
      console.error('Error fetching score for action:', error);
      return null;
    }
  };

  useEffect(() => {
    if (assetId) {
      fetchScores();
    }
  }, [assetId]);

  return {
    scores,
    isLoading,
    fetchScores,
    createScore,
    updateScore,
    getScoreForIssue,
    getScoreForAction,
  };
};