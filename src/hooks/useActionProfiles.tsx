import { useState, useEffect } from 'react';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/apiService';

export interface ActionProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  favorite_color?: string | null;
}

export function useActionProfiles() {
  const [profiles, setProfiles] = useState<ActionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      
      const result = await apiService.get(`/organization_members?organization_id=${organizationId || '00000000-0000-0000-0000-000000000001'}`);
      const data = result.data || [];

      // Transform to match ActionProfile interface
      const actionProfiles: ActionProfile[] = data.map((member: any) => ({
        id: member.user_id,
        user_id: member.user_id,
        full_name: member.full_name,
        role: member.role,
        favorite_color: member.favorite_color
      }));

      setProfiles(actionProfiles);
    } catch (error) {
      console.error('Error in fetchProfiles:', error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchProfiles();
    }
  }, [organizationId]);

  return {
    profiles,
    loading,
    refetch: fetchProfiles
  };
}
