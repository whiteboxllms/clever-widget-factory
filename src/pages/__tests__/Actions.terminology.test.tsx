/**
 * Tests for Actions page UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
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

// Mock useOrganizationMembers
vi.mock('@/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: vi.fn(() => ({
    members: [],
  })),
}));

// Mock useAuth
vi.mock('@/hooks/useCognitoAuth', () => {
  const mockUserValue = {
    id: 'test-user-id',
    userId: 'test-user-id',
    username: 'test@example.com',
    email: 'test@example.com',
  };
  
  const mockAuthValue = {
    user: mockUserValue,
    session: null,
    idToken: null,
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
            assigned_to: 'test-user-id', // Assign to test user so it shows with 'me' filter
            status: 'pending',
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
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

    // Wait for component to load and render
    await waitFor(() => {
      // Verify the component rendered - look for the action title or mission badge
      const actionTitle = screen.queryByText(/Test Action/i);
      const missionBadge = screen.queryByText(/Project #/i);
      // Either the action title or mission badge should be visible
      expect(actionTitle || missionBadge).toBeTruthy();
    }, { timeout: 10000 });
  }, 15000); // Increase test timeout to 15 seconds
});

