import { useState, useCallback } from 'react';
import { supabase } from '@/lib/client';
import { toast } from '@/hooks/use-toast';
import { BaseAction } from '@/types/actions';
import { processStockConsumption } from '@/lib/utils';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { autoCheckinToolsForAction } from '@/lib/autoToolCheckout';

export const useIssueActions = () => {
  const [loading, setLoading] = useState(false);
  const organizationId = useOrganizationId();

  const getActionsForIssue = useCallback(async (issueId: string): Promise<BaseAction[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('actions')
        .select('*')
        .eq('linked_issue_id', issueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(action => ({
        ...action,
        required_stock: Array.isArray(action.required_stock) ? action.required_stock : []
      })) as unknown as BaseAction[];
    } catch (error) {
      console.error('Error fetching actions for issue:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch actions for this issue',
        variant: 'destructive'
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const markActionComplete = useCallback(async (action: BaseAction): Promise<boolean> => {
    try {
      // Get the current user for inventory logging
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.id) {
        throw new Error('User must be authenticated to complete actions');
      }

      // Process required stock consumption if any
      const requiredStock = action.required_stock || [];
      if (requiredStock.length > 0) {
        await processStockConsumption(
          requiredStock, 
          action.id, 
          currentUser.id, 
          action.title, 
          action.mission_id
        );
      }

      const { error } = await supabase
        .from('actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('actions')
        .update({
          status: 'in_progress',
          completed_at: null
        })
        .eq('id', actionId);

      if (error) throw error;

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
    loading
  };
};