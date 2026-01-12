/**
 * Property Test: Policy Status Validation
 * 
 * Property 7: Policy Status Validation
 * Validates: Requirements 3.3
 * 
 * Tests that policy status transitions are properly validated and enforced
 * according to business rules and organizational requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { policyService } from '../../services/policyService';
import { queryJSON } from '../../lib/database';

// Mock the database
vi.mock('../../lib/database', () => ({
  queryJSON: vi.fn()
}));

describe('Property Test: Policy Status Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enforce valid policy status values', async () => {
    // Property: Only valid status values should be accepted
    const validStatuses = ['draft', 'active', 'deprecated'];
    const invalidStatuses = ['pending', 'inactive', 'archived', 'deleted', '', null, undefined];

    const basePolicyData = {
      title: 'Test Policy',
      description_text: 'Test policy description',
      created_by: 'user-123',
      organization_id: 'org-456'
    };

    // Test valid statuses
    for (const status of validStatuses) {
      const mockPolicyResult = [{
        id: 'policy-123',
        ...basePolicyData,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }];

      (queryJSON as any).mockResolvedValueOnce(mockPolicyResult);

      const result = await policyService.createPolicy({
        ...basePolicyData,
        status
      });

      // Property: Valid statuses should be accepted
      expect(result).toBeTruthy();
      expect(result.status).toBe(status);
    }

    // Test invalid statuses
    for (const status of invalidStatuses) {
      try {
        await policyService.createPolicy({
          ...basePolicyData,
          status
        });
        
        // Property: Invalid statuses should be rejected
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toContain('Invalid policy status');
      }
    }
  });

  it('should enforce valid status transitions', async () => {
    // Property: Status transitions should follow business rules
    const validTransitions = [
      { from: 'draft', to: 'active' },
      { from: 'draft', to: 'deprecated' },
      { from: 'active', to: 'deprecated' }
    ];

    const invalidTransitions = [
      { from: 'deprecated', to: 'active' },
      { from: 'deprecated', to: 'draft' },
      { from: 'active', to: 'draft' }
    ];

    const existingPolicy = {
      id: 'policy-transition-test',
      title: 'Transition Test Policy',
      description_text: 'Policy for testing status transitions',
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Test valid transitions
    for (const transition of validTransitions) {
      const currentPolicy = { ...existingPolicy, status: transition.from };
      const updatedPolicy = { ...existingPolicy, status: transition.to, updated_at: new Date().toISOString() };

      // Mock getting current policy
      (queryJSON as any).mockResolvedValueOnce([currentPolicy]);
      // Mock successful update
      (queryJSON as any).mockResolvedValueOnce([updatedPolicy]);

      const result = await policyService.updatePolicy(existingPolicy.id, {
        status: transition.to
      });

      // Property: Valid transitions should succeed
      expect(result).toBeTruthy();
      expect(result.status).toBe(transition.to);
    }

    // Test invalid transitions
    for (const transition of invalidTransitions) {
      const currentPolicy = { ...existingPolicy, status: transition.from };

      // Mock getting current policy
      (queryJSON as any).mockResolvedValueOnce([currentPolicy]);

      try {
        await policyService.updatePolicy(existingPolicy.id, {
          status: transition.to
        });
        
        // Property: Invalid transitions should be rejected
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toContain('Invalid status transition');
      }
    }
  });

  it('should validate status-dependent field requirements', async () => {
    // Property: Different statuses may have different field requirements
    const basePolicyData = {
      title: 'Status Validation Policy',
      description_text: 'Policy for testing status-dependent validation',
      created_by: 'user-123',
      organization_id: 'org-456'
    };

    // Draft policies should allow minimal fields
    const draftPolicy = {
      ...basePolicyData,
      status: 'draft'
    };

    const mockDraftResult = [{
      id: 'policy-draft',
      ...draftPolicy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];

    (queryJSON as any).mockResolvedValueOnce(mockDraftResult);

    const draftResult = await policyService.createPolicy(draftPolicy);
    expect(draftResult).toBeTruthy();
    expect(draftResult.status).toBe('draft');

    // Active policies should require effective_date
    const activePolicyWithoutDate = {
      ...basePolicyData,
      status: 'active'
    };

    try {
      await policyService.createPolicy(activePolicyWithoutDate);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('effective_date is required for active policies');
    }

    // Active policies with effective_date should succeed
    const activePolicyWithDate = {
      ...basePolicyData,
      status: 'active',
      effective_date: new Date().toISOString()
    };

    const mockActiveResult = [{
      id: 'policy-active',
      ...activePolicyWithDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];

    (queryJSON as any).mockResolvedValueOnce(mockActiveResult);

    const activeResult = await policyService.createPolicy(activePolicyWithDate);
    expect(activeResult).toBeTruthy();
    expect(activeResult.status).toBe('active');
    expect(activeResult.effective_date).toBeTruthy();
  });

  it('should handle concurrent status updates safely', async () => {
    // Property: Concurrent status updates should be handled safely
    const policyId = 'policy-concurrent-test';
    const basePolicy = {
      id: policyId,
      title: 'Concurrent Update Test',
      description_text: 'Policy for testing concurrent updates',
      status: 'draft',
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Simulate concurrent updates
    const updates = [
      { status: 'active', effective_date: new Date().toISOString() },
      { status: 'deprecated', deprecated_date: new Date().toISOString() }
    ];

    // Mock getting current policy for both updates
    (queryJSON as any).mockResolvedValue([basePolicy]);

    // Mock successful update for first request
    const firstUpdateResult = {
      ...basePolicy,
      status: 'active',
      effective_date: updates[0].effective_date,
      updated_at: new Date().toISOString()
    };
    (queryJSON as any).mockResolvedValueOnce([firstUpdateResult]);

    // First update should succeed
    const firstResult = await policyService.updatePolicy(policyId, updates[0]);
    expect(firstResult.status).toBe('active');

    // Second update should fail due to changed status
    try {
      await policyService.updatePolicy(policyId, updates[1]);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('Invalid status transition');
    }
  });

  it('should validate status-specific date requirements', async () => {
    // Property: Status changes should validate associated date fields
    const policyId = 'policy-date-validation';
    const basePolicy = {
      id: policyId,
      title: 'Date Validation Policy',
      description_text: 'Policy for testing date validation',
      status: 'draft',
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mock getting current policy
    (queryJSON as any).mockResolvedValue([basePolicy]);

    // Activating policy without effective_date should fail
    try {
      await policyService.updatePolicy(policyId, { status: 'active' });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('effective_date is required');
    }

    // Activating policy with future effective_date should succeed
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    
    const mockActiveResult = {
      ...basePolicy,
      status: 'active',
      effective_date: futureDate.toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([mockActiveResult]);

    const activeResult = await policyService.updatePolicy(policyId, {
      status: 'active',
      effective_date: futureDate.toISOString()
    });

    expect(activeResult.status).toBe('active');
    expect(activeResult.effective_date).toBe(futureDate.toISOString());

    // Deprecating policy should set deprecated_date
    const mockDeprecatedResult = {
      ...mockActiveResult,
      status: 'deprecated',
      deprecated_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([mockActiveResult]); // Current state
    (queryJSON as any).mockResolvedValueOnce([mockDeprecatedResult]); // Updated state

    const deprecatedResult = await policyService.updatePolicy(policyId, {
      status: 'deprecated'
    });

    expect(deprecatedResult.status).toBe('deprecated');
    expect(deprecatedResult.deprecated_date).toBeTruthy();
  });

  it('should maintain status history and audit trail', async () => {
    // Property: Status changes should be tracked for audit purposes
    const policyId = 'policy-audit-test';
    const basePolicy = {
      id: policyId,
      title: 'Audit Trail Policy',
      description_text: 'Policy for testing audit trail',
      status: 'draft',
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mock status transition from draft to active
    (queryJSON as any).mockResolvedValueOnce([basePolicy]); // Get current
    
    const activePolicy = {
      ...basePolicy,
      status: 'active',
      effective_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status_history: [
        {
          status: 'draft',
          changed_at: basePolicy.created_at,
          changed_by: basePolicy.created_by
        },
        {
          status: 'active',
          changed_at: new Date().toISOString(),
          changed_by: 'user-456'
        }
      ]
    };

    (queryJSON as any).mockResolvedValueOnce([activePolicy]); // Updated result

    const result = await policyService.updatePolicy(policyId, {
      status: 'active',
      effective_date: new Date().toISOString()
    });

    // Property: Status history should be maintained
    expect(result.status_history).toBeDefined();
    expect(Array.isArray(result.status_history)).toBe(true);
    expect(result.status_history.length).toBeGreaterThan(1);
    
    // Property: History should include previous and current status
    const statuses = result.status_history.map(h => h.status);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('active');
  });

  it('should validate business rules for policy activation', async () => {
    // Property: Policy activation should follow business rules
    const testCases = [
      {
        name: 'Policy with incomplete description',
        policy: {
          title: 'Incomplete Policy',
          description_text: 'Too short', // Less than minimum required
          status: 'active',
          effective_date: new Date().toISOString()
        },
        shouldFail: true,
        errorMessage: 'description_text must be at least 50 characters for active policies'
      },
      {
        name: 'Policy with past effective date',
        policy: {
          title: 'Past Date Policy',
          description_text: 'This policy has a comprehensive description that meets the minimum length requirements for activation',
          status: 'active',
          effective_date: new Date(Date.now() - 86400000).toISOString() // Yesterday
        },
        shouldFail: false // Past dates should be allowed for retroactive policies
      },
      {
        name: 'Policy with valid future date',
        policy: {
          title: 'Future Policy',
          description_text: 'This policy has a comprehensive description that meets the minimum length requirements for activation',
          status: 'active',
          effective_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        },
        shouldFail: false
      }
    ];

    for (const testCase of testCases) {
      const policyData = {
        ...testCase.policy,
        created_by: 'user-123',
        organization_id: 'org-456'
      };

      if (testCase.shouldFail) {
        try {
          await policyService.createPolicy(policyData);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain(testCase.errorMessage);
        }
      } else {
        const mockResult = [{
          id: 'policy-business-rule-test',
          ...policyData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }];

        (queryJSON as any).mockResolvedValueOnce(mockResult);

        const result = await policyService.createPolicy(policyData);
        expect(result).toBeTruthy();
        expect(result.status).toBe('active');
      }
    }
  });
});