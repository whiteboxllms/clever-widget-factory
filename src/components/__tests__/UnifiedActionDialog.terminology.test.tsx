/**
 * Tests for UnifiedActionDialog UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnifiedActionDialog } from '../UnifiedActionDialog';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';
import { AuthWrapper } from '@/test-utils/testWrappers';

// Mock dependencies
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: vi.fn(() => 'org-1'),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      getQueryData: (key: any) => {
        if (key[0] === 'actions') {
          return [{
            id: 'action-1',
            mission_id: 'mission-1',
            attachments: [],
          }];
        }
        return [];
      },
      invalidateQueries: vi.fn(),
      refetchQueries: vi.fn(),
    }),
  };
});

describe('UnifiedActionDialog - UI Terminology', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onActionSaved: vi.fn(),
    profiles: [] as any[],
  };

  beforeEach(() => {
    setupFetchMock((url: string) => {
      if (url.includes('/missions')) {
        return mockApiResponse([
          {
            id: 'mission-1',
            mission_number: 1,
            title: 'Test Mission',
            problem_statement: 'Test problem',
            status: 'planning',
          },
        ]);
      }
      return mockApiResponse([]);
    });
  });

  it('should display "Create Mission Action" when context type is mission', async () => {
    const context = {
      type: 'mission' as const,
      parentId: 'mission-1',
    };

    render(
      <AuthWrapper>
        <UnifiedActionDialog
          {...defaultProps}
          context={context}
        />
      </AuthWrapper>
    );

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Create Mission Action"
      // AFTER MIGRATION: Update to expect "Create Project Action"
      const dialogTitle = screen.getByText(/Create Project Action/i);
      expect(dialogTitle).toBeInTheDocument();
    });
  });

  it('should display "Mission Context" when mission data is present', async () => {
    const context = {
      type: 'mission' as const,
      parentId: 'mission-1',
    };

    render(
      <AuthWrapper>
        <UnifiedActionDialog
          {...defaultProps}
          context={context}
          actionId="action-1"
        />
      </AuthWrapper>
    );

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Mission Context"
      // AFTER MIGRATION: Update to expect "Project Context"
      const contextLabel = screen.getByText(/Project Context/i);
      expect(contextLabel).toBeInTheDocument();
    });
  });

  it('should display "Mission #" prefix for mission numbers', async () => {
    const context = {
      type: 'mission' as const,
      parentId: 'mission-1',
    };

    render(
      <AuthWrapper>
        <UnifiedActionDialog
          {...defaultProps}
          context={context}
          actionId="action-1"
        />
      </AuthWrapper>
    );

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Mission #"
      // AFTER MIGRATION: Update to expect "Project #"
      const missionNumber = screen.getByText(/Project #/i);
      expect(missionNumber).toBeInTheDocument();
    });
  });
});

