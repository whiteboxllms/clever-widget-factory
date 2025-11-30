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
      
      const result = await apiService.get('/profiles');
      const data = result.data || [];

      // Transform to match ActionProfile interface
      const actionProfiles: ActionProfile[] = data.map((profile: any) => ({
        id: profile.user_id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        role: profile.role || 'member',
        favorite_color: profile.favorite_color
      }));

      setProfiles(actionProfiles);
    } catch (error) {
      console.error('Error in fetchProfiles:', error);
      toast({
        title: "Error",
        description: "Failed to load profiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return {
    profiles,
    loading,
    refetch: fetchProfiles
  };
}
