import { useState, useEffect } from 'react';
import { database as supabase } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Tool } from './useToolsData';

export const useParentStructures = () => {
  const [parentStructures, setParentStructures] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchParentStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('tools')
        .select(`
          id,
          name,
          description,
          category,
          status,
          image_url,
          legacy_storage_vicinity,
          parent_structure_id,
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
        `)
        .in('category', ['Infrastructure', 'Container'])
        .neq('status', 'removed')
        .order('name');

      if (error) throw error;
      setParentStructures(data || []);
    } catch (error) {
      console.error('Error fetching parent structures:', error);
      toast({
        title: "Error",
        description: "Failed to load parent structures",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParentStructures();
  }, []);

  return {
    parentStructures,
    loading,
    refetch: fetchParentStructures
  };
};