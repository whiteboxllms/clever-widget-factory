import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiService, getApiData } from '@/lib/apiService';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { toolsQueryKey, checkoutsQueryKey } from '@/lib/queryKeys';

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  image_url?: string;
  legacy_storage_vicinity?: string;
  parent_structure_id?: string;
  storage_location: string | null;
  actual_location?: string;
  serial_number?: string;
  last_maintenance?: string;
  manual_url?: string;
  
  policy?: string;
  created_at: string;
  updated_at: string;
  has_motor?: boolean;
  last_audited_at?: string;
  audit_status?: string;
  
  // Checkout fields from Lambda API
  is_checked_out?: boolean;
  checked_out_user_id?: string;
  checked_out_to?: string;
  checked_out_date?: string;
  expected_return_date?: string;
  checkout_intended_usage?: string;
  checkout_notes?: string;
}

const fetchTools = async () => {
  const response = await apiService.get<{ data: any[] }>('/tools?limit=1000');
  return getApiData(response) || [];
};

const fetchCheckouts = async () => {
  const response = await apiService.get<{ data: any[] }>('/checkouts?is_returned=false');
  return getApiData(response) || [];
};

export const useToolsData = (showRemovedItems: boolean = false) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use TanStack Query to share cache with other hooks (useOfflineData, useCombinedAssets)
  // Use shared query key function for consistency across the app
  const { data: toolsData = [], isLoading: toolsLoading, refetch: refetchTools } = useQuery({
    queryKey: toolsQueryKey(),
    queryFn: fetchTools,
    ...offlineQueryConfig,
  });

  // Fetch checkouts separately
  const { data: checkoutsData = [], isLoading: checkoutsLoading } = useQuery({
    queryKey: checkoutsQueryKey(false),
    queryFn: fetchCheckouts,
    ...offlineQueryConfig,
  });

  // Filter out removed items if needed
  let tools = toolsData;
  if (!showRemovedItems) {
    tools = toolsData.filter((tool: Tool) => tool.status !== 'removed');
  }

  // Build checkout map
  const activeCheckouts: {[key: string]: {user_name: string, user_id: string}} = {};
  checkoutsData.forEach((checkout: any) => {
    activeCheckouts[checkout.tool_id] = { 
      user_name: checkout.user_name, 
      user_id: checkout.user_id 
    };
  });

  const updateTool = async (toolId: string, updates: any) => {
    // TODO: Implement tool updates via AWS API
    console.warn('Tool updates not yet implemented for AWS API');
    return false;
  };

  const createTool = async (toolData: any) => {
    // TODO: Implement tool creation via AWS API
    console.warn('Tool creation not yet implemented for AWS API');
    return null;
  };

  const invalidateTools = () => {
    queryClient.invalidateQueries({ queryKey: toolsQueryKey() });
  };

  return {
    tools,
    loading: toolsLoading || checkoutsLoading,
    activeCheckouts,
    fetchTools: invalidateTools, // For backward compatibility
    updateTool,
    createTool,
    refetch: invalidateTools
  };
};