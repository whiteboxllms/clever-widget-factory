import { useState, useEffect } from 'react';
import { apiService, getApiData } from '@/lib/apiService';
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
      
      // Fetch action scores
      const scoresResponse = await apiService.get('/action_scores', {
        params: { start_date: startDate, end_date: endDate }
      });
      const scoresData = getApiData(scoresResponse) || [];

      // Get unique action IDs
      const actionIds = [...new Set(scoresData.map((score: any) => score.action_id).filter(Boolean))];
      
      // Fetch actions
      const actionsResponse = await apiService.get('/actions');
      const allActions = getApiData(actionsResponse) || [];
      const actionsData = allActions.filter((a: any) => actionIds.includes(a.id));

      // Get unique assigned user IDs
      const assignedUserIds = [...new Set(actionsData.map((action: any) => action.assigned_to).filter(Boolean))];
      
      // Fetch organization members
      const membersResponse = await apiService.get('/organization_members');
      const allMembers = getApiData(membersResponse) || [];
      const membersData = allMembers.filter((m: any) => assignedUserIds.includes(m.user_id));

      // Create lookup maps
      const actionsMap = new Map(actionsData.map((action: any) => [action.id, action]));
      const membersMap = new Map(membersData.map((member: any) => [member.user_id, member]));

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