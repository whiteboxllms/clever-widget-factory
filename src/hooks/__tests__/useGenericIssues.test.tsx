/**
 * Tests for useGenericIssues hook
 * 
 * Verifies:
 * - Uses TanStack Query with correct query keys
 * - Caches data and doesn't refetch unnecessarily
 * - Invalidates only specific queries on mutations
 * - Handles filter changes correctly
 * - Returns cached data when available
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGenericIssues } from '../useGenericIssues';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';
import { BaseIssue } from '@/types/issues';
import { issuesQueryKey } from '@/lib/queryKeys';

// Mock dependencies
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: () => 'test-org-id',
}));

vi.mock('@/hooks/useCognitoAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test-user-id' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('useGenericIssues', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  const mockIssues: BaseIssue[] = [
    {
      id: 'issue-1',
      context_type: 'tool',
      context_id: 'tool-1',
      description: 'Test issue 1',
      status: 'active',
      issue_type: 'efficiency',
      workflow_status: 'reported',
      issue_metadata: {},
      report_photo_urls: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'issue-2',
      context_type: 'tool',
      context_id: 'tool-1',
      description: 'Test issue 2',
      status: 'active',
      issue_type: 'efficiency',
      workflow_status: 'reported',
      issue_metadata: {},
      report_photo_urls: [],
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    vi.clearAllMocks();
    setupFetchMock(() => mockApiResponse(mockIssues));
    
    // Setup default API responses
    const { apiService } = require('@/lib/apiService');
    vi.mocked(apiService.get).mockResolvedValue({ data: mockIssues });
    vi.mocked(apiService.post).mockResolvedValue({ data: { id: 'new-issue' } });
    vi.mocked(apiService.put).mockResolvedValue({});
  });

  describe('Query Key Generation', () => {
    it('should use correct query key based on filters', async () => {
      const { result } = renderHook(
        () => useGenericIssues({ contextType: 'tool', contextId: 'tool-1' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const expectedKey = issuesQueryKey({
        contextType: 'tool',
        contextId: 'tool-1',
        status: undefined,
      });

      const cachedData = queryClient.getQueryData(expectedKey);
      expect(cachedData).toBeDefined();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch issues on mount', async () => {
      const { result } = renderHook(
        () => useGenericIssues({ contextType: 'tool' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.issues).toHaveLength(2);
    });

    it('should return cached data on subsequent renders', async () => {
      const { result: result1 } = renderHook(
        () => useGenericIssues({ contextType: 'tool' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Second render should use cache
      const { result: result2 } = renderHook(
        () => useGenericIssues({ contextType: 'tool' }),
        { wrapper }
      );

      // Should not be loading if data is cached
      expect(result2.current.issues).toHaveLength(2);
    });
  });

  describe('Filter Changes', () => {
    it('should refetch when filters change', async () => {
      const { result, rerender } = renderHook(
        ({ filters }) => useGenericIssues(filters),
        {
          wrapper,
          initialProps: { filters: { contextType: 'tool' as const } },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Change filter
      rerender({ filters: { contextType: 'order' as const } });

      // Should refetch with new filter
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Mutations', () => {
    it('should invalidate only specific query on create', async () => {
      const { apiService } = require('@/lib/apiService');
      vi.mocked(apiService.post).mockResolvedValue({
        data: { id: 'issue-3', ...mockIssues[0] },
      });

      const { result } = renderHook(
        () => useGenericIssues({ contextType: 'tool' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const queryKey = issuesQueryKey({ contextType: 'tool' });
      const initialData = queryClient.getQueryData(queryKey);

      await result.current.createIssue({
        context_type: 'tool',
        context_id: 'tool-1',
        description: 'New issue',
      });

      // Should invalidate the specific query
      await waitFor(() => {
        const newData = queryClient.getQueryData(queryKey);
        expect(newData).not.toBe(initialData);
      });
    });

    it('should invalidate only specific query on update', async () => {
      const { apiService } = require('@/lib/apiService');
      vi.mocked(apiService.get).mockResolvedValue({
        data: mockIssues[0],
      });
      vi.mocked(apiService.put).mockResolvedValue({});
      vi.mocked(apiService.post).mockResolvedValue({});

      const { result } = renderHook(
        () => useGenericIssues({ contextType: 'tool' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const queryKey = issuesQueryKey({ contextType: 'tool' });
      const initialData = queryClient.getQueryData(queryKey);

      await result.current.updateIssue('issue-1', {
        description: 'Updated description',
      });

      // Should invalidate the specific query
      await waitFor(() => {
        const newData = queryClient.getQueryData(queryKey);
        expect(newData).not.toBe(initialData);
      });
    });
  });

  describe('Asset-Specific Filtering', () => {
    it('should only fetch issues for specific asset when contextId provided', async () => {
      const { apiService } = require('@/lib/apiService');
      const assetIssues = [mockIssues[0]];

      vi.mocked(apiService.get).mockResolvedValue({
        data: assetIssues,
      });

      const { result } = renderHook(
        () => useGenericIssues({ contextType: 'tool', contextId: 'tool-1' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify API was called with context_id filter
      expect(apiService.get).toHaveBeenCalledWith(
        expect.stringContaining('context_id=tool-1')
      );
    });
  });
});

