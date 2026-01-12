/**
 * Unit Tests for ExplorationTab Component
 * 
 * Tests exploration tab functionality including:
 * - Field editing and saving
 * - AI suggestion functionality  
 * - Conditional display logic
 * 
 * Requirements: 2.6, 2.7, 2.8, 6.3, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorationTab } from '@/components/ExplorationTab';
import { ExplorationService } from '@/services/explorationService';
import { AIContentService } from '@/services/aiContentService';
import { BaseAction } from '@/types/actions';

// Mock the services
vi.mock('@/services/explorationService');
vi.mock('@/services/aiContentService');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const MockedExplorationService = ExplorationService as vi.MockedClass<typeof ExplorationService>;
const MockedAIContentService = AIContentService as vi.MockedClass<typeof AIContentService>;

describe('ExplorationTab Component', () => {
  let queryClient: QueryClient;
  let mockExplorationService: any;
  let mockAIContentService: any;
  
  const mockAction: BaseAction = {
    id: 'test-action-1',
    title: 'Test Action',
    description: 'Test action description',
    policy: 'Test policy content',
    summary_policy_text: 'Test summary policy',
    status: 'in_progress',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockExploration = {
    id: 1,
    action_id: 'test-action-1',
    exploration_code: 'SF010124EX001',
    exploration_notes_text: 'Initial exploration notes',
    metrics_text: 'Initial metrics data',
    public_flag: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // Reset mocks
    vi.clearAllMocks();
    
    // Setup service mocks
    mockExplorationService = {
      getExplorationByActionId: vi.fn(),
      updateExploration: vi.fn()
    };
    
    mockAIContentService = {
      generateExplorationSuggestions: vi.fn()
    };

    MockedExplorationService.mockImplementation(() => mockExplorationService);
    MockedAIContentService.mockImplementation(() => mockAIContentService);
  });

  const renderExplorationTab = (action = mockAction, onUpdate?: () => void) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ExplorationTab action={action} onUpdate={onUpdate} />
      </QueryClientProvider>
    );
  };

  describe('Loading and Display', () => {
    it('shows loading state initially', async () => {
      mockExplorationService.getExplorationByActionId.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockExploration), 100))
      );

      renderExplorationTab();
      
      expect(screen.getByText('Loading exploration data...')).toBeInTheDocument();
    });

    it('displays exploration data when loaded', async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('SF010124EX001')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Initial exploration notes')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Initial metrics data')).toBeInTheDocument();
      });
    });

    it('shows no exploration data message when exploration does not exist', async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(null);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('No Exploration Data')).toBeInTheDocument();
        expect(screen.getByText(/This action doesn't have exploration data/)).toBeInTheDocument();
      });
    });
  });

  describe('Field Editing', () => {
    beforeEach(async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
    });

    it('allows editing exploration notes', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Initial exploration notes')).toBeInTheDocument();
      });

      const notesTextarea = screen.getByLabelText('Exploration Notes');
      fireEvent.change(notesTextarea, { target: { value: 'Updated exploration notes' } });
      
      expect(notesTextarea).toHaveValue('Updated exploration notes');
      
      // Save button should appear when there are changes
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });

    it('allows editing metrics text', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Initial metrics data')).toBeInTheDocument();
      });

      const metricsTextarea = screen.getByLabelText('Metrics & Measurements');
      fireEvent.change(metricsTextarea, { target: { value: 'Updated metrics data' } });
      
      expect(metricsTextarea).toHaveValue('Updated metrics data');
      
      // Save button should appear when there are changes
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });

    it('allows toggling public flag', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByRole('switch')).toBeInTheDocument();
      });

      const publicSwitch = screen.getByRole('switch');
      expect(publicSwitch).not.toBeChecked();
      
      fireEvent.click(publicSwitch);
      expect(publicSwitch).toBeChecked();
      
      // Save button should appear when there are changes
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });
  });

  describe('Saving Changes', () => {
    beforeEach(async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
      mockExplorationService.updateExploration.mockResolvedValue({
        ...mockExploration,
        exploration_notes_text: 'Updated notes',
        updated_at: '2024-01-02T00:00:00Z'
      });
    });

    it('saves changes when save button is clicked', async () => {
      const onUpdate = vi.fn();
      renderExplorationTab(mockAction, onUpdate);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Initial exploration notes')).toBeInTheDocument();
      });

      // Make a change
      const notesTextarea = screen.getByLabelText('Exploration Notes');
      fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } });
      
      // Click save
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalledWith(1, {
          exploration_notes_text: 'Updated notes',
          metrics_text: 'Initial metrics data',
          public_flag: false
        });
        expect(onUpdate).toHaveBeenCalled();
      });
    });

    it('shows loading state while saving', async () => {
      mockExplorationService.updateExploration.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Initial exploration notes')).toBeInTheDocument();
      });

      // Make a change
      const notesTextarea = screen.getByLabelText('Exploration Notes');
      fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } });
      
      // Click save
      const saveButton = await screen.findByText('Save Changes');
      fireEvent.click(saveButton);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  describe('AI Suggestions', () => {
    beforeEach(async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
    });

    it('generates AI suggestions when button is clicked', async () => {
      const mockAIResponse = {
        content: {
          exploration_notes_text: 'AI generated exploration notes',
          metrics_text: 'AI generated metrics',
          suggested_measurements: ['Temperature', 'Humidity'],
          comparison_areas: ['Control area A', 'Control area B'],
          documentation_tips: ['Take photos', 'Record GPS coordinates']
        },
        confidence: 0.85,
        model_used: 'gpt-4',
        generated_at: '2024-01-01T00:00:00Z',
        context_used: ['action_context', 'similar_explorations']
      };

      mockAIContentService.generateExplorationSuggestions.mockResolvedValue(mockAIResponse);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Get AI Suggestions')).toBeInTheDocument();
      });

      const aiButton = screen.getByText('Get AI Suggestions');
      fireEvent.click(aiButton);
      
      await waitFor(() => {
        expect(mockAIContentService.generateExplorationSuggestions).toHaveBeenCalledWith({
          action_id: 'test-action-1',
          state_text: 'Test action description',
          policy_text: 'Test policy content',
          summary_policy_text: 'Test summary policy',
          existing_exploration_notes: 'Initial exploration notes',
          existing_metrics: 'Initial metrics data'
        });
      });
    });

    it('shows loading state while generating AI suggestions', async () => {
      mockAIContentService.generateExplorationSuggestions.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Get AI Suggestions')).toBeInTheDocument();
      });

      const aiButton = screen.getByText('Get AI Suggestions');
      fireEvent.click(aiButton);
      
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    it('handles AI service unavailability gracefully', async () => {
      mockAIContentService.generateExplorationSuggestions.mockResolvedValue(null);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Get AI Suggestions')).toBeInTheDocument();
      });

      const aiButton = screen.getByText('Get AI Suggestions');
      fireEvent.click(aiButton);
      
      await waitFor(() => {
        expect(mockAIContentService.generateExplorationSuggestions).toHaveBeenCalled();
      });
    });

    it('only fills empty fields with AI suggestions', async () => {
      // Start with empty exploration data
      const emptyExploration = {
        ...mockExploration,
        exploration_notes_text: '',
        metrics_text: ''
      };
      
      mockExplorationService.getExplorationByActionId.mockResolvedValue(emptyExploration);
      
      const mockAIResponse = {
        content: {
          exploration_notes_text: 'AI generated notes',
          metrics_text: 'AI generated metrics'
        }
      };
      
      mockAIContentService.generateExplorationSuggestions.mockResolvedValue(mockAIResponse);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByLabelText('Exploration Notes')).toHaveValue('');
      });

      // Manually add some notes
      const notesTextarea = screen.getByLabelText('Exploration Notes');
      fireEvent.change(notesTextarea, { target: { value: 'Manual notes' } });
      
      // Click AI suggestions
      const aiButton = screen.getByText('Get AI Suggestions');
      fireEvent.click(aiButton);
      
      await waitFor(() => {
        // Notes should not be overwritten (already has content)
        expect(screen.getByLabelText('Exploration Notes')).toHaveValue('Manual notes');
        // Metrics should be filled (was empty)
        expect(screen.getByLabelText('Metrics & Measurements')).toHaveValue('AI generated metrics');
      });
    });
  });

  describe('Conditional Display Logic', () => {
    it('does not render when action has no ID', () => {
      const actionWithoutId = { ...mockAction, id: undefined } as any;
      mockExplorationService.getExplorationByActionId.mockResolvedValue(null);

      renderExplorationTab(actionWithoutId);
      
      // Should show loading initially, then no exploration data
      expect(screen.getByText('Loading exploration data...')).toBeInTheDocument();
    });

    it('displays metadata information', async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText(/Created:/)).toBeInTheDocument();
        expect(screen.getByText(/Last Updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles exploration loading errors gracefully', async () => {
      mockExplorationService.getExplorationByActionId.mockRejectedValue(new Error('Network error'));

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('No Exploration Data')).toBeInTheDocument();
      });
    });

    it('handles save errors gracefully', async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
      mockExplorationService.updateExploration.mockRejectedValue(new Error('Save failed'));

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Initial exploration notes')).toBeInTheDocument();
      });

      // Make a change
      const notesTextarea = screen.getByLabelText('Exploration Notes');
      fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } });
      
      // Click save
      const saveButton = await screen.findByText('Save Changes');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalled();
      });
    });

    it('handles AI generation errors gracefully', async () => {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);
      mockAIContentService.generateExplorationSuggestions.mockRejectedValue(new Error('AI service error'));

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Get AI Suggestions')).toBeInTheDocument();
      });

      const aiButton = screen.getByText('Get AI Suggestions');
      fireEvent.click(aiButton);
      
      await waitFor(() => {
        expect(mockAIContentService.generateExplorationSuggestions).toHaveBeenCalled();
      });
    });
  });
});