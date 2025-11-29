import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/apiService';

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
  
  stargazer_sop?: string;
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

export const useToolsData = (showRemovedItems: boolean = false) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCheckouts, setActiveCheckouts] = useState<{[key: string]: {user_name: string, user_id: string}}>({});
  const { toast } = useToast();

  const fetchTools = async () => {
    try {
      const result = await apiService.get('/tools');
      let toolsData = result.data || [];
      
      if (!showRemovedItems) {
        toolsData = toolsData.filter((tool: Tool) => tool.status !== 'removed');
      }
      
      setTools(toolsData);

      // Fetch active checkouts
      const checkoutsResult = await apiService.get('/checkouts?is_returned=false');
      const checkoutMap: {[key: string]: {user_name: string, user_id: string}} = {};
      checkoutsResult.data?.forEach((checkout: any) => {
        checkoutMap[checkout.tool_id] = { user_name: checkout.user_name, user_id: checkout.user_id };
      });
      setActiveCheckouts(checkoutMap);
    } catch (error) {
      console.error('Error fetching tools:', error);
      if (navigator.onLine) {
        toast({
          title: "Error",
          description: "Failed to load tools",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchTools();
  }, [showRemovedItems]);

  return {
    tools,
    loading,
    activeCheckouts,
    fetchTools,
    updateTool,
    createTool,
    refetch: fetchTools
  };
};