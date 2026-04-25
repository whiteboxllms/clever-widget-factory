import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, getApiData } from '@/lib/apiService';
import { memberSettingsQueryKey } from '@/lib/queryKeys';

/**
 * Member settings shape stored in organization_members.settings JSONB.
 */
export interface MemberSettings {
  growth_intents?: string[];
}

/**
 * Query hook to fetch member settings.
 * GET /api/members/:userId/settings → { data: MemberSettings }
 *
 * Requirements: 4.1, 4.2
 */
export function useMemberSettings(
  userId: string | undefined,
  organizationId: string | undefined
) {
  return useQuery<MemberSettings>({
    queryKey: memberSettingsQueryKey(userId ?? '', organizationId),
    queryFn: async () => {
      const response = await apiService.get(`/members/${userId}/settings`);
      return getApiData(response) ?? {};
    },
    enabled: !!(userId && organizationId),
  });
}

/**
 * Mutation hook to update member settings.
 * PUT /api/members/:userId/settings { settings: MemberSettings }
 *
 * Uses optimistic updates to keep the UI responsive.
 * Requirements: 4.1, 4.2
 */
export function useUpdateMemberSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      settings,
    }: {
      userId: string;
      settings: MemberSettings;
    }) => {
      const result = await apiService.put(`/members/${userId}/settings`, {
        settings,
      });
      return getApiData(result) as MemberSettings;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: memberSettingsQueryKey(variables.userId),
      });

      const previous = queryClient.getQueryData<MemberSettings>(
        memberSettingsQueryKey(variables.userId)
      );

      // Optimistically update the cache
      queryClient.setQueryData<MemberSettings>(
        memberSettingsQueryKey(variables.userId),
        variables.settings
      );

      return { previous };
    },
    onError: (_error, variables, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(
          memberSettingsQueryKey(variables.userId),
          context.previous
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch to ensure server state is in sync
      queryClient.invalidateQueries({
        queryKey: memberSettingsQueryKey(variables.userId),
      });
    },
  });
}
