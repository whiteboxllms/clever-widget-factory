import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { observationService } from '../services/observationService';
import { observationsQueryKey, observationQueryKey } from '../lib/queryKeys';
import type { CreateObservationData } from '../types/observations';

export function useObservations() {
  return useQuery({
    queryKey: observationsQueryKey(),
    queryFn: () => observationService.getObservations(),
  });
}

export function useObservation(id: string) {
  return useQuery({
    queryKey: observationQueryKey(id),
    queryFn: () => observationService.getObservation(id),
    enabled: !!id,
  });
}

export function useObservationMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateObservationData) => observationService.createObservation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: observationsQueryKey() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateObservationData> }) =>
      observationService.updateObservation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: observationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: observationQueryKey(variables.id) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => observationService.deleteObservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: observationsQueryKey() });
    },
  });

  return {
    createObservation: createMutation.mutateAsync,
    updateObservation: updateMutation.mutateAsync,
    deleteObservation: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
