/**
 * Tests for Actions page UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Actions from '../Actions';
import { AuthWrapper } from '@/test-utils/testWrappers';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';

// Mock aws-amplify/auth
vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    userId: 'test-user-id',
    username: 'test@example.com',
    signInDetails: { loginId: 'test@example.com' },
  }),
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      accessToken: { payload: { sub: 'test-user-id' } },
      idToken: { payload: { sub: 'test-user-id', email: 'test@example.com' } },
    },
  }),
  signOut: vi.fn().mockResolvedValue({}),
}));

// Mock useOrganizationId
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: vi.fn(() => 'org-1'),
}));

describe('Actions Page - UI Terminology', () => {
  beforeEach(() => {
    setupFetchMock((url: string) => {
      if (url.includes('/actions')) {
        return mockApiResponse([
          {
            id: 'action-1',
            title: 'Test Action',
            mission: {
              id: 'mission-1',
              mission_number: 1,
              title: 'Test Mission',
            },
            assigned_to: null,
            status: 'pending',
          },
        ]);
      }
      if (url.includes('/profiles')) {
        return mockApiResponse([
          {
            user_id: 'test-user-id',
            full_name: 'Test User',
            role: 'admin',
          },
        ]);
      }
      if (url.includes('/organization_members')) {
        return mockApiResponse([]);
      }
      return mockApiResponse([]);
    });
  });

  it('should display "Mission #" prefix in action cards', async () => {
    render(
      <BrowserRouter>
        <AuthWrapper>
          <Actions />
        </AuthWrapper>
      </BrowserRouter>
    );

    // Wait for user to be loaded first
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Mission #"
      // AFTER MIGRATION: Update to expect "Project #"
      const missionBadge = screen.getByText(/Project #/i);
      expect(missionBadge).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});

