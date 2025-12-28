import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Tool } from './useToolsData';
import { toolsQueryKey } from '@/lib/queryKeys';

export const useParentStructures = () => {
  const queryClient = useQueryClient();
  
  // Get tools directly from cache (already loaded by useCombinedAssets)
  // This is instant - no query, no network call, just reading from memory
  const toolsData = queryClient.getQueryData<Tool[]>(toolsQueryKey()) || [];
  
  // Filter client-side: Infrastructure or Container category, and not removed
  // This is O(n) where n is typically < 2000, so it's extremely fast (< 1ms)
  const parentStructures = useMemo(() => {
    return toolsData.filter((tool: Tool) => {
      const isInfrastructureOrContainer = tool.category === 'Infrastructure' || tool.category === 'Container';
      const isNotRemoved = tool.status !== 'removed';
      return isInfrastructureOrContainer && isNotRemoved;
    });
  }, [toolsData]);

  // Check if tools query is still loading (from the query state)
  const queryState = queryClient.getQueryState(toolsQueryKey());
  const loading = queryState?.status === 'pending' || queryState?.isFetching || false;

  return {
    parentStructures,
    loading,
    refetch: () => {
      // Invalidate the tools query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: toolsQueryKey() });
    }
  };
};