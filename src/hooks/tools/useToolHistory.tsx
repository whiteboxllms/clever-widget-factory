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
      const historyResponse = historyResult.data || { asset: null, checkouts: [], issues: [], actions: [] };
      
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
        issue_description: issue.description // Ensure description is included
      }));
      
      // Add asset creation entry if asset exists
      const assetEntries: any[] = [];
      if (historyResponse.asset) {
        const asset = historyResponse.asset;
        // Add asset creation entry
        if (asset.created_at) {
          assetEntries.push({
            type: 'asset_created',
            date: asset.created_at,
            asset_id: toolId
          });
        }
        // Add asset update entry if updated_at is different from created_at
        if (asset.updated_at && asset.updated_at !== asset.created_at) {
          assetEntries.push({
            type: 'asset_updated',
            date: asset.updated_at,
            asset_id: toolId
          });
        }
      }
      
      // Add actions
      const actions = (historyResponse.actions || []).map((action: any) => ({
        ...action,
        type: 'action',
        date: action.created_at,
        user_name: action.created_by_name || 'System'
      }));
      
      const historyData = [...assetEntries, ...checkouts, ...issues, ...actions];

      // Find current checkout (not returned)
      const activeCheckout = checkouts.find(
        (entry: any) => !entry.is_returned
      );
      setCurrentCheckout(activeCheckout ? { user_name: activeCheckout.user_name } : null);

      // Transform to HistoryEntry format
      const allHistory: HistoryEntry[] = historyData.map((entry: any) => {
        switch (entry.type) {
          case 'asset_created':
            return {
              id: `asset-created-${toolId}`,
              type: 'asset_change',
              asset_id: toolId,
              change_type: 'created',
              changed_at: entry.date,
              changed_by: 'system',
              user_name: 'System'
            } as AssetHistoryEntry;

          case 'asset_updated':
            return {
              id: `asset-updated-${toolId}-${entry.date}`,
              type: 'asset_change',
              asset_id: toolId,
              change_type: 'updated',
              changed_at: entry.date,
              changed_by: 'system',
              user_name: 'System'
            } as AssetHistoryEntry;

          case 'checkout':
            return {
              id: entry.id,
              checkout_date: entry.date,
              created_at: entry.date,
              user_name: entry.user_name || 'Unknown',
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
    assetInfo,
    loading,
    fetchToolHistory,
    setCurrentCheckout
  };
};