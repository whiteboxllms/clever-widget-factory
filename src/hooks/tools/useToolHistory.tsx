import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/apiService';

export interface CheckoutHistory {
  id: string;
  type?: string;
  checkout_date: string | null;
  created_at: string;
  expected_return_date?: string;
  user_name: string;
  user_display_name?: string;  // From API JOIN with organization_members
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
  damage_assessment?: string;
}

export interface AssetHistoryEntry {
  id: string;
  type: 'asset_change';
  asset_id: string;
  change_type: 'created' | 'updated' | 'removed' | 'status_change' | 'action_created';
  changed_at: string;
  changed_by: string;
  user_name?: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  // Action-specific fields (optional)
  action_id?: string;
  action_title?: string;
  action_status?: string;
}

export type HistoryEntry = CheckoutHistory | IssueHistoryEntry | AssetHistoryEntry;

export const useToolHistory = () => {
  const [toolHistory, setToolHistory] = useState<HistoryEntry[]>([]);
  const [currentCheckout, setCurrentCheckout] = useState<{user_name: string} | null>(null);
  const [assetInfo, setAssetInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchToolHistory = useCallback(async (toolId: string) => {
    setLoading(true);
    setToolHistory([]); // Clear previous history while loading
    try {
      // Fetch unified history from computed endpoint
      const historyResult = await apiService.get(`/tools/${toolId}/history`);
      const historyResponse = historyResult.data || { asset: null, timeline: [], checkouts: [], issues: [], actions: [] };
      
      // Use timeline if available (contains asset_history entries)
      const timeline = historyResponse.timeline || [];
      
      // Combine checkouts and issues into unified history
      const checkouts = (historyResponse.checkouts || []).map((checkout: any) => ({
        ...checkout,
        type: 'checkout',
        date: checkout.checkout_date || checkout.created_at
      }));
      
      const issues = (historyResponse.issues || []).map((issue: any) => ({
        ...issue,
        type: 'issue',
        date: issue.reported_at || issue.created_at,
        user_name: issue.reported_by_name,
        damage_assessment: issue.damage_assessment,
        issue_description: issue.description
      }));
      
      // Add actions
      const actions = (historyResponse.actions || []).map((action: any) => ({
        ...action,
        type: 'action',
        date: action.created_at,
        user_name: action.created_by_name || 'System'
      }));
      
      const historyData = [...timeline, ...checkouts, ...issues, ...actions];

      // Find current checkout (not returned)
      const activeCheckout = checkouts.find(
        (entry: any) => !entry.is_returned
      );
      setCurrentCheckout(activeCheckout ? { user_name: activeCheckout.user_name } : null);

      // Transform to HistoryEntry format
      const allHistory: HistoryEntry[] = historyData.map((entry: any) => {
        switch (entry.type) {
          case 'asset_change':
            return {
              id: entry.data?.id || entry.id,
              type: 'asset_change',
              asset_id: toolId,
              change_type: entry.data?.change_type || 'updated',
              changed_at: entry.timestamp || entry.data?.changed_at,
              changed_by: entry.data?.changed_by || 'system',
              user_name: entry.data?.user_name || 'System',
              field_changed: entry.data?.field_changed,
              old_value: entry.data?.old_value,
              new_value: entry.data?.new_value,
              notes: entry.data?.notes
            } as AssetHistoryEntry;

          case 'checkout':
            return {
              id: entry.id,
              checkout_date: entry.date,
              created_at: entry.date,
              user_name: entry.user_display_name || entry.user_name || 'Unknown',
              user_display_name: entry.user_display_name,
              is_returned: entry.is_returned || false,
              intended_usage: entry.intended_usage,
              notes: entry.notes,
              action_id: entry.action_id,
              action_title: entry.action_title,
              checkin: null
            } as CheckoutHistory;

          case 'action':
            return {
              id: entry.id,
              type: 'asset_change',
              asset_id: toolId,
              change_type: 'action_created',
              changed_at: entry.date,
              changed_by: entry.created_by || 'system',
              user_name: entry.user_name || 'System',
              notes: entry.description,
              action_id: entry.id,
              action_title: entry.title,
              action_status: entry.status
            } as AssetHistoryEntry;

          case 'issue':
            return {
              id: entry.id,
              type: 'issue_change',
              issue_id: entry.id,
              issue_description: entry.description || entry.issue_description,
              issue_type: entry.issue_type,
              change_type: 'created',
              changed_at: entry.date,
              changed_by: entry.reported_by || 'system',
              user_name: entry.user_name || 'System',
              old_status: null,
              new_status: entry.status,
              notes: entry.description,
              damage_assessment: entry.damage_assessment
            } as IssueHistoryEntry;

          case 'issue_history':
            return {
              id: entry.id,
              type: 'issue_change',
              issue_id: entry.issue_id,
              change_type: entry.change_type as 'created' | 'updated' | 'resolved' | 'removed',
              changed_at: entry.date,
              changed_by: entry.changed_by || 'system',
              user_name: entry.user_name || 'System',
              old_status: entry.old_status,
              new_status: entry.new_status,
              notes: entry.description || entry.notes
            } as IssueHistoryEntry;

          default:
            return entry;
        }
      });

      // Sort by date descending (most recent first)
      allHistory.sort((a, b) => {
        const dateA = 'checkout_date' in a ? (a.checkout_date || a.created_at) : a.changed_at;
        const dateB = 'checkout_date' in b ? (b.checkout_date || b.created_at) : b.changed_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      // Group entries that happened within 5 seconds of each other
      const groupedHistory: HistoryEntry[] = [];
      let currentGroup: HistoryEntry[] = [];
      let currentTimestamp: number | null = null;

      allHistory.forEach((entry) => {
        const entryTime = new Date('checkout_date' in entry ? (entry.checkout_date || entry.created_at) : entry.changed_at).getTime();
        
        if (currentTimestamp === null || Math.abs(entryTime - currentTimestamp) <= 5000) {
          currentGroup.push(entry);
          currentTimestamp = entryTime;
        } else {
          if (currentGroup.length > 1 && currentGroup.every(e => e.type === 'asset_change')) {
            // Combine multiple asset_change entries into one
            const combined = currentGroup[0] as AssetHistoryEntry;
            combined.notes = currentGroup.map(e => {
              const ae = e as AssetHistoryEntry;
              return ae.field_changed ? `${ae.field_changed}: ${ae.new_value || 'null'}` : '';
            }).filter(Boolean).join(', ');
            groupedHistory.push(combined);
          } else {
            groupedHistory.push(...currentGroup);
          }
          currentGroup = [entry];
          currentTimestamp = entryTime;
        }
      });

      // Push last group
      if (currentGroup.length > 1 && currentGroup.every(e => e.type === 'asset_change')) {
        const combined = currentGroup[0] as AssetHistoryEntry;
        combined.notes = currentGroup.map(e => {
          const ae = e as AssetHistoryEntry;
          return ae.field_changed ? `${ae.field_changed}: ${ae.new_value || 'null'}` : '';
        }).filter(Boolean).join(', ');
        groupedHistory.push(combined);
      } else {
        groupedHistory.push(...currentGroup);
      }

      setToolHistory(groupedHistory);
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
    assetInfo,
    loading,
    fetchToolHistory,
    setCurrentCheckout
  };
};