import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      let query = supabase
        .from('action_scores')
        .select('*')
        .eq('asset_context_id', targetAssetId || assetId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      setScores((data || []).map(item => ({
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
      const { data, error } = await supabase
        .from('action_scores')
        .insert({
          action_id: scoreData.source_id,
          asset_context_id: scoreData.asset_id,
          asset_context_name: scoreData.asset_name,
          source_type: scoreData.source_type,
          source_id: scoreData.source_id,
          prompt_id: scoreData.prompt_id,
          prompt_text: scoreData.prompt_text,
          scores: scoreData.scores,
          ai_response: scoreData.ai_response,
          likely_root_causes: scoreData.likely_root_causes || [],
          score_attribution_type: scoreData.score_attribution_type || 'action'
        })
        .select()
        .single();

      if (error) throw error;

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
      const { error } = await supabase
        .from('action_scores')
        .update({
          scores: updates.scores,
          ai_response: updates.ai_response,
          likely_root_causes: updates.likely_root_causes
        })
        .eq('id', id);

      if (error) throw error;

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
      const { data, error } = await supabase
        .from('action_scores')
        .select('*')
        .eq('source_id', issueId)
        .eq('source_type', 'issue')
        .maybeSingle();

      if (error) throw error;
      
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
      const { data, error } = await supabase
        .from('action_scores')
        .select('*')
        .eq('source_id', actionId)
        .eq('source_type', 'action')
        .maybeSingle();

      if (error) throw error;
      
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