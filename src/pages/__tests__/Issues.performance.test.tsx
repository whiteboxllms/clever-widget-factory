/**
 * Performance tests for Issues page
 * 
 * Verifies:
 * - Prefetches data in background
 * - Uses cached data for instant filtering
 * - Only fetches asset-specific issues when contextId provided
 * - Doesn't refetch organization members unnecessarily
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Issues from '../Issues';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';
import { AuthWrapper } from '@/test-utils/testWrappers';
import { BaseIssue } from '@/types/issues';

// Mock dependencies
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: () => 'test-org-id',
}));

vi.mock('@/hooks/useCognitoAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test-user-id' },
  }),
}));

vi.mock('@/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    members: [
      {
        id: 'user-1',
        user_id: 'user-1',
        full_name: 'Test User',
        role: 'admin',
      },
    ],
    loading: false,
  }),
}));

vi.mock('@/lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/lib/queryFetchers', () => ({
  fetchOrganizationMembers: vi.fn(() => Promise.resolve([])),
}));

describe('Issues Page Performance', () => {
  let queryClient: QueryClient;

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
      context_type: 'order',
      context_id: 'order-1',
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
      },
    });

    vi.clearAllMocks();
    setupFetchMock(() => mockApiResponse(mockIssues));

    const { apiService } = require('@/lib/apiService');
    vi.mocked(apiService.get).mockResolvedValue({
      data: mockIssues,
    });
  });

  describe('Background Prefetching', () => {
    it('should prefetch all issues in background', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthWrapper>
              <Issues />
            </AuthWrapper>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const { apiService } = require('@/lib/apiService');
        // Should have called API to fetch issues
        expect(apiService.get).toHaveBeenCalled();
      });
    });

    it('should prefetch organization members if not cached', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthWrapper>
              <Issues />
            </AuthWrapper>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const { fetchOrganizationMembers } = require('@/lib/queryFetchers');
        expect(fetchOrganizationMembers).toHaveBeenCalled();
      });
    });
  });

  describe('Asset-Specific Filtering', () => {
    it('should only fetch asset-specific issues when contextId provided', async () => {
      const assetIssues = [mockIssues[0]];

      const { apiService } = require('@/lib/apiService');
      vi.mocked(apiService.get).mockResolvedValue({
        data: assetIssues,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/issues?contextType=tool&contextId=tool-1']}>
            <AuthWrapper>
              <Issues />
            </AuthWrapper>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        // Should be called with context_id filter
        expect(apiService.get).toHaveBeenCalledWith(
          expect.stringContaining('context_id=tool-1')
        );
      });
    });
  });

  describe('Cache Usage', () => {
    it('should use cached data for instant filtering', async () => {
      // Pre-populate cache
      queryClient.setQueryData(['issues', 'all', 'all', 'all'], mockIssues);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthWrapper>
              <Issues />
            </AuthWrapper>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Should render immediately with cached data
      await waitFor(() => {
        expect(screen.getByText(/Issues/i)).toBeInTheDocument();
      });

      const { apiService } = require('@/lib/apiService');
      // Should not need to refetch if cache is fresh
      expect(apiService.get).not.toHaveBeenCalled();
    });
  });
});

