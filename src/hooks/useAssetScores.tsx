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
        .from('asset_scores')
        .select('*')
        .eq('asset_id', targetAssetId || assetId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setScores((data || []) as AssetScore[]);
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
  }) => {
    try {
      const { data, error } = await supabase
        .from('asset_scores')
        .insert(scoreData)
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
        .from('asset_scores')
        .update(updates)
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
        .from('asset_scores')
        .select('*')
        .eq('source_id', issueId)
        .eq('source_type', 'issue')
        .maybeSingle();

      if (error) throw error;
      return data as AssetScore | null;
    } catch (error) {
      console.error('Error fetching score for issue:', error);
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
  };
};