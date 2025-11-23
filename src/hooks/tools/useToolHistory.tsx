import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface CheckoutHistory {
  id: string;
  type?: string;
  checkout_date: string | null;
  created_at: string;
  expected_return_date?: string;
  user_name: string;
  intended_usage?: string;
  notes?: string;
  is_returned: boolean;
  action_id?: string | null;
  action_title?: string | null;
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

export interface AssetHistoryEntry {
  id: string;
  type: 'asset_change';
  asset_id: string;
  change_type: 'created' | 'updated' | 'removed' | 'status_change';
  changed_at: string;
  changed_by: string;
  user_name?: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
}

export type HistoryEntry = CheckoutHistory | IssueHistoryEntry | AssetHistoryEntry;

export const useToolHistory = () => {
  const [toolHistory, setToolHistory] = useState<HistoryEntry[]>([]);
  const [currentCheckout, setCurrentCheckout] = useState<{user_name: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchToolHistory = useCallback(async (toolId: string) => {
    setLoading(true);
    setToolHistory([]); // Clear previous history while loading
    try {
      // Fetch all checkouts (both returned and not returned)
      const checkoutsResponse = await fetch(`${API_BASE_URL}/checkouts?tool_id=${toolId}`);
      const checkoutsResult = await checkoutsResponse.json();
      const checkoutsData = checkoutsResult.data || [];

      // Simplified: Only fetch checkouts for now
      // TODO: Add checkins, asset_history, issue_history endpoints to AWS API
      const standaloneCheckins: any[] = [];
      const issueHistoryWithNames: IssueHistoryEntry[] = [];
      const assetHistoryWithNames: AssetHistoryEntry[] = [];
      
      // Find current checkout (not returned)
      const activeCheckout = checkoutsData?.find((checkout: any) => !checkout.is_returned);
      setCurrentCheckout(activeCheckout ? { user_name: activeCheckout.user_name } : null);
      
      // Combine checkouts and standalone check-ins into history
      const processedCheckouts = (checkoutsData || []).map((checkout: any) => ({
        ...checkout,
        checkin: null // TODO: Fetch checkins separately
      }));
      
      const allHistory: HistoryEntry[] = [
        ...processedCheckouts,
        ...(standaloneCheckins || []).map(checkin => ({
          id: checkin.id,
          type: 'checkin',
          checkout_date: checkin.checkin_date,
          created_at: checkin.checkin_date, // Use checkin_date as created_at for sorting
          user_name: checkin.user_name,
          is_returned: true,
          checkin: checkin
        })),
        ...issueHistoryWithNames,
        ...assetHistoryWithNames
      ].sort((a, b) => {
        const dateA = new Date('checkout_date' in a ? (a.checkout_date || a.created_at) : a.changed_at);
        const dateB = new Date('checkout_date' in b ? (b.checkout_date || b.created_at) : b.changed_at);
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
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    toolHistory,
    currentCheckout,
    loading,
    fetchToolHistory,
    setCurrentCheckout
  };
};