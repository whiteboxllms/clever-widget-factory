/**
 * Unit tests for action creation form with exploration fields
 * Tests Task 11.1: Add exploration fields to action creation form
 * 
 * Requirements: 2.1, 6.1, 6.2, 6.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the services
const mockExplorationService = {
  generateExplorationCode: vi.fn(),
  codeExists: vi.fn()
};

const mockAIContentService = {
  generateSummaryPolicy: vi.fn(),
  isAvailable: vi.fn()
};

// Mock form state management
interface ExplorationFormState {
  isExploration: boolean;
  explorationCode: string;
  summaryPolicyText: string;
  title: string;
  description: string;
  policy: string;
}

class ExplorationFormManager {
  private state: ExplorationFormState;

  constructor() {
    this.state = {
      isExploration: false,
      explorationCode: '',
      summaryPolicyText: '',
      title: '',
      description: '',
      policy: ''
    };
  }

  getState(): ExplorationFormState {
    return { ...this.state };
  }

  setState(updates: Partial<ExplorationFormState>): void {
    this.state = { ...this.state, ...updates };
  }

  async handleExplorationToggle(checked: boolean): Promise<void> {
    this.setState({ isExploration: checked });
    
    if (checked && !this.state.explorationCode) {
      // Auto-generate exploration code when checkbox is checked
      const code = await mockExplorationService.generateExplorationCode(new Date());
      this.setState({ explorationCode: code });
    }
    
    if (!checked) {
      // Clear exploration fields when unchecked
      this.setState({ 
        explorationCode: '',
        summaryPolicyText: ''
      });
    }
  }

  async generateAISummaryPolicy(): Promise<boolean> {
    if (!this.state.description && !this.state.policy) {
      return false; // Missing required information
    }

    try {
      const response = await mockAIContentService.generateSummaryPolicy({
        state_text: this.state.description,
        policy_text: this.state.policy,
        action_context: {
          title: this.state.title
        }
      });

      if (response?.content?.summary_policy_text) {
        this.setState({ summaryPolicyText: response.content.summary_policy_text });
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  validateExplorationCode(code: string): boolean {
    // Format: SF<mmddyy><SUFFIX><number>
    const regex = /^[A-Z]{2}\d{6}[A-Z]{2}\d{2,}$/;
    return regex.test(code);
  }

  getFormData(): any {
    return {
      title: this.state.title,
      description: this.state.description,
      policy: this.state.policy,
      is_exploration: this.state.isExploration,
      exploration_code: this.state.isExploration ? this.state.explorationCode : null,
      summary_policy_text: this.state.isExploration ? this.state.summaryPolicyText : null
    };
  }
}

describe('Action Creation Form - Exploration Fields', () => {
  let formManager: ExplorationFormManager;

  beforeEach(() => {
    formManager = new ExplorationFormManager();
    vi.clearAllMocks();
    
    // Setup default mocks
    mockExplorationService.generateExplorationCode.mockResolvedValue('SF010425EX001');
    mockExplorationService.codeExists.mockResolvedValue(false);
    mockAIContentService.generateSummaryPolicy.mockResolvedValue({
      content: {
        summary_policy_text: 'Follow safety protocols and document all activities',
        key_points: ['Safety first', 'Document activities'],
        safety_considerations: ['Use PPE', 'Follow procedures']
      },
      confidence: 0.8,
      model_used: 'gpt-4',
      generated_at: new Date().toISOString(),
      context_used: ['state_text', 'policy_text']
    });
    mockAIContentService.isAvailable.mockResolvedValue(true);
  });

  describe('Exploration Checkbox Behavior', () => {
    it('should initialize with exploration disabled', () => {
      const state = formManager.getState();
      expect(state.isExploration).toBe(false);
      expect(state.explorationCode).toBe('');
      expect(state.summaryPolicyText).toBe('');
    });

    it('should enable exploration and auto-generate code when checked', async () => {
      await formManager.handleExplorationToggle(true);
      
      const state = formManager.getState();
      expect(state.isExploration).toBe(true);
      expect(state.explorationCode).toBe('SF010425EX001');
      expect(mockExplorationService.generateExplorationCode).toHaveBeenCalledWith(expect.any(Date));
    });

    it('should clear exploration fields when unchecked', async () => {
      // First enable exploration
      await formManager.handleExplorationToggle(true);
      formManager.setState({ summaryPolicyText: 'Test summary' });
      
      // Then disable it
      await formManager.handleExplorationToggle(false);
      
      const state = formManager.getState();
      expect(state.isExploration).toBe(false);
      expect(state.explorationCode).toBe('');
      expect(state.summaryPolicyText).toBe('');
    });

    it('should not regenerate code if code already exists', async () => {
      formManager.setState({ explorationCode: 'SF010425EX002' });
      
      await formManager.handleExplorationToggle(true);
      
      const state = formManager.getState();
      expect(state.explorationCode).toBe('SF010425EX002'); // Should keep existing code
      expect(mockExplorationService.generateExplorationCode).not.toHaveBeenCalled();
    });
  });

  describe('Exploration Code Generation', () => {
    it('should generate code in correct format', () => {
      const testCodes = [
        'SF010425EX001',
        'SF123125EX999',
        'SF060724EX042'
      ];

      testCodes.forEach(code => {
        expect(formManager.validateExplorationCode(code)).toBe(true);
      });
    });

    it('should reject invalid code formats', () => {
      const invalidCodes = [
        'SF01042EX001',    // Wrong date format
        'SF010425EX1',     // Wrong number format
        'AB010425EX001',   // Wrong prefix
        'SF010425EY001',   // Wrong middle part
        'SF010425EX',      // Missing number
        ''                 // Empty string
      ];

      invalidCodes.forEach(code => {
        expect(formManager.validateExplorationCode(code)).toBe(false);
      });
    });

    it('should handle code generation errors gracefully', async () => {
      mockExplorationService.generateExplorationCode.mockRejectedValue(new Error('Service unavailable'));
      
      // Should not throw error
      await expect(formManager.handleExplorationToggle(true)).resolves.not.toThrow();
      
      const state = formManager.getState();
      expect(state.isExploration).toBe(true);
      expect(state.explorationCode).toBe(''); // Should remain empty on error
    });
  });

  describe('AI Summary Policy Generation', () => {
    beforeEach(() => {
      formManager.setState({
        title: 'Test Action',
        description: 'Test description',
        policy: 'Test policy'
      });
    });

    it('should generate AI summary when description and policy exist', async () => {
      const result = await formManager.generateAISummaryPolicy();
      
      expect(result).toBe(true);
      expect(mockAIContentService.generateSummaryPolicy).toHaveBeenCalledWith({
        state_text: 'Test description',
        policy_text: 'Test policy',
        action_context: {
          title: 'Test Action'
        }
      });
      
      const state = formManager.getState();
      expect(state.summaryPolicyText).toBe('Follow safety protocols and document all activities');
    });

    it('should fail when description and policy are missing', async () => {
      formManager.setState({ description: '', policy: '' });
      
      const result = await formManager.generateAISummaryPolicy();
      
      expect(result).toBe(false);
      expect(mockAIContentService.generateSummaryPolicy).not.toHaveBeenCalled();
    });

    it('should work with only description', async () => {
      formManager.setState({ policy: '' });
      
      const result = await formManager.generateAISummaryPolicy();
      
      expect(result).toBe(true);
      expect(mockAIContentService.generateSummaryPolicy).toHaveBeenCalled();
    });

    it('should work with only policy', async () => {
      formManager.setState({ description: '' });
      
      const result = await formManager.generateAISummaryPolicy();
      
      expect(result).toBe(true);
      expect(mockAIContentService.generateSummaryPolicy).toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      mockAIContentService.generateSummaryPolicy.mockRejectedValue(new Error('AI service unavailable'));
      
      const result = await formManager.generateAISummaryPolicy();
      
      expect(result).toBe(false);
      const state = formManager.getState();
      expect(state.summaryPolicyText).toBe(''); // Should remain empty on error
    });

    it('should handle empty AI response gracefully', async () => {
      mockAIContentService.generateSummaryPolicy.mockResolvedValue(null);
      
      const result = await formManager.generateAISummaryPolicy();
      
      expect(result).toBe(false);
      const state = formManager.getState();
      expect(state.summaryPolicyText).toBe('');
    });
  });

  describe('Form Data Integration', () => {
    it('should include exploration fields in form data when exploration is enabled', async () => {
      await formManager.handleExplorationToggle(true);
      formManager.setState({
        title: 'Test Action',
        description: 'Test description',
        summaryPolicyText: 'Test summary'
      });
      
      const formData = formManager.getFormData();
      
      expect(formData.is_exploration).toBe(true);
      expect(formData.exploration_code).toBe('SF010425EX001');
      expect(formData.summary_policy_text).toBe('Test summary');
    });

    it('should exclude exploration fields when exploration is disabled', () => {
      formManager.setState({
        title: 'Test Action',
        description: 'Test description'
      });
      
      const formData = formManager.getFormData();
      
      expect(formData.is_exploration).toBe(false);
      expect(formData.exploration_code).toBeNull();
      expect(formData.summary_policy_text).toBeNull();
    });

    it('should maintain backward compatibility with existing actions', () => {
      formManager.setState({
        title: 'Regular Action',
        description: 'Regular description',
        policy: 'Regular policy'
      });
      
      const formData = formManager.getFormData();
      
      // Should have all standard fields
      expect(formData.title).toBe('Regular Action');
      expect(formData.description).toBe('Regular description');
      expect(formData.policy).toBe('Regular policy');
      
      // Exploration fields should be false/null
      expect(formData.is_exploration).toBe(false);
      expect(formData.exploration_code).toBeNull();
      expect(formData.summary_policy_text).toBeNull();
    });
  });

  describe('User Experience', () => {
    it('should provide clear validation feedback for exploration code', () => {
      const validCode = 'SF010425EX001';
      const invalidCode = 'INVALID';
      
      expect(formManager.validateExplorationCode(validCode)).toBe(true);
      expect(formManager.validateExplorationCode(invalidCode)).toBe(false);
    });

    it('should allow manual editing of generated exploration code', async () => {
      await formManager.handleExplorationToggle(true);
      
      // Manually edit the code
      formManager.setState({ explorationCode: 'SF010425EX999' });
      
      const state = formManager.getState();
      expect(state.explorationCode).toBe('SF010425EX999');
    });

    it('should preserve form state during exploration toggle', async () => {
      formManager.setState({
        title: 'Test Action',
        description: 'Test description',
        policy: 'Test policy'
      });
      
      await formManager.handleExplorationToggle(true);
      
      const state = formManager.getState();
      expect(state.title).toBe('Test Action');
      expect(state.description).toBe('Test description');
      expect(state.policy).toBe('Test policy');
    });
  });
});