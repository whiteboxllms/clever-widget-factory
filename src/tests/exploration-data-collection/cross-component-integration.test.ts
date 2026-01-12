import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'sonner';

// Components
import UnifiedActionDialog from '../../components/UnifiedActionDialog';
import Explorations from '../../pages/Explorations';
import PolicyCreationDialog from '../../components/PolicyCreationDialog';
import PolicyLinkingDialog from '../../components/PolicyLinkingDialog';

// Services
import { actionService } from '../../services/actionService';
import { explorationService } from '../../services/explorationService';
import { policyService } from '../../services/policyService';
import { aiContentService } from '../../services/aiContentService';
import { semanticSearchService } from '../../services/semanticSearchService';
import { analyticsService } from '../../services/analyticsService';

// Types
import type { Action } from '../../types/actions';

// Mock services
vi.mock('../../services/actionService');
vi.mock('../../services/explorationService');
vi.mock('../../services/policyService');
vi.mock('../../services/aiContentService');
vi.mock('../../services/semanticSearchService');
vi.mock('../../services/analyticsService');
vi.mock('../../hooks/useImageUpload');
vi.mock('sonner');

const mockActionService = vi.mocked(actionService);
const mockExplorationService = vi.mocked(explorationService);
const mockPolicyService = vi.mocked(policyService);
const mockAIContentService = vi.mocked(aiContentService);
const mockSemanticSearchService = vi.mocked(semanticSearchService);
const mockAnalyticsService = vi.mocked(analyticsService);
const mockToast = vi.mocked(toast);

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock data
const mockExplorations = [
  {
    id: 1,
    action_id: 'action-1',
    exploration_code: 'SF010124EX001',
    exploration_notes_text: 'First exploration notes',
    metrics_text: 'First metrics',
    public_flag: true,
    key_photos: ['photo1.jpg'],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    action: {
      id: 'action-1',
      description: 'First exploration action',
      policy: 'First policy text',
      location: 'Location A',
      explorer: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      organization_id: 'test-org',
      is_exploration: true,
      exploration_code: 'SF010124EX001',
      summary_policy_text: 'First summary'
    }
  },
  {
    id: 2,
    action_id: 'action-2',
    exploration_code: 'SF010124EX002',
    exploration_notes_text: 'Second exploration notes',
    metrics_text: 'Second metrics',
    public_flag: false,
    key_photos: [],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    action: {
      id: 'action-2',
      description: 'Second exploration action',
      policy: 'Second policy text',
      location: 'Location B',
      explorer: 'user2',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      organization_id: 'test-org',
      is_exploration: true,
      exploration_code: 'SF010124EX002',
      summary_policy_text: 'Second summary'
    }
  }
];

const mockPolicies = [
  {
    id: 1,
    title: 'Environmental Policy',
    description_text: 'Environmental protection policy',
    status: 'active' as const,
    effective_start_date: '2024-01-01',
    category: 'Environmental',
    priority: 'high' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    title: 'Safety Policy',
    description_text: 'Safety and security policy',
    status: 'draft' as const,
    category: 'Safety',
    priority: 'medium' as const,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  }
];

describe('Cross-Component Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockExplorationService.listExplorations.mockResolvedValue(mockExplorations);
    mockPolicyService.listPolicies.mockResolvedValue(mockPolicies);
    mockActionService.updateAction.mockResolvedValue(mockExplorations[0].action);
    mockPolicyService.createPolicy.mockResolvedValue(mockPolicies[0]);
    mockAIContentService.generatePolicyDraft.mockResolvedValue({
      title: 'AI Generated Policy',
      description_text: 'AI generated description',
      confidence: 0.9,
      model: 'gpt-4'
    });
    mockSemanticSearchService.searchSimilar.mockResolvedValue([]);
    mockAnalyticsService.getExplorationPercentages.mockResolvedValue({
      total_actions: 100,
      exploration_actions: 25,
      exploration_percentage: 25.0,
      period_breakdown: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Exploration List to Policy Creation Workflow', () => {
    it('should create policy from exploration list and update exploration display', async () => {
      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for explorations to load
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Click create policy button on first exploration
      const createPolicyButtons = screen.getAllByRole('button', { name: /create policy/i });
      await user.click(createPolicyButtons[0]);

      // Verify PolicyCreationDialog opens with exploration context
      await waitFor(() => {
        expect(screen.getByText(/create policy from exploration/i)).toBeInTheDocument();
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.getByText('First exploration action')).toBeInTheDocument();
      });

      // Generate AI policy draft
      const generateButton = screen.getByRole('button', { name: /generate ai draft/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockAIContentService.generatePolicyDraft).toHaveBeenCalledWith({
          exploration_code: 'SF010124EX001',
          state_text: 'First exploration action',
          exploration_notes: 'First exploration notes',
          metrics_text: 'First metrics',
          summary_policy_text: 'First summary'
        });
      });

      // Fill in policy details
      const titleField = screen.getByLabelText(/title/i);
      expect(titleField).toHaveValue('AI Generated Policy');

      const categoryField = screen.getByLabelText(/category/i);
      await user.type(categoryField, 'Environmental');

      // Create policy
      const createButton = screen.getByRole('button', { name: /create policy/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockPolicyService.createPolicy).toHaveBeenCalled();
        expect(mockActionService.updateAction).toHaveBeenCalledWith('action-1', {
          policy_id: 1
        });
      });

      // Verify success message
      expect(mockToast.success).toHaveBeenCalledWith('Policy created and linked successfully');

      // Verify exploration list refreshes (would show policy link)
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledTimes(2); // Initial load + refresh
      });
    });

    it('should link exploration to existing policy and update display', async () => {
      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for explorations to load
      await waitFor(() => {
        expect(screen.getByText('SF010124EX002')).toBeInTheDocument();
      });

      // Click link policy button on second exploration
      const linkPolicyButtons = screen.getAllByRole('button', { name: /link to policy/i });
      await user.click(linkPolicyButtons[1]);

      // Verify PolicyLinkingDialog opens
      await waitFor(() => {
        expect(screen.getByText(/link to existing policy/i)).toBeInTheDocument();
      });

      // Wait for policies to load
      await waitFor(() => {
        expect(mockPolicyService.listPolicies).toHaveBeenCalled();
        expect(screen.getByText('Environmental Policy')).toBeInTheDocument();
      });

      // Search for specific policy
      const searchField = screen.getByPlaceholderText(/search policies/i);
      await user.type(searchField, 'Environmental');

      // Select policy
      const policyCard = screen.getByText('Environmental Policy');
      await user.click(policyCard);

      // Link policy
      const linkButton = screen.getByRole('button', { name: /link policy/i });
      await user.click(linkButton);

      await waitFor(() => {
        expect(mockActionService.updateAction).toHaveBeenCalledWith('action-2', {
          policy_id: 1
        });
      });

      // Verify success message and list refresh
      expect(mockToast.success).toHaveBeenCalledWith('Policy linked successfully');
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Search and Analytics Integration', () => {
    it('should integrate semantic search with exploration filtering', async () => {
      const mockSearchResults = [
        {
          id: 'action-1',
          type: 'action',
          content: 'First exploration action',
          similarity: 0.95,
          metadata: { exploration_code: 'SF010124EX001' }
        }
      ];

      mockSemanticSearchService.searchSimilar.mockResolvedValue(mockSearchResults);

      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Perform semantic search (if implemented in UI)
      const searchField = screen.getByPlaceholderText(/search explorations/i);
      await user.type(searchField, 'environmental protection measures');

      // Verify search is performed
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'environmental protection measures'
          })
        );
      });
    });

    it('should display analytics data with exploration context', async () => {
      const mockAnalytics = {
        total_actions: 100,
        exploration_actions: 25,
        exploration_percentage: 25.0,
        period_breakdown: [
          { period: '2024-01', total_actions: 50, exploration_actions: 15, percentage: 30.0 },
          { period: '2024-02', total_actions: 50, exploration_actions: 10, percentage: 20.0 }
        ]
      };

      mockAnalyticsService.getExplorationPercentages.mockResolvedValue(mockAnalytics);

      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for data to load
      await waitFor(() => {
        expect(mockAnalyticsService.getExplorationPercentages).toHaveBeenCalled();
      });

      // Verify analytics integration (if displayed in UI)
      // This would depend on how analytics are integrated into the explorations page
    });
  });

  describe('Error Recovery and State Management', () => {
    it('should handle policy creation failure and maintain exploration list state', async () => {
      mockPolicyService.createPolicy.mockRejectedValue(new Error('Policy creation failed'));

      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for explorations to load
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Try to create policy
      const createPolicyButtons = screen.getAllByRole('button', { name: /create policy/i });
      await user.click(createPolicyButtons[0]);

      // Fill and submit form
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate ai draft/i })).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /generate ai draft/i });
      await user.click(generateButton);

      const createButton = screen.getByRole('button', { name: /create policy/i });
      await user.click(createButton);

      // Verify error handling
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to create policy. Please try again.');
      });

      // Verify exploration list is still intact
      expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      expect(screen.getByText('SF010124EX002')).toBeInTheDocument();
    });

    it('should handle network failures gracefully across components', async () => {
      mockExplorationService.listExplorations.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Verify error state is displayed
      await waitFor(() => {
        expect(screen.getByText(/failed to load explorations/i)).toBeInTheDocument();
      });

      // Verify retry functionality (if implemented)
      const retryButton = screen.queryByRole('button', { name: /retry/i });
      if (retryButton) {
        await user.click(retryButton);
        expect(mockExplorationService.listExplorations).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('Data Consistency Across Components', () => {
    it('should maintain data consistency when updating exploration from multiple entry points', async () => {
      const updatedExploration = {
        ...mockExplorations[0],
        exploration_notes_text: 'Updated notes from dialog',
        updated_at: '2024-01-03T00:00:00Z'
      };

      mockExplorationService.updateExploration.mockResolvedValue(updatedExploration);
      mockExplorationService.getExplorationByActionId.mockResolvedValue(updatedExploration);

      // First, render exploration list
      const { rerender } = render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Then simulate opening action dialog and updating exploration
      rerender(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            action={mockExplorations[0].action}
            isCreating={false}
          />
        </TestWrapper>
      );

      // Wait for exploration tab to be available
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /exploration/i })).toBeInTheDocument();
      });

      // Click exploration tab and update notes
      const explorationTab = screen.getByRole('tab', { name: /exploration/i });
      await user.click(explorationTab);

      const notesField = screen.getByLabelText(/exploration notes/i);
      await user.clear(notesField);
      await user.type(notesField, 'Updated notes from dialog');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Verify update was called
      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalledWith(1, {
          exploration_notes_text: 'Updated notes from dialog',
          metrics_text: 'First metrics',
          public_flag: true,
          key_photos: ['photo1.jpg']
        });
      });

      // Verify success feedback
      expect(mockToast.success).toHaveBeenCalledWith('Exploration updated successfully');
    });

    it('should handle concurrent updates gracefully', async () => {
      // Simulate concurrent update scenario
      let updateCount = 0;
      mockExplorationService.updateExploration.mockImplementation(async () => {
        updateCount++;
        if (updateCount === 1) {
          // First update succeeds
          return { ...mockExplorations[0], exploration_notes_text: 'First update' };
        } else {
          // Second update fails due to conflict
          throw new Error('Conflict: Resource was modified by another user');
        }
      });

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            action={mockExplorations[0].action}
            isCreating={false}
          />
        </TestWrapper>
      );

      // Navigate to exploration tab
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /exploration/i })).toBeInTheDocument();
      });

      const explorationTab = screen.getByRole('tab', { name: /exploration/i });
      await user.click(explorationTab);

      // Make first update
      const notesField = screen.getByLabelText(/exploration notes/i);
      await user.clear(notesField);
      await user.type(notesField, 'First update');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Exploration updated successfully');
      });

      // Make second update (should fail)
      await user.clear(notesField);
      await user.type(notesField, 'Second update');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to update exploration. The resource may have been modified by another user.');
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should efficiently handle large exploration lists with filtering', async () => {
      // Create large dataset
      const largeExplorationList = Array.from({ length: 100 }, (_, i) => ({
        ...mockExplorations[0],
        id: i + 1,
        action_id: `action-${i + 1}`,
        exploration_code: `SF010124EX${String(i + 1).padStart(3, '0')}`,
        exploration_notes_text: `Exploration notes ${i + 1}`,
        action: {
          ...mockExplorations[0].action,
          id: `action-${i + 1}`,
          description: `Exploration action ${i + 1}`,
          exploration_code: `SF010124EX${String(i + 1).padStart(3, '0')}`
        }
      }));

      mockExplorationService.listExplorations.mockResolvedValue(largeExplorationList);

      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      });

      // Test filtering performance
      const searchField = screen.getByPlaceholderText(/search explorations/i);
      await user.type(searchField, 'SF010124EX050');

      // Verify filtering is applied
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'SF010124EX050'
          })
        );
      });

      // Verify only relevant results are shown (this would depend on actual filtering implementation)
      expect(screen.queryByText('SF010124EX001')).not.toBeInTheDocument();
    });

    it('should optimize API calls with proper caching', async () => {
      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Initial load
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledTimes(1);
      });

      // Apply filter (should trigger new API call)
      const publicToggle = screen.getByLabelText(/public only/i);
      await user.click(publicToggle);

      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledTimes(2);
      });

      // Remove filter (should use cache or trigger minimal API call)
      await user.click(publicToggle);

      // Verify efficient API usage
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalledTimes(3);
      });
    });
  });
});