import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stateService } from '../services/stateService';
import { statesQueryKey, stateQueryKey, actionsQueryKey } from '../lib/queryKeys';
import type { CreateObservationData } from '../types/observations';

export function useStates(filters?: { entity_type?: string; entity_id?: string }) {
  return useQuery({
    queryKey: statesQueryKey(filters),
    queryFn: () => stateService.getStates(filters),
    enabled: !!(filters?.entity_type && filters?.entity_id),
  });
}

export function useStateById(id: string) {
  return useQuery({
    queryKey: stateQueryKey(id),
    queryFn: () => stateService.getState(id),
    enabled: !!id,
  });
}

export function useStateMutations(filters?: { entity_type?: string; entity_id?: string }) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateObservationData) => stateService.createState(data),
    onSuccess: (newState, variables) => {
      // Invalidate the filtered states list
      if (filters) {
        queryClient.invalidateQueries({ queryKey: statesQueryKey(filters) });
      }
      // Invalidate all states
      queryClient.invalidateQueries({ queryKey: statesQueryKey() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateObservationData> }) =>
      stateService.updateState(id, data),
    onSuccess: (_, variables) => {
      // Invalidate the filtered states list
      if (filters) {
        queryClient.invalidateQueries({ queryKey: statesQueryKey(filters) });
      }
      // Invalidate all states
      queryClient.invalidateQueries({ queryKey: statesQueryKey() });
      // Invalidate the specific state
      queryClient.invalidateQueries({ queryKey: stateQueryKey(variables.id) });
      
      // If this state is linked to an action, invalidate actions cache
      // because implementation_update_count might change (e.g., photos added/removed)
      if (filters?.entity_type === 'action') {
        queryClient.invalidateQueries({ queryKey: actionsQueryKey() });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stateService.deleteState(id),
    onSuccess: () => {
      // Invalidate the filtered states list
      if (filters) {
        queryClient.invalidateQueries({ queryKey: statesQueryKey(filters) });
      }
      // Invalidate all states
      queryClient.invalidateQueries({ queryKey: statesQueryKey() });
    },
  });

  return {
    createState: createMutation.mutateAsync,
    updateState: updateMutation.mutateAsync,
    deleteState: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
