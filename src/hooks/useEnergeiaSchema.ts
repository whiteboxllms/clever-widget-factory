import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/hooks/useCognitoAuth';
import type { EnergeiaSchemaData } from '@/types/energeia';

const ENERGEIA_SCHEMA_QUERY_KEY = 'energeia-schema';

export function useEnergeiaSchema(): {
  data: EnergeiaSchemaData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isEmpty: boolean;
  computedAt: string | null;
  refresh: (k: number, timeWindowDays: number, reductionMethod: 'pca' | 'tsne') => Promise<void>;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery<EnergeiaSchemaData | null>({
    queryKey: [ENERGEIA_SCHEMA_QUERY_KEY],
    queryFn: async () => {
      const response = await apiService.get<{ data: EnergeiaSchemaData | null }>(
        '/api/energeia/schema'
      );
      return response.data ?? null;
    },
    enabled: Boolean(user?.userId),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const refresh = async (k: number, timeWindowDays: number, reductionMethod: 'pca' | 'tsne' = 'pca'): Promise<void> => {
    setIsRefreshing(true);
    try {
      await apiService.post('/api/energeia/refresh', {
        k,
        time_window_days: timeWindowDays,
        reduction_method: reductionMethod,
      });
      await queryClient.invalidateQueries({ queryKey: [ENERGEIA_SCHEMA_QUERY_KEY] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const data = query.data ?? null;
  const isLoading = query.isLoading;

  return {
    data,
    isLoading,
    isRefreshing,
    isEmpty: data === null && !isLoading && !isRefreshing,
    computedAt: data?.computed_at ?? null,
    refresh,
  };
}
