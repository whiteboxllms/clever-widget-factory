/**
 * Centralized API Service for AWS API Gateway
 * 
 * Automatically adds Authorization header with Cognito JWT token
 * Handles token refresh and error responses
 */

import { fetchAuthSession } from 'aws-amplify/auth';

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
 * Get the current Cognito ID token with automatic refresh
 */
async function getIdToken(): Promise<string | null> {
  try {
    // Force refresh to get a fresh token if current one is expired
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString();
    return idToken || null;
  } catch (error) {
    console.error('Failed to get ID token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
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
    console.log('🔗 API Request:', { baseUrl, endpoint, normalizedEndpoint, url });
  }

  // Get ID token for Authorization header
  const idToken = await getIdToken();
  
  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add Authorization header if token is available
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
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
    return data;
  } catch (error) {
    // If response is not JSON, return empty object
    return {} as T;
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
   */
  async post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
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

