import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase
        .from('action_scores')
        .select('*')
        .eq('action_id', targetActionId || actionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScores((data || []) as ActionScore[]);
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
      const { data, error } = await supabase
        .from('action_scores')
        .insert({
          ...scoreData,
          source_type: 'action',
          source_id: scoreData.action_id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchScores(scoreData.action_id);
      toast({
        title: "Success",
        description: "Action score created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating action score:', error);
      toast({
        title: "Error",
        description: "Failed to create action score",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateScore = async (id: string, updates: Partial<ActionScore>) => {
    try {
      const { error } = await supabase
        .from('action_scores')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

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

  const getScoreForAction = async (actionId: string) => {
    try {
      const { data, error } = await supabase
        .from('action_scores')
        .select('*')
        .eq('action_id', actionId)
        .maybeSingle();

      if (error) throw error;
      return data as ActionScore | null;
    } catch (error) {
      console.error('Error fetching score for action:', error);
      return null;
    }
  };

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