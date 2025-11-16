import { useState, useEffect } from 'react';

import { useToast } from '@/hooks/use-toast';
import { Tool } from './useToolsData';

export const useParentStructures = () => {
  const [parentStructures, setParentStructures] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchParentStructures = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tools?category=Infrastructure,Container&status=!removed`);
      const data = await response.json();
      
      if (!response.ok) throw new Error('Failed to fetch parent structures');
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