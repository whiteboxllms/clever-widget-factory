import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useUserNames } from '@/hooks/useUserNames';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { apiService } from '@/lib/apiService';
import { toolsQueryKey } from '@/lib/queryKeys';

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
  accountable_person_id?: string;
  accountable_person_name?: string; // Resolved name from accountable_person_id
  accountable_person_color?: string; // Favorite color of accountable person
  created_at: string;
  updated_at: string;
}

type AssetsQueryOptions = {
  search?: string;
  limit?: number;
  page?: number;
  searchDescriptions?: boolean;
  showLowStock?: boolean;
};

const fetchTools = async () => {
  const result = await apiService.get('/tools?limit=1000');
  return result.data || [];
};

const fetchParts = async () => {
  try {
    const result = await apiService.get('/parts?limit=1000');
    return result.data || [];
  } catch (error) {
    console.error('❌ Parts fetch error:', error);
    return [];
  }
};

const fetchActions = async () => {
  const result = await apiService.get('/actions?limit=1000');
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
  
  const loading = toolsLoading || partsLoading;
  
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
    if (!showRemovedItems) {
      filteredToolsData = filteredToolsData.filter(tool => tool.status !== 'removed');
    }
    
    let filteredPartsData = partsData || [];
    
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
    
    // Apply pagination to each type separately
    const limit = options?.limit || 50;
    const page = options?.page || 0;
    
    const paginatedParts = filteredPartsData.slice(0, (page + 1) * limit);
    const paginatedTools = filteredToolsData.slice(0, (page + 1) * limit);
    
    const allAssets: CombinedAsset[] = [
      ...paginatedParts.map(part => ({
        ...part,
        type: 'stock' as const,
        has_issues: false,
        is_checked_out: false
      })),
      ...paginatedTools.map(tool => ({
        ...tool,
        type: 'asset' as const,
        has_issues: false,
        is_checked_out: Boolean(tool.is_checked_out),
        checked_out_user_id: tool.checked_out_user_id,
        checked_out_to: tool.checked_out_to,
        checked_out_date: tool.checked_out_date
      }))
    ];
    
    return allAssets;
  }, [showRemovedItems, toolsData, partsData, loading, options?.search, options?.searchDescriptions, options?.showLowStock, options?.limit, options?.page]);
  
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