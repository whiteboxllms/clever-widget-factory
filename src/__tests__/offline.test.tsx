import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuery, useMutation } from '@tanstack/react-query';
import { offlineQueryConfig, offlineMutationConfig } from '@/lib/queryConfig';

describe('Offline Functionality', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should use cached data when offline', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Test' }] });

    // First fetch - online
    const { result, rerender } = renderHook(
      () =>
        useQuery({
          queryKey: ['test'],
          queryFn: mockFetch,
          ...offlineQueryConfig,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: [{ id: '1', name: 'Test' }] });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Simulate offline - mock fetch to fail
    mockFetch.mockRejectedValue(new Error('Network error'));

    // Refetch while offline
    queryClient.invalidateQueries({ queryKey: ['test'] });
    rerender();

    // Should still have cached data
    await waitFor(() => {
      expect(result.current.data).toEqual({ data: [{ id: '1', name: 'Test' }] });
    });
  });

  it('should execute mutations immediately even when offline', async () => {
    const mockMutate = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: mockMutate,
          ...offlineMutationConfig,
        }),
      { wrapper }
    );

    // Try to mutate while offline - with networkMode: 'always', it executes immediately
    result.current.mutate({ id: '1', name: 'New Item' });

    // Mutation executes and will retry on failure
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });

    expect(mockMutate).toHaveBeenCalledWith(
      { id: '1', name: 'New Item' },
      expect.any(Object)
    );
  });

  it('should have correct offline config', () => {
    expect(offlineQueryConfig.networkMode).toBe('offlineFirst');
    expect(offlineQueryConfig.staleTime).toBe(15 * 60 * 1000);
    expect(offlineQueryConfig.gcTime).toBe(7 * 24 * 60 * 60 * 1000);

    expect(offlineMutationConfig.networkMode).toBe('always');
    expect(offlineMutationConfig.retry).toBe(0);
  });
});
