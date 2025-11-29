import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export interface ActionScore {
  id: string;
  action_id: string;
  source_type: 'action';
  source_id: string;
  prompt_id: string;
  prompt_text: string;
  scores: Record<string, { score: number; reason: string }>;
  ai_response?: Record<string, any>;
  likely_root_causes?: string[];
  created_at: string;
  updated_at: string;
  asset_context_id?: string;
  asset_context_name?: string;
}

export const useActionScores = (actionId?: string) => {
  const [scores, setScores] = useState<ActionScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchScores = async (targetActionId?: string) => {
    if (!targetActionId && !actionId) return;
    
    try {
      setIsLoading(true);
      const sourceId = targetActionId || actionId;
      const response = await apiService.get<{ data: any[] }>(
        `/action_scores?source_id=${sourceId}&source_type=action`
      );
      const data = response.data || [];

      setScores(
        data.map((item: any) => ({
          id: item.id,
          action_id: item.action_id,
          source_type: 'action' as const,
          source_id: item.source_id,
          prompt_id: item.prompt_id,
          prompt_text: item.prompt_text,
          scores: item.scores as Record<string, { score: number; reason: string }>,
          ai_response: item.ai_response as Record<string, any>,
          likely_root_causes: item.likely_root_causes || [],
          created_at: item.created_at,
          updated_at: item.updated_at,
          asset_context_id: item.asset_context_id,
          asset_context_name: item.asset_context_name,
        }))
      );
    } catch (error) {
      console.error('Error fetching action scores:', error);
      toast({
        title: "Error",
        description: "Failed to fetch action scores",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createScore = async (scoreData: {
    action_id: string;
    prompt_id: string;
    prompt_text: string;
    scores: Record<string, { score: number; reason: string }>;
    ai_response?: Record<string, any>;
    likely_root_causes?: string[];
    asset_context_id?: string;
    asset_context_name?: string;
  }) => {
    try {
      const response = await apiService.post<{ data: any }>(
        '/action_scores',
        {
          action_id: scoreData.action_id,
          source_type: 'action',
          source_id: scoreData.action_id,
          prompt_id: scoreData.prompt_id,
          prompt_text: scoreData.prompt_text,
          scores: scoreData.scores,
          ai_response: scoreData.ai_response,
          likely_root_causes: scoreData.likely_root_causes,
          asset_context_id: scoreData.asset_context_id,
          asset_context_name: scoreData.asset_context_name,
        }
      );
      const data = response.data;

      await fetchScores(scoreData.action_id);
      toast({
        title: "Success",
        description: "Action score created successfully",
      });
      return data;
    } catch (error: any) {
      console.error('Error creating action score:', error);
      const errorMsg = error?.response?.data?.error || "Failed to create action score";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateScore = async (id: string, updates: Partial<ActionScore>) => {
    try {
      await apiService.put(`/action_scores/${id}`, updates);

      await fetchScores();
      toast({
        title: "Success",
        description: "Action score updated successfully",
      });
    } catch (error) {
      console.error('Error updating action score:', error);
      toast({
        title: "Error",
        description: "Failed to update action score",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getScoreForAction = useCallback(async (actionId: string) => {
    try {
      const response = await apiService.get<{ data: any[] }>(
        `/action_scores?source_id=${actionId}&source_type=action`
      );
      const data = response.data?.[0];

      if (!data) return null;

      return {
        id: data.id,
        action_id: data.action_id,
        source_type: 'action' as const,
        source_id: data.source_id,
        prompt_id: data.prompt_id,
        prompt_text: data.prompt_text,
        scores: data.scores as Record<string, { score: number; reason: string }>,
        ai_response: data.ai_response as Record<string, any>,
        likely_root_causes: data.likely_root_causes || [],
        created_at: data.created_at,
        updated_at: data.updated_at,
        asset_context_id: data.asset_context_id,
        asset_context_name: data.asset_context_name
      } as ActionScore;
    } catch (error) {
      console.error('Error fetching score for action:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (actionId) {
      fetchScores();
    }
  }, [actionId]);

  return {
    scores,
    isLoading,
    fetchScores,
    createScore,
    updateScore,
    getScoreForAction,
  };
};