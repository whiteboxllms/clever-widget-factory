import { useState, useEffect } from 'react';
import { supabase } from '@/lib/client';
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
      
      // First get the action scores
      let query = supabase
        .from('action_scores')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: scoresData, error: scoresError } = await query;
      if (scoresError) throw scoresError;

      // Get unique action IDs and assigned user IDs
      const actionIds = [...new Set(scoresData?.map(score => score.action_id).filter(Boolean))];
      
      // Fetch actions separately
      const { data: actionsData, error: actionsError } = await supabase
        .from('actions')
        .select('id, title, description, status, assigned_to')
        .in('id', actionIds);

      if (actionsError) throw actionsError;

      // Get unique assigned user IDs
      const assignedUserIds = [...new Set(actionsData?.map(action => action.assigned_to).filter(Boolean))];
      
      // Fetch organization members for assignees
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, full_name, role')
        .in('user_id', assignedUserIds);

      if (membersError) throw membersError;

      // Create lookup maps
      const actionsMap = new Map(actionsData?.map(action => [action.id, action]) || []);
      const membersMap = new Map(membersData?.map(member => [member.user_id, member]) || []);

      // Filter by assigned users if specified
      let filteredData = scoresData || [];
      if (userIds && userIds.length > 0) {
        filteredData = filteredData.filter(item => {
          const action = actionsMap.get(item.action_id);
          return action?.assigned_to && userIds.includes(action.assigned_to);
        });
      }

      setScoredActions(filteredData.map(item => {
        const action = actionsMap.get(item.action_id);
        const assignee = action?.assigned_to ? membersMap.get(action.assigned_to) : null;

        return {
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
          action: action ? {
            id: action.id,
            title: action.title,
            description: action.description,
            status: action.status,
            assigned_to: action.assigned_to,
            assignee: assignee ? {
              full_name: assignee.full_name,
              role: assignee.role
            } : undefined
          } : undefined
        };
      }));
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