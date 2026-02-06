import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStateMutations } from '../useStates';
import { stateService } from '../../services/stateService';
import type { CreateObservationData } from '../../types/observations';

// Mock the state service
vi.mock('../../services/stateService', () => ({
  stateService: {
    createState: vi.fn(),
    updateState: vi.fn(),
    deleteState: vi.fn(),
  },
}));

describe('useStateMutations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('cache invalidation', () => {
    it('should invalidate actions cache when creating state with action link', async () => {
      const mockState = {
        id: 'state-1',
        observation_text: 'Test observation',
        photos: [],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      const data: CreateObservationData = {
        observation_text: 'Test observation',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      await result.current.createState(data);

      await waitFor(() => {
        // Should invalidate states cache
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states', 'action', 'action-1'],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states'],
        });
        // Should invalidate actions cache because entity_type is 'action'
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['actions'],
        });
      });
    });

    it('should invalidate actions cache when deleting state with action link', async () => {
      vi.mocked(stateService.deleteState).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      await result.current.deleteState('state-1');

      await waitFor(() => {
        // Should invalidate states cache
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states', 'action', 'action-1'],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states'],
        });
        // Should invalidate actions cache because entity_type is 'action'
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['actions'],
        });
      });
    });

    it('should NOT invalidate actions cache when creating state with non-action link', async () => {
      const mockState = {
        id: 'state-1',
        observation_text: 'Test observation',
        photos: [],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'part', entity_id: 'part-1' }),
        { wrapper }
      );

      const data: CreateObservationData = {
        observation_text: 'Test observation',
        photos: [],
        links: [{ entity_type: 'part', entity_id: 'part-1' }],
      };

      await result.current.createState(data);

      await waitFor(() => {
        // Should invalidate states cache
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states', 'part', 'part-1'],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states'],
        });
        // Should NOT invalidate actions cache because entity_type is 'part'
        expect(invalidateSpy).not.toHaveBeenCalledWith({
          queryKey: ['actions'],
        });
      });
    });

    it('should invalidate specific state and states list when updating', async () => {
      const mockState = {
        id: 'state-1',
        observation_text: 'Updated observation',
        photos: [],
      };

      vi.mocked(stateService.updateState).mockResolvedValue(mockState as any);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      await result.current.updateState({
        id: 'state-1',
        data: { observation_text: 'Updated observation' },
      });

      await waitFor(() => {
        // Should invalidate states cache
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states', 'action', 'action-1'],
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['states'],
        });
        // Should invalidate specific state
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ['state', 'state-1'],
        });
      });
    });
  });
});
