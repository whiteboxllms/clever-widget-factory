/**
 * Test utilities for mocking AWS services
 */

import { vi } from 'vitest';

/**
 * Mock fetch for API Gateway calls
 */
export function mockApiResponse(data: any, status: number = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => ({ data }),
    text: async () => JSON.stringify({ data }),
    headers: new Headers(),
  } as Response;
}

/**
 * Setup global fetch mock
 */
export function setupFetchMock(responses: Map<string, Response> | ((url: string) => Response)) {
  global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url.toString();
    
    if (responses instanceof Map) {
      const response = responses.get(urlString);
      if (response) {
        return Promise.resolve(response);
      }
    } else if (typeof responses === 'function') {
      return Promise.resolve(responses(urlString));
    }
    
    // Default: return empty response
    return Promise.resolve(mockApiResponse([]));
  }) as typeof fetch;
}

/**
 * Mock Cognito Auth User
 */
export const mockCognitoUser = {
  userId: 'test-user-id',
  username: 'test@example.com',
  signInDetails: {
    loginId: 'test@example.com',
  },
};

/**
 * Mock Auth Session
 */
export const mockAuthSession = {
  tokens: {
    accessToken: {
      payload: {
        sub: 'test-user-id',
        email: 'test@example.com',
      },
    },
    idToken: {
      payload: {
        sub: 'test-user-id',
        email: 'test@example.com',
        'cognito:username': 'test@example.com',
      },
    },
  },
};

/**
 * Mock Auth Context Value
 */
export const mockAuthContextValue = {
  user: {
    id: 'test-user-id',
    userId: 'test-user-id',
    username: 'test@example.com',
    email: 'test@example.com',
    name: 'Test User',
  },
  session: mockAuthSession,
  loading: false,
  isAdmin: true,
  isContributor: true,
  isLeadership: true,
  canEditTools: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  confirmSignIn: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  confirmResetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
};

