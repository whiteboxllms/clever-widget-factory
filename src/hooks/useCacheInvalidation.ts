import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './useWebSocket';
import {
  toolsQueryKey,
  actionsQueryKey,
  completedActionsQueryKey,
  allActionsQueryKey,
  issuesQueryKey,
  missionsQueryKey,
  explorationsQueryKey,
  experiencesQueryKey,
} from '@/lib/queryKeys';

interface CacheInvalidatePayload {
  entityType: string;
  entityId: string;
  mutationType: 'created' | 'updated' | 'deleted';
}

/**
 * Subscribes to `cache:invalidate` WebSocket messages and invalidates
 * the corresponding TanStack Query caches so all connected clients
 * see fresh data without a manual refresh.
 */
export function useCacheInvalidation() {
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = subscribe('cache:invalidate', (payload: CacheInvalidatePayload) => {
      const { entityType } = payload;

      // Map entity types to the query keys that should be invalidated.
      // Some entity types map to multiple keys (e.g. actions have three list variants).
      // Issues and experiences use prefix matching because their keys include filter params.
      switch (entityType) {
        case 'tool':
          queryClient.invalidateQueries({ queryKey: toolsQueryKey() });
          break;

        case 'part':
          queryClient.invalidateQueries({ queryKey: ['parts'] });
          break;

        case 'action':
          queryClient.invalidateQueries({ queryKey: actionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: completedActionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: allActionsQueryKey() });
          break;

        case 'issue':
          // issuesQueryKey() produces ['issues', ...filters] — invalidate any key starting with 'issues'
          queryClient.invalidateQueries({ queryKey: [issuesQueryKey()[0]] });
          break;

        case 'mission':
          queryClient.invalidateQueries({ queryKey: missionsQueryKey() });
          break;

        case 'exploration':
          queryClient.invalidateQueries({ queryKey: explorationsQueryKey() });
          break;

        case 'experience':
          // experiencesQueryKey() produces ['experiences', ...filters] — invalidate any key starting with 'experiences'
          queryClient.invalidateQueries({ queryKey: [experiencesQueryKey()[0]] });
          break;

        default:
          console.warn(`[useCacheInvalidation] Unknown entityType: "${entityType}", skipping invalidation`);
          break;
      }
    });

    return unsubscribe;
  }, [subscribe, queryClient]);
}
