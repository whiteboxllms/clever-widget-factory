import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOrganizationMembers } from '@/lib/queryFetchers';
import { offlineQueryConfig } from '@/lib/queryConfig';

export interface OrganizationMember {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  favorite_color?: string;
  cognito_user_id?: string;
}

export function useOrganizationMembers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['organization_members'],
    queryFn: async () => {
      const members = await fetchOrganizationMembers();
      return members.map((member: any) => ({
        id: member.user_id,
        user_id: member.user_id,
        full_name: member.full_name,
        role: member.role,
        favorite_color: member.favorite_color,
        cognito_user_id: member.cognito_user_id,
      })) as OrganizationMember[];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: offlineQueryConfig.placeholderData,
    networkMode: offlineQueryConfig.networkMode,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['organization_members'] });

  return {
    members: query.data ?? [],
    loading: query.isLoading,
    refetch: invalidate,
  };
}
