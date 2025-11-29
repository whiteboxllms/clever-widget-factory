import { keepPreviousData } from '@tanstack/react-query';

// Re-export for convenience
export { keepPreviousData };

// Shared offline-first configuration for all queries
// Uses immediate render with background fetch pattern
export const offlineQueryConfig = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  networkMode: 'offlineFirst' as const, // Use cache when offline
  placeholderData: keepPreviousData,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
};

export const offlineMutationConfig = {
  networkMode: 'always' as const, // Execute mutations even when offline
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};