import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { snapshotService, type CreateSnapshotData, type UpdateSnapshotData } from '../services/snapshotService';

export function useSnapshots(stateId: string | undefined) {
  return useQuery({
    queryKey: ['snapshots', stateId],
    queryFn: () => stateId ? snapshotService.getSnapshots(stateId) : Promise.resolve([]),
    enabled: !!stateId,
  });
}

export function useSnapshotMutations(stateId: string) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateSnapshotData) => snapshotService.createSnapshot(stateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots', stateId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ snapshotId, data }: { snapshotId: string; data: UpdateSnapshotData }) =>
      snapshotService.updateSnapshot(snapshotId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots', stateId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (snapshotId: string) => snapshotService.deleteSnapshot(snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots', stateId] });
    },
  });

  return {
    createSnapshot: createMutation.mutateAsync,
    updateSnapshot: updateMutation.mutateAsync,
    deleteSnapshot: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
