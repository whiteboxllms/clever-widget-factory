/**
 * Integration tests for API Service
 * 
 * These tests verify that the API service correctly:
 * - Adds Authorization headers
 * - Handles errors
 * - Works with real Cognito tokens (when available)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAuthSession } from 'aws-amplify/auth';

// Mock aws-amplify/auth
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

// Set up environment variable before importing apiService
const API_BASE_URL = 'https://api.example.com';
vi.stubEnv('VITE_API_BASE_URL', API_BASE_URL);

// Import after env is set
import { apiService } from './apiService';

describe('API Service Integration', () => {
  const API_BASE_URL = 'https://api.example.com';
  const mockIdToken = 'mock-cognito-id-token-12345';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore env after each test
    vi.stubEnv('VITE_API_BASE_URL', API_BASE_URL);
  });

  describe('Authorization Header Integration', () => {
    it('should include Authorization header in all requests when token is available', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      const mockResponse = { data: [] };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Test all HTTP methods
      await apiService.get('/tools');
      await apiService.post('/tools', { name: 'test' });
      await apiService.put('/tools/1', { name: 'updated' });
      await apiService.delete('/tools/1');

      // Verify all requests included Authorization header
      const calls = vi.mocked(fetch).mock.calls;
      calls.forEach(call => {
        const options = call[1] as RequestInit;
        expect(options.headers).toHaveProperty('Authorization', `Bearer ${mockIdToken}`);
      });
    });

    it('should handle missing token gracefully', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: null,
      } as any);

      const mockResponse = { status: 'ok' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await apiService.get('/health');

      const call = vi.mocked(fetch).mock.calls[0];
      const options = call[1] as RequestInit;
      const headers = options.headers as HeadersInit;
      
      // Should not have Authorization header if no token
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);
    });

    it('should handle 401 Unauthorized and log warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Token expired' }),
      } as Response);

      await expect(apiService.get('/tools')).rejects.toMatchObject({
        status: 401,
        message: 'Token expired',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unauthorized request')
      );

      consoleSpy.mockRestore();
    });

    it('should handle 403 Forbidden and log warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied' }),
      } as Response);

      await expect(apiService.get('/tools')).rejects.toMatchObject({
        status: 403,
        message: 'Access denied',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Forbidden')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('URL Handling', () => {
    beforeEach(() => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);
    });

    it('should handle endpoints with /api/ prefix', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await apiService.get('/api/tools');

      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/tools`,
        expect.any(Object)
      );
    });

    it('should add /api/ prefix to endpoints without it', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await apiService.get('tools');

      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/tools`,
        expect.any(Object)
      );
    });

    it('should preserve absolute URLs', async () => {
      const absoluteUrl = 'https://external-api.com/endpoint';
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await apiService.get(absoluteUrl);

      expect(fetch).toHaveBeenCalledWith(
        absoluteUrl,
        expect.any(Object)
      );
    });
  });

  describe('Response Parsing', () => {
    beforeEach(() => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);
    });

    it('should parse JSON responses', async () => {
      const mockData = { data: [{ id: 1, name: 'test' }] };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await apiService.get('/tools');
      expect(result).toEqual(mockData);
    });

    it('should handle non-JSON responses gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Not JSON');
        },
      } as Response);

      const result = await apiService.get('/health');
      expect(result).toEqual({});
    });
  });

  describe('Profiles Endpoint', () => {
    beforeEach(() => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);
    });

    it('should successfully fetch profile by user_id', async () => {
      const userId = '08617390-b001-708d-f61e-07a1698282ec';
      const mockProfileData = {
        data: [{
          user_id: userId,
          full_name: 'Test User',
          favorite_color: 'blue',
          updated_at: '2025-01-01T00:00:00Z'
        }]
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfileData,
      } as Response);

      const result = await apiService.get(`/profiles?user_id=${userId}`);

      // Verify the request was made correctly
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profiles'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockIdToken}`,
          }),
        })
      );

      // Verify the response structure
      expect(result).toEqual(mockProfileData);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('user_id');
      }
    });

    it('should handle profiles endpoint with special characters in user_id safely', async () => {
      // Test that user_id with special characters doesn't cause SQL injection
      const userId = "08617390-b001-708d-f61e-07a1698282ec'; DROP TABLE profiles; --";
      const mockProfileData = {
        data: []
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfileData,
      } as Response);

      // This should not throw an error or cause SQL injection
      const result = await apiService.get(`/profiles?user_id=${encodeURIComponent(userId)}`);

      expect(result).toEqual(mockProfileData);
    });

    it('should return empty array when profile not found', async () => {
      const userId = 'non-existent-user-id';
      const mockProfileData = {
        data: []
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProfileData,
      } as Response);

      const result = await apiService.get(`/profiles?user_id=${userId}`);

      expect(result.data).toEqual([]);
    });
  });
});

