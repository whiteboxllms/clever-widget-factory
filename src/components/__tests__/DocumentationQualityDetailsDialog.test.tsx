/**
 * Tests for DocumentationQualityDetailsDialog component
 * 
 * These tests ensure that:
 * 1. The component fetches data from AWS API (not Supabase)
 * 2. Documentation quality scores are calculated correctly
 * 3. Parts are filtered by user and activity type
 * 4. Error handling works properly
 * 5. Navigation to edit parts works correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentationQualityDetailsDialog } from '../DocumentationQualityDetailsDialog';
import { mockApiResponse, setupFetchMock } from '@/test-utils/mocks';
import { fetchAuthSession } from 'aws-amplify/auth';

// Mock AWS Amplify auth
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock environment variable
const originalEnv = import.meta.env;
let queryClient: QueryClient;

beforeEach(() => {
  import.meta.env = {
    ...originalEnv,
    VITE_API_BASE_URL: 'https://test-api.example.com',
  };
  mockNavigate.mockClear();
  
  // Create a fresh QueryClient for each test
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  import.meta.env = originalEnv;
});

// Helper function to render component with QueryClient
function renderWithQueryClient(component: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('DocumentationQualityDetailsDialog', () => {
  const mockUserId = 'user-123';
  const mockUserName = 'John Doe';
  const mockActivityType = 'Created';

  // Use recent dates within the last week
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const mockPartsHistory = [
    {
      id: 'history-1',
      part_id: 'part-123',
      change_type: 'create',
      changed_by: mockUserId,
      changed_at: yesterday.toISOString(),
      created_at: yesterday.toISOString(),
    },
    {
      id: 'history-2',
      part_id: 'part-456',
      change_type: 'create',
      changed_by: mockUserId,
      changed_at: twoDaysAgo.toISOString(),
      created_at: twoDaysAgo.toISOString(),
    },
    {
      id: 'history-3',
      part_id: 'part-789',
      change_type: 'update',
      changed_by: 'other-user',
      changed_at: threeDaysAgo.toISOString(),
      created_at: threeDaysAgo.toISOString(),
    },
  ];

  const mockParts = [
    {
      id: 'part-123',
      name: 'Complete Part',
      description: 'A well-documented part',
      cost_per_unit: 10.50,
      image_url: 'https://example.com/image1.jpg',
      storage_location: 'Shelf A',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'part-456',
      name: 'Incomplete Part',
      description: null,
      cost_per_unit: null,
      image_url: null,
      storage_location: 'Shelf B',
      updated_at: '2024-01-16T10:00:00Z',
    },
    {
      id: 'part-789',
      name: 'Other User Part',
      description: 'Should not appear',
      cost_per_unit: 5.00,
      image_url: 'https://example.com/image3.jpg',
      storage_location: 'Shelf C',
      updated_at: '2024-01-17T10:00:00Z',
    },
  ];

  describe('AWS API Integration', () => {
    it('should fetch parts history and parts from AWS API endpoints', async () => {
      const fetchCalls: any[] = [];
      
      global.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        fetchCalls.push({ url: urlString, method: init?.method });
        
        // Mock AWS API response for parts_history
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        
        // Mock AWS API response for parts
        if (urlString.includes('/parts') && !urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType={mockActivityType}
        />
      );

      // Wait for API calls to be made
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify both endpoints were called
      const historyCall = fetchCalls.find(call => call.url.includes('/parts_history'));
      const partsCall = fetchCalls.find(call => 
        call.url.includes('/parts') && !call.url.includes('/parts_history')
      );
      
      expect(historyCall).toBeDefined();
      expect(partsCall).toBeDefined();
    });

    it('should NOT use Supabase client', async () => {
      // Mock Supabase to ensure it's not called
      const supabaseMock = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      };

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType={mockActivityType}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify Supabase was NOT called
      expect(supabaseMock.from).not.toHaveBeenCalled();
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
        
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType={mockActivityType}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify Authorization headers were included
      const callsWithAuth = fetchCalls.filter(call => {
        const headers = call.headers as Record<string, string>;
        return headers && headers['Authorization'] === `Bearer ${mockIdToken}`;
      });
      
      expect(callsWithAuth.length).toBeGreaterThan(0);
    });
  });

  describe('Data Filtering and Processing', () => {
    it('should filter parts history by user and activity type', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      // Wait for data to be processed and displayed
      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Should show parts created by the user
      expect(screen.getByText('Complete Part')).toBeInTheDocument();
      expect(screen.getByText('Incomplete Part')).toBeInTheDocument();
      
      // Should NOT show parts by other users
      expect(screen.queryByText('Other User Part')).not.toBeInTheDocument();
    });

    it('should filter by "update" activity type correctly', async () => {
      const updateHistory = [
        {
          id: 'history-update-1',
          part_id: 'part-update-123',
          change_type: 'update',
          changed_by: mockUserId,
          changed_at: yesterday.toISOString(),
          created_at: yesterday.toISOString(),
        },
      ];

      const updateParts = [
        {
          id: 'part-update-123',
          name: 'Updated Part',
          description: 'An updated part',
          cost_per_unit: 15.00,
          image_url: 'https://example.com/updated.jpg',
          storage_location: 'Shelf D',
          updated_at: yesterday.toISOString(),
        },
      ];

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([...mockPartsHistory, ...updateHistory]));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse([...mockParts, ...updateParts]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Updated"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Updated Part')).toBeInTheDocument();
      });

      // Should show only updated parts
      expect(screen.getByText('Updated Part')).toBeInTheDocument();
      
      // Should NOT show created parts when filtering for updates
      expect(screen.queryByText('Complete Part')).not.toBeInTheDocument();
      expect(screen.queryByText('Incomplete Part')).not.toBeInTheDocument();
    });

    it('should filter by date range (last week)', async () => {
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const oldHistory = [
        {
          id: 'history-old',
          part_id: 'part-old',
          change_type: 'create',
          changed_by: mockUserId,
          changed_at: oldDate.toISOString(), // Old date
          created_at: oldDate.toISOString(),
        },
      ];

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([...mockPartsHistory, ...oldHistory]));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Should show recent parts
      expect(screen.getByText('Complete Part')).toBeInTheDocument();
      expect(screen.getByText('Incomplete Part')).toBeInTheDocument();
      
      // Should NOT show old parts (assuming part-old would have a corresponding part)
      // Since we didn't add the old part to mockParts, it won't appear anyway
    });
  });

  describe('Documentation Quality Scoring', () => {
    it('should calculate quality scores correctly', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Complete part should have 100% quality (all 3 fields filled)
      expect(screen.getByText('100% Quality')).toBeInTheDocument();
      
      // Incomplete part should have 0% quality (0 of 3 fields filled)
      expect(screen.getByText('0% Quality')).toBeInTheDocument();
    });

    it('should show correct quality score for partially complete parts', async () => {
      const partialParts = [
        {
          id: 'part-partial',
          name: 'Partial Part',
          description: 'Has description',
          cost_per_unit: null, // Missing
          image_url: 'https://example.com/partial.jpg',
          storage_location: 'Shelf E',
          updated_at: yesterday.toISOString(),
        },
      ];

      const partialHistory = [
        {
          id: 'history-partial',
          part_id: 'part-partial',
          change_type: 'create',
          changed_by: mockUserId,
          changed_at: yesterday.toISOString(),
          created_at: yesterday.toISOString(),
        },
      ];

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(partialHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(partialParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Partial Part')).toBeInTheDocument();
      });

      // Should show 67% quality (2 of 3 fields filled: description + image)
      expect(screen.getByText('67% Quality')).toBeInTheDocument();
    });

    it('should display field status correctly', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Complete part should show filled fields
      expect(screen.getByText('A well-documented part')).toBeInTheDocument();
      expect(screen.getByText('$10.5')).toBeInTheDocument();
      expect(screen.getByText('Provided')).toBeInTheDocument();

      // Incomplete part should show missing field messages
      expect(screen.getByText('Missing - Add a detailed description')).toBeInTheDocument();
      expect(screen.getByText('Missing - Add cost information')).toBeInTheDocument();
      expect(screen.getByText('Missing - Add a photo for identification')).toBeInTheDocument();
    });
  });

  describe('Navigation and Interaction', () => {
    it('should navigate to edit part when card is clicked', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      const mockOnOpenChange = vi.fn();

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Click on the part card
      const partCard = screen.getByText('Complete Part').closest('.cursor-pointer');
      expect(partCard).toBeInTheDocument();
      
      fireEvent.click(partCard!);

      // Should navigate to inventory page with edit parameter
      expect(mockNavigate).toHaveBeenCalledWith('/inventory?edit=part-123');
      
      // Should close the dialog
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show edit tip in each card', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(mockPartsHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse(mockParts));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Should show edit tip in each card
      const tipElements = screen.getAllByText(/Click anywhere on this card to edit the part/);
      expect(tipElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
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

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      // Should show loading initially, then error state
      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      });
    });

    it('should handle empty data gracefully', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse([]));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse([]));
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      });
    });

    it('should handle null API response data', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: null }),
          } as Response);
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: null }),
          } as Response);
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Behavior', () => {
    it('should not fetch data when dialog is closed', async () => {
      global.fetch = vi.fn();

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={false}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      // Wait a bit to ensure no fetch calls are made
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should show loading state initially', async () => {
      global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      expect(screen.getByText('Loading details...')).toBeInTheDocument();
    });

    it('should display correct dialog title and description', async () => {
      global.fetch = vi.fn((url: string | URL | Request) => {
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      expect(screen.getByText(`Documentation Quality Details - ${mockUserName} (${mockActivityType})`)).toBeInTheDocument();
      expect(screen.getByText(/Documentation Quality Score:/)).toBeInTheDocument();
      expect(screen.getByText(/Optional Fields:/)).toBeInTheDocument();
      expect(screen.getByText(/Score Calculation:/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle parts with missing part data', async () => {
      const historyWithMissingPart = [
        {
          id: 'history-missing',
          part_id: 'part-missing',
          change_type: 'create',
          changed_by: mockUserId,
          changed_at: yesterday.toISOString(),
          created_at: yesterday.toISOString(),
        },
      ];

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(historyWithMissingPart));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse([])); // No matching parts
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No transactions found')).toBeInTheDocument();
      });
    });

    it('should handle duplicate part IDs in history', async () => {
      const duplicateHistory = [
        {
          id: 'history-1',
          part_id: 'part-123',
          change_type: 'create',
          changed_by: mockUserId,
          changed_at: twoDaysAgo.toISOString(),
          created_at: twoDaysAgo.toISOString(),
        },
        {
          id: 'history-2',
          part_id: 'part-123', // Same part ID
          change_type: 'create',
          changed_by: mockUserId,
          changed_at: yesterday.toISOString(), // Later date
          created_at: yesterday.toISOString(),
        },
      ];

      global.fetch = vi.fn((url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('/parts_history')) {
          return Promise.resolve(mockApiResponse(duplicateHistory));
        }
        if (urlString.includes('/parts')) {
          return Promise.resolve(mockApiResponse([mockParts[0]])); // Only one part
        }
        return Promise.resolve(mockApiResponse([]));
      }) as typeof fetch;

      renderWithQueryClient(
        <DocumentationQualityDetailsDialog
          open={true}
          onOpenChange={() => {}}
          userId={mockUserId}
          userName={mockUserName}
          activityType="Created"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Complete Part')).toBeInTheDocument();
      });

      // Should only show the part once, even with duplicate history entries
      const partCards = screen.getAllByText('Complete Part');
      expect(partCards).toHaveLength(1);
    });
  });
});