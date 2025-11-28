import { keepPreviousData } from '@tanstack/react-query';

// Shared offline-first configuration for all queries
// Uses immediate render with background fetch pattern
export const offlineQueryConfig = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  networkMode: 'offlineFirst' as const, // Use cache when offline
  placeholderData: keepPreviousData, // Show previous data immediately while fetching in background
  refetchOnMount: true, // Refetch in background if data is stale
  refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary calls
};

export const offlineMutationConfig = {
  networkMode: 'offlineFirst' as const, // Queue mutations when offline
};