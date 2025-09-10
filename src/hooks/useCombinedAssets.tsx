import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CombinedAsset {
  id: string;
  name: string;
  type: 'asset' | 'stock';
  description?: string;
  category?: string;
  status?: string;
  serial_number?: string;
  current_quantity?: number;
  minimum_quantity?: number;
  unit?: string;
  cost_per_unit?: number;
  cost_evidence_url?: string;
  supplier?: string;
  image_url?: string;
  storage_location?: string;
  storage_vicinity?: string;
  legacy_storage_vicinity?: string;
  has_issues?: boolean;
  is_checked_out?: boolean;
  checked_out_to?: string;
  checked_out_user_id?: string;
  created_at: string;
  updated_at: string;
}

export const useCombinedAssets = (showRemovedItems: boolean = false) => {
  const [assets, setAssets] = useState<CombinedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssets = async () => {
    try {
      setLoading(true);

      // Fetch tools (assets)
      let toolsQuery = supabase
        .from('tools')
        .select(`
          id,
          name,
          description,
          category,
          status,
          serial_number,
          image_url,
          storage_location,
          legacy_storage_vicinity,
          created_at,
          updated_at
        `);
      
      if (!showRemovedItems) {
        toolsQuery = toolsQuery.neq('status', 'removed');
      }

      // Fetch parts (stock)
      const [toolsResponse, partsResponse] = await Promise.all([
        toolsQuery.order('name'),
        supabase
          .from('parts')
          .select(`
            id,
            name,
            description,
            category,
            current_quantity,
            minimum_quantity,
            unit,
            image_url,
            storage_location,
            legacy_storage_vicinity,
            created_at,
            updated_at
          `)
          .order('name')
      ]);

      if (toolsResponse.error) throw toolsResponse.error;
      if (partsResponse.error) throw partsResponse.error;

      // Fetch active checkouts for tools
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select('tool_id, user_name, user_id')
        .eq('is_returned', false);

      if (checkoutsError) {
        console.error('Error fetching checkouts:', checkoutsError);
      }

      // Create checkout map
      const checkoutMap = new Map<string, { user_name: string; user_id: string }>();
      checkoutsData?.forEach(checkout => {
        checkoutMap.set(checkout.tool_id, { user_name: checkout.user_name, user_id: checkout.user_id });
      });

      // Fetch tools with issues
      const { data: issuesData, error: issuesError } = await supabase
        .from('issues')
        .select('context_id')
        .eq('context_type', 'tool')
        .eq('status', 'active');

      if (issuesError) {
        console.error('Error fetching issues:', issuesError);
      }

      const toolsWithIssues = new Set(issuesData?.map(issue => issue.context_id) || []);

      // Transform and combine data
      const transformedAssets: CombinedAsset[] = [
        // Transform tools to assets
        ...(toolsResponse.data || []).map(tool => {
          const checkout = checkoutMap.get(tool.id);
          return {
            ...tool,
            type: 'asset' as const,
            has_issues: toolsWithIssues.has(tool.id),
            is_checked_out: checkoutMap.has(tool.id),
            checked_out_to: checkout?.user_name,
            checked_out_user_id: checkout?.user_id
          };
        }),
        // Transform parts to stock
        ...(partsResponse.data || []).map(part => ({
          ...part,
          type: 'stock' as const,
          has_issues: false,
          is_checked_out: false
        }))
      ];

      setAssets(transformedAssets);
    } catch (error) {
      console.error('Error fetching combined assets:', error);
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createAsset = async (assetData: any, isAsset: boolean) => {
    try {
      const table = isAsset ? 'tools' : 'parts';
      const { data, error } = await supabase
        .from(table)
        .insert(assetData)
        .select()
        .single();

      if (error) {
        console.error(`Supabase error creating ${table}:`, error);
        throw error;
      }

      // Log creation event for stock items only (parts_history)
      if (!isAsset) {
        try {
          const partData = data as any; // Type assertion for parts data
          await supabase
            .from('parts_history')
            .insert({
              part_id: data.id,
              change_type: 'create',
              old_quantity: 0,
              new_quantity: partData.current_quantity || 0,
              quantity_change: partData.current_quantity || 0,
              changed_by: (await supabase.auth.getUser()).data.user?.id,
              change_reason: `Created stock item: ${data.name}`,
              organization_id: data.organization_id
            });
        } catch (historyError) {
          console.warn('Failed to log creation to parts_history:', historyError);
        }
      }

      // Add to local state
      const newAsset: CombinedAsset = {
        ...data,
        type: isAsset ? 'asset' : 'stock',
        has_issues: false,
        is_checked_out: false
      };
      
      setAssets(prev => [...prev, newAsset]);
      return data;
    } catch (error) {
      console.error(`Error creating ${isAsset ? 'asset' : 'stock item'}:`, error);
      toast({
        title: "Error",
        description: `Failed to create ${isAsset ? 'asset' : 'stock item'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      return null;
    }
  };

  const updateAsset = async (assetId: string, updates: any, isAsset: boolean) => {
    try {
      const table = isAsset ? 'tools' : 'parts';
      const { error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', assetId);

      if (error) throw error;

      // Update local state
      setAssets(prev => prev.map(asset => 
        asset.id === assetId ? { ...asset, ...updates } : asset
      ));

      return true;
    } catch (error) {
      console.error(`Error updating ${isAsset ? 'asset' : 'stock item'}:`, error);
      toast({
        title: "Error",
        description: `Failed to update ${isAsset ? 'asset' : 'stock item'}`,
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [showRemovedItems]);

  return {
    assets,
    loading,
    fetchAssets,
    createAsset,
    updateAsset,
    refetch: fetchAssets
  };
};