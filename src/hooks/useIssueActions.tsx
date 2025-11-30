import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { getCurrentUser } from 'aws-amplify/auth';
import { toast } from '@/hooks/use-toast';
import { BaseAction } from '@/types/actions';
import { processStockConsumption } from '@/lib/utils';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { autoCheckinToolsForAction } from '@/lib/autoToolCheckout';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { issueActionsQueryKey } from '@/lib/queryKeys';

export const useIssueActions = () => {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();

  // Use TanStack Query for fetching actions by issue ID
  const getActionsForIssue = useCallback(async (issueId: string): Promise<BaseAction[]> => {
    // Check cache first
    const cachedData = queryClient.getQueryData<BaseAction[]>(issueActionsQueryKey(issueId));
    if (cachedData) {
      return cachedData;
    }

    // If not cached, fetch and cache it
    const queryData = await queryClient.fetchQuery({
      queryKey: issueActionsQueryKey(issueId),
      queryFn: async () => {
        const response = await apiService.get<{ data: any[] }>(`/actions?linked_issue_id=${issueId}`);
        const data = response.data || [];
        
        return data.map(action => ({
          ...action,
          required_stock: Array.isArray(action.required_stock) ? action.required_stock : []
        })) as unknown as BaseAction[];
      },
      ...offlineQueryConfig,
      staleTime: 2 * 60 * 1000, // 2 minutes for actions
    });

    return queryData;
  }, [queryClient]);

  const markActionComplete = useCallback(async (action: BaseAction): Promise<boolean> => {
    try {
      // Get the current user for inventory logging
      const currentUser = await getCurrentUser();
      if (!currentUser?.userId) {
        throw new Error('User must be authenticated to complete actions');
      }

      // Process required stock consumption if any
      const requiredStock = action.required_stock || [];
      if (requiredStock.length > 0) {
        await processStockConsumption(
          requiredStock, 
          action.id, 
          currentUser.userId, 
          action.title, 
          action.mission_id
        );
      }

      // Update action status to completed
      await apiService.put(`/actions/${action.id}`, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      // Auto-checkin tools
      try {
        await autoCheckinToolsForAction({
          actionId: action.id,
          checkinReason: 'Action completed',
          notes: 'Auto-checked in when action was completed'
        });
      } catch (checkinError) {
        console.error('Auto-checkin failed:', checkinError);
      }

      toast({
        title: 'Success',
        description: 'Action marked as complete and stock consumption recorded'
      });
      return true;
    } catch (error) {
      console.error('Error marking action complete:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark action as complete and record stock usage',
        variant: 'destructive'
      });
      return false;
    }
  }, [organizationId]);

  const markActionIncomplete = useCallback(async (actionId: string): Promise<boolean> => {
    try {
      await apiService.put(`/actions/${actionId}`, {
        status: 'in_progress',
        completed_at: null
      });

      toast({
        title: 'Success',
        description: 'Action marked as incomplete'
      });
      return true;
    } catch (error) {
      console.error('Error marking action incomplete:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark action as incomplete',
        variant: 'destructive'
      });
      return false;
    }
  }, []);

  return {
    getActionsForIssue,
    markActionComplete,
    markActionIncomplete,
    loading: false // No longer using local loading state since we use TanStack Query
  };
};