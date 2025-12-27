import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { BaseAction } from '@/types/actions';

export function useActionMutations() {
  const queryClient = useQueryClient();

  const updateAction = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<BaseAction> }) => {
      const result = await apiService.put(`/actions/${data.id}`, data.updates);
      return result.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['actions'] });
      const previousActions = queryClient.getQueryData<BaseAction[]>(['actions']);
      
      queryClient.setQueryData<BaseAction[]>(['actions'], (old) => {
        if (!old) return old;
        return old.map(action => 
          action.id === variables.id 
            ? { ...action, ...variables.updates }
            : action
        );
      });
      
      return { previousActions };
    },
    onError: (err, variables, context) => {
      if (context?.previousActions) {
        queryClient.setQueryData(['actions'], context.previousActions);
      }
    },
    onSuccess: () => {
      // Invalidate checkouts since they're created server-side with generated IDs
      queryClient.invalidateQueries({ queryKey: ['checkouts'] });
    }
  });

  return { updateAction };
}
