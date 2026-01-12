import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'sonner';

// Components
import UnifiedActionDialog from '../../components/UnifiedActionDialog';
import Explorations from '../../pages/Explorations';
import ExplorationTab from '../../components/ExplorationTab';
import PolicyCreationDialog from '../../components/PolicyCreationDialog';
import PolicyLinkingDialog from '../../components/PolicyLinkingDialog';

// Services
import { actionService } from '../../services/actionService';
import { explorationService } from '../../services/explorationService';
import { policyService } from '../../services/policyService';
import { aiContentService } from '../../services/aiContentService';
import { explorationCodeGenerator } from '../../services/explorationCodeGenerator';

// Types
import type { Action } from '../../types/actions';

// Mock services
vi.mock('../../services/actionService');
vi.mock('../../services/explorationService');
vi.mock('../../services/policyService');
vi.mock('../../services/aiContentService');
vi.mock('../../services/explorationCodeGenerator');
vi.mock('../../hooks/useImageUpload');
vi.mock('sonner');

const mockActionService = vi.mocked(actionService);
const mockExplorationService = vi.mocked(explorationService);
const mockPolicyService = vi.mocked(policyService);
const mockAIContentService = vi.mocked(aiContentService);
const mockExplorationCodeGenerator = vi.mocked(explorationCodeGenerator);
const mockToast = vi.mocked(toast);

// Test wrapper component
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
const mockAction: Action = {
  id: 'test-action-1',
  description: 'Test exploration action',
  policy: 'Test policy text',
  location: 'Test Location',
  explorer: 'test-user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  organization_id: 'test-org',
  is_exploration: true,
  exploration_code: 'SF010124EX001',
  summary_policy_text: 'AI-generated summary policy'
};

const mockExploration = {
  id: 1,
  action_id: 'test-action-1',
  exploration_code: 'SF010124EX001',
  exploration_notes_text: 'Test exploration notes',
  metrics_text: 'Test metrics data',
  public_flag: true,
  key_photos: ['photo1.jpg', 'photo2.jpg'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

const mockPolicy = {
  id: 1,
  title: 'Test Policy',
  description_text: 'Test policy description',
  status: 'active' as const,
  effective_start_date: '2024-01-01',
  category: 'Environmental',
  priority: 'medium' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

describe('Integration Workflow Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockActionService.createAction.mockResolvedValue(mockAction);
    mockActionService.updateAction.mockResolvedValue(mockAction);
    mockExplorationService.createExploration.mockResolvedValue(mockExploration);
    mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
    mockExplorationService.updateExploration.mockResolvedValue(mockExploration);
    mockExplorationService.listExplorations.mockResolvedValue([mockExploration]);
    mockPolicyService.createPolicy.mockResolvedValue(mockPolicy);
    mockPolicyService.listPolicies.mockResolvedValue([mockPolicy]);
    mockExplorationCodeGenerator.generateCode.mockResolvedValue('SF010124EX001');
    mockExplorationCodeGenerator.validateCode.mockResolvedValue({ isValid: true, isUnique: true });
    mockAIContentService.generateSummaryPolicy.mockResolvedValue({
      summary_policy_text: 'AI-generated summary policy',
      confidence: 0.9,
      model: 'gpt-4'
    });
    mockAIContentService.generateExplorationSuggestions.mockResolvedValue({
      exploration_notes_text: 'AI-generated exploration notes',
      metrics_text: 'AI-generated metrics',
      confidence: 0.9,
      model: 'gpt-4'
    });
    mockAIContentService.generatePolicyDraft.mockResolvedValue({
      title: 'AI-Generated Policy Title',
      description_text: 'AI-generated policy description',
      confidence: 0.9,
      model: 'gpt-4'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Exploration Creation Workflow', () => {
    it('should create exploration from action creation dialog with AI assistance', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            isCreating={true}
          />
        </TestWrapper>
      );

      // Fill in basic action fields
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.type(descriptionField, 'Test exploration action');

      const locationField = screen.getByLabelText(/location/i);
      await user.type(locationField, 'Test Location');

      // Enable exploration mode
      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      // Verify exploration code is generated
      await waitFor(() => {
        expect(mockExplorationCodeGenerator.generateCode).toHaveBeenCalled();
      });

      const explorationCodeField = screen.getByLabelText(/exploration code/i);
      expect(explorationCodeField).toHaveValue('SF010124EX001');

      // Use AI assistance for summary policy
      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockAIContentService.generateSummaryPolicy).toHaveBeenCalledWith({
          state_text: 'Test exploration action',
          policy_text: '',
          location: 'Test Location'
        });
      });

      // Verify AI content is populated
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      expect(summaryPolicyField).toHaveValue('AI-generated summary policy');

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify action creation with exploration data
      await waitFor(() => {
        expect(mockActionService.createAction).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Test exploration action',
            location: 'Test Location',
            is_exploration: true,
            exploration_code: 'SF010124EX001',
            summary_policy_text: 'AI-generated summary policy'
          })
        );
      });

      // Verify exploration record creation
      expect(mockExplorationService.createExploration).toHaveBeenCalledWith({
        action_id: expect.any(String),
        exploration_code: 'SF010124EX001',
        exploration_notes_text: '',
        metrics_text: '',
        public_flag: false,
        key_photos: []
      });

      expect(onSave).toHaveBeenCalled();
    });

    it('should handle exploration creation without AI assistance', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      // Mock AI service failure
      mockAIContentService.generateSummaryPolicy.mockRejectedValue(new Error('AI service unavailable'));

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            isCreating={true}
          />
        </TestWrapper>
      );

      // Fill in basic action fields
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.type(descriptionField, 'Test exploration action');

      // Enable exploration mode
      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      // Try AI assistance (should fail gracefully)
      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('AI service is currently unavailable. Please try again later.');
      });

      // Manually enter summary policy
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      await user.type(summaryPolicyField, 'Manual summary policy');

      // Submit the form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify action creation still works
      await waitFor(() => {
        expect(mockActionService.createAction).toHaveBeenCalledWith(
          expect.objectContaining({
            summary_policy_text: 'Manual summary policy'
          })
        );
      });

      expect(onSave).toHaveBeenCalled();
    });

    it('should validate exploration code uniqueness in real-time', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      // Mock code validation failure
      mockExplorationCodeGenerator.validateCode.mockResolvedValue({ 
        isValid: true, 
        isUnique: false 
      });

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            isCreating={true}
          />
        </TestWrapper>
      );

      // Enable exploration mode
      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      // Modify exploration code
      const explorationCodeField = screen.getByLabelText(/exploration code/i);
      await user.clear(explorationCodeField);
      await user.type(explorationCodeField, 'SF010124EX999');

      // Verify validation is called
      await waitFor(() => {
        expect(mockExplorationCodeGenerator.validateCode).toHaveBeenCalledWith('SF010124EX999');
      });

      // Verify error state is shown
      expect(screen.getByText(/code already exists/i)).toBeInTheDocument();

      // Verify save button is disabled
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Exploration Tab Integration', () => {
    it('should load and edit exploration data in action dialog', async () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            action={mockAction}
            isCreating={false}
          />
        </TestWrapper>
      );

      // Wait for exploration data to load
      await waitFor(() => {
        expect(mockExplorationService.getExplorationByActionId).toHaveBeenCalledWith('test-action-1');
      });

      // Verify exploration tab is visible
      const explorationTab = screen.getByRole('tab', { name: /exploration/i });
      expect(explorationTab).toBeInTheDocument();

      // Click exploration tab
      await user.click(explorationTab);

      // Verify exploration data is displayed
      expect(screen.getByDisplayValue('Test exploration notes')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test metrics data')).toBeInTheDocument();

      // Edit exploration notes
      const notesField = screen.getByLabelText(/exploration notes/i);
      await user.clear(notesField);
      await user.type(notesField, 'Updated exploration notes');

      // Use AI suggestions
      const aiSuggestButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiSuggestButton);

      await waitFor(() => {
        expect(mockAIContentService.generateExplorationSuggestions).toHaveBeenCalledWith({
          action_context: expect.objectContaining({
            description: 'Test exploration action',
            location: 'Test Location'
          }),
          exploration_code: 'SF010124EX001'
        });
      });

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalledWith(1, {
          exploration_notes_text: 'Updated exploration notes',
          metrics_text: 'AI-generated metrics',
          public_flag: true,
          key_photos: ['photo1.jpg', 'photo2.jpg']
        });
      });

      expect(mockToast.success).toHaveBeenCalledWith('Exploration updated successfully');
    });
  });

  describe('Policy Promotion End-to-End Workflow', () => {
    it('should create policy from exploration with AI assistance', async () => {
      render(
        <TestWrapper>
          <PolicyCreationDialog
            isOpen={true}
            onClose={vi.fn()}
            exploration={mockExploration}
            action={mockAction}
          />
        </TestWrapper>
      );

      // Verify exploration context is displayed
      expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      expect(screen.getByText('Test exploration action')).toBeInTheDocument();

      // Generate AI policy draft
      const generateButton = screen.getByRole('button', { name: /generate ai draft/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockAIContentService.generatePolicyDraft).toHaveBeenCalledWith({
          exploration_code: 'SF010124EX001',
          state_text: 'Test exploration action',
          exploration_notes: 'Test exploration notes',
          metrics_text: 'Test metrics data',
          summary_policy_text: 'AI-generated summary policy'
        });
      });

      // Verify AI content is populated
      expect(screen.getByDisplayValue('AI-Generated Policy Title')).toBeInTheDocument();
      expect(screen.getByDisplayValue('AI-generated policy description')).toBeInTheDocument();

      // Set policy metadata
      const statusSelect = screen.getByLabelText(/status/i);
      await user.selectOptions(statusSelect, 'active');

      const categoryField = screen.getByLabelText(/category/i);
      await user.type(categoryField, 'Environmental');

      // Create policy
      const createButton = screen.getByRole('button', { name: /create policy/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockPolicyService.createPolicy).toHaveBeenCalledWith({
          title: 'AI-Generated Policy Title',
          description_text: 'AI-generated policy description',
          status: 'active',
          category: 'Environmental',
          priority: 'medium'
        });
      });

      // Verify action is linked to policy
      expect(mockActionService.updateAction).toHaveBeenCalledWith('test-action-1', {
        policy_id: 1
      });

      expect(mockToast.success).toHaveBeenCalledWith('Policy created and linked successfully');
    });

    it('should link exploration to existing policy', async () => {
      render(
        <TestWrapper>
          <PolicyLinkingDialog
            isOpen={true}
            onClose={vi.fn()}
            action={mockAction}
          />
        </TestWrapper>
      );

      // Wait for policies to load
      await waitFor(() => {
        expect(mockPolicyService.listPolicies).toHaveBeenCalled();
      });

      // Search for policies
      const searchField = screen.getByPlaceholderText(/search policies/i);
      await user.type(searchField, 'Test Policy');

      // Select policy
      const policyCard = screen.getByText('Test Policy');
      await user.click(policyCard);

      // Link policy
      const linkButton = screen.getByRole('button', { name: /link policy/i });
      await user.click(linkButton);

      await waitFor(() => {
        expect(mockActionService.updateAction).toHaveBeenCalledWith('test-action-1', {
          policy_id: 1
        });
      });

      expect(mockToast.success).toHaveBeenCalledWith('Policy linked successfully');
    });
  });

  describe('Explorations Review Page Integration', () => {
    it('should display and filter explorations with policy actions', async () => {
      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      // Wait for explorations to load
      await waitFor(() => {
        expect(mockExplorationService.listExplorations).toHaveBeenCalled();
      });

      // Verify exploration is displayed
      expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
      expect(screen.getByText('Test exploration action')).toBeInTheDocument();

      // Test filtering
      const searchField = screen.getByPlaceholderText(/search explorations/i);
      await user.type(searchField, 'SF010124EX001');

      // Test policy actions
      const createPolicyButton = screen.getByRole('button', { name: /create policy/i });
      expect(createPolicyButton).toBeInTheDocument();

      const linkPolicyButton = screen.getByRole('button', { name: /link to policy/i });
      expect(linkPolicyButton).toBeInTheDocument();

      const viewActionButton = screen.getByRole('button', { name: /view action/i });
      expect(viewActionButton).toBeInTheDocument();
    });

    it('should handle empty exploration list', async () => {
      mockExplorationService.listExplorations.mockResolvedValue([]);

      render(
        <TestWrapper>
          <Explorations />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no explorations found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service failures gracefully', async () => {
      mockActionService.createAction.mockRejectedValue(new Error('Service unavailable'));

      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={onClose}
            onSave={onSave}
            isCreating={true}
          />
        </TestWrapper>
      );

      // Fill form and submit
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.type(descriptionField, 'Test action');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to save action. Please try again.');
      });

      expect(onSave).not.toHaveBeenCalled();
    });

    it('should handle AI service failures with fallback', async () => {
      mockAIContentService.generateSummaryPolicy.mockRejectedValue(new Error('AI unavailable'));
      mockAIContentService.generateExplorationSuggestions.mockRejectedValue(new Error('AI unavailable'));
      mockAIContentService.generatePolicyDraft.mockRejectedValue(new Error('AI unavailable'));

      const onSave = vi.fn();

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={onSave}
            isCreating={true}
          />
        </TestWrapper>
      );

      // Enable exploration
      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      // Try AI assistance
      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('AI service is currently unavailable. Please try again later.');
      });

      // Verify form still works without AI
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.type(descriptionField, 'Test action');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockActionService.createAction).toHaveBeenCalled();
      });

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle regular actions without exploration features', async () => {
      const regularAction: Action = {
        ...mockAction,
        is_exploration: false,
        exploration_code: undefined,
        summary_policy_text: undefined
      };

      mockExplorationService.getExplorationByActionId.mockResolvedValue(null);

      const onSave = vi.fn();

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={onSave}
            action={regularAction}
            isCreating={false}
          />
        </TestWrapper>
      );

      // Verify exploration tab is not shown
      expect(screen.queryByRole('tab', { name: /exploration/i })).not.toBeInTheDocument();

      // Verify only 2 tabs are shown
      expect(screen.getByRole('tab', { name: /policy/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /implementation/i })).toBeInTheDocument();

      // Verify form works normally
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.clear(descriptionField);
      await user.type(descriptionField, 'Updated regular action');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockActionService.updateAction).toHaveBeenCalledWith(
          regularAction.id,
          expect.objectContaining({
            description: 'Updated regular action'
          })
        );
      });

      expect(onSave).toHaveBeenCalled();
    });
  });
});