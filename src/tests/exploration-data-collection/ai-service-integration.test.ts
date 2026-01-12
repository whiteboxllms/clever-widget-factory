import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'sonner';

// Components
import UnifiedActionDialog from '../../components/UnifiedActionDialog';
import ExplorationTab from '../../components/ExplorationTab';
import PolicyCreationDialog from '../../components/PolicyCreationDialog';

// Services
import { aiContentService } from '../../services/aiContentService';
import { actionService } from '../../services/actionService';
import { explorationService } from '../../services/explorationService';
import { policyService } from '../../services/policyService';

// Types
import type { Action } from '../../types/actions';

// Mock services
vi.mock('../../services/aiContentService');
vi.mock('../../services/actionService');
vi.mock('../../services/explorationService');
vi.mock('../../services/policyService');
vi.mock('sonner');

const mockAIContentService = vi.mocked(aiContentService);
const mockActionService = vi.mocked(actionService);
const mockExplorationService = vi.mocked(explorationService);
const mockPolicyService = vi.mocked(policyService);
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
const mockAction: Action = {
  id: 'test-action-1',
  description: 'Test exploration action for AI integration',
  policy: 'Test policy text for AI context',
  location: 'Test Location for AI',
  explorer: 'test-user',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  organization_id: 'test-org',
  is_exploration: true,
  exploration_code: 'SF010124EX001',
  summary_policy_text: ''
};

const mockExploration = {
  id: 1,
  action_id: 'test-action-1',
  exploration_code: 'SF010124EX001',
  exploration_notes_text: '',
  metrics_text: '',
  public_flag: false,
  key_photos: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

describe('AI Service Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockActionService.createAction.mockResolvedValue(mockAction);
    mockActionService.updateAction.mockResolvedValue(mockAction);
    mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
    mockExplorationService.updateExploration.mockResolvedValue(mockExploration);
    mockPolicyService.createPolicy.mockResolvedValue({
      id: 1,
      title: 'Test Policy',
      description_text: 'Test Description',
      status: 'active' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AI Summary Policy Generation', () => {
    it('should generate summary policy with proper context', async () => {
      mockAIContentService.generateSummaryPolicy.mockResolvedValue({
        summary_policy_text: 'AI-generated summary policy based on state and policy context',
        confidence: 0.92,
        model: 'gpt-4',
        tokens_used: 150
      });

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

      // Fill in context fields
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.type(descriptionField, 'Detailed state description for AI context');

      const policyField = screen.getByLabelText(/policy text/i);
      await user.type(policyField, 'Comprehensive policy text for AI analysis');

      const locationField = screen.getByLabelText(/location/i);
      await user.type(locationField, 'Specific location for context');

      // Enable exploration mode
      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      // Use AI assistance
      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      // Verify AI service is called with proper context
      await waitFor(() => {
        expect(mockAIContentService.generateSummaryPolicy).toHaveBeenCalledWith({
          state_text: 'Detailed state description for AI context',
          policy_text: 'Comprehensive policy text for AI analysis',
          location: 'Specific location for context'
        });
      });

      // Verify AI content is populated
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      expect(summaryPolicyField).toHaveValue('AI-generated summary policy based on state and policy context');

      // Verify success feedback
      expect(mockToast.success).toHaveBeenCalledWith('AI suggestions generated successfully');
    });

    it('should handle AI service timeout gracefully', async () => {
      mockAIContentService.generateSummaryPolicy.mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      // Enable exploration and try AI assistance
      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      // Verify timeout is handled
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('AI request timed out. Please try again.');
      }, { timeout: 5000 });

      // Verify form remains functional
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      await user.type(summaryPolicyField, 'Manual summary policy');
      expect(summaryPolicyField).toHaveValue('Manual summary policy');
    });

    it('should handle AI service rate limiting', async () => {
      mockAIContentService.generateSummaryPolicy.mockRejectedValue(
        new Error('Rate limit exceeded. Please try again in 60 seconds.')
      );

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Rate limit exceeded. Please try again in 60 seconds.');
      });

      // Verify button is temporarily disabled (if implemented)
      expect(aiAssistButton).toBeDisabled();
    });
  });

  describe('AI Exploration Suggestions', () => {
    it('should generate contextual exploration suggestions', async () => {
      mockAIContentService.generateExplorationSuggestions.mockResolvedValue({
        exploration_notes_text: 'AI-generated exploration notes with specific observations and recommendations',
        metrics_text: 'AI-generated metrics including quantitative measurements and analysis',
        confidence: 0.88,
        model: 'gpt-4',
        tokens_used: 200
      });

      render(
        <TestWrapper>
          <ExplorationTab
            action={mockAction}
            exploration={mockExploration}
            onUpdate={vi.fn()}
          />
        </TestWrapper>
      );

      // Use AI suggestions
      const aiSuggestButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiSuggestButton);

      // Verify AI service is called with proper context
      await waitFor(() => {
        expect(mockAIContentService.generateExplorationSuggestions).toHaveBeenCalledWith({
          action_context: {
            description: 'Test exploration action for AI integration',
            policy: 'Test policy text for AI context',
            location: 'Test Location for AI',
            summary_policy_text: ''
          },
          exploration_code: 'SF010124EX001',
          existing_notes: '',
          existing_metrics: ''
        });
      });

      // Verify AI content is populated in empty fields only
      const notesField = screen.getByLabelText(/exploration notes/i);
      const metricsField = screen.getByLabelText(/metrics/i);
      
      expect(notesField).toHaveValue('AI-generated exploration notes with specific observations and recommendations');
      expect(metricsField).toHaveValue('AI-generated metrics including quantitative measurements and analysis');
    });

    it('should preserve existing content when using AI suggestions', async () => {
      const explorationWithContent = {
        ...mockExploration,
        exploration_notes_text: 'Existing user notes',
        metrics_text: ''
      };

      mockAIContentService.generateExplorationSuggestions.mockResolvedValue({
        exploration_notes_text: 'AI-generated notes',
        metrics_text: 'AI-generated metrics',
        confidence: 0.85,
        model: 'gpt-4'
      });

      render(
        <TestWrapper>
          <ExplorationTab
            action={mockAction}
            exploration={explorationWithContent}
            onUpdate={vi.fn()}
          />
        </TestWrapper>
      );

      const aiSuggestButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiSuggestButton);

      await waitFor(() => {
        expect(mockAIContentService.generateExplorationSuggestions).toHaveBeenCalled();
      });

      // Verify existing content is preserved, only empty fields are filled
      const notesField = screen.getByLabelText(/exploration notes/i);
      const metricsField = screen.getByLabelText(/metrics/i);
      
      expect(notesField).toHaveValue('Existing user notes'); // Preserved
      expect(metricsField).toHaveValue('AI-generated metrics'); // Filled
    });

    it('should handle partial AI response gracefully', async () => {
      mockAIContentService.generateExplorationSuggestions.mockResolvedValue({
        exploration_notes_text: 'AI-generated notes',
        metrics_text: '', // Empty response for metrics
        confidence: 0.75,
        model: 'gpt-4',
        warning: 'Partial response due to content filtering'
      });

      render(
        <TestWrapper>
          <ExplorationTab
            action={mockAction}
            exploration={mockExploration}
            onUpdate={vi.fn()}
          />
        </TestWrapper>
      );

      const aiSuggestButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiSuggestButton);

      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith('Partial AI suggestions generated. Some content may have been filtered.');
      });

      // Verify partial content is still applied
      const notesField = screen.getByLabelText(/exploration notes/i);
      expect(notesField).toHaveValue('AI-generated notes');
    });
  });

  describe('AI Policy Draft Generation', () => {
    it('should generate comprehensive policy draft from exploration data', async () => {
      mockAIContentService.generatePolicyDraft.mockResolvedValue({
        title: 'Comprehensive Environmental Protection Policy',
        description_text: 'Detailed policy description based on exploration findings and analysis',
        category: 'Environmental',
        priority: 'high',
        confidence: 0.91,
        model: 'gpt-4',
        tokens_used: 300
      });

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

      // Generate AI policy draft
      const generateButton = screen.getByRole('button', { name: /generate ai draft/i });
      await user.click(generateButton);

      // Verify AI service is called with comprehensive context
      await waitFor(() => {
        expect(mockAIContentService.generatePolicyDraft).toHaveBeenCalledWith({
          exploration_code: 'SF010124EX001',
          state_text: 'Test exploration action for AI integration',
          policy_text: 'Test policy text for AI context',
          exploration_notes: '',
          metrics_text: '',
          summary_policy_text: '',
          location: 'Test Location for AI'
        });
      });

      // Verify AI content is populated
      const titleField = screen.getByLabelText(/title/i);
      const descriptionField = screen.getByLabelText(/description/i);
      
      expect(titleField).toHaveValue('Comprehensive Environmental Protection Policy');
      expect(descriptionField).toHaveValue('Detailed policy description based on exploration findings and analysis');

      // Verify metadata suggestions are applied if provided
      const categoryField = screen.getByLabelText(/category/i);
      expect(categoryField).toHaveValue('Environmental');
    });

    it('should handle AI content filtering and safety measures', async () => {
      mockAIContentService.generatePolicyDraft.mockResolvedValue({
        title: '[Content filtered - please provide manual title]',
        description_text: 'Policy description with some content filtered for safety',
        confidence: 0.60,
        model: 'gpt-4',
        warning: 'Some content was filtered due to safety guidelines'
      });

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

      const generateButton = screen.getByRole('button', { name: /generate ai draft/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith('Some AI content was filtered. Please review and edit as needed.');
      });

      // Verify filtered content is still usable
      const titleField = screen.getByLabelText(/title/i);
      expect(titleField).toHaveValue('[Content filtered - please provide manual title]');
    });
  });

  describe('AI Service Health and Monitoring', () => {
    it('should check AI service health before making requests', async () => {
      mockAIContentService.checkHealth = vi.fn().mockResolvedValue({
        status: 'healthy',
        response_time: 150,
        available_models: ['gpt-4', 'gpt-3.5-turbo'],
        rate_limit_remaining: 95
      });

      mockAIContentService.generateSummaryPolicy.mockResolvedValue({
        summary_policy_text: 'AI-generated content',
        confidence: 0.9,
        model: 'gpt-4'
      });

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      // Verify health check is performed (if implemented)
      await waitFor(() => {
        if (mockAIContentService.checkHealth) {
          expect(mockAIContentService.checkHealth).toHaveBeenCalled();
        }
        expect(mockAIContentService.generateSummaryPolicy).toHaveBeenCalled();
      });
    });

    it('should handle AI service degraded performance', async () => {
      mockAIContentService.checkHealth = vi.fn().mockResolvedValue({
        status: 'degraded',
        response_time: 5000,
        available_models: ['gpt-3.5-turbo'], // Limited models
        rate_limit_remaining: 10
      });

      mockAIContentService.generateSummaryPolicy.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve({
            summary_policy_text: 'Slower AI response',
            confidence: 0.75,
            model: 'gpt-3.5-turbo'
          }), 3000)
        )
      );

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      // Verify degraded performance warning
      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith('AI service is experiencing slower response times. Please be patient.');
      }, { timeout: 6000 });

      // Verify content is still generated
      await waitFor(() => {
        const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
        expect(summaryPolicyField).toHaveValue('Slower AI response');
      }, { timeout: 6000 });
    });
  });

  describe('AI Fallback Mechanisms', () => {
    it('should provide helpful fallback content when AI is unavailable', async () => {
      mockAIContentService.generateSummaryPolicy.mockRejectedValue(
        new Error('AI service is currently unavailable')
      );

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('AI service is currently unavailable. Please try again later.');
      });

      // Verify fallback guidance is provided (if implemented)
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      const placeholder = summaryPolicyField.getAttribute('placeholder');
      expect(placeholder).toContain('summary'); // Should have helpful placeholder
    });

    it('should maintain full functionality without AI assistance', async () => {
      // Simulate complete AI service failure
      mockAIContentService.generateSummaryPolicy.mockRejectedValue(new Error('Service unavailable'));
      mockAIContentService.generateExplorationSuggestions.mockRejectedValue(new Error('Service unavailable'));
      mockAIContentService.generatePolicyDraft.mockRejectedValue(new Error('Service unavailable'));

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

      // Fill form manually without AI assistance
      const descriptionField = screen.getByLabelText(/state description/i);
      await user.type(descriptionField, 'Manual exploration description');

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      await user.type(summaryPolicyField, 'Manual summary policy');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Verify form submission works without AI
      await waitFor(() => {
        expect(mockActionService.createAction).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Manual exploration description',
            summary_policy_text: 'Manual summary policy'
          })
        );
      });

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe('AI Response Quality and Validation', () => {
    it('should validate AI response quality and provide confidence indicators', async () => {
      mockAIContentService.generateSummaryPolicy.mockResolvedValue({
        summary_policy_text: 'High-quality AI-generated summary with detailed analysis',
        confidence: 0.95,
        model: 'gpt-4',
        tokens_used: 180,
        quality_score: 0.92
      });

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('High-quality AI suggestions generated successfully');
      });

      // Verify quality indicator is shown (if implemented in UI)
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      expect(summaryPolicyField).toHaveValue('High-quality AI-generated summary with detailed analysis');
    });

    it('should handle low-confidence AI responses appropriately', async () => {
      mockAIContentService.generateSummaryPolicy.mockResolvedValue({
        summary_policy_text: 'Low-confidence AI response that may need review',
        confidence: 0.45,
        model: 'gpt-3.5-turbo',
        warning: 'Low confidence response - please review carefully'
      });

      render(
        <TestWrapper>
          <UnifiedActionDialog
            isOpen={true}
            onClose={vi.fn()}
            onSave={vi.fn()}
            isCreating={true}
          />
        </TestWrapper>
      );

      const explorationCheckbox = screen.getByLabelText(/mark as exploration/i);
      await user.click(explorationCheckbox);

      const aiAssistButton = screen.getByRole('button', { name: /get ai suggestions/i });
      await user.click(aiAssistButton);

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith('AI suggestions generated with low confidence. Please review and edit as needed.');
      });

      // Verify content is still provided but with appropriate warning
      const summaryPolicyField = screen.getByLabelText(/summary policy text/i);
      expect(summaryPolicyField).toHaveValue('Low-confidence AI response that may need review');
    });
  });
});