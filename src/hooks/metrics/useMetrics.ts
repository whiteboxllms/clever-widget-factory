import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { metricsApi, type Metric, type CreateMetricRequest, type UpdateMetricRequest } from '@/lib/metricsApi';
import { toast } from 'sonner';

export function useMetrics(toolId: string | undefined) {
  return useQuery({
    queryKey: ['metrics', toolId],
    queryFn: () => metricsApi.getMetrics(toolId!),
    enabled: !!toolId,
  });
}

export function useCreateMetric(toolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMetricRequest) => metricsApi.createMetric(toolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics', toolId] });
      toast.success('Metric added');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add metric');
    },
  });
}

export function useUpdateMetric(toolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ metricId, data }: { metricId: string; data: UpdateMetricRequest }) =>
      metricsApi.updateMetric(toolId, metricId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics', toolId] });
      toast.success('Metric updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update metric');
    },
  });
}

export function useDeleteMetric(toolId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (metricId: string) => metricsApi.deleteMetric(toolId, metricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics', toolId] });
      toast.success('Metric deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete metric');
    },
  });
}
