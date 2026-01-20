/**
 * TanStack Query Hooks for Exploration Management
 * 
 * Provides hooks for:
 * - Listing non-integrated explorations
 * - Creating new explorations
 * - Linking/unlinking actions to explorations
 * - Cache management and invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { explorationService } from '../services/explorationService';

// Cache key constants
export const explorationKeys = {
  all: ['explorations'] as const,
  lists: () => [...explorationKeys.all, 'list'] as const,
  list: (status?: string) => [...explorationKeys.lists(), { status }] as const,
  details: () => [...explorationKeys.all, 'detail'] as const,
  detail: (id: string) => [...explorationKeys.details(), id] as const,
};

/**
 * Hook to fetch non-integrated explorations for the selection dialog
 */
export function useNonIntegratedExplorations() {
  return useQuery({
    queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
    queryFn: () => explorationService.getNonIntegratedExplorations(),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });
}

/**
 * Hook to create a new exploration with a user-provided code
 */
export function useCreateExploration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { exploration_code: string }) =>
      explorationService.createExploration(data),
    onSuccess: (newExploration) => {
      // Invalidate the explorations list to refresh with new exploration
      queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });

      // Optionally set the new exploration in cache
      queryClient.setQueryData(
        explorationKeys.detail(String(newExploration.id)),
        newExploration
      );
    },
    onError: (error) => {
      console.error('Failed to create exploration:', error);
    },
  });
}

/**
 * Hook to link an action to an exploration
 */
export function useLinkExploration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      explorationId,
    }: {
      actionId: string;
      explorationId: string;
    }) => explorationService.linkExploration(actionId, explorationId),
    onSuccess: (data) => {
      // Update action cache
      if (data.action) {
        queryClient.setQueryData(['actions', data.action.id], data.action);
      }

      // Update exploration cache
      if (data.explorations && data.explorations.length > 0) {
        data.explorations.forEach((exp: any) => {
          queryClient.setQueryData(explorationKeys.detail(exp.id), exp);
        });
      }

      // Invalidate list to refresh action counts
      queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });
    },
    onError: (error) => {
      console.error('Failed to link exploration:', error);
    },
  });
}

/**
 * Hook to link an action to multiple explorations
 */
export function useLinkExplorations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      explorationIds,
    }: {
      actionId: string;
      explorationIds: string[];
    }) => explorationService.linkExplorations(actionId, explorationIds),
    onSuccess: (data) => {
      // Update action cache
      if (data.action) {
        queryClient.setQueryData(['actions', data.action.id], data.action);
      }

      // Update exploration cache
      if (data.explorations && data.explorations.length > 0) {
        data.explorations.forEach((exp: any) => {
          queryClient.setQueryData(explorationKeys.detail(exp.id), exp);
        });
      }

      // Invalidate list to refresh action counts
      queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });
    },
    onError: (error) => {
      console.error('Failed to link explorations:', error);
    },
  });
}

/**
 * Hook to unlink an action from an exploration
 */
export function useUnlinkExploration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      actionId,
      explorationId,
    }: {
      actionId: string;
      explorationId: string;
    }) => explorationService.unlinkExploration(actionId, explorationId),
    onSuccess: (data) => {
      // Update action cache
      if (data.action) {
        queryClient.setQueryData(['actions', data.action.id], data.action);
      }

      // Invalidate list to refresh action counts
      queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });
    },
    onError: (error) => {
      console.error('Failed to unlink exploration:', error);
    },
  });
}
