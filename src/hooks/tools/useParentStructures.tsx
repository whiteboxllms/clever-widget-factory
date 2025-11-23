import { useState, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { Tool } from './useToolsData';
import { apiService } from '@/lib/apiService';

export const useParentStructures = () => {
  const [parentStructures, setParentStructures] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchParentStructures = async () => {
    try {
      const result = await apiService.get('/tools?category=Infrastructure,Container&status=!removed');
      setParentStructures(result.data || []);
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