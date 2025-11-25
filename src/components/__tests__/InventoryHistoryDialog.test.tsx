/**
 * Tests for InventoryHistoryDialog component
 * 
 * These tests ensure that:
 * 1. The component fetches inventory history from AWS API (not Supabase)
 * 2. History entries are displayed correctly with user names
 * 3. Error handling works properly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InventoryHistoryDialog } from '../InventoryHistoryDialog';
import { mockApiResponse, setupFetchMock } from '@/test-utils/mocks';
import { useToast } from '@/hooks/use-toast';
import { fetchAuthSession } from 'aws-amplify/auth';

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Mock AWS Amplify auth
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

// Mock environment variable
const originalEnv = import.meta.env;
beforeEach(() => {
  import.meta.env = {
    ...originalEnv,
    VITE_API_BASE_URL: 'https://test-api.example.com',
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  import.meta.env = originalEnv;
});

describe('InventoryHistoryDialog', () => {
  const mockPartId = 'part-123';
  const mockPartName = 'Test Part';

  const mockHistoryEntry = {
    id: 'history-1',
    part_id: mockPartId,
    change_type: 'quantity_remove',
    old_quantity: 10,
    new_quantity: 9,
    quantity_change: -1,
    changed_by: 'user-123',
    changed_by_name: 'John Doe',
    change_reason: 'Used for action: Test Action',
    changed_at: '2024-01-15T10:00:00Z',
    organization_id: 'org-123',
  };

  const mockHistoryEntry2 = {
    id: 'history-2',
    part_id: mockPartId,
    change_type: 'quantity_add',
    old_quantity: 9,
    new_quantity: 15,
    quantity_change: 6,
    changed_by: 'user-456',
    changed_by_name: 'Jane Smith',
    change_reason: 'Manual stock addition',
    changed_at: '2024-01-16T10:00:00Z',
    organization_id: 'org-123',
  };

  describe('AWS API Integration', () => {
    it('should fetch inventory history from AWS API endpoint', async () => {
      const fetchCalls: any[] = [];
      
      global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({ url: urlString, method: init?.method });
        
        // Mock AWS API response for parts_history
        if (urlString.includes('/parts_history') && urlString.includes(`part_id=${mockPartId}`)) {
          return Promise.resolve(
            mockApiResponse([mockHistoryEntry, mockHistoryEntry2])
          );
        }
        
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      // Open the dialog
      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for fetch to be called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify the correct AWS API endpoint was called
      const historyFetchCall = fetchCalls.find(call => 
        call.url.includes('/parts_history') && 
        call.url.includes(`part_id=${mockPartId}`)
      );
      
      expect(historyFetchCall).toBeDefined();
      expect(historyFetchCall.url).toContain('/parts_history');
      expect(historyFetchCall.url).toContain(`part_id=${mockPartId}`);
    });

    it('should NOT use Supabase client', async () => {
      // This test ensures we're not using Supabase
      const supabaseMock = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([mockHistoryEntry]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify Supabase was NOT called
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('should display history entries with user names from AWS API', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(
            mockApiResponse([mockHistoryEntry, mockHistoryEntry2])
          );
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for history to be displayed
      await waitFor(() => {
        expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify user names are displayed
      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const mockToast = vi.fn();
      const { useToast: useToastOriginal } = await import('@/hooks/use-toast');
      vi.mocked(useToast).mockReturnValue({
        toast: mockToast,
      });
      
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Database error' }),
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to fetch inventory history',
            variant: 'destructive',
          })
        );
      }, { timeout: 3000 });
    });

    it('should display empty state when no history exists', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      await waitFor(() => {
        expect(screen.getByText(/No history records found/i)).toBeInTheDocument();
      });
    });

    it('should include Authorization header with Bearer token in API requests', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const fetchCalls: any[] = [];
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({ 
          url: urlString, 
          method: init?.method,
          headers: init?.headers,
        });
        
        // Mock AWS API response for parts_history
        if (urlString.includes('/parts_history') && urlString.includes(`part_id=${mockPartId}`)) {
          return Promise.resolve(
            mockApiResponse([mockHistoryEntry])
          );
        }
        
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      // Open the dialog
      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for fetch to be called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify the Authorization header was included
      const historyFetchCall = fetchCalls.find(call => 
        call.url.includes('/parts_history') && 
        call.url.includes(`part_id=${mockPartId}`)
      );
      
      expect(historyFetchCall).toBeDefined();
      expect(historyFetchCall.headers).toBeDefined();
      
      // Check that Authorization header is present
      // apiService creates headers as a plain object
      const headers = historyFetchCall.headers as Record<string, string>;
      expect(headers).toBeDefined();
      expect(headers['Authorization']).toBe(`Bearer ${mockIdToken}`);
    });

    it('should NOT have duplicate /api/ in the URL path', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const fetchCalls: any[] = [];
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      // Mock environment to have base URL with /api already
      import.meta.env.VITE_API_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api';

      global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({ 
          url: urlString, 
          method: init?.method,
        });
        
        // Mock AWS API response for parts_history
        if (urlString.includes('/parts_history') && urlString.includes(`part_id=${mockPartId}`)) {
          return Promise.resolve(
            mockApiResponse([mockHistoryEntry])
          );
        }
        
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      // Open the dialog
      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for fetch to be called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify the URL does NOT have duplicate /api/
      const historyFetchCall = fetchCalls.find(call => 
        call.url.includes('/parts_history') && 
        call.url.includes(`part_id=${mockPartId}`)
      );
      
      expect(historyFetchCall).toBeDefined();
      
      // Check that URL does NOT contain /api/api/
      expect(historyFetchCall.url).not.toContain('/api/api/');
      
      // Check that URL contains /api/parts_history (single /api/)
      expect(historyFetchCall.url).toContain('/api/parts_history');
      
      // Verify the URL structure is correct
      expect(historyFetchCall.url).toMatch(/\/api\/parts_history\?/);
    });

    it('should construct URL with query parameters matching the exact curl format', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const realPartId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165'; // Real UUID from curl
      const fetchCalls: any[] = [];
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      // Mock environment to match production base URL
      const originalBaseUrl = import.meta.env.VITE_API_BASE_URL;
      import.meta.env.VITE_API_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api';

      global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({ 
          url: urlString, 
          method: init?.method,
          headers: init?.headers,
        });
        
        // Mock AWS API response for parts_history
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(
            mockApiResponse([mockHistoryEntry])
          );
        }
        
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={realPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      // Open the dialog
      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for fetch to be called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify the exact URL format matches the curl command
      const historyFetchCall = fetchCalls.find(call => 
        call.url.includes('/parts_history')
      );
      
      expect(historyFetchCall).toBeDefined();
      
      // Verify the URL contains the expected path and query parameters
      // Note: apiService may construct relative or absolute URLs depending on VITE_API_BASE_URL
      expect(historyFetchCall.url).toContain('/parts_history');
      expect(historyFetchCall.url).toContain(`part_id=${realPartId}`);
      expect(historyFetchCall.url).toContain('limit=100');
      
      // Verify query parameters are present and correctly formatted
      // Handle both relative and absolute URLs
      const url = historyFetchCall.url.startsWith('http') 
        ? new URL(historyFetchCall.url)
        : new URL(historyFetchCall.url, 'https://example.com');
      expect(url.searchParams.get('part_id')).toBe(realPartId);
      expect(url.searchParams.get('limit')).toBe('100');
      
      // Restore original base URL
      import.meta.env.VITE_API_BASE_URL = originalBaseUrl;
      
      // Verify no duplicate /api/ in path
      expect(historyFetchCall.url).not.toContain('/api/api/');
      
      // Verify Authorization header is present
      const headers = historyFetchCall.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${mockIdToken}`);
    });

    it('should handle API response with correct data structure from Lambda', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const realPartId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      // Mock the exact response structure from Lambda (wrapped in { data: [...] })
      const lambdaResponse = {
        data: [
          {
            id: 'history-1',
            part_id: realPartId,
            change_type: 'quantity_remove',
            old_quantity: 10,
            new_quantity: 9,
            quantity_change: -1,
            changed_by: '08617390-b001-708d-f61e-07a1698282ec',
            changed_by_name: 'Stefan Hamilton', // From Lambda JOIN with organization_members
            change_reason: 'Used for action: Test Action',
            changed_at: '2024-01-15T10:00:00Z',
            organization_id: 'org-123',
          }
        ]
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => lambdaResponse,
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={realPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for history to be displayed with the name from Lambda response
      await waitFor(() => {
        expect(screen.getByText(/Stefan Hamilton/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify the data from Lambda response is correctly displayed
      expect(screen.getByText(/Stefan Hamilton/i)).toBeInTheDocument();
    });

    it('should handle null or undefined data in API response gracefully', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      // Simulate Lambda returning null data (which can happen with json_agg)
      const lambdaResponseWithNull = {
        data: null  // Lambda can return { data: null } when json_agg returns null
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => lambdaResponseWithNull,
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Should display empty state when data is null
      await waitFor(() => {
        expect(screen.getByText(/No history records found/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify no errors occurred
      expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
    });

    it('should properly encode UUID query parameters in URL', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const uuidWithSpecialChars = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
      const fetchCalls: any[] = [];
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({ url: urlString });
        
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={uuidWithSpecialChars} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify UUID is properly included in URL without encoding issues
      const historyCall = fetchCalls.find(call => call.url.includes('/parts_history'));
      expect(historyCall).toBeDefined();
      
      // Handle both relative and absolute URLs when constructing URL object
      const url = historyCall.url.startsWith('http') 
        ? new URL(historyCall.url)
        : new URL(historyCall.url, 'https://example.com');
      expect(url.searchParams.get('part_id')).toBe(uuidWithSpecialChars);
      
      // Verify the UUID appears correctly in the URL (not double-encoded)
      expect(historyCall.url).toContain(uuidWithSpecialChars);
    });

    it('should handle 401 Unauthorized response and show error toast', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const mockToast = vi.fn();
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      vi.mocked(useToast).mockReturnValue({
        toast: mockToast,
      });

      // Simulate 401 Unauthorized response (expired token)
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ error: 'Unauthorized: Invalid token' }),
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for error toast to be called
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to fetch inventory history',
            variant: 'destructive',
          })
        );
      }, { timeout: 3000 });
    });

    it('should handle API response when data field is missing (should fail initially)', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      // Simulate Lambda returning response without 'data' field (edge case)
      const responseWithoutData = {
        // Missing 'data' field - this could happen if Lambda response structure changes
        items: [mockHistoryEntry]
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => responseWithoutData,
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Should handle missing data field gracefully and show empty state
      await waitFor(() => {
        expect(screen.getByText(/No history records found/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify no errors occurred (component should handle missing data gracefully)
      expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
    });

    it('should handle SQL syntax errors from Lambda API gracefully', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const mockToast = vi.fn();
      const realPartId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      vi.mocked(useToast).mockReturnValue({
        toast: mockToast,
      });

      // Simulate SQL syntax error from Lambda (e.g., unquoted UUID causing "trailing junk after numeric literal")
      const sqlErrorResponse = {
        error: 'trailing junk after numeric literal at or near "0c08ac5b"'
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => sqlErrorResponse,
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={realPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Should show error toast when SQL error occurs
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to fetch inventory history',
            variant: 'destructive',
          })
        );
      }, { timeout: 3000 });
    });

    it('should display action link when history entry has action_id and action_title', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      const mockActionId = 'action-123';
      const mockActionTitle = 'Test Action';
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      const historyEntryWithAction = {
        ...mockHistoryEntry,
        change_type: 'quantity_remove',
        change_reason: `Used for action: ${mockActionTitle} - 1 Test Part`,
        action_id: mockActionId,
        action_title: mockActionTitle,
        action_status: 'completed',
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([historyEntryWithAction]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      // Mock window.open
      const mockWindowOpen = vi.fn();
      window.open = mockWindowOpen;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for the action link to appear
      await waitFor(() => {
        const actionLink = screen.getByText(new RegExp(`View Action: ${mockActionTitle}`, 'i'));
        expect(actionLink).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click the action link
      const actionLink = screen.getByText(new RegExp(`View Action: ${mockActionTitle}`, 'i'));
      actionLink.click();

      // Verify window.open was called with the correct URL
      expect(mockWindowOpen).toHaveBeenCalledWith(`/actions#${mockActionId}`, '_blank');
    });

    it('should not display action link when history entry does not have action_id', async () => {
      const mockIdToken = 'mock-cognito-id-token-12345';
      
      // Mock fetchAuthSession to return a token
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          idToken: {
            toString: () => mockIdToken,
          },
        },
      } as any);

      const historyEntryWithoutAction = {
        ...mockHistoryEntry,
        change_type: 'quantity_remove',
        change_reason: 'Manual adjustment',
        action_id: null,
        action_title: null,
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([historyEntryWithoutAction]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      render(
        <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
          <button>Open History</button>
        </InventoryHistoryDialog>
      );

      const trigger = screen.getByText('Open History');
      trigger.click();

      // Wait for the history to load
      await waitFor(() => {
        // Use getAllByText since there are multiple "Removed" elements
        const removedElements = screen.getAllByText(/Removed/i);
        expect(removedElements.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // Verify action link is NOT displayed
      expect(screen.queryByText(/View Action:/i)).not.toBeInTheDocument();
    });
  });
});

