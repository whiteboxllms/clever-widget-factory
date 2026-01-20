import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useNonIntegratedExplorations,
  useCreateExploration,
  useLinkExploration,
  useLinkExplorations,
  useUnlinkExploration,
  explorationKeys,
} from '../../hooks/useExplorations';
import * as explorationService from '../../services/explorationService';

// Mock the exploration service
vi.mock('../../services/explorationService', () => ({
  explorationService: {
    getNonIntegratedExplorations: vi.fn(),
    createNewExploration: vi.fn(),
    linkExploration: vi.fn(),
    linkExplorations: vi.fn(),
    unlinkExploration: vi.fn(),
  },
}));

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useExplorations Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('explorationKeys', () => {
    it('should generate correct cache keys', () => {
      expect(explorationKeys.all).toEqual(['explorations']);
      expect(explorationKeys.lists()).toEqual(['explorations', 'list']);
      expect(explorationKeys.list('in_progress')).toEqual([
        'explorations',
        'list',
        { status: 'in_progress' },
      ]);
      expect(explorationKeys.detail('exp-1')).toEqual([
        'explorations',
        'detail',
        'exp-1',
      ]);
    });
  });

  describe('useNonIntegratedExplorations', () => {
    it('should fetch non-integrated explorations', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          status: 'in_progress',
          action_count: 1,
        },
      ];

      vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
        mockExplorations
      );

      const { result } = renderHook(() => useNonIntegratedExplorations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockExplorations);
    });

    it('should handle errors', async () => {
      const error = new Error('Network error');
      vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockRejectedValue(
        error
      );

      const { result } = renderHook(() => useNonIntegratedExplorations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should return empty array by default', async () => {
      vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
        []
      );

      const { result } = renderHook(() => useNonIntegratedExplorations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useCreateExploration', () => {
    it('should create new exploration', async () => {
      const newExploration = {
        id: 'exp-new',
        exploration_code: 'SF010326EX99',
        status: 'in_progress',
        action_count: 0,
      };

      vi.mocked(explorationService.explorationService.createNewExploration).mockResolvedValue(
        newExploration
      );

      const { result } = renderHook(() => useCreateExploration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.data).toEqual(newExploration);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Creation failed');
      vi.mocked(explorationService.explorationService.createNewExploration).mockRejectedValue(
        error
      );

      const { result } = renderHook(() => useCreateExploration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe('useLinkExploration', () => {
    it('should link action to exploration', async () => {
      const linkResponse = {
        action: { id: 'action-1', exploration_ids: ['exp-1'] },
        explorations: [{ id: 'exp-1', action_count: 1 }],
      };

      vi.mocked(explorationService.explorationService.linkExploration).mockResolvedValue(
        linkResponse
      );

      const { result } = renderHook(() => useLinkExploration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        actionId: 'action-1',
        explorationId: 'exp-1',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.data).toEqual(linkResponse);
    });

    it('should handle linking errors', async () => {
      const error = new Error('Link failed');
      vi.mocked(explorationService.explorationService.linkExploration).mockRejectedValue(
        error
      );

      const { result } = renderHook(() => useLinkExploration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        actionId: 'action-1',
        explorationId: 'exp-1',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });

  describe('useLinkExplorations', () => {
    it('should link action to multiple explorations', async () => {
      const linkResponse = {
        action: { id: 'action-1', exploration_ids: ['exp-1', 'exp-2'] },
        explorations: [
          { id: 'exp-1', action_count: 1 },
          { id: 'exp-2', action_count: 1 },
        ],
      };

      vi.mocked(explorationService.explorationService.linkExplorations).mockResolvedValue(
        linkResponse
      );

      const { result } = renderHook(() => useLinkExplorations(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        actionId: 'action-1',
        explorationIds: ['exp-1', 'exp-2'],
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.data).toEqual(linkResponse);
    });
  });

  describe('useUnlinkExploration', () => {
    it('should unlink action from exploration', async () => {
      const unlinkResponse = {
        action: { id: 'action-1', exploration_ids: [] },
        message: 'Exploration unlinked successfully',
      };

      vi.mocked(explorationService.explorationService.unlinkExploration).mockResolvedValue(
        unlinkResponse
      );

      const { result } = renderHook(() => useUnlinkExploration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        actionId: 'action-1',
        explorationId: 'exp-1',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.data).toEqual(unlinkResponse);
    });

    it('should handle unlinking errors', async () => {
      const error = new Error('Unlink failed');
      vi.mocked(explorationService.explorationService.unlinkExploration).mockRejectedValue(
        error
      );

      const { result } = renderHook(() => useUnlinkExploration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        actionId: 'action-1',
        explorationId: 'exp-1',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });
});
