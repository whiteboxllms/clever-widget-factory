import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';

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

export const useCombinedAssets = (showRemovedItems: boolean = false, searchQuery: string = '') => {
  const [assets, setAssets] = useState<CombinedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const organizationId = useOrganizationId();

  const fetchAssets = useCallback(async (query: string = '') => {
    if (!organizationId) return;
    
    setLoading(true);
    try {

      // Build base query for tools with search
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
        `)
        .eq('organization_id', organizationId);

      // Build base query for parts with search  
      let partsQuery = supabase
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
        .eq('organization_id', organizationId);

      // Apply search filters if query exists
      if (query.trim()) {
        toolsQuery = toolsQuery.or(`name.ilike.%${query}%,serial_number.ilike.%${query}%,description.ilike.%${query}%,storage_location.ilike.%${query}%`);
        partsQuery = partsQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%,storage_location.ilike.%${query}%`);
      }

      // Apply removal filter
      if (!showRemovedItems) {
        toolsQuery = toolsQuery.neq('status', 'removed');
      }

      // Limit results for better performance
      toolsQuery = toolsQuery.limit(50);
      partsQuery = partsQuery.limit(50);

      // Fetch tools and parts concurrently
      const [toolsResponse, partsResponse] = await Promise.all([
        toolsQuery.order('name'),
        partsQuery.order('name')
      ]);

      if (toolsResponse.error) throw toolsResponse.error;
      if (partsResponse.error) throw partsResponse.error;

      const tools = toolsResponse.data || [];
      const parts = partsResponse.data || [];

      // Only fetch additional data if we have results
      if (tools.length === 0 && parts.length === 0) {
        setAssets([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // Get tool IDs for fetching checkouts and issues
      const toolIds = tools.map(tool => tool.id);

      // Fetch checkouts only for returned tools
      const { data: checkoutsData, error: checkoutsError } = toolIds.length > 0
        ? await supabase
            .from('checkouts')
            .select('tool_id, user_name, user_id')
            .eq('is_returned', false)
            .in('tool_id', toolIds)
        : { data: [], error: null };

      if (checkoutsError) {
        console.error('Error fetching checkouts:', checkoutsError);
      }

      // Create checkout map
      const checkoutMap = new Map<string, { user_name: string; user_id: string }>();
      checkoutsData?.forEach(checkout => {
        checkoutMap.set(checkout.tool_id, { user_name: checkout.user_name, user_id: checkout.user_id });
      });

      // Fetch issues only for returned tools and parts
      const allIds = [...toolIds, ...parts.map(part => part.id)];
      
      const { data: issuesData, error: issuesError } = allIds.length > 0
        ? await supabase
            .from('issues')
            .select('context_id')
            .eq('status', 'active')
            .in('context_id', allIds)
        : { data: [], error: null };

      if (issuesError) {
        console.error('Error fetching issues:', issuesError);
      }

      const toolsWithIssues = new Set(issuesData?.map(issue => issue.context_id) || []);

      // Transform and combine data
      const transformedAssets: CombinedAsset[] = [
        // Transform tools to assets
        ...tools.map(tool => {
          const checkout = checkoutMap.get(tool.id);
          return {
            id: tool.id,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            type: 'asset' as const,
            status: tool.status as CombinedAsset['status'],
            serial_number: tool.serial_number,
            image_url: tool.image_url,
            storage_location: tool.storage_location,
            legacy_storage_vicinity: tool.legacy_storage_vicinity,
            created_at: tool.created_at,
            updated_at: tool.updated_at,
            is_checked_out: !!checkout,
            checked_out_to: checkout?.user_name,
            checked_out_user_id: checkout?.user_id,
            has_issues: toolsWithIssues.has(tool.id),
            current_quantity: null,
            minimum_quantity: null,
            unit: null
          };
        }),
        // Transform parts to stock
        ...parts.map(part => ({
          id: part.id,
          name: part.name,
          description: part.description,
          category: part.category,
          type: 'stock' as const,
          status: 'available' as const,
          serial_number: null,
          image_url: part.image_url,
          storage_location: part.storage_location,
          legacy_storage_vicinity: part.legacy_storage_vicinity,
          created_at: part.created_at,
          updated_at: part.updated_at,
          is_checked_out: false,
          checked_out_to: null,
          checked_out_user_id: null,
          has_issues: toolsWithIssues.has(part.id),
          current_quantity: part.current_quantity,
          minimum_quantity: part.minimum_quantity,
          unit: part.unit
        }))
      ];

      setAssets(transformedAssets);
      setTotalCount(transformedAssets.length);
      
      if (query.trim()) {
        setHasSearched(true);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [organizationId, showRemovedItems]);

  const searchAssets = useCallback(async (query: string) => {
    await fetchAssets(query);
  }, [fetchAssets]);

  const resetSearch = useCallback(() => {
    setAssets([]);
    setTotalCount(0);
    setHasSearched(false);
  }, []);

  // Load data on mount and when filters change
  useEffect(() => {
    fetchAssets(searchQuery);
    if (searchQuery.trim()) {
      setHasSearched(true);
    }
  }, [searchQuery, showRemovedItems, fetchAssets]);

  const refetch = useCallback(() => {
    if (hasSearched || searchQuery.trim()) {
      return fetchAssets(searchQuery);
    }
  }, [fetchAssets, hasSearched, searchQuery]);

  const createAsset = async (assetData: any, isAsset: boolean) => {
    try {
      if (isAsset) {
        const { data, error } = await supabase
          .from('tools')
          .insert([assetData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('parts')
          .insert([assetData])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error creating asset:', error);
      throw error;
    }
  };

  const updateAsset = async (assetId: string, updates: any, isAsset: boolean) => {
    try {
      const table = isAsset ? 'tools' : 'parts';
      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', assetId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state
      setAssets(prevAssets => 
        prevAssets.map(asset => 
          asset.id === assetId 
            ? { ...asset, ...updates, updated_at: new Date().toISOString() }
            : asset
        )
      );
      
      return data;
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    }
  };

  return { 
    assets, 
    loading, 
    hasSearched,
    totalCount,
    searchAssets,
    resetSearch,
    createAsset, 
    updateAsset, 
    refetch 
  };
};