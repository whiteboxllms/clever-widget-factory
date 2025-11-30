import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';

export interface ActionProfile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  favorite_color?: string | null;
}

/**
 * useActionProfiles - Migrated to use organization_members instead of profiles
 * 
 * This hook now uses useOrganizationMembers which:
 * - Uses TanStack Query with session-level caching (staleTime: Infinity)
 * - Only fetches once per session
 * - Returns active organization members only
 * 
 * The data is transformed to match the ActionProfile interface for backward compatibility.
 */
export function useActionProfiles() {
  const { members, loading } = useOrganizationMembers();

  // Transform organization members to ActionProfile format
  // Filter out members with empty/whitespace names
  const profiles: ActionProfile[] = members
    .filter(member => member.full_name && member.full_name.trim() !== '')
    .map(member => ({
      id: member.user_id,
      user_id: member.user_id,
      full_name: member.full_name,
      role: member.role || 'member',
      favorite_color: member.favorite_color || null
    }));

  return {
    profiles,
    loading,
    refetch: () => {
      // Refetch is handled by useOrganizationMembers
      // This is kept for backward compatibility but doesn't need to do anything
      // since organization members are cached at session level
    }
  };
}
