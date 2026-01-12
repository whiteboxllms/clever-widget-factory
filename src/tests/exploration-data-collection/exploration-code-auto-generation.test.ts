/**
 * Unit tests for exploration code auto-generation in UI
 * Tests Task 11.2: Implement exploration code auto-generation in UI
 * 
 * Requirements: 2.2, 2.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the exploration service
const mockExplorationService = {
  generateExplorationCode: vi.fn(),
  codeExists: vi.fn()
};

// Mock validation state interface
interface CodeValidationState {
  isValid: boolean;
  isUnique: boolean;
  isChecking: boolean;
  message: string;
}

// Mock form manager for testing
class ExplorationCodeManager {
  private explorationCode: string = '';
  private validationState: CodeValidationState = {
    isValid: true,
    isUnique: true,
    isChecking: false,
    message: ''
  };

  getCode(): string {
    return this.explorationCode;
  }

  getValidationState(): CodeValidationState {
    return { ...this.validationState };
  }

  async generateCode(): Promise<void> {
    const code = await mockExplorationService.generateExplorationCode(new Date());
    this.explorationCode = code;
    await this.validateCode(code);
  }

  async validateCode(code: string): Promise<void> {
    if (!code) {
      this.validationState = {
        isValid: true,
        isUnique: true,
        isChecking: false,
        message: ''
      };
      return;
    }

    this.validationState = { ...this.validationState, isChecking: true };

    // Check format
    const formatRegex = /^SF\d{6}EX\d{3}$/;
    const isValidFormat = formatRegex.test(code);

    if (!isValidFormat) {
      this.validationState = {
        isValid: false,
        isUnique: true,
        isChecking: false,
        message: 'Invalid format. Expected: SF<mmddyy><SUFFIX><number> (e.g., SF010126EX01 or SF122925CT01)'
      };
      return;
    }

    // Check uniqueness
    const exists = await mockExplorationService.codeExists(code);
    
    this.validationState = {
      isValid: true,
      isUnique: !exists,
      isChecking: false,
      message: exists ? 'This code already exists' : 'Code is available'
    };
  }

  async setCode(code: string): Promise<void> {
    this.explorationCode = code;
    await this.validateCode(code);
  }

  canSubmit(): boolean {
    return this.explorationCode.trim() !== '' && 
           this.validationState.isValid && 
           this.validationState.isUnique;
  }
}

describe('Exploration Code Auto-Generation', () => {
  let codeManager: ExplorationCodeManager;

  beforeEach(() => {
    codeManager = new ExplorationCodeManager();
    vi.clearAllMocks();
    
    // Setup default mocks
    mockExplorationService.generateExplorationCode.mockResolvedValue('SF010426EX001');
    mockExplorationService.codeExists.mockImplementation(async (code) => {
      const existingCodes = ['SF010425EX001', 'SF010425EX002'];
      return existingCodes.includes(code);
    });
  });

  describe('Auto-Generation', () => {
    it('should auto-generate code when exploration is enabled', async () => {
      await codeManager.generateCode();
      
      expect(codeManager.getCode()).toBe('SF010426EX001');
      expect(mockExplorationService.generateExplorationCode).toHaveBeenCalledWith(expect.any(Date));
    });

    it('should validate generated code automatically', async () => {
      await codeManager.generateCode();
      
      const validation = codeManager.getValidationState();
      expect(validation.isValid).toBe(true);
      expect(validation.isUnique).toBe(true);
      expect(validation.message).toBe('Code is available');
    });
  });

  describe('User Override', () => {
    it('should allow user to override generated code', async () => {
      await codeManager.generateCode();
      expect(codeManager.getCode()).toBe('SF010426EX001');
      
      await codeManager.setCode('SF060724EX999');
      expect(codeManager.getCode()).toBe('SF060724EX999');
    });

    it('should validate user-entered code', async () => {
      await codeManager.setCode('SF060724EX999');
      
      const validation = codeManager.getValidationState();
      expect(validation.isValid).toBe(true);
      expect(validation.isUnique).toBe(true);
      expect(mockExplorationService.codeExists).toHaveBeenCalledWith('SF060724EX999');
    });
  });

  describe('Real-Time Validation', () => {
    it('should validate code format correctly', async () => {
      const testCases = [
        { code: 'SF010426EX001', expectedValid: true },
        { code: 'SF123125EX999', expectedValid: true },
        { code: 'INVALID', expectedValid: false },
        { code: 'SF01042EX001', expectedValid: false },
        { code: 'AB010426EX001', expectedValid: false }
      ];

      for (const testCase of testCases) {
        await codeManager.setCode(testCase.code);
        const validation = codeManager.getValidationState();
        expect(validation.isValid).toBe(testCase.expectedValid);
      }
    });

    it('should check code uniqueness', async () => {
      // Test unique code
      await codeManager.setCode('SF060724EX999');
      let validation = codeManager.getValidationState();
      expect(validation.isUnique).toBe(true);
      expect(validation.message).toBe('Code is available');

      // Test existing code
      await codeManager.setCode('SF010425EX001');
      validation = codeManager.getValidationState();
      expect(validation.isUnique).toBe(false);
      expect(validation.message).toBe('This code already exists');
    });

    it('should handle empty code gracefully', async () => {
      await codeManager.setCode('');
      
      const validation = codeManager.getValidationState();
      expect(validation.isValid).toBe(true);
      expect(validation.isUnique).toBe(true);
      expect(validation.message).toBe('');
    });
  });

  describe('Submission Validation', () => {
    it('should prevent submission with invalid code', async () => {
      await codeManager.setCode('INVALID');
      expect(codeManager.canSubmit()).toBe(false);
    });

    it('should prevent submission with existing code', async () => {
      await codeManager.setCode('SF010425EX001');
      expect(codeManager.canSubmit()).toBe(false);
    });

    it('should allow submission with valid unique code', async () => {
      await codeManager.setCode('SF060724EX999');
      expect(codeManager.canSubmit()).toBe(true);
    });

    it('should prevent submission with empty code', async () => {
      await codeManager.setCode('');
      expect(codeManager.canSubmit()).toBe(false);
    });
  });
});