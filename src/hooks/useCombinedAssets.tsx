import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useUserNames } from '@/hooks/useUserNames';
import { offlineQueryConfig } from '@/lib/queryConfig';

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
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tools?limit=1000`);
  const result = await response.json();
  return result.data || [];
};

const fetchParts = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/parts?limit=1000`);
  const result = await response.json();
  return result.data || [];
};

const fetchActions = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/actions?limit=1000`);
  const result = await response.json();
  return result.data || [];
};

const fetchOrganizationMembers = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/organization_members`);
  const result = await response.json();
  return result.data || [];
};

const fetchProfiles = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profiles`);
  const result = await response.json();
  return result.data || [];
};

export const useCombinedAssets = (showRemovedItems: boolean = false, options?: AssetsQueryOptions) => {
  const [assets, setAssets] = useState<CombinedAsset[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const { toast } = useToast();
  
  const { data: toolsData = [], isLoading: toolsLoading } = useQuery({
    queryKey: ['tools'],
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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetData)
      });
      
      if (!response.ok) throw new Error('Failed to create');
      const result = await response.json();
      const data = result.data;

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

  const updateAsset = async (assetId: string, updates: Partial<CombinedAsset>, isAsset: boolean) => {
    try {
      const endpoint = isAsset ? 'tools' : 'parts';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId, ...updates })
      });
      
      if (!response.ok) throw new Error('Failed to update');

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

  // Process and paginate data
  const processedAssets = useMemo(() => {
    if (loading) return [];
    
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
    
    const allAssets: CombinedAsset[] = [
      ...filteredToolsData.map(tool => ({
        ...tool,
        type: 'asset' as const,
        has_issues: false,
        is_checked_out: false
      })),
      ...filteredPartsData.map(part => ({
        ...part,
        type: 'stock' as const,
        has_issues: false,
        is_checked_out: false
      }))
    ];
    
    // Apply pagination
    const limit = options?.limit || 50;
    const page = options?.page || 0;
    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    
    return allAssets.slice(0, endIndex); // Show items from 0 to current page end
  }, [showRemovedItems, toolsData, partsData, loading, options?.search, options?.searchDescriptions, options?.showLowStock, options?.limit, options?.page]);
  
  // Update assets when processed data changes
  useEffect(() => {
    setAssets(processedAssets);
  }, [processedAssets]);

  return {
    assets,
    loading,
    fetchAssets,
    createAsset,
    updateAsset,
    refetch: () => fetchAssets({ page: 0, append: false })
  };
};