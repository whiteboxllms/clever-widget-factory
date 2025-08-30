import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CheckoutHistory {
  id: string;
  type?: string;
  checkout_date: string;
  expected_return_date?: string;
  user_name: string;
  intended_usage?: string;
  notes?: string;
  is_returned: boolean;
  checkin?: {
    id: string;
    checkin_date: string;
    problems_reported?: string;
    notes?: string;
    user_name?: string;
    hours_used?: number;
    after_image_urls?: string[];
    sop_best_practices?: string;
    what_did_you_do?: string;
    checkin_reason?: string;
  };
}

export interface IssueHistoryEntry {
  id: string;
  type: 'issue_change';
  issue_id: string;
  issue_description?: string;
  issue_type?: string;
  change_type: 'created' | 'updated' | 'resolved' | 'removed';
  changed_at: string;
  changed_by: string;
  user_name?: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  old_status?: string;
  new_status?: string;
  notes?: string;
}

export type HistoryEntry = CheckoutHistory | IssueHistoryEntry;

export const useToolHistory = () => {
  const [toolHistory, setToolHistory] = useState<HistoryEntry[]>([]);
  const [currentCheckout, setCurrentCheckout] = useState<{user_name: string} | null>(null);
  const { toast } = useToast();

  const fetchToolHistory = async (toolId: string) => {
    try {
      // Fetch all checkouts (both returned and not returned)
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select(`
          *,
          checkins(
            id,
            checkin_date,
            problems_reported,
            notes,
            user_name,
            hours_used,
            after_image_urls,
            sop_best_practices,
            what_did_you_do,
            checkin_reason
          )
        `)
        .eq('tool_id', toolId)
        .order('checkout_date', { ascending: false });

      if (checkoutsError) throw checkoutsError;

      // Fetch standalone check-ins (not linked to any checkout)
      const { data: standaloneCheckins, error: checkinsError } = await supabase
        .from('checkins')
        .select('*')
        .eq('tool_id', toolId)
        .is('checkout_id', null)
        .order('checkin_date', { ascending: false });

      if (checkinsError) throw checkinsError;

      // Fetch issue history with issue details
      const { data: issueHistoryData, error: issueHistoryError } = await supabase
        .from('issue_history')
        .select(`
          id,
          issue_id,
          changed_by,
          changed_at,
          old_status,
          new_status,
          field_changed,
          old_value,
          new_value,
          notes
        `)
        .order('changed_at', { ascending: false });

      if (issueHistoryError) throw issueHistoryError;

      // Filter issue history for this tool by fetching related issues
      let issueHistoryWithNames: IssueHistoryEntry[] = [];
      if (issueHistoryData && issueHistoryData.length > 0) {
        // Get all issues for this tool
        const { data: toolIssues } = await supabase
          .from('issues')
          .select('id, description, issue_type')
          .eq('context_type', 'tool')
          .eq('context_id', toolId);

        const toolIssueIds = new Set(toolIssues?.map(issue => issue.id) || []);
        
        // Filter history to only include entries for this tool's issues
        const relevantHistory = issueHistoryData.filter(item => 
          toolIssueIds.has(item.issue_id)
        );

        if (relevantHistory.length > 0) {
          const { data: userDisplayNames } = await supabase.rpc('get_user_display_names');
          const userNameMap = new Map(
            userDisplayNames?.map(user => [user.user_id, user.full_name]) || []
          );

          const issueMap = new Map(
            toolIssues?.map(issue => [issue.id, issue]) || []
          );

          issueHistoryWithNames = relevantHistory.map(historyItem => {
            const issueInfo = issueMap.get(historyItem.issue_id);
            return {
              id: historyItem.id,
              type: 'issue_change' as const,
              issue_id: historyItem.issue_id,
              issue_description: issueInfo?.description,
              issue_type: issueInfo?.issue_type,
              change_type: historyItem.old_status === null ? 'created' : 
                          historyItem.new_status === 'resolved' ? 'resolved' :
                          historyItem.new_status === 'removed' ? 'removed' : 'updated',
              changed_at: historyItem.changed_at,
              changed_by: historyItem.changed_by,
              user_name: userNameMap.get(historyItem.changed_by) || 'Unknown User',
              field_changed: historyItem.field_changed,
              old_value: historyItem.old_value,
              new_value: historyItem.new_value,
              old_status: historyItem.old_status,
              new_status: historyItem.new_status,
              notes: historyItem.notes
            };
          });
        }
      }
      
      // Find current checkout (not returned)
      const activeCheckout = checkoutsData?.find(checkout => !checkout.is_returned);
      setCurrentCheckout(activeCheckout ? { user_name: activeCheckout.user_name } : null);
      
      // Combine checkouts and standalone check-ins into history
      const processedCheckouts = (checkoutsData || []).map(checkout => ({
        ...checkout,
        checkin: checkout.checkins && checkout.checkins.length > 0 ? checkout.checkins[0] : null
      }));
      
      const allHistory: HistoryEntry[] = [
        ...processedCheckouts,
        ...(standaloneCheckins || []).map(checkin => ({
          id: checkin.id,
          type: 'checkin',
          checkout_date: checkin.checkin_date,
          user_name: checkin.user_name,
          is_returned: true,
          checkin: checkin
        })),
        ...issueHistoryWithNames
      ].sort((a, b) => {
        const dateA = new Date('checkout_date' in a ? a.checkout_date : a.changed_at);
        const dateB = new Date('checkout_date' in b ? b.checkout_date : b.changed_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      setToolHistory(allHistory);
    } catch (error) {
      console.error('Error fetching tool history:', error);
      toast({
        title: "Error",
        description: "Failed to load tool history",
        variant: "destructive"
      });
    }
  };

  return {
    toolHistory,
    currentCheckout,
    fetchToolHistory,
    setCurrentCheckout
  };
};