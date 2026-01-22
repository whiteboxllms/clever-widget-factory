/**
 * TanStack Query Hooks for Action Management
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actionService } from '../services/actionService';

/**
 * Hook to update an existing action
 */
export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      actionService.updateAction(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['actions', data.id] });
    },
    onError: (error) => {
      console.error('Failed to update action:', error);
    },
  });
}
