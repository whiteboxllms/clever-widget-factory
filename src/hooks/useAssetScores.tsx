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
  prompt_text: string;
  scores: Record<string, { score: number; reason: string }>;
  ai_response?: Record<string, any>;
  likely_root_causes?: string[];
  score_attribution_type?: 'action' | 'issue_reporter' | 'issue_responsible';
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
      const response = await apiService.get<{ data: any[] }>(`/action_scores?asset_context_id=${assetContextId}`);
      const data = response.data || [];
      
      setScores(data.map((item: any) => ({
        id: item.id,
        asset_id: item.asset_context_id || '',
        asset_name: item.asset_context_name || 'Unknown Asset',
        source_type: item.source_type as 'action' | 'issue',
        source_id: item.source_id,
        prompt_id: item.prompt_id,
        prompt_text: item.prompt_text,
        scores: item.scores as Record<string, { score: number; reason: string }>,
        ai_response: item.ai_response as Record<string, any>,
        likely_root_causes: item.likely_root_causes || [],
        created_at: item.created_at,
        updated_at: item.updated_at
      })));
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
    prompt_text: string;
    scores: Record<string, { score: number; reason: string }>;
    ai_response?: Record<string, any>;
    likely_root_causes?: string[];
    score_attribution_type?: 'action' | 'issue_reporter' | 'issue_responsible';
    user_id?: string;
  }) => {
    try {
      let actionId = scoreData.source_id;

      // If this is an issue-based score, we need to create a placeholder action first
      if (scoreData.source_type === 'issue') {
        // Check if an action already exists for this issue
        const checkResponse = await apiService.get<{ data: any[] }>(`/actions?linked_issue_id=${scoreData.source_id}`);
        const existingAction = checkResponse.data?.[0];

        if (existingAction) {
          actionId = existingAction.id;
        } else {
          // Create a placeholder action for this issue
          const newAction = await apiService.post('/actions', {
            title: 'Score tracking for issue',
            description: 'Automatically created action for issue score tracking',
            status: 'not_started',
            linked_issue_id: scoreData.source_id,
            asset_id: scoreData.asset_id
          });
          
          if (!newAction?.data?.id) {
            throw new Error('Failed to create placeholder action');
          }

          actionId = newAction.data.id;
        }
      }

      // Insert the action score
      const response = await apiService.post('/action_scores', {
        action_id: actionId,
        asset_context_id: scoreData.asset_id,
        asset_context_name: scoreData.asset_name,
        source_type: scoreData.source_type,
        source_id: scoreData.source_id,
        prompt_id: scoreData.prompt_id,
        prompt_text: scoreData.prompt_text,
        scores: scoreData.scores,
        ai_response: scoreData.ai_response,
        likely_root_causes: scoreData.likely_root_causes,
        score_attribution_type: scoreData.score_attribution_type || 'action'
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
    try {
      await apiService.put(`/action_scores/${id}`, updates);

      await fetchScores();
      toast({
        title: "Success",
        description: "Asset score updated successfully",
      });
    } catch (error) {
      console.error('Error updating asset score:', error);
      toast({
        title: "Error",
        description: "Failed to update asset score",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getScoreForIssue = async (issueId: string) => {
    try {
      const response = await apiService.get<{ data: any[] }>(`/action_scores?source_id=${issueId}&source_type=issue`);
      const data = response.data?.[0];
      
      if (!data) return null;
      
      return {
        id: data.id,
        asset_id: data.asset_context_id || '',
        asset_name: data.asset_context_name || 'Unknown Asset',
        source_type: data.source_type as 'action' | 'issue',
        source_id: data.source_id,
        prompt_id: data.prompt_id,
        prompt_text: data.prompt_text,
        scores: data.scores as Record<string, { score: number; reason: string }>,
        ai_response: data.ai_response as Record<string, any>,
        likely_root_causes: data.likely_root_causes || [],
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
      const response = await apiService.get<{ data: any[] }>(`/action_scores?source_id=${actionId}&source_type=action`);
      const data = response.data?.[0];
      
      if (!data) return null;
      
      return {
        id: data.id,
        asset_id: data.asset_context_id || '',
        asset_name: data.asset_context_name || 'Unknown Asset',
        source_type: data.source_type as 'action' | 'issue',
        source_id: data.source_id,
        prompt_id: data.prompt_id,
        prompt_text: data.prompt_text,
        scores: data.scores as Record<string, { score: number; reason: string }>,
        ai_response: data.ai_response as Record<string, any>,
        likely_root_causes: data.likely_root_causes || [],
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