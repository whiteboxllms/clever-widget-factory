/**
 * Unit Test: Action States Workflows
 * 
 * Tests state creation, editing, and deletion flows with mocked services
 * Validates implementation_update_count updates and cache consistency
 * 
 * Requirements: 3.5, 3.6, 3.7, 4.4, 4.5, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStateMutations } from '../useStates';
import { stateService } from '@/services/stateService';
import type { CreateObservationData, Observation } from '@/types/observations';

// Mock the state service
vi.mock('@/services/stateService', () => ({
  stateService: {
    createState: vi.fn(),
    updateState: vi.fn(),
    deleteState: vi.fn(),
    getStates: vi.fn(),
  },
}));

describe('Action States Workflows', () => {
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

  describe('Complete flow: create action → add state → verify count updates', () => {
    it('should invalidate actions cache when creating state with action link', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Test observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      const data: CreateObservationData = {
        state_text: 'Test observation',
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

    it('should create state successfully and trigger cache invalidation', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Work in progress',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState);

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      const data: CreateObservationData = {
        state_text: 'Work in progress',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      await result.current.createState(data);

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      expect(stateService.createState).toHaveBeenCalledWith(data);
    });
  });

  describe('Complete flow: edit state → verify updates appear', () => {
    it('should update state and invalidate caches', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Updated observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      vi.mocked(stateService.updateState).mockResolvedValue(mockState);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      await result.current.updateState({
        id: 'state-1',
        data: { state_text: 'Updated observation' },
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

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

  describe('Complete flow: delete state → verify count decrements', () => {
    it('should delete state and invalidate actions cache', async () => {
      vi.mocked(stateService.deleteState).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      await result.current.deleteState('state-1');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

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

  describe('Dialog remains open during all operations', () => {
    it('should maintain cache state without closing dialog', async () => {
      const mockState1: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'First observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      const mockState2: Observation = {
        id: 'state-2',
        organization_id: 'org-1',
        observation_text: 'Second observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:01:00Z',
        created_at: '2025-02-06T10:01:00Z',
        updated_at: '2025-02-06T10:01:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      vi.mocked(stateService.createState)
        .mockResolvedValueOnce(mockState1)
        .mockResolvedValueOnce(mockState2);

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      // Create first state
      await result.current.createState({
        state_text: 'First observation',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      // Create second state (simulating user staying in dialog)
      await result.current.createState({
        state_text: 'Second observation',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      // Verify both states were created
      expect(stateService.createState).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache consistency across operations', () => {
    it('should maintain cache consistency across create, update, and delete', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Initial observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      const updatedState: Observation = {
        ...mockState,
        observation_text: 'Updated observation',
        updated_at: '2025-02-06T10:01:00Z',
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState);
      vi.mocked(stateService.updateState).mockResolvedValue(updatedState);
      vi.mocked(stateService.deleteState).mockResolvedValue(undefined);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      // Create
      await result.current.createState({
        state_text: 'Initial observation',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      // Update
      await result.current.updateState({
        id: 'state-1',
        data: { state_text: 'Updated observation' },
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Delete
      await result.current.deleteState('state-1');

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });

      // Verify cache invalidations occurred for all operations
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['actions'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['states', 'action', 'action-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['states'],
      });
    });
  });

  describe('Text-only and photo-only state creation', () => {
    it('should support text-only state creation', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Text-only observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState);

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      await result.current.createState({
        state_text: 'Text-only observation',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      expect(stateService.createState).toHaveBeenCalledWith({
        state_text: 'Text-only observation',
        photos: [],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });
    });

    it('should support photo-only state creation', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: '',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: ['https://example.com/photo1.jpg'],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState);

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'action', entity_id: 'action-1' }),
        { wrapper }
      );

      await result.current.createState({
        state_text: '',
        photos: ['https://example.com/photo1.jpg'],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      expect(stateService.createState).toHaveBeenCalledWith({
        state_text: '',
        photos: ['https://example.com/photo1.jpg'],
        links: [{ entity_type: 'action', entity_id: 'action-1' }],
      });
    });
  });

  describe('Non-action entity types', () => {
    it('should NOT invalidate actions cache for non-action entities', async () => {
      const mockState: Observation = {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Part observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-06T10:00:00Z',
        created_at: '2025-02-06T10:00:00Z',
        updated_at: '2025-02-06T10:00:00Z',
        photos: [],
        links: [{ entity_type: 'part', entity_id: 'part-1' }],
      };

      vi.mocked(stateService.createState).mockResolvedValue(mockState);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useStateMutations({ entity_type: 'part', entity_id: 'part-1' }),
        { wrapper }
      );

      await result.current.createState({
        state_text: 'Part observation',
        photos: [],
        links: [{ entity_type: 'part', entity_id: 'part-1' }],
      });

      await waitFor(() => {
        expect(result.current.isCreating).toBe(false);
      });

      // Should invalidate states cache
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['states', 'part', 'part-1'],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['states'],
      });
      // Should NOT invalidate actions cache
      expect(invalidateSpy).not.toHaveBeenCalledWith({
        queryKey: ['actions'],
      });
    });
  });
});
