import { useState, useEffect } from 'react';
import { supabase } from '@/lib/client';

interface UserProfile {
  user_id: string;
  full_name: string | null;
}

// Custom hook for securely accessing user display names
export const useSecureProfiles = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAllDisplayNames = async () => {
    setLoading(true);
    try {
      // Use the security definer function instead of direct table access
      const { data, error } = await supabase
        .rpc('get_user_display_names');
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching user display names:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = async (userId: string): Promise<string | null> => {
    try {
      // Use the security definer function for individual lookups
      const { data, error } = await supabase
        .rpc('get_user_display_name', { target_user_id: userId });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching display name for user:', userId, error);
      return null;
    }
  };

  const getDisplayNameBatch = async (userIds: string[]): Promise<Record<string, string>> => {
    const nameMap: Record<string, string> = {};
    
    try {
      // Get all display names at once
      const { data, error } = await supabase
        .rpc('get_user_display_names');
      
      if (error) throw error;
      
      // Filter to only requested user IDs and create map
      (data || []).forEach((profile: UserProfile) => {
        if (userIds.includes(profile.user_id) && profile.full_name) {
          nameMap[profile.user_id] = profile.full_name;
        }
      });
    } catch (error) {
      console.error('Error fetching display names batch:', error);
    }
    
    return nameMap;
  };

  useEffect(() => {
    fetchAllDisplayNames();
  }, []);

  return {
    profiles,
    loading,
    refreshProfiles: fetchAllDisplayNames,
    getDisplayName,
    getDisplayNameBatch
  };
};