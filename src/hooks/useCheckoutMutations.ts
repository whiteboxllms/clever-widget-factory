import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';

interface CheckoutData {
  tool_id: string;
  user_id: string;
  intended_usage: string | null;
  notes: string | null;
  action_id: string | null;
  is_returned: boolean;
  checkout_date: string;
}

export function useCheckoutMutations() {
  const queryClient = useQueryClient();

  const createCheckout = useMutation({
    mutationFn: async (data: CheckoutData) => {
      const result = await apiService.post('/checkouts', data);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate server-computed data - remove refetchType to always refetch
      queryClient.invalidateQueries({ 
        queryKey: ['checkouts']
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tools']
      });
    }
  });

  return { createCheckout };
}
