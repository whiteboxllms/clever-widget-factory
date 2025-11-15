import { useState, useEffect } from 'react';
import { supabase } from '@/lib/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useToast } from '@/hooks/use-toast';

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
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // First get organization members
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, full_name, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('full_name');

      if (membersError) throw membersError;

      // Then get profiles for those users
      const userIds = members?.map(m => m.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, favorite_color')
        .in('user_id', userIds);

      if (profilesError) {
        console.warn('Error fetching profiles:', profilesError);
      }

      // Create a map of user_id to favorite_color
      const colorMap = new Map();
      profiles?.forEach(profile => {
        colorMap.set(profile.user_id, profile.favorite_color);
      });

      // Map the data to include favorite_color
      const profilesWithColors = (members || []).map(member => ({
        id: member.id,
        user_id: member.user_id,
        full_name: member.full_name,
        role: member.role,
        favorite_color: colorMap.get(member.user_id) || null
      }));

      setProfiles(profilesWithColors);
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