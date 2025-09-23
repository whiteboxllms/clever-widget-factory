import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useToast } from '@/hooks/use-toast';

export interface ActionProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

export function useActionProfiles() {
  const [profiles, setProfiles] = useState<ActionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  const fetchProfiles = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Standardized query: active members from current organization, ordered by name
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, full_name, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching action profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles",
        variant: "destructive"
      });
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [organizationId]);

  return {
    profiles,
    loading,
    refetch: fetchProfiles
  };
}