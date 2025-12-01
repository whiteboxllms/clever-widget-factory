/**
 * Tests for Create Project flow - verifying template selection is removed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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
    profiles: [
      {
        id: 'profile-1',
        user_id: 'test-user-id',
        full_name: 'Test User',
        role: 'admin',
      },
    ],
  })),
}));

describe('Missions Page - Create Project Flow', () => {
  let fetchCallHistory: Array<{ url: string; options?: RequestInit }> = [];

  beforeEach(() => {
    fetchCallHistory = [];
    // Mock API responses
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      fetchCallHistory.push({ url: urlString, options: init });

      if (urlString.includes('/missions') && init?.method === 'GET') {
        return Promise.resolve(mockApiResponse([
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
        ]));
      }
      if (urlString.includes('/missions') && init?.method === 'POST') {
        return Promise.resolve(mockApiResponse({
          data: {
            id: 'mission-new',
            mission_number: 2,
            title: 'New Project',
            problem_statement: 'New problem',
            status: 'planning',
            created_by: 'test-user-id',
            qa_assigned_to: 'test-user-id',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }));
      }
      if (urlString.includes('/profiles')) {
        return Promise.resolve(mockApiResponse([
          {
            user_id: 'test-user-id',
            full_name: 'Test User',
            role: 'admin',
          },
        ]));
      }
      if (urlString.includes('/organization_members')) {
        return Promise.resolve(mockApiResponse([
          {
            user_id: 'test-user-id',
            role: 'admin',
            full_name: 'Test User',
          },
        ]));
      }
      if (urlString.includes('/actions') && init?.method === 'POST') {
        return Promise.resolve(mockApiResponse([]));
      }
      return Promise.resolve(mockApiResponse([]));
    }) as typeof fetch;
  });

  it('should open form directly when Create Project is clicked', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthWrapper>
            <Missions />
          </AuthWrapper>
        </BrowserRouter>
      );
      // Give AuthProvider time to load user
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/Create Project/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const createButton = screen.getByText(/Create Project/i);
    fireEvent.click(createButton);

    // Should show form directly, not template selection
    await waitFor(() => {
      expect(screen.getByText(/Create New Project/i)).toBeInTheDocument();
      expect(screen.getByText(/Define your project details/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Project Title/i)).toBeInTheDocument();
    });
  });

  it('should NOT show template selection screen', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthWrapper>
            <Missions />
          </AuthWrapper>
        </BrowserRouter>
      );
      // Give AuthProvider time to load user
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/Create Project/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const createButton = screen.getByText(/Create Project/i);
    fireEvent.click(createButton);

    await waitFor(() => {
      // Should NOT show template selection text
      expect(screen.queryByText(/Choose a template/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Choose a Project Template/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Equipment Repair/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Custom Project/i)).not.toBeInTheDocument();
    });
  });

  it('should show form fields directly', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthWrapper>
            <Missions />
          </AuthWrapper>
        </BrowserRouter>
      );
      // Give AuthProvider time to load user
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/Create Project/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const createButton = screen.getByText(/Create Project/i);
    fireEvent.click(createButton);

    await waitFor(() => {
      // Should show form fields
      expect(screen.getByLabelText(/Project Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Background/i)).toBeInTheDocument();
    });
  });

  it('should allow creating project without template data', async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthWrapper>
            <Missions />
          </AuthWrapper>
        </BrowserRouter>
      );
      // Give AuthProvider time to load user
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/Create Project/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const createButton = screen.getByText(/Create Project/i);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Project Title/i)).toBeInTheDocument();
    });

    // Fill out form
    const titleInput = screen.getByLabelText(/Project Title/i);
    const backgroundInput = screen.getByLabelText(/Background/i);

    fireEvent.change(titleInput, { target: { value: 'Test Project' } });
    fireEvent.change(backgroundInput, { target: { value: 'Test background statement' } });

    // Submit form - find the submit button in the form (not the trigger button)
    await waitFor(() => {
      const submitButtons = screen.getAllByText(/Create Project/i);
      // The submit button should be in the dialog, not the trigger
      const submitButton = submitButtons.find(btn => 
        btn.closest('[role="dialog"]') !== null
      ) || submitButtons[submitButtons.length - 1];
      if (submitButton) {
        fireEvent.click(submitButton);
      }
    });

    // Wait for API call
    await waitFor(() => {
      const missionCalls = fetchCallHistory.filter(
        (call) => call.url.includes('/missions') && call.options?.method === 'POST'
      );
      expect(missionCalls.length).toBeGreaterThan(0);

      // Verify the request body does not include template fields
      const lastCall = missionCalls[missionCalls.length - 1];
      if (lastCall && lastCall.options?.body) {
        const body = JSON.parse(lastCall.options.body as string);
        expect(body).not.toHaveProperty('template_id');
        expect(body).not.toHaveProperty('template_name');
        expect(body).not.toHaveProperty('template_color');
        expect(body).not.toHaveProperty('template_icon');
        expect(body.title).toBe('Test Project');
        expect(body.problem_statement).toBe('Test background statement');
      }
    });
  });
});

