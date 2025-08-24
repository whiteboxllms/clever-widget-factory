import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface IssueAction {
  id: string;
  title: string;
  description?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  linked_issue_id?: string;
  issue_reference?: string;
  attachments?: string[];
}

export const useIssueActions = () => {
  const [loading, setLoading] = useState(false);

  const getActionsForIssue = useCallback(async (issueId: string): Promise<IssueAction[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mission_actions')
        .select('*')
        .eq('linked_issue_id', issueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
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

  const markActionComplete = useCallback(async (actionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('mission_actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', actionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Action marked as complete'
      });
      return true;
    } catch (error) {
      console.error('Error marking action complete:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark action as complete',
        variant: 'destructive'
      });
      return false;
    }
  }, []);

  const markActionIncomplete = useCallback(async (actionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('mission_actions')
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