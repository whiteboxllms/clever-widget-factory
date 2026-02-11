/**
 * Centralized API Service for AWS API Gateway
 * 
 * Automatically adds Authorization header with Cognito JWT token
 * Handles token refresh and error responses
 * Automatically updates TanStack Query cache on mutations
 */

import { fetchAuthSession } from 'aws-amplify/auth';
import { QueryClient } from '@tanstack/react-query';
import { 
  toolsQueryKey, 
  actionsQueryKey, 
  issuesQueryKey,
  missionsQueryKey,
  partsOrdersQueryKey,
  explorationsQueryKey,
  observationsQueryKey
} from './queryKeys';

// Global query client instance for cache updates
let globalQueryClient: QueryClient | null = null;

export function setQueryClient(queryClient: QueryClient) {
  globalQueryClient = queryClient;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Validate API_BASE_URL configuration
if (API_BASE_URL.endsWith('/api')) {
  console.error(
    '❌ CONFIGURATION ERROR: VITE_API_BASE_URL should NOT end with "/api"\n' +
    `   Current value: ${API_BASE_URL}\n` +
    `   Should be: ${API_BASE_URL.replace(/\/api$/, '')}\n` +
    '   The apiService automatically adds /api prefix to endpoints.'
  );
}

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  error?: any;
}

/**
 * Get the current Cognito ID token with caching
 */
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let lastTokenFetchTime: number = 0;

/**
 * Clear the token cache (useful for testing)
 */
export function clearTokenCache() {
  cachedToken = null;
  tokenExpiry = 0;
  lastTokenFetchTime = 0;
}

async function getIdToken(): Promise<string | null> {
  try {
    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && Date.now() < tokenExpiry - 300000) {
      return cachedToken;
    }
    
    // Avoid hammering Cognito - if we just fetched a token and it was empty, wait a bit
    const timeSinceLastFetch = Date.now() - lastTokenFetchTime;
    if (timeSinceLastFetch < 1000 && !cachedToken) {
      console.warn('Token fetch attempted too soon after previous empty result');
      return null;
    }
    
    lastTokenFetchTime = Date.now();
    
    const session = await fetchAuthSession({ forceRefresh: false });
    
    // Handle different token formats
    let idToken: string | null = null;
    
    if (session.tokens?.idToken) {
      // idToken might be a string or an object with toString()
      if (typeof session.tokens.idToken === 'string') {
        idToken = session.tokens.idToken;
      } else if (session.tokens.idToken.toString) {
        idToken = session.tokens.idToken.toString();
      } else {
        console.warn('idToken is not a string and has no toString method:', typeof session.tokens.idToken);
      }
    }
    
    if (!idToken || !idToken.trim()) {
      console.warn('No ID token received from Cognito session', {
        hasSession: !!session,
        hasTokens: !!session.tokens,
        hasIdToken: !!session.tokens?.idToken,
        idTokenType: typeof session.tokens?.idToken,
        idTokenValue: idToken ? `${idToken.substring(0, 20)}...` : 'null'
      });
      cachedToken = null;
      tokenExpiry = 0;
      return null;
    }
    
    // Validate token format (should be JWT with 3 parts)
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('Invalid token format - expected JWT with 3 parts, got:', tokenParts.length, {
        tokenPreview: `${idToken.substring(0, 50)}...`
      });
      cachedToken = null;
      tokenExpiry = 0;
      return null;
    }
    
    cachedToken = idToken;
    // JWT exp is in seconds, convert to ms
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      tokenExpiry = payload.exp * 1000;
    } catch (decodeErr) {
      console.warn('Failed to decode JWT payload:', decodeErr);
      tokenExpiry = Date.now() + 3600000; // Assume 1 hour expiry
    }
    
    return idToken;
  } catch (error) {
    console.error('Failed to get ID token:', error);
    cachedToken = null;
    tokenExpiry = 0;
    return null;
  }
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { optimisticId?: string } = {}
): Promise<T> {
  // Handle absolute URLs
  if (endpoint.startsWith('http')) {
    // Absolute URL - use as-is
    var url = endpoint;
  } else {
    // Relative endpoint - construct full URL
    // Combine with base URL (base URL should not have trailing slash)
    const baseUrl = API_BASE_URL.endsWith('/') 
      ? API_BASE_URL.slice(0, -1) 
      : API_BASE_URL;
    
    // Check if base URL already ends with /api
    const baseUrlHasApi = baseUrl.endsWith('/api');
    
    // Normalize endpoint
    let normalizedEndpoint: string;
    if (endpoint.startsWith('/api/')) {
      // Endpoint already has /api/, use it directly
      normalizedEndpoint = endpoint;
    } else if (endpoint.startsWith('/')) {
      // Endpoint starts with /, add /api prefix only if base URL doesn't already have it
      normalizedEndpoint = baseUrlHasApi ? endpoint : `/api${endpoint}`;
    } else {
      // Endpoint has no leading slash, add /api/ prefix only if base URL doesn't already have it
      normalizedEndpoint = baseUrlHasApi ? `/${endpoint}` : `/api/${endpoint}`;
    }
    
    url = `${baseUrl}${normalizedEndpoint}`;
  }

  // Get ID token for Authorization header
  const idToken = await getIdToken();
  
  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token is available
  if (idToken && idToken.trim()) {
    headers['Authorization'] = `Bearer ${idToken}`;
  } else {
    console.error('❌ CRITICAL: No valid ID token available for request', {
      url,
      method: options.method,
      hasToken: !!idToken,
      tokenLength: idToken?.length || 0,
      tokenTrimmed: idToken?.trim() || 'N/A'
    });
    // Don't set Authorization header if token is empty - let it fail with proper error
  }

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle errors
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.statusText}`;
    let errorData: any = null;

    try {
      errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If response is not JSON, use status text
    }

    const error: ApiError = {
      message: errorMessage,
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    };

    // Handle 401 Unauthorized - token expired, try to refresh and redirect if that fails
    if (response.status === 401) {
      console.warn('Unauthorized - attempting token refresh');
      try {
        await fetchAuthSession({ forceRefresh: true });
        // If refresh succeeds, the next request will use the new token
        // Don't redirect - let the app retry the request
      } catch (refreshError) {
        console.error('Token refresh failed, redirecting to login');
        window.location.href = '/login';
      }
    }

    // Handle 403 Forbidden - user doesn't have permission
    if (response.status === 403) {
      console.warn('Forbidden - user does not have permission');
    }

    throw error;
  }

  // Parse response
  try {
    const data = await response.json();
    
    // Auto-update cache for mutations (POST, PUT, DELETE)
    if (globalQueryClient && ['POST', 'PUT', 'DELETE'].includes(options.method || '')) {
      updateCacheFromResponse(endpoint, options.method || '', data, options.optimisticId);
    }
    
    return data;
  } catch (error) {
    // If response is not JSON, return empty object
    return {} as T;
  }
}

/**
 * Automatically update TanStack Query cache based on API response
 * Supports optimistic updates by replacing temp items with real data
 */
function updateCacheFromResponse(endpoint: string, method: string, responseData: any, optimisticId?: string) {
  if (!globalQueryClient) return;
  
  // Extract the actual data (handle { data: ... } wrapper)
  const data = responseData?.data || responseData;
  if (!data) return;
  
  // Determine which cache to update based on endpoint
  if (endpoint.includes('/tools')) {
    if (method === 'POST') {
      if (optimisticId) {
        // Replace optimistic temp item with real data
        globalQueryClient.setQueryData(toolsQueryKey(), (old: any[] = []) => 
          old.map(item => item.id === optimisticId ? data : item)
        );
      } else {
        // Add new tool to cache (non-optimistic)
        globalQueryClient.setQueryData(toolsQueryKey(), (old: any[] = []) => [...old, data]);
      }
    } else if (method === 'PUT') {
      // Update existing tool in cache
      globalQueryClient.setQueryData(toolsQueryKey(), (old: any[] = []) => 
        old.map(item => item.id === data.id ? data : item)
      );
    } else if (method === 'DELETE') {
      // Remove tool from cache
      const toolId = endpoint.split('/').pop();
      globalQueryClient.setQueryData(toolsQueryKey(), (old: any[] = []) => 
        old.filter(item => item.id !== toolId)
      );
    }
  } else if (endpoint.includes('/actions')) {
    if (method === 'POST') {
      if (optimisticId) {
        globalQueryClient.setQueryData(actionsQueryKey(), (old: any[] = []) => 
          old.map(item => item.id === optimisticId ? data : item)
        );
      } else {
        globalQueryClient.setQueryData(actionsQueryKey(), (old: any[] = []) => [...old, data]);
      }
    } else if (method === 'PUT') {
      globalQueryClient.setQueryData(actionsQueryKey(), (old: any[] = []) => 
        old.map(item => item.id === data.id ? data : item)
      );
    } else if (method === 'DELETE') {
      const actionId = endpoint.split('/').pop();
      globalQueryClient.setQueryData(actionsQueryKey(), (old: any[] = []) => 
        old.filter(item => item.id !== actionId)
      );
    }
  } else if (endpoint.includes('/issues')) {
    if (method === 'POST') {
      if (optimisticId) {
        globalQueryClient.setQueryData(issuesQueryKey(), (old: any[] = []) => 
          old.map(item => item.id === optimisticId ? data : item)
        );
      } else {
        globalQueryClient.setQueryData(issuesQueryKey(), (old: any[] = []) => [...old, data]);
      }
    } else if (method === 'PUT') {
      globalQueryClient.setQueryData(issuesQueryKey(), (old: any[] = []) => 
        old.map(item => item.id === data.id ? data : item)
      );
    }
  } else if (endpoint.includes('/missions')) {
    if (method === 'POST') {
      if (optimisticId) {
        globalQueryClient.setQueryData(missionsQueryKey(), (old: any[] = []) => 
          old.map(item => item.id === optimisticId ? data : item)
        );
      } else {
        globalQueryClient.setQueryData(missionsQueryKey(), (old: any[] = []) => [...old, data]);
      }
    } else if (method === 'PUT') {
      globalQueryClient.setQueryData(missionsQueryKey(), (old: any[] = []) => 
        old.map(item => item.id === data.id ? data : item)
      );
    }
  } else if (endpoint.includes('/explorations') || endpoint.includes('/exploration')) {
    if (method === 'POST') {
      if (optimisticId) {
        globalQueryClient.setQueryData(explorationsQueryKey(), (old: any[] = []) => 
          old.map(item => item.id === optimisticId ? data : item)
        );
      } else {
        globalQueryClient.setQueryData(explorationsQueryKey(), (old: any[] = []) => [...old, data]);
      }
    } else if (method === 'PUT') {
      globalQueryClient.setQueryData(explorationsQueryKey(), (old: any[] = []) => 
        old.map(item => item.id === data.id ? data : item)
      );
    }
  } else if (endpoint.includes('/observations')) {
    if (method === 'POST') {
      if (optimisticId) {
        globalQueryClient.setQueryData(observationsQueryKey(), (old: any[] = []) => 
          old.map(item => item.id === optimisticId ? data : item)
        );
      } else {
        globalQueryClient.setQueryData(observationsQueryKey(), (old: any[] = []) => [...old, data]);
      }
    } else if (method === 'PUT') {
      globalQueryClient.setQueryData(observationsQueryKey(), (old: any[] = []) => 
        old.map(item => item.id === data.id ? data : item)
      );
    } else if (method === 'DELETE') {
      const observationId = endpoint.split('/').pop();
      globalQueryClient.setQueryData(observationsQueryKey(), (old: any[] = []) => 
        old.filter(item => item.id !== observationId)
      );
    }
  }
}

/**
 * API Service with common HTTP methods
 */
export const apiService = {
  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * POST request
   * @param optimisticId - Optional temp ID for optimistic updates (will replace temp item with real data)
   */
  async post<T = any>(endpoint: string, body?: any, options?: RequestInit & { optimisticId?: string }): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  },

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
};

/**
 * Helper to get data from API response
 * Most API responses follow the pattern: { data: ... }
 */
export function getApiData<T>(response: { data?: T }): T {
  return response.data as T;
}

/**
 * Helper to check if API response has data
 */
export function hasApiData(response: any): boolean {
  return response !== null && response !== undefined && response.data !== undefined;
}

