import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export interface UserProfile {
  user_id: string;
  full_name: string;
  role?: string;
  favorite_color?: string;
}

// Global cache to persist across component unmounts
const userCache = new Map<string, UserProfile>();
const cacheTimestamp = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useUserNames(userIds: string[] = []) {
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  
  const organizationId = useOrganizationId();

  const fetchUserNames = useCallback(async (ids: string[]) => {
    if (!ids.length || !organizationId) {
      setUserMap(new Map());
      return;
    }

    // Check cache first
    const now = Date.now();
    const uncachedIds = ids.filter(id => {
      const cached = userCache.get(id);
      const timestamp = cacheTimestamp.get(id);
      return !cached || !timestamp || (now - timestamp) > CACHE_DURATION;
    });

    // If all IDs are cached and fresh, use cache
    if (uncachedIds.length === 0) {
      const cachedMap = new Map<string, string>();
      ids.forEach(id => {
        const cached = userCache.get(id);
        if (cached) {
          cachedMap.set(id, cached.full_name);
        }
      });
      setUserMap(cachedMap);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch only uncached users from organization_members and profiles
      const [membersResult, profilesResult] = await Promise.all([
        supabase
          .from('organization_members')
          .select('user_id, full_name, role')
          .eq('is_active', true)
          .in('user_id', uncachedIds),
        supabase
          .from('profiles')
          .select('user_id, favorite_color')
          .in('user_id', uncachedIds)
      ]);

      if (membersResult.error) {
        console.warn('Error fetching organization members:', membersResult.error);
        return;
      }

      const usersData = membersResult.data || [];
      const profilesData = profilesResult.data || [];
      
      // Create a map of user_id (favorite_color removed as column doesn't exist)
      const colorMap = new Map();

      // Update cache
      const newMap = new Map<string, string>();
      
      // Add cached users
      ids.forEach(id => {
        const cached = userCache.get(id);
        if (cached) {
          newMap.set(id, cached.full_name);
        }
      });

      // Add newly fetched users
      usersData.forEach(user => {
        const userProfile: UserProfile = {
          user_id: user.user_id,
          full_name: user.full_name || 'Unknown',
          role: user.role,
          favorite_color: colorMap.get(user.user_id) || '#6B7280' // Default gray color
        };
        
        userCache.set(user.user_id, userProfile);
        cacheTimestamp.set(user.user_id, now);
        newMap.set(user.user_id, userProfile.full_name);
      });

      setUserMap(newMap);
    } catch (error) {
      console.warn('Error in useUserNames:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUserNames(userIds);
  }, [fetchUserNames, userIds.join(',')]);

  const getUserName = useCallback((userId: string) => {
    return userMap.get(userId) || 'Unknown';
  }, [userMap]);

  const getUserColor = useCallback((userId: string) => {
    const cached = userCache.get(userId);
    return cached?.favorite_color || '#6B7280'; // Default gray color
  }, []);

  const getUserProfile = useCallback((userId: string) => {
    const cached = userCache.get(userId);
    return cached || { user_id: userId, full_name: 'Unknown', favorite_color: '#6B7280' };
  }, []);

  const refreshUser = useCallback((userId: string) => {
    // Remove from cache to force refresh
    userCache.delete(userId);
    cacheTimestamp.delete(userId);
    fetchUserNames([userId]);
  }, [fetchUserNames]);

  return {
    getUserName,
    getUserColor,
    getUserProfile,
    userMap,
    loading,
    refreshUser
  };
}
