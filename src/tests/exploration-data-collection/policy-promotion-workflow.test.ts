/**
 * Unit Tests for Policy Promotion Workflow
 * 
 * Tests the policy promotion functionality including:
 * - Policy draft generation from exploration data
 * - Policy creation workflow with AI assistance
 * - Existing policy linking functionality
 * 
 * Requirements: 3.2, 3.5
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PolicyCreationDialog } from '@/components/PolicyCreationDialog';
import { PolicyLinkingDialog } from '@/components/PolicyLinkingDialog';
import { PolicyService, CreatePolicyRequest, PolicyResponse } from '@/services/policyService';
import { AIContentService, PolicyDraftRequest } from '@/services/aiContentService';
import { ActionService } from '@/services/actionService';
import { ExplorationListItem } from '@/services/explorationService';

// Mock the services
vi.mock('@/services/policyService');
vi.mock('@/services/aiContentService');
vi.mock('@/services/actionService');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const MockedPolicyService = PolicyService as vi.MockedClass<typeof PolicyService>;
const MockedAIContentService = AIContentService as vi.MockedClass<typeof AIContentService>;
const MockedActionService = ActionService as vi.MockedClass<typeof ActionService>;

describe('Policy Promotion Workflow', () => {
  let queryClient: QueryClient;
  let mockPolicyService: any;
  let mockAIContentService: any;
  let mockActionService: any;

  const mockExploration: ExplorationListItem = {
    exploration_code: 'SF010124EX001',
    state_text: 'Testing soil conditions in field A',
    summary_policy_text: 'Apply organic fertilizer based on soil test results',
    exploration_notes_text: 'Soil pH is 6.5, nitrogen levels are low. Organic matter content is adequate.',
    metrics_text: 'pH: 6.5, N: 15ppm, P: 25ppm, K: 180ppm, OM: 3.2%',
    key_photos: ['photo1.jpg', 'photo2.jpg'],
    action_id: 'action-1',
    exploration_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    explorer_name: 'John Doe',
    public_flag: true
  };

  const mockPolicies: PolicyResponse[] = [
    {
      id: 1,
      title: 'Soil Management Policy',
      description_text: 'Guidelines for soil testing and fertilizer application',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      effective_start_date: '2024-01-01T00:00:00Z',
      category: 'Agriculture',
      priority: 'high'
    },
    {
      id: 2,
      title: 'Organic Fertilizer Standards',
      description_text: 'Standards for organic fertilizer application rates',
      status: 'draft',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      category: 'Fertilizer',
      priority: 'medium'
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
    mockPolicyService = {
      createPolicy: vi.fn(),
      listPolicies: vi.fn()
    };
    
    mockAIContentService = {
      generatePolicyDraft: vi.fn()
    };

    mockActionService = {
      updateAction: vi.fn()
    };

    MockedPolicyService.mockImplementation(() => mockPolicyService);
    MockedAIContentService.mockImplementation(() => mockAIContentService);
    MockedActionService.mockImplementation(() => mockActionService);
  });

  const renderPolicyCreationDialog = (props = {}) => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      exploration: mockExploration,
      onPolicyCreated: vi.fn()
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <PolicyCreationDialog {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  const renderPolicyLinkingDialog = (props = {}) => {
    const defaultProps = {
      open: true,
      onOpenChange: vi.fn(),
      exploration: mockExploration,
      onPolicyLinked: vi.fn()
    };

    mockPolicyService.listPolicies.mockResolvedValue(mockPolicies);

    return render(
      <QueryClientProvider client={queryClient}>
        <PolicyLinkingDialog {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Policy Creation from Exploration', () => {
    it('displays exploration context in policy creation dialog', async () => {
      renderPolicyCreationDialog();
      
      expect(screen.getByText('Create Policy from Exploration')).toBeInTheDocument();
      expect(screen.getByText(/Create a new policy based on findings from exploration SF010124EX001/)).toBeInTheDocument();
      
      // Check exploration context display
      expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      expect(screen.getByText('Testing soil conditions in field A')).toBeInTheDocument();
      expect(screen.getByText(/Soil pH is 6.5, nitrogen levels are low/)).toBeInTheDocument();
      expect(screen.getByText(/pH: 6.5, N: 15ppm, P: 25ppm, K: 180ppm/)).toBeInTheDocument();
    });

    it('pre-fills policy title based on exploration code', async () => {
      renderPolicyCreationDialog();
      
      const titleInput = screen.getByDisplayValue('Policy for SF010124EX001');
      expect(titleInput).toBeInTheDocument();
    });

    it('generates AI policy draft when Generate AI Draft button is clicked', async () => {
      const mockAIResponse = {
        content: {
          title: 'Soil Testing and Fertilizer Application Policy',
          description_text: 'This policy establishes guidelines for soil testing procedures and organic fertilizer application based on test results. Regular soil testing should be conducted to determine pH levels and nutrient content, with fertilizer applications adjusted accordingly.'
        },
        confidence: 0.85,
        model: 'gpt-4'
      };

      mockAIContentService.generatePolicyDraft.mockResolvedValue(mockAIResponse);
      
      renderPolicyCreationDialog();
      
      const generateButton = screen.getByText('Generate AI Draft');
      fireEvent.click(generateButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Generating...')).toBeInTheDocument();
      });
      
      // Should call AI service with exploration data
      await waitFor(() => {
        expect(mockAIContentService.generatePolicyDraft).toHaveBeenCalledWith({
          exploration_data: {
            exploration_code: 'SF010124EX001',
            exploration_notes_text: 'Soil pH is 6.5, nitrogen levels are low. Organic matter content is adequate.',
            metrics_text: 'pH: 6.5, N: 15ppm, P: 25ppm, K: 180ppm, OM: 3.2%',
            action_title: 'Testing soil conditions in field A',
            state_text: 'Testing soil conditions in field A'
          }
        });
      });
      
      // Should populate form fields with AI response
      await waitFor(() => {
        expect(screen.getByDisplayValue('Soil Testing and Fertilizer Application Policy')).toBeInTheDocument();
        expect(screen.getByDisplayValue(/This policy establishes guidelines for soil testing procedures/)).toBeInTheDocument();
      });
    });

    it('handles AI service unavailability gracefully', async () => {
      mockAIContentService.generatePolicyDraft.mockResolvedValue(null);
      
      renderPolicyCreationDialog();
      
      const generateButton = screen.getByText('Generate AI Draft');
      fireEvent.click(generateButton);
      
      await waitFor(() => {
        expect(mockAIContentService.generatePolicyDraft).toHaveBeenCalled();
      });
      
      // Should show fallback message but not break the form
      expect(screen.getByText('Generate AI Draft')).toBeInTheDocument();
    });

    it('validates required fields before policy creation', async () => {
      renderPolicyCreationDialog();
      
      // Clear the pre-filled title
      const titleInput = screen.getByDisplayValue('Policy for SF010124EX001');
      fireEvent.change(titleInput, { target: { value: '' } });
      
      const createButton = screen.getByText('Create Policy');
      fireEvent.click(createButton);
      
      // Should not call create service
      expect(mockPolicyService.createPolicy).not.toHaveBeenCalled();
    });

    it('creates policy with form data when Create Policy is clicked', async () => {
      const mockCreatedPolicy = { id: 123, ...mockPolicies[0] };
      mockPolicyService.createPolicy.mockResolvedValue(mockCreatedPolicy);
      
      const onPolicyCreated = vi.fn();
      renderPolicyCreationDialog({ onPolicyCreated });
      
      // Fill in required fields
      const titleInput = screen.getByDisplayValue('Policy for SF010124EX001');
      fireEvent.change(titleInput, { target: { value: 'Test Policy Title' } });
      
      const descriptionInput = screen.getByPlaceholderText(/Describe the policy, its purpose/);
      fireEvent.change(descriptionInput, { target: { value: 'Test policy description' } });
      
      const createButton = screen.getByText('Create Policy');
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockPolicyService.createPolicy).toHaveBeenCalledWith({
          title: 'Test Policy Title',
          description_text: 'Test policy description',
          status: 'draft',
          effective_start_date: undefined,
          effective_end_date: undefined,
          category: undefined,
          priority: undefined
        });
      });
      
      await waitFor(() => {
        expect(onPolicyCreated).toHaveBeenCalledWith(123);
      });
    });

    it('supports status selection and effective dates', async () => {
      const mockCreatedPolicy = { id: 124, ...mockPolicies[0] };
      mockPolicyService.createPolicy.mockResolvedValue(mockCreatedPolicy);
      
      renderPolicyCreationDialog();
      
      // Fill in required fields
      const titleInput = screen.getByDisplayValue('Policy for SF010124EX001');
      fireEvent.change(titleInput, { target: { value: 'Test Policy' } });
      
      const descriptionInput = screen.getByPlaceholderText(/Describe the policy, its purpose/);
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
      
      // Change status to active
      const statusSelect = screen.getByDisplayValue('Draft');
      fireEvent.click(statusSelect);
      const activeOption = screen.getByText('Active');
      fireEvent.click(activeOption);
      
      // Set priority
      const prioritySelect = screen.getByDisplayValue('Select priority');
      fireEvent.click(prioritySelect);
      const highOption = screen.getByText('High');
      fireEvent.click(highOption);
      
      // Set category
      const categoryInput = screen.getByPlaceholderText(/Enter policy category/);
      fireEvent.change(categoryInput, { target: { value: 'Agriculture' } });
      
      const createButton = screen.getByText('Create Policy');
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockPolicyService.createPolicy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'active',
            priority: 'high',
            category: 'Agriculture'
          })
        );
      });
    });

    it('handles policy creation errors gracefully', async () => {
      mockPolicyService.createPolicy.mockRejectedValue(new Error('Network error'));
      
      renderPolicyCreationDialog();
      
      // Fill in required fields
      const titleInput = screen.getByDisplayValue('Policy for SF010124EX001');
      fireEvent.change(titleInput, { target: { value: 'Test Policy' } });
      
      const descriptionInput = screen.getByPlaceholderText(/Describe the policy, its purpose/);
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
      
      const createButton = screen.getByText('Create Policy');
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockPolicyService.createPolicy).toHaveBeenCalled();
      });
      
      // Should handle error gracefully
      expect(screen.getByText('Create Policy')).toBeInTheDocument();
    });
  });

  describe('Existing Policy Linking', () => {
    it('displays exploration context in policy linking dialog', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Link to Existing Policy')).toBeInTheDocument();
        expect(screen.getByText(/Link exploration SF010124EX001 to an existing policy/)).toBeInTheDocument();
        
        // Check exploration context display
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.getByText('Testing soil conditions in field A')).toBeInTheDocument();
        expect(screen.getByText(/Apply organic fertilizer based on soil test results/)).toBeInTheDocument();
      });
    });

    it('loads and displays available policies', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(mockPolicyService.listPolicies).toHaveBeenCalled();
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
        expect(screen.getByText('Organic Fertilizer Standards')).toBeInTheDocument();
      });
    });

    it('filters policies by search term', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
        expect(screen.getByText('Organic Fertilizer Standards')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/Search by title, description, or category/);
      fireEvent.change(searchInput, { target: { value: 'Soil' } });
      
      // Should filter policies client-side
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
        expect(screen.queryByText('Organic Fertilizer Standards')).not.toBeInTheDocument();
      });
    });

    it('filters policies by status', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
      });
      
      const statusSelect = screen.getByDisplayValue('All Statuses');
      fireEvent.click(statusSelect);
      const activeOption = screen.getByText('Active');
      fireEvent.click(activeOption);
      
      // Should call listPolicies with status filter
      await waitFor(() => {
        expect(mockPolicyService.listPolicies).toHaveBeenCalledWith({
          status: 'active'
        });
      });
    });

    it('allows policy selection and displays selected policy', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
      });
      
      const policyCard = screen.getByText('Soil Management Policy').closest('.cursor-pointer');
      fireEvent.click(policyCard!);
      
      // Should show selected policy badge
      await waitFor(() => {
        expect(screen.getByText('Selected: Soil Management Policy')).toBeInTheDocument();
      });
      
      // Link button should be enabled
      const linkButton = screen.getByText('Link Policy');
      expect(linkButton).not.toBeDisabled();
    });

    it('links exploration to selected policy when Link Policy is clicked', async () => {
      mockActionService.updateAction.mockResolvedValue({});
      
      const onPolicyLinked = vi.fn();
      renderPolicyLinkingDialog({ onPolicyLinked });
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
      });
      
      // Select a policy
      const policyCard = screen.getByText('Soil Management Policy').closest('.cursor-pointer');
      fireEvent.click(policyCard!);
      
      await waitFor(() => {
        expect(screen.getByText('Selected: Soil Management Policy')).toBeInTheDocument();
      });
      
      // Click link button
      const linkButton = screen.getByText('Link Policy');
      fireEvent.click(linkButton);
      
      await waitFor(() => {
        expect(mockActionService.updateAction).toHaveBeenCalledWith('action-1', {
          policy_id: 1
        });
      });
      
      await waitFor(() => {
        expect(onPolicyLinked).toHaveBeenCalledWith(1);
      });
    });

    it('displays policy metadata correctly', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
        expect(screen.getByText('draft')).toBeInTheDocument();
        expect(screen.getByText('high priority')).toBeInTheDocument();
        expect(screen.getByText('medium priority')).toBeInTheDocument();
        expect(screen.getByText('Agriculture')).toBeInTheDocument();
        expect(screen.getByText('Fertilizer')).toBeInTheDocument();
      });
    });

    it('handles policy linking errors gracefully', async () => {
      mockActionService.updateAction.mockRejectedValue(new Error('Network error'));
      
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
      });
      
      // Select a policy
      const policyCard = screen.getByText('Soil Management Policy').closest('.cursor-pointer');
      fireEvent.click(policyCard!);
      
      await waitFor(() => {
        expect(screen.getByText('Link Policy')).not.toBeDisabled();
      });
      
      // Click link button
      const linkButton = screen.getByText('Link Policy');
      fireEvent.click(linkButton);
      
      await waitFor(() => {
        expect(mockActionService.updateAction).toHaveBeenCalled();
      });
      
      // Should handle error gracefully
      expect(screen.getByText('Link Policy')).toBeInTheDocument();
    });

    it('shows empty state when no policies exist', async () => {
      mockPolicyService.listPolicies.mockResolvedValue([]);
      
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('No policies found')).toBeInTheDocument();
        expect(screen.getByText('No policies have been created yet.')).toBeInTheDocument();
      });
    });

    it('disables Link Policy button when no policy is selected', async () => {
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
      });
      
      const linkButton = screen.getByText('Link Policy');
      expect(linkButton).toBeDisabled();
    });
  });

  describe('Dialog State Management', () => {
    it('closes policy creation dialog when Cancel is clicked', async () => {
      const onOpenChange = vi.fn();
      renderPolicyCreationDialog({ onOpenChange });
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('closes policy linking dialog when Cancel is clicked', async () => {
      const onOpenChange = vi.fn();
      renderPolicyLinkingDialog({ onOpenChange });
      
      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('resets form state when policy creation dialog is reopened', async () => {
      const { rerender } = renderPolicyCreationDialog({ open: false });
      
      // Reopen dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <PolicyCreationDialog
            open={true}
            onOpenChange={vi.fn()}
            exploration={mockExploration}
            onPolicyCreated={vi.fn()}
          />
        </QueryClientProvider>
      );
      
      // Should reset to default title
      expect(screen.getByDisplayValue('Policy for SF010124EX001')).toBeInTheDocument();
    });

    it('resets search state when policy linking dialog is reopened', async () => {
      const { rerender } = renderPolicyLinkingDialog({ open: false });
      
      // Reopen dialog
      rerender(
        <QueryClientProvider client={queryClient}>
          <PolicyLinkingDialog
            open={true}
            onOpenChange={vi.fn()}
            exploration={mockExploration}
            onPolicyLinked={vi.fn()}
          />
        </QueryClientProvider>
      );
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by title, description, or category/);
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during policy creation', async () => {
      mockPolicyService.createPolicy.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ id: 123 }), 100))
      );
      
      renderPolicyCreationDialog();
      
      // Fill in required fields
      const titleInput = screen.getByDisplayValue('Policy for SF010124EX001');
      fireEvent.change(titleInput, { target: { value: 'Test Policy' } });
      
      const descriptionInput = screen.getByPlaceholderText(/Describe the policy, its purpose/);
      fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
      
      const createButton = screen.getByText('Create Policy');
      fireEvent.click(createButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });

    it('shows loading state during policy linking', async () => {
      mockActionService.updateAction.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 100))
      );
      
      renderPolicyLinkingDialog();
      
      await waitFor(() => {
        expect(screen.getByText('Soil Management Policy')).toBeInTheDocument();
      });
      
      // Select a policy
      const policyCard = screen.getByText('Soil Management Policy').closest('.cursor-pointer');
      fireEvent.click(policyCard!);
      
      await waitFor(() => {
        expect(screen.getByText('Link Policy')).not.toBeDisabled();
      });
      
      // Click link button
      const linkButton = screen.getByText('Link Policy');
      fireEvent.click(linkButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Linking...')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching policies', async () => {
      mockPolicyService.listPolicies.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockPolicies), 100))
      );
      
      renderPolicyLinkingDialog();
      
      expect(screen.getByText('Loading policies...')).toBeInTheDocument();
    });
  });
});