import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ScoredAction {
  id: string;
  action_id: string;
  source_id: string;
  source_type: string;
  asset_context_id: string;
  asset_context_name: string;
  prompt_text: string;
  scores: Record<string, { score: number; reason: string }>;
  ai_response: any;
  likely_root_causes: string[];
  score_attribution_type: string;
  created_at: string;
  updated_at: string;
  // Related action data
  action?: {
    id: string;
    title: string;
    description: string;
    status: string;
    assigned_to: string;
    assignee?: {
      full_name: string;
      role: string;
    };
  };
}

export function useScoredActions() {
  const [scoredActions, setScoredActions] = useState<ScoredAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchScoredActions = async (userIds?: string[], startDate?: string, endDate?: string) => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('action_scores')
        .select(`
          *,
          actions!action_scores_action_id_fkey (
            id,
            title,
            description,
            status,
            assigned_to,
            profiles:assigned_to (
              full_name,
              role
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by assigned users if specified
      let filteredData = data || [];
      if (userIds && userIds.length > 0) {
        filteredData = filteredData.filter(item => 
          item.actions?.assigned_to && userIds.includes(item.actions.assigned_to)
        );
      }

      setScoredActions(filteredData.map(item => ({
        id: item.id,
        action_id: item.action_id,
        source_id: item.source_id,
        source_type: item.source_type,
        asset_context_id: item.asset_context_id || '',
        asset_context_name: item.asset_context_name || 'Unknown Asset',
        prompt_text: item.prompt_text,
        scores: item.scores as Record<string, { score: number; reason: string }>,
        ai_response: item.ai_response,
        likely_root_causes: item.likely_root_causes || [],
        score_attribution_type: item.score_attribution_type || 'action',
        created_at: item.created_at,
        updated_at: item.updated_at,
        action: item.actions ? {
          id: item.actions.id,
          title: item.actions.title,
          description: item.actions.description,
          status: item.actions.status,
          assigned_to: item.actions.assigned_to,
          assignee: item.actions.profiles ? {
            full_name: item.actions.profiles.full_name,
            role: item.actions.profiles.role
          } : undefined
        } : undefined
      })));
    } catch (error) {
      console.error('Error fetching scored actions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch scored actions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    scoredActions,
    isLoading,
    fetchScoredActions
  };
}