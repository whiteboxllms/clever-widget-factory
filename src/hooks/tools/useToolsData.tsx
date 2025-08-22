import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  image_url?: string;
  storage_vicinity: string;
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
}

export const useToolsData = (showRemovedItems: boolean = false) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCheckouts, setActiveCheckouts] = useState<{[key: string]: {user_name: string, user_id: string}}>({});
  const { toast } = useToast();

  const fetchTools = async () => {
    try {
      let query = supabase
        .from('tools')
        .select(`
          id,
          name,
          description,
          category,
          status,
          image_url,
          storage_vicinity,
          storage_location,
          actual_location,
          serial_number,
          last_maintenance,
          manual_url,
          
          stargazer_sop,
          created_at,
          updated_at,
          has_motor,
          last_audited_at,
          audit_status
        `);
      
      if (!showRemovedItems) {
        query = query.neq('status', 'unable_to_find');
      }
      
      const { data, error } = await query.order('name');

      if (error) throw error;
      setTools(data || []);

      // Fetch active checkouts for all tools
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select('tool_id, user_name, user_id')
        .eq('is_returned', false);

      if (checkoutsError) {
        console.error('Error fetching active checkouts:', checkoutsError);
      } else {
        const checkoutMap: {[key: string]: {user_name: string, user_id: string}} = {};
        checkoutsData?.forEach(checkout => {
          checkoutMap[checkout.tool_id] = { user_name: checkout.user_name, user_id: checkout.user_id };
        });
        setActiveCheckouts(checkoutMap);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      toast({
        title: "Error",
        description: "Failed to load tools",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTool = async (toolId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('tools')
        .update(updates)
        .eq('id', toolId);

      if (error) throw error;

      // Update local state
      setTools(prev => prev.map(tool => 
        tool.id === toolId ? { ...tool, ...updates } : tool
      ));

      return true;
    } catch (error) {
      console.error('Error updating tool:', error);
      toast({
        title: "Error",
        description: "Failed to update tool",
        variant: "destructive"
      });
      return false;
    }
  };

  const createTool = async (toolData: any) => {
    try {
      console.log('Creating tool with data:', toolData);
      const { data, error } = await supabase
        .from('tools')
        .insert(toolData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Add to local state
      setTools(prev => [...prev, data]);
      
      return data;
    } catch (error) {
      console.error('Error creating tool:', error);
      toast({
        title: "Error",
        description: `Failed to create tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      return null;
    }
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