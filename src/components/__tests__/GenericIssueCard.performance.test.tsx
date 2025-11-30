/**
 * Performance tests for GenericIssueCard component
 * 
 * Verifies:
 * - Only fetches score when enableScorecard={true}
 * - Only fetches actions when enableActions={true}
 * - Uses cached data when available
 * - Deduplicates requests when multiple cards need same data
 * - Doesn't refetch on every render
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GenericIssueCard } from '../GenericIssueCard';
import { BaseIssue } from '@/types/issues';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';
import { AuthWrapper } from '@/test-utils/testWrappers';

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

vi.mock('@/hooks/useAssetScores', () => ({
  useAssetScores: () => ({
    getScoreForIssue: vi.fn(async (issueId: string) => {
      if (issueId === 'issue-1') {
        return {
          id: 'score-1',
          asset_id: 'tool-1',
          source_id: issueId,
          scores: { quality: { score: 5, reason: 'Test' } },
        };
      }
      return null;
    }),
  }),
}));

vi.mock('@/hooks/useIssueActions', () => ({
  useIssueActions: () => ({
    getActionsForIssue: vi.fn(async (issueId: string) => {
      if (issueId === 'issue-1') {
        return [
          {
            id: 'action-1',
            title: 'Test Action',
            status: 'not_started',
          },
        ];
      }
      return [];
    }),
  }),
}));

vi.mock('@/services/fiveWhysService', () => ({
  listSessions: vi.fn(() => Promise.resolve([])),
}));

describe('GenericIssueCard Performance', () => {
  let queryClient: QueryClient;
  let getScoreForIssueSpy: ReturnType<typeof vi.fn>;
  let getActionsForIssueSpy: ReturnType<typeof vi.fn>;

  const mockIssue: BaseIssue = {
    id: 'issue-1',
    context_type: 'tool',
    context_id: 'tool-1',
    description: 'Test issue',
    status: 'active',
    issue_type: 'efficiency',
    workflow_status: 'reported',
    issue_metadata: {},
    report_photo_urls: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const { useAssetScores } = require('@/hooks/useAssetScores');
    const { useIssueActions } = require('@/hooks/useIssueActions');

    getScoreForIssueSpy = vi.fn(useAssetScores().getScoreForIssue);
    getActionsForIssueSpy = vi.fn(useIssueActions().getActionsForIssue);

    vi.clearAllMocks();
    setupFetchMock(() => mockApiResponse([]));
  });

  describe('Conditional Fetching', () => {
    it('should not fetch score when enableScorecard is false', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <GenericIssueCard
              issue={mockIssue}
              onRefresh={vi.fn()}
              enableScorecard={false}
              enableActions={false}
            />
          </AuthWrapper>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(getScoreForIssueSpy).not.toHaveBeenCalled();
      });
    });

    it('should fetch score when enableScorecard is true', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <GenericIssueCard
              issue={mockIssue}
              onRefresh={vi.fn()}
              enableScorecard={true}
              enableActions={false}
            />
          </AuthWrapper>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(getScoreForIssueSpy).toHaveBeenCalledWith('issue-1');
      });
    });

    it('should not fetch actions when enableActions is false', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <GenericIssueCard
              issue={mockIssue}
              onRefresh={vi.fn()}
              enableScorecard={false}
              enableActions={false}
            />
          </AuthWrapper>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(getActionsForIssueSpy).not.toHaveBeenCalled();
      });
    });

    it('should fetch actions when enableActions is true', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <GenericIssueCard
              issue={mockIssue}
              onRefresh={vi.fn()}
              enableScorecard={false}
              enableActions={true}
            />
          </AuthWrapper>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(getActionsForIssueSpy).toHaveBeenCalledWith('issue-1');
      });
    });
  });

  describe('Query Deduplication', () => {
    it('should deduplicate requests when multiple cards need same data', async () => {
      const { useAssetScores } = require('@/hooks/useAssetScores');
      const getScoreForIssue = vi.fn(useAssetScores().getScoreForIssue);

      render(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <>
              <GenericIssueCard
                issue={mockIssue}
                onRefresh={vi.fn()}
                enableScorecard={true}
                enableActions={false}
              />
              <GenericIssueCard
                issue={mockIssue}
                onRefresh={vi.fn()}
                enableScorecard={true}
                enableActions={false}
              />
            </>
          </AuthWrapper>
        </QueryClientProvider>
      );

      await waitFor(() => {
        // Should only be called once due to query deduplication
        expect(getScoreForIssue).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Cache Usage', () => {
    it('should use cached data on re-render', async () => {
      const { result, rerender } = render(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <GenericIssueCard
              issue={mockIssue}
              onRefresh={vi.fn()}
              enableScorecard={true}
              enableActions={false}
            />
          </AuthWrapper>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(getScoreForIssueSpy).toHaveBeenCalledTimes(1);
      });

      // Re-render with same props
      rerender(
        <QueryClientProvider client={queryClient}>
          <AuthWrapper>
            <GenericIssueCard
              issue={mockIssue}
              onRefresh={vi.fn()}
              enableScorecard={true}
              enableActions={false}
            />
          </AuthWrapper>
        </QueryClientProvider>
      );

      // Should not refetch - use cached data
      await waitFor(() => {
        expect(getScoreForIssueSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});

