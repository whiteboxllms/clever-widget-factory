// Shared offline-first configuration for all queries
export const offlineQueryConfig = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
  networkMode: 'offlineFirst' as const, // Use cache when offline
};

export const offlineMutationConfig = {
  networkMode: 'offlineFirst' as const, // Queue mutations when offline
};