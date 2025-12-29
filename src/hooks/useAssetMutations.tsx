import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { offlineMutationConfig } from '@/lib/queryConfig';
import { toolsQueryKey } from '@/lib/queryKeys';

export function useAssetMutations() {
  const queryClient = useQueryClient();

  const updatePart = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await apiService.put(`/parts/${id}`, data);
      return result.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['parts'] });
      const previousParts = queryClient.getQueryData(['parts']);
      queryClient.setQueryData(['parts'], (old: any[]) => 
        old?.map(part => part.id === variables.id ? { ...part, ...variables.data } : part)
      );
      return { previousParts };
    },
    onError: (err, variables, context) => {
      if (context?.previousParts) {
        queryClient.setQueryData(['parts'], context.previousParts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    ...offlineMutationConfig,
  });

  const updateTool = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await apiService.put(`/tools/${id}`, data);
      return result.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: toolsQueryKey() });
      const previousTools = queryClient.getQueryData(toolsQueryKey());
      queryClient.setQueryData(toolsQueryKey(), (old: any[]) => 
        old?.map(tool => tool.id === variables.id ? { ...tool, ...variables.data } : tool)
      );
      return { previousTools };
    },
    onError: (err, variables, context) => {
      if (context?.previousTools) {
        queryClient.setQueryData(toolsQueryKey(), context.previousTools);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: toolsQueryKey() });
    },
    ...offlineMutationConfig,
  });

  const createPartsHistory = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiService.post('/parts_history', data);
      return result.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['parts_history'] });
      const previousHistory = queryClient.getQueryData(['parts_history']);
      queryClient.setQueryData(['parts_history'], (old: any[]) => 
        old ? [...old, { ...variables, id: 'temp-' + Date.now() }] : [variables]
      );
      return { previousHistory };
    },
    onError: (err, variables, context) => {
      if (context?.previousHistory) {
        queryClient.setQueryData(['parts_history'], context.previousHistory);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['parts_history'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryData'] });
    },
    ...offlineMutationConfig,
  });

  const deletePart = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiService.delete(`/parts/${id}`);
      return result.data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['parts'] });
      const previousParts = queryClient.getQueryData(['parts']);
      queryClient.setQueryData(['parts'], (old: any[]) => 
        old?.filter(part => part.id !== id)
      );
      return { previousParts };
    },
    onError: (err, id, context) => {
      if (context?.previousParts) {
        queryClient.setQueryData(['parts'], context.previousParts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    ...offlineMutationConfig,
  });

  return {
    updatePart,
    updateTool,
    createPartsHistory,
    deletePart,
  };
}
