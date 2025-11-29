import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { offlineMutationConfig } from '@/lib/queryConfig';

export function useAssetMutations() {
  const queryClient = useQueryClient();

  const updatePart = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await apiService.put(`/parts/${id}`, data);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
    ...offlineMutationConfig,
  });

  const updateTool = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await apiService.put(`/tools/${id}`, data);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
    ...offlineMutationConfig,
  });

  const createPartsHistory = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiService.post('/parts_history', data);
      return result.data;
    },
    onSuccess: () => {
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
    onSuccess: () => {
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
