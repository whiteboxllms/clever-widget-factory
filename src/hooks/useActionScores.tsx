import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { actionsQueryKey } from '@/lib/queryKeys';
import { BaseAction } from '@/types/actions';

export interface ActionScore {
  id: string;
  action_id: string;
  prompt_id: string;
  scores: Array<{ score_name: string; score: number; reason: string; how_to_improve?: string }>;
  attributes?: Array<{ attribute_name: string; attribute_values: string[] }>;
  contexts?: Array<{ context_service: string; context_id: string }>;
  ai_response?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const useActionScores = (actionId?: string) => {
  const [scores, setScores] = useState<ActionScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchScores = async (targetActionId?: string) => {
    if (!targetActionId && !actionId) return;
    
    try {
      setIsLoading(true);
      const sourceId = targetActionId || actionId;
      const response = await apiService.get<{ data: any[] }>(
        `/analysis/analyses?context_service=action_score&context_id=${sourceId}`
      );
      const data = response.data || [];

      setScores(
        data.map((item: any) => ({
          id: item.id,
          action_id: item.contexts?.find((c: any) => c.context_service === 'action_score')?.context_id || '',
          prompt_id: item.prompt_id,
          scores: item.scores || [],
          attributes: item.attributes || [],
          contexts: item.contexts || [],
          ai_response: item.ai_response,
          created_at: item.created_at,
          updated_at: item.updated_at,
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
    scores: Array<{ score_name: string; score: number; reason: string; how_to_improve?: string }>;
    ai_response?: Record<string, any>;
    attributes?: Array<{ attribute_name: string; attribute_values: string[] }>;
  }) => {
    // Optimistic update: immediately update has_score in cache
    queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
      if (!old) return old;
      return old.map(action => 
        action.id === scoreData.action_id 
          ? { ...action, has_score: true }
          : action
      );
    });

    try {
      const response = await apiService.post<{ data: any }>(
        '/analysis/analyses',
        {
          prompt_id: scoreData.prompt_id,
          scores: scoreData.scores,
          ai_response: scoreData.ai_response,
          attributes: scoreData.attributes,
          contexts: [{ context_service: 'action_score', context_id: scoreData.action_id }]
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
      // Rollback optimistic update on error
      queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
        if (!old) return old;
        return old.map(action => 
          action.id === scoreData.action_id 
            ? { ...action, has_score: false }
            : action
        );
      });
      
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
    // No update endpoint - delete and recreate instead
    throw new Error('Update not supported - create new score instead');
  };

  const getScoreForAction = useCallback(async (actionId: string) => {
    try {
      const response = await apiService.get<{ data: any[] }>(
        `/analysis/analyses?context_service=action_score&context_id=${actionId}`
      );
      const data = response.data?.[0];

      if (!data) return null;

      return {
        id: data.id,
        action_id: data.contexts?.find((c: any) => c.context_service === 'action_score')?.context_id || '',
        prompt_id: data.prompt_id,
        scores: data.scores || [],
        attributes: data.attributes || [],
        contexts: data.contexts || [],
        ai_response: data.ai_response,
        created_at: data.created_at,
        updated_at: data.updated_at
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