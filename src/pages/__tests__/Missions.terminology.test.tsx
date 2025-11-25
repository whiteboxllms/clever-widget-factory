/**
 * Tests for Missions page UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import Missions from '../Missions';
import { AuthWrapper } from '@/test-utils/testWrappers';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';

// Mock aws-amplify/auth - ensure these resolve immediately
vi.mock('aws-amplify/auth', () => {
  const mockUser = {
    userId: 'test-user-id',
    username: 'test@example.com',
    signInDetails: { loginId: 'test@example.com' },
  };

  const mockSession = {
    tokens: {
      accessToken: { 
        payload: { sub: 'test-user-id' },
        toString: () => 'mock-access-token',
      },
      idToken: { 
        payload: { sub: 'test-user-id', email: 'test@example.com' },
        toString: () => 'mock-id-token',
      },
    },
  };

  return {
    getCurrentUser: vi.fn().mockResolvedValue(mockUser),
    fetchAuthSession: vi.fn().mockResolvedValue(mockSession),
    signOut: vi.fn().mockResolvedValue({}),
  };
});

// Mock useOrganizationId
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: vi.fn(() => 'org-1'),
}));

// Mock useCognitoAuth to provide user immediately
// The component throws if user is null during initialization, so we need user available immediately
vi.mock('@/hooks/useCognitoAuth', () => {
  const mockUserValue = {
    id: 'test-user-id',
    userId: 'test-user-id',
    username: 'test@example.com',
    email: 'test@example.com',
  };
  
  const mockSession = {
    tokens: {
      accessToken: { 
        payload: { sub: 'test-user-id' },
        toString: () => 'mock-access-token',
      },
      idToken: { 
        payload: { sub: 'test-user-id', email: 'test@example.com' },
        toString: () => 'mock-id-token',
      },
    },
  };
  
  const mockAuthValue = {
    user: mockUserValue,
    session: mockSession,
    idToken: 'mock-id-token',
    loading: false,
    isAdmin: true,
    isContributor: true,
    isLeadership: true,
    canEditTools: true,
    signUp: vi.fn(),
    signIn: vi.fn(),
    confirmSignIn: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    confirmResetPassword: vi.fn(),
    updatePassword: vi.fn(),
  };
  
  const AuthContext = React.createContext(mockAuthValue);
  
  return {
    useAuth: () => mockAuthValue,
    AuthProvider: ({ children }: { children: React.ReactNode }) => {
      return React.createElement(AuthContext.Provider, { value: mockAuthValue }, children);
    },
  };
});

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
      const title = screen.getByText('Stargazer Projects');
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
      const createButton = screen.getByText(/Create Project/i);
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
      const filterLabel = screen.getByText(/Project Filters/i);
      expect(filterLabel).toBeInTheDocument();
    });
  });
});

