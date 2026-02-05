import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { offlineMutationConfig } from '@/lib/queryConfig';
import { toolsQueryKey } from '@/lib/queryKeys';

export function useAssetMutations() {
  const queryClient = useQueryClient();

  const createTool = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiService.post('/tools', data);
      return result.data;
    },
    onMutate: async (newTool) => {
      await queryClient.cancelQueries({ queryKey: toolsQueryKey() });
      const previousTools = queryClient.getQueryData(toolsQueryKey());
      
      // Optimistically add the new tool to cache
      const tempId = 'temp-' + Date.now();
      queryClient.setQueryData(toolsQueryKey(), (old: any[]) => 
        old ? [...old, { ...newTool, id: tempId, created_at: new Date().toISOString() }] : [{ ...newTool, id: tempId }]
      );
      
      return { previousTools, tempId };
    },
    onSuccess: (data, variables, context) => {
      // Replace temp item with real data from server
      queryClient.setQueryData(toolsQueryKey(), (old: any[]) => 
        old?.map(tool => tool.id === context.tempId ? data : tool)
      );
    },
    onError: (err, variables, context) => {
      if (context?.previousTools) {
        queryClient.setQueryData(toolsQueryKey(), context.previousTools);
      }
    },
    ...offlineMutationConfig,
  });

  const createPart = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiService.post('/parts', data);
      return result.data;
    },
    onMutate: async (newPart) => {
      await queryClient.cancelQueries({ queryKey: ['parts'] });
      const previousParts = queryClient.getQueryData(['parts']);
      
      // Optimistically add the new part to cache
      const tempId = 'temp-' + Date.now();
      queryClient.setQueryData(['parts'], (old: any[]) => 
        old ? [...old, { ...newPart, id: tempId, created_at: new Date().toISOString() }] : [{ ...newPart, id: tempId }]
      );
      
      return { previousParts, tempId };
    },
    onSuccess: (data, variables, context) => {
      // Replace temp item with real data from server
      queryClient.setQueryData(['parts'], (old: any[]) => 
        old?.map(part => part.id === context.tempId ? data : part)
      );
    },
    onError: (err, variables, context) => {
      if (context?.previousParts) {
        queryClient.setQueryData(['parts'], context.previousParts);
      }
    },
    ...offlineMutationConfig,
  });

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
    createTool,
    createPart,
    updatePart,
    updateTool,
    createPartsHistory,
    deletePart,
  };
}
