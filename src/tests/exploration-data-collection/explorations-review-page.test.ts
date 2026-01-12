/**
 * Unit Tests for Explorations Review Page
 * 
 * Tests the exploration review interface including:
 * - Filtering functionality
 * - Policy action buttons
 * - Exploration list display
 * 
 * Requirements: 5.1, 5.2, 5.4, 3.1, 3.5
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Explorations from '@/pages/Explorations';
import { ExplorationService, ExplorationListItem } from '@/services/explorationService';
import { PolicyService } from '@/services/policyService';

// Mock the services
vi.mock('@/services/explorationService');
vi.mock('@/services/policyService');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));
vi.mock('@/hooks/useCognitoAuth', () => ({
  useAuth: () => ({ 
    user: { userId: 'test-user' }, 
    isLeadership: false 
  })
}));
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: () => 'test-org'
}));
vi.mock('@/hooks/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({
    members: [
      { user_id: 'user-1', full_name: 'John Doe' },
      { user_id: 'user-2', full_name: 'Jane Smith' }
    ]
  })
}));

const MockedExplorationService = ExplorationService as vi.MockedClass<typeof ExplorationService>;
const MockedPolicyService = PolicyService as vi.MockedClass<typeof PolicyService>;

describe('Explorations Review Page', () => {
  let queryClient: QueryClient;
  let mockExplorationService: any;
  let mockPolicyService: any;

  const mockExplorations: ExplorationListItem[] = [
    {
      exploration_code: 'SF010124EX001',
      state_text: 'Testing soil conditions in field A',
      summary_policy_text: 'Apply organic fertilizer based on soil test results',
      exploration_notes_text: 'Soil pH is 6.5, nitrogen levels are low',
      metrics_text: 'pH: 6.5, N: 15ppm, P: 25ppm, K: 180ppm',
      key_photos: ['photo1.jpg', 'photo2.jpg'],
      action_id: 'action-1',
      exploration_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      explorer_name: 'John Doe'
    },
    {
      exploration_code: 'SF010224EX002',
      state_text: 'Evaluating pest control methods in greenhouse',
      summary_policy_text: 'Use integrated pest management approach',
      exploration_notes_text: 'Beneficial insects are effective against aphids',
      metrics_text: 'Aphid reduction: 85%, beneficial insect survival: 95%',
      key_photos: ['photo3.jpg'],
      action_id: 'action-2',
      exploration_id: 2,
      created_at: '2024-01-02T00:00:00Z',
      explorer_name: 'Jane Smith'
    }
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    vi.clearAllMocks();

    // Setup service mocks
    mockExplorationService = {
      listExplorations: vi.fn()
    };
    
    mockPolicyService = {
      createPolicy: vi.fn(),
      listPolicies: vi.fn()
    };

    MockedExplorationService.mockImplementation(() => mockExplorationService);
    MockedPolicyService.mockImplementation(() => mockPolicyService);
  });

  const renderExplorationsPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Explorations />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Page Loading and Display', () => {
    it('shows loading state initially', async () => {
      mockExplorationService.listExplorations.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockExplorations), 100))
      );

      renderExplorationsPage();
      
      expect(screen.getByText('Loading explorations...')).toBeInTheDocument();
    });

    it('displays explorations list when loaded', async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.getByText('SF010224EX002')).toBeInTheDocument();
        expect(screen.getByText('Testing soil conditions in field A')).toBeInTheDocument();
        expect(screen.getByText('Evaluating pest control methods in greenhouse')).toBeInTheDocument();
      });
    });

    it('shows empty state when no explorations exist', async () => {
      mockExplorationService.listExplorations.mockResolvedValue([]);

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('No explorations found')).toBeInTheDocument();
        expect(screen.getByText('No explorations have been created yet.')).toBeInTheDocument();
      });
    });

    it('displays exploration count correctly', async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Explorations (2)')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering Functionality', () => {
    beforeEach(async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);
    });

    it('filters explorations by search term', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.getByText('SF010224EX002')).toBeInTheDocument();
      });

      // Search for "soil"
      const searchInput = screen.getByPlaceholderText('Search explorations...');
      fireEvent.change(searchInput, { target: { value: 'soil' } });
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.queryByText('SF010224EX002')).not.toBeInTheDocument();
      });
    });

    it('filters explorations by explorer', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Filter by explorer
      const explorerSelect = screen.getByDisplayValue('All Explorers');
      fireEvent.click(explorerSelect);
      
      const johnOption = screen.getByText('John Doe');
      fireEvent.click(johnOption);
      
      // Should call listExplorations with explorer filter
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledWith(
          expect.objectContaining({
            explorer: 'user-1'
          })
        );
      });
    });

    it('filters explorations by public flag', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Filter by public visibility
      const publicSelect = screen.getByDisplayValue('All Explorations');
      fireEvent.click(publicSelect);
      
      const publicOption = screen.getByText('Public Only');
      fireEvent.click(publicOption);
      
      // Should call listExplorations with public_flag filter
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledWith(
          expect.objectContaining({
            public_flag: true
          })
        );
      });
    });

    it('filters explorations by location', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Filter by location
      const locationInput = screen.getByPlaceholderText('Filter by location...');
      fireEvent.change(locationInput, { target: { value: 'field A' } });
      
      // Should call listExplorations with location filter
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledWith(
          expect.objectContaining({
            location: 'field A'
          })
        );
      });
    });

    it('clears search filter when X button is clicked', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Add search term
      const searchInput = screen.getByPlaceholderText('Search explorations...');
      fireEvent.change(searchInput, { target: { value: 'soil' } });
      
      // Click clear button
      const clearButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(clearButton);
      
      expect(searchInput).toHaveValue('');
    });

    it('shows filtered results count', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Explorations (2)')).toBeInTheDocument();
      });

      // Filter to show only one result
      const searchInput = screen.getByPlaceholderText('Search explorations...');
      fireEvent.change(searchInput, { target: { value: 'soil' } });
      
      await waitFor(() => {
        expect(screen.getByText('Explorations (1)')).toBeInTheDocument();
      });
    });
  });

  describe('Exploration Card Display', () => {
    beforeEach(async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);
    });

    it('displays exploration code prominently', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        const codeElements = screen.getAllByText(/SF\d{6}EX\d{3}/);
        expect(codeElements).toHaveLength(2);
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.getByText('SF010224EX002')).toBeInTheDocument();
      });
    });

    it('displays state text and summary policy', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Testing soil conditions in field A')).toBeInTheDocument();
        expect(screen.getByText('Apply organic fertilizer based on soil test results')).toBeInTheDocument();
      });
    });

    it('displays exploration notes and metrics', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText(/Soil pH is 6.5, nitrogen levels are low/)).toBeInTheDocument();
        expect(screen.getByText(/pH: 6.5, N: 15ppm, P: 25ppm, K: 180ppm/)).toBeInTheDocument();
      });
    });

    it('displays photo count when photos exist', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('2 photos')).toBeInTheDocument();
        expect(screen.getByText('1 photo')).toBeInTheDocument();
      });
    });

    it('displays creation date and explorer name', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText(/Jan 01, 2024.*John Doe/)).toBeInTheDocument();
        expect(screen.getByText(/Jan 02, 2024.*Jane Smith/)).toBeInTheDocument();
      });
    });

    it('displays public/private badges correctly', async () => {
      // Mock one public and one private exploration
      const explorationsWithVisibility = [
        { ...mockExplorations[0], public_flag: true },
        { ...mockExplorations[1], public_flag: false }
      ];
      mockExplorationService.listExplorations.mockResolvedValue(explorationsWithVisibility);

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
      });
    });
  });

  describe('Policy Action Buttons', () => {
    beforeEach(async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);
    });

    it('displays action buttons for each exploration', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        const viewActionButtons = screen.getAllByText('View Action');
        const createPolicyButtons = screen.getAllByText('Create Policy');
        const linkPolicyButtons = screen.getAllByText('Link to Policy');
        
        expect(viewActionButtons).toHaveLength(2);
        expect(createPolicyButtons).toHaveLength(2);
        expect(linkPolicyButtons).toHaveLength(2);
      });
    });

    it('opens policy creation dialog when Create Policy is clicked', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      const createPolicyButtons = screen.getAllByText('Create Policy');
      fireEvent.click(createPolicyButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Create Policy from Exploration')).toBeInTheDocument();
        expect(screen.getByText(/Create a new policy based on findings from exploration SF010124EX001/)).toBeInTheDocument();
      });
    });

    it('opens policy linking dialog when Link to Policy is clicked', async () => {
      mockPolicyService.listPolicies.mockResolvedValue([
        {
          id: 1,
          title: 'Test Policy',
          description_text: 'Test policy description',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]);

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      const linkPolicyButtons = screen.getAllByText('Link to Policy');
      fireEvent.click(linkPolicyButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Link to Existing Policy')).toBeInTheDocument();
        expect(screen.getByText(/Link exploration SF010124EX001 to an existing policy/)).toBeInTheDocument();
      });
    });

    it('navigates to action view when View Action is clicked', async () => {
      const mockNavigate = vi.fn();
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate
        };
      });

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      const viewActionButtons = screen.getAllByText('View Action');
      fireEvent.click(viewActionButtons[0]);
      
      expect(mockNavigate).toHaveBeenCalledWith('/actions/action-1');
    });
  });

  describe('Date Range Filtering', () => {
    beforeEach(async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);
    });

    it('opens date picker when date range button is clicked', async () => {
      renderExplorationsPage();
      
      const dateRangeButton = screen.getByText('Select date range');
      fireEvent.click(dateRangeButton);
      
      await waitFor(() => {
        // Calendar should be visible
        expect(screen.getByRole('grid')).toBeInTheDocument();
      });
    });

    it('clears date range when Clear button is clicked', async () => {
      renderExplorationsPage();
      
      const dateRangeButton = screen.getByText('Select date range');
      fireEvent.click(dateRangeButton);
      
      await waitFor(() => {
        const clearButton = screen.getByText('Clear');
        fireEvent.click(clearButton);
        
        expect(screen.getByText('Select date range')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles exploration loading errors gracefully', async () => {
      mockExplorationService.listExplorations.mockRejectedValue(new Error('Network error'));

      renderExplorationsPage();
      
      // Should still render the page structure
      await waitFor(() => {
        expect(screen.getByText('Explorations')).toBeInTheDocument();
        expect(screen.getByText('Review and manage exploration data')).toBeInTheDocument();
      });
    });

    it('shows empty state when exploration service returns empty array', async () => {
      mockExplorationService.listExplorations.mockResolvedValue([]);

      renderExplorationsPage();
      
      await waitFor(() => {
        expect(screen.getByText('No explorations found')).toBeInTheDocument();
        expect(screen.getByText('No explorations have been created yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('displays back to dashboard button', async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);

      renderExplorationsPage();
      
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });

    it('displays page title and description', async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);

      renderExplorationsPage();
      
      expect(screen.getByText('Explorations')).toBeInTheDocument();
      expect(screen.getByText('Review and manage exploration data')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    beforeEach(async () => {
      mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);
    });

    it('renders filter grid responsively', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        const filterGrid = screen.getByText('Search').closest('.grid');
        expect(filterGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
      });
    });

    it('renders exploration cards with responsive layout', async () => {
      renderExplorationsPage();
      
      await waitFor(() => {
        const cards = screen.getAllByText(/SF\d{6}EX\d{3}/);
        expect(cards).toHaveLength(2);
        
        // Cards should be in a responsive layout
        const cardContainer = cards[0].closest('.space-y-4');
        expect(cardContainer).toBeInTheDocument();
      });
    });
  });
});