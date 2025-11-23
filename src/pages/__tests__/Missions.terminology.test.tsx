/**
 * Tests for Missions page UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Missions from '../Missions';
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

// Mock useActionProfiles
vi.mock('@/hooks/useActionProfiles', () => ({
  useActionProfiles: vi.fn(() => ({
    profiles: [],
  })),
}));

describe('Missions Page - UI Terminology', () => {
  beforeEach(() => {
    // Mock API responses
    setupFetchMock((url: string) => {
      if (url.includes('/missions')) {
        return mockApiResponse([
          {
            id: 'mission-1',
            mission_number: 1,
            title: 'Test Mission',
            problem_statement: 'Test problem',
            status: 'planning',
            created_by: 'test-user-id',
            qa_assigned_to: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
        return mockApiResponse([
          {
            user_id: 'test-user-id',
            role: 'admin',
          },
        ]);
      }
      return mockApiResponse([]);
    });
  });

  it('should display "Stargazer Missions" as page title', async () => {
    render(
      <BrowserRouter>
        <AuthWrapper>
          <Missions />
        </AuthWrapper>
      </BrowserRouter>
    );

    // Wait for user to be loaded first
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Missions"
      // AFTER MIGRATION: Update to expect "Projects"
      const title = screen.getByText('Stargazer Missions');
      expect(title).toBeInTheDocument();
    });
  });

  it('should display "Create Mission" button for admin users', async () => {
    render(
      <BrowserRouter>
        <AuthWrapper>
          <Missions />
        </AuthWrapper>
      </BrowserRouter>
    );

    // Wait for user to be loaded first
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Create Mission"
      // AFTER MIGRATION: Update to expect "Create Project"
      const createButton = screen.getByText(/Create Mission/i);
      expect(createButton).toBeInTheDocument();
    });
  });

  it('should display "Mission Filters" label', async () => {
    render(
      <BrowserRouter>
        <AuthWrapper>
          <Missions />
        </AuthWrapper>
      </BrowserRouter>
    );

    // Wait for user to be loaded first
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    await waitFor(() => {
      // BEFORE MIGRATION: Should find "Mission Filters"
      // AFTER MIGRATION: Update to expect "Project Filters"
      const filterLabel = screen.getByText(/Mission Filters/i);
      expect(filterLabel).toBeInTheDocument();
    });
  });
});

