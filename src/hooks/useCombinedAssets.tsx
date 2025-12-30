import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useUserNames } from '@/hooks/useUserNames';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { apiService, getApiData } from '@/lib/apiService';
import { toolsQueryKey, issuesQueryKey } from '@/lib/queryKeys';

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
  parent_structure_id?: string;
  parent_structure_name?: string; // Resolved name from parent_structure_id
  legacy_storage_vicinity?: string;
  area_display?: string; // Computed field: parent_structure_name || legacy_storage_vicinity
  has_issues?: boolean;
  is_checked_out?: boolean;
  checked_out_to?: string;
  checked_out_user_id?: string;
  checked_out_date?: string;
  checkout_action_id?: string;
  accountable_person_id?: string;
  accountable_person_name?: string; // Resolved name from accountable_person_id
  accountable_person_color?: string; // Favorite color of accountable person
  sellable?: boolean; // For stock items - whether available in Sari Sari store
  created_at: string;
  updated_at: string;
}

type AssetsQueryOptions = {
  search?: string;
  limit?: number;
  page?: number;
  searchDescriptions?: boolean;
  showLowStock?: boolean;
  skipPagination?: boolean;
};

const fetchTools = async () => {
  const result = await apiService.get('/tools?limit=2000');
  return result.data || [];
};

const fetchParts = async () => {
  try {
    const result = await apiService.get('/parts?limit=2000');
    return result.data || [];
  } catch (error) {
    console.error('❌ Parts fetch error:', error);
    return [];
  }
};

const fetchActions = async () => {
  const result = await apiService.get('/actions?limit=2000');
  return result.data || [];
};

const fetchOrganizationMembers = async () => {
  const result = await apiService.get('/organization_members');
  return result.data || [];
};

export const useCombinedAssets = (showRemovedItems: boolean = false, options?: AssetsQueryOptions) => {
  const [currentPage, setCurrentPage] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: toolsData = [], isLoading: toolsLoading } = useQuery({
    queryKey: toolsQueryKey(),
    queryFn: fetchTools,
    ...offlineQueryConfig,
  });
  
  const { data: partsData = [], isLoading: partsLoading } = useQuery({
    queryKey: ['parts'],
    queryFn: fetchParts,
    ...offlineQueryConfig,
  });

  // Fetch all active issues for tools and parts to determine has_issues
  const fetchActiveIssues = async () => {
    try {
      const params = new URLSearchParams();
      params.append('status', 'active');
      const response = await apiService.get(`/issues?${params}`);
      return getApiData(response) || [];
    } catch (error) {
      console.error('Error fetching active issues:', error);
      return [];
    }
  };

  const { data: activeIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: issuesQueryKey({ status: 'active' }),
    queryFn: fetchActiveIssues,
    ...offlineQueryConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes - issues don't change frequently
  });

  // Create a Set of asset IDs that have active issues
  const assetsWithIssues = useMemo(() => {
    const set = new Set<string>();
    activeIssues.forEach((issue: any) => {
      if (issue.context_id && (issue.context_type === 'tool' || issue.context_type === 'part')) {
        set.add(issue.context_id);
      }
    });
    return set;
  }, [activeIssues]);
  
  const loading = toolsLoading || partsLoading || issuesLoading;
  
  const { getUserName, getUserColor } = useUserNames([]);

  const fetchAssets = async (fetchOptions?: { search?: string; page?: number; limit?: number; append?: boolean; searchDescriptions?: boolean; showLowStock?: boolean }) => {
    // Update current page for pagination
    if (fetchOptions?.page !== undefined) {
      setCurrentPage(fetchOptions.page);
    }
  };

  const createAsset = async (assetData: Record<string, unknown>, isAsset: boolean) => {
    try {
      const endpoint = isAsset ? 'tools' : 'parts';
      const result = await apiService.post(`/${endpoint}`, assetData);
      const data = result.data;

      // Note: Asset will appear after refetch
      return data;
    } catch (error: any) {
      console.error(`Error creating ${isAsset ? 'asset' : 'stock item'}:`, error);
      const errorMessage = error?.message || error?.error || 'Unknown error';
      toast({
        title: "Error",
        description: `Failed to create ${isAsset ? 'asset' : 'stock item'}: ${errorMessage}`,
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateAsset = async (assetId: string, updates: Partial<CombinedAsset>, isAsset: boolean) => {
    try {
      const endpoint = isAsset ? 'tools' : 'parts';
      await apiService.put(`/${endpoint}/${assetId}`, updates);

      // Note: Asset will update after refetch

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

  // Process and paginate data
  const processedAssets = useMemo(() => {
    if (loading) {
      return [];
    }
    
    // Process data directly from TanStack Query
    let filteredToolsData = toolsData || [];
    if (showRemovedItems) {
      // Show only removed items
      // Note: Tools that are checked out have status 'checked_out' even if they were removed
      // We need to check if the tool was removed by looking at tools that are not checked out
      // and have status 'removed', OR tools that are checked out but we can't determine original status
      // For now, we'll filter by status === 'removed' (checked-out removed tools will be excluded)
      filteredToolsData = filteredToolsData.filter(tool => {
        // Check if status is explicitly 'removed'
        if (tool.status === 'removed') return true;
        // If checked out, we can't determine original status from current data
        // So we only show explicitly removed (not checked out) items
        return false;
      });
      console.log('🔍 Show Removed filter:', {
        totalTools: toolsData.length,
        removedTools: filteredToolsData.length,
        removedToolNames: filteredToolsData.map(t => `${t.name} (${t.status})`),
        allStatuses: [...new Set(toolsData.map(t => t.status))]
      });
    } else {
      // Show only active items (exclude removed)
      filteredToolsData = filteredToolsData.filter(tool => tool.status !== 'removed');
    }
    
    let filteredPartsData = partsData || [];
    // Note: Parts don't have a 'removed' status - they are deleted instead
    // When showRemovedItems is true, hide all stock items since deleted parts can't be retrieved
    if (showRemovedItems) {
      filteredPartsData = [];
    }
    
    // Apply low stock filter
    if (options?.showLowStock) {
      filteredPartsData = filteredPartsData.filter(part => {
        const isLowStock = part.current_quantity != null && 
          part.minimum_quantity != null && 
          part.current_quantity < part.minimum_quantity;
        return isLowStock;
      });
      // When low stock filter is active, exclude all tools/assets
      filteredToolsData = [];
    }
    
    // Apply search filter
    if (options?.search && options.search.trim()) {
      const searchTerm = options.search.trim().toLowerCase();
      
      filteredToolsData = filteredToolsData.filter(tool => 
        tool.name?.toLowerCase().includes(searchTerm) ||
        tool.serial_number?.toLowerCase().includes(searchTerm) ||
        tool.category?.toLowerCase().includes(searchTerm) ||
        tool.storage_location?.toLowerCase().includes(searchTerm) ||
        (options.searchDescriptions && tool.description?.toLowerCase().includes(searchTerm))
      );
      
      filteredPartsData = filteredPartsData.filter(part => 
        part.name?.toLowerCase().includes(searchTerm) ||
        part.category?.toLowerCase().includes(searchTerm) ||
        part.storage_location?.toLowerCase().includes(searchTerm) ||
        (options.searchDescriptions && part.description?.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply pagination to each type separately (unless skipPagination is true)
    let paginatedParts = filteredPartsData;
    let paginatedTools = filteredToolsData;
    
    if (!options?.skipPagination) {
      const limit = options?.limit || 50;
      const page = options?.page || 0;
      paginatedParts = filteredPartsData.slice(0, (page + 1) * limit);
      paginatedTools = filteredToolsData.slice(0, (page + 1) * limit);
    }
    
    const allAssets: CombinedAsset[] = [
      ...paginatedParts.map(part => ({
        ...part,
        type: 'stock' as const,
        has_issues: assetsWithIssues.has(part.id),
        is_checked_out: false
      })),
      ...paginatedTools.map(tool => ({
        ...tool,
        type: 'asset' as const,
        has_issues: assetsWithIssues.has(tool.id),
        is_checked_out: Boolean(tool.is_checked_out),
        checked_out_user_id: tool.checked_out_user_id,
        checked_out_to: tool.checked_out_to,
        checked_out_date: tool.checked_out_date,
        checkout_action_id: tool.checkout_action_id
      }))
    ];
    
    return allAssets;
  }, [showRemovedItems, toolsData, partsData, assetsWithIssues, loading, options?.search, options?.searchDescriptions, options?.showLowStock, options?.limit, options?.page, options?.skipPagination]);
  
  return {
    assets: processedAssets,
    loading,
    fetchAssets,
    createAsset,
    updateAsset,
    refetch: async () => {
      // Invalidate and refetch both tools and parts queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tools'] }),
        queryClient.invalidateQueries({ queryKey: ['parts'] })
      ]);
      // Reset to first page
      setCurrentPage(0);
    }
  };
};