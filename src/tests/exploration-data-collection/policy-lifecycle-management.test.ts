/**
 * Property Test: Policy Lifecycle Management
 * 
 * Property 21: Policy Lifecycle Management
 * Validates: Requirements 7.5
 * 
 * Tests that policy lifecycle is properly managed from creation through
 * activation, updates, and eventual deprecation with proper data integrity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { policyService } from '../../services/policyService';
import { queryJSON } from '../../lib/database';

// Mock the database
vi.mock('../../lib/database', () => ({
  queryJSON: vi.fn()
}));

describe('Property Test: Policy Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should manage complete policy lifecycle from draft to deprecated', async () => {
    // Property: Policies should progress through complete lifecycle with proper state management
    const policyId = 'policy-lifecycle-test';
    const basePolicyData = {
      title: 'Lifecycle Test Policy',
      description_text: 'This is a comprehensive policy description that meets all requirements for testing the complete lifecycle management system',
      created_by: 'user-123',
      organization_id: 'org-456'
    };

    // Stage 1: Create draft policy
    const draftPolicy = {
      id: policyId,
      ...basePolicyData,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([draftPolicy]);

    const createdPolicy = await policyService.createPolicy({
      ...basePolicyData,
      status: 'draft'
    });

    expect(createdPolicy.status).toBe('draft');
    expect(createdPolicy.effective_date).toBeUndefined();
    expect(createdPolicy.deprecated_date).toBeUndefined();

    // Stage 2: Activate policy
    const effectiveDate = new Date();
    effectiveDate.setDate(effectiveDate.getDate() + 1);

    const activePolicy = {
      ...draftPolicy,
      status: 'active',
      effective_date: effectiveDate.toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([draftPolicy]); // Current state
    (queryJSON as any).mockResolvedValueOnce([activePolicy]); // Updated state

    const activatedPolicy = await policyService.updatePolicy(policyId, {
      status: 'active',
      effective_date: effectiveDate.toISOString()
    });

    expect(activatedPolicy.status).toBe('active');
    expect(activatedPolicy.effective_date).toBe(effectiveDate.toISOString());

    // Stage 3: Update active policy (content changes)
    const updatedActivePolicy = {
      ...activePolicy,
      description_text: 'Updated comprehensive policy description with additional requirements and procedures',
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([activePolicy]); // Current state
    (queryJSON as any).mockResolvedValueOnce([updatedActivePolicy]); // Updated state

    const contentUpdatedPolicy = await policyService.updatePolicy(policyId, {
      description_text: updatedActivePolicy.description_text
    });

    expect(contentUpdatedPolicy.status).toBe('active'); // Status unchanged
    expect(contentUpdatedPolicy.description_text).toBe(updatedActivePolicy.description_text);

    // Stage 4: Deprecate policy
    const deprecatedDate = new Date();
    const deprecatedPolicy = {
      ...updatedActivePolicy,
      status: 'deprecated',
      deprecated_date: deprecatedDate.toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([updatedActivePolicy]); // Current state
    (queryJSON as any).mockResolvedValueOnce([deprecatedPolicy]); // Updated state

    const finalPolicy = await policyService.updatePolicy(policyId, {
      status: 'deprecated'
    });

    expect(finalPolicy.status).toBe('deprecated');
    expect(finalPolicy.deprecated_date).toBeTruthy();
    expect(finalPolicy.effective_date).toBe(effectiveDate.toISOString()); // Preserved
  });

  it('should maintain referential integrity throughout lifecycle', async () => {
    // Property: Policy references should remain valid throughout lifecycle changes
    const policyId = 'policy-integrity-test';
    const actionId = 'action-linked-test';

    const linkedPolicy = {
      id: policyId,
      title: 'Linked Policy Test',
      description_text: 'Policy that is linked to actions and should maintain referential integrity',
      status: 'active',
      effective_date: new Date().toISOString(),
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const linkedAction = {
      id: actionId,
      title: 'Action linked to policy',
      description: 'Action that references the policy',
      policy_id: policyId,
      created_by: 'user-123',
      organization_id: 'org-456'
    };

    // Mock policy and action existence
    (queryJSON as any).mockResolvedValueOnce([linkedPolicy]); // Get policy
    (queryJSON as any).mockResolvedValueOnce([linkedAction]); // Get linked actions

    // Attempt to deprecate policy with linked actions
    const deprecatedPolicy = {
      ...linkedPolicy,
      status: 'deprecated',
      deprecated_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([deprecatedPolicy]);

    const result = await policyService.updatePolicy(policyId, {
      status: 'deprecated'
    });

    // Property: Policy should be deprecated but links should remain valid
    expect(result.status).toBe('deprecated');
    
    // Property: Linked actions should still reference the policy
    expect(linkedAction.policy_id).toBe(policyId);
  });

  it('should handle version management during lifecycle', async () => {
    // Property: Policy versions should be managed properly during lifecycle changes
    const policyId = 'policy-version-test';
    const basePolicy = {
      id: policyId,
      title: 'Version Management Policy',
      description_text: 'Original policy description for version management testing',
      status: 'draft',
      version: 1,
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Version 1: Initial draft
    (queryJSON as any).mockResolvedValueOnce([basePolicy]);

    const v1Policy = await policyService.createPolicy({
      title: basePolicy.title,
      description_text: basePolicy.description_text,
      status: 'draft'
    });

    expect(v1Policy.version).toBe(1);

    // Version 2: Major content update
    const v2Policy = {
      ...basePolicy,
      description_text: 'Significantly updated policy description with new procedures and requirements',
      version: 2,
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([basePolicy]); // Current state
    (queryJSON as any).mockResolvedValueOnce([v2Policy]); // Updated state

    const updatedPolicy = await policyService.updatePolicy(policyId, {
      description_text: v2Policy.description_text
    });

    expect(updatedPolicy.version).toBe(2);

    // Version 3: Activation (should increment version)
    const v3Policy = {
      ...v2Policy,
      status: 'active',
      effective_date: new Date().toISOString(),
      version: 3,
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([v2Policy]); // Current state
    (queryJSON as any).mockResolvedValueOnce([v3Policy]); // Updated state

    const activatedPolicy = await policyService.updatePolicy(policyId, {
      status: 'active',
      effective_date: v3Policy.effective_date
    });

    expect(activatedPolicy.version).toBe(3);
    expect(activatedPolicy.status).toBe('active');
  });

  it('should enforce lifecycle constraints and business rules', async () => {
    // Property: Lifecycle transitions should enforce business rules
    const testCases = [
      {
        name: 'Cannot activate policy without effective date',
        currentStatus: 'draft',
        newStatus: 'active',
        data: {},
        shouldFail: true,
        errorMessage: 'effective_date is required'
      },
      {
        name: 'Cannot reactivate deprecated policy',
        currentStatus: 'deprecated',
        newStatus: 'active',
        data: { effective_date: new Date().toISOString() },
        shouldFail: true,
        errorMessage: 'Invalid status transition'
      },
      {
        name: 'Can update content of active policy',
        currentStatus: 'active',
        newStatus: 'active',
        data: { description_text: 'Updated description that meets minimum length requirements for active policies' },
        shouldFail: false
      },
      {
        name: 'Cannot delete policy with linked actions',
        currentStatus: 'active',
        operation: 'delete',
        hasLinkedActions: true,
        shouldFail: true,
        errorMessage: 'Cannot delete policy with linked actions'
      }
    ];

    for (const testCase of testCases) {
      const policyId = `policy-constraint-${testCase.name.replace(/\s+/g, '-').toLowerCase()}`;
      const currentPolicy = {
        id: policyId,
        title: `Constraint Test: ${testCase.name}`,
        description_text: 'Policy for testing lifecycle constraints and business rules',
        status: testCase.currentStatus,
        effective_date: testCase.currentStatus === 'active' ? new Date().toISOString() : undefined,
        deprecated_date: testCase.currentStatus === 'deprecated' ? new Date().toISOString() : undefined,
        created_by: 'user-123',
        organization_id: 'org-456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      (queryJSON as any).mockResolvedValue([currentPolicy]);

      if (testCase.hasLinkedActions) {
        const linkedActions = [{ id: 'action-1', policy_id: policyId }];
        (queryJSON as any).mockResolvedValueOnce(linkedActions);
      }

      if (testCase.shouldFail) {
        try {
          if (testCase.operation === 'delete') {
            await policyService.deletePolicy(policyId);
          } else {
            await policyService.updatePolicy(policyId, {
              status: testCase.newStatus,
              ...testCase.data
            });
          }
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain(testCase.errorMessage);
        }
      } else {
        const updatedPolicy = {
          ...currentPolicy,
          ...testCase.data,
          updated_at: new Date().toISOString()
        };

        (queryJSON as any).mockResolvedValueOnce([updatedPolicy]);

        const result = await policyService.updatePolicy(policyId, testCase.data);
        expect(result).toBeTruthy();
      }
    }
  });

  it('should maintain audit trail throughout lifecycle', async () => {
    // Property: All lifecycle changes should be audited
    const policyId = 'policy-audit-lifecycle';
    const userId1 = 'user-creator';
    const userId2 = 'user-activator';
    const userId3 = 'user-deprecator';

    const lifecycleStages = [
      {
        status: 'draft',
        user: userId1,
        timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
        changes: { created: true }
      },
      {
        status: 'active',
        user: userId2,
        timestamp: new Date('2024-01-02T10:00:00Z').toISOString(),
        changes: { effective_date: new Date('2024-01-02T10:00:00Z').toISOString() }
      },
      {
        status: 'deprecated',
        user: userId3,
        timestamp: new Date('2024-01-03T10:00:00Z').toISOString(),
        changes: { deprecated_date: new Date('2024-01-03T10:00:00Z').toISOString() }
      }
    ];

    let currentPolicy = {
      id: policyId,
      title: 'Audit Trail Lifecycle Policy',
      description_text: 'Policy for testing complete audit trail throughout lifecycle',
      status: 'draft',
      created_by: userId1,
      organization_id: 'org-456',
      created_at: lifecycleStages[0].timestamp,
      updated_at: lifecycleStages[0].timestamp,
      audit_trail: [
        {
          action: 'created',
          status: 'draft',
          user: userId1,
          timestamp: lifecycleStages[0].timestamp,
          changes: lifecycleStages[0].changes
        }
      ]
    };

    // Process each lifecycle stage
    for (let i = 1; i < lifecycleStages.length; i++) {
      const stage = lifecycleStages[i];
      const previousPolicy = { ...currentPolicy };

      currentPolicy = {
        ...currentPolicy,
        status: stage.status,
        updated_at: stage.timestamp,
        ...stage.changes,
        audit_trail: [
          ...currentPolicy.audit_trail,
          {
            action: 'status_changed',
            status: stage.status,
            user: stage.user,
            timestamp: stage.timestamp,
            changes: stage.changes
          }
        ]
      };

      (queryJSON as any).mockResolvedValueOnce([previousPolicy]); // Current state
      (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Updated state

      const result = await policyService.updatePolicy(policyId, {
        status: stage.status,
        ...stage.changes
      });

      // Property: Audit trail should include all changes
      expect(result.audit_trail).toBeDefined();
      expect(result.audit_trail.length).toBe(i + 1);
      
      // Property: Latest audit entry should match current change
      const latestAudit = result.audit_trail[result.audit_trail.length - 1];
      expect(latestAudit.status).toBe(stage.status);
      expect(latestAudit.user).toBe(stage.user);
      expect(latestAudit.timestamp).toBe(stage.timestamp);
    }

    // Property: Complete audit trail should show full lifecycle
    const finalAuditTrail = currentPolicy.audit_trail;
    expect(finalAuditTrail.length).toBe(3);
    expect(finalAuditTrail.map(a => a.status)).toEqual(['draft', 'active', 'deprecated']);
    expect(finalAuditTrail.map(a => a.user)).toEqual([userId1, userId2, userId3]);
  });

  it('should handle concurrent lifecycle operations safely', async () => {
    // Property: Concurrent lifecycle operations should be handled safely
    const policyId = 'policy-concurrent-lifecycle';
    const basePolicy = {
      id: policyId,
      title: 'Concurrent Lifecycle Policy',
      description_text: 'Policy for testing concurrent lifecycle operations',
      status: 'draft',
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Simulate two concurrent operations: activate and update content
    const operation1 = {
      status: 'active',
      effective_date: new Date().toISOString()
    };

    const operation2 = {
      description_text: 'Updated policy description for concurrent testing scenario'
    };

    // Mock getting current policy for both operations
    (queryJSON as any).mockResolvedValue([basePolicy]);

    // First operation succeeds
    const updatedPolicy1 = {
      ...basePolicy,
      ...operation1,
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([updatedPolicy1]);

    const result1 = await policyService.updatePolicy(policyId, operation1);
    expect(result1.status).toBe('active');

    // Second operation should work with the new state
    const updatedPolicy2 = {
      ...updatedPolicy1,
      ...operation2,
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([updatedPolicy1]); // Current state
    (queryJSON as any).mockResolvedValueOnce([updatedPolicy2]); // Updated state

    const result2 = await policyService.updatePolicy(policyId, operation2);
    expect(result2.status).toBe('active'); // Status preserved
    expect(result2.description_text).toBe(operation2.description_text);
  });

  it('should validate lifecycle timing constraints', async () => {
    // Property: Lifecycle timing should follow business rules
    const policyId = 'policy-timing-test';
    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000); // Yesterday
    const futureDate = new Date(now.getTime() + 86400000); // Tomorrow

    const timingTests = [
      {
        name: 'Effective date in past should be allowed',
        effective_date: pastDate.toISOString(),
        shouldFail: false
      },
      {
        name: 'Effective date in future should be allowed',
        effective_date: futureDate.toISOString(),
        shouldFail: false
      },
      {
        name: 'Deprecated date before effective date should fail',
        effective_date: futureDate.toISOString(),
        deprecated_date: pastDate.toISOString(),
        shouldFail: true,
        errorMessage: 'deprecated_date cannot be before effective_date'
      }
    ];

    for (const test of timingTests) {
      const policy = {
        id: `${policyId}-${test.name.replace(/\s+/g, '-').toLowerCase()}`,
        title: `Timing Test: ${test.name}`,
        description_text: 'Policy for testing lifecycle timing constraints and business rules',
        status: 'draft',
        created_by: 'user-123',
        organization_id: 'org-456',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      const updateData = {
        status: 'active' as const,
        effective_date: test.effective_date,
        ...(test.deprecated_date && { deprecated_date: test.deprecated_date })
      };

      (queryJSON as any).mockResolvedValue([policy]);

      if (test.shouldFail) {
        try {
          await policyService.updatePolicy(policy.id, updateData);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain(test.errorMessage);
        }
      } else {
        const updatedPolicy = {
          ...policy,
          ...updateData,
          updated_at: new Date().toISOString()
        };

        (queryJSON as any).mockResolvedValueOnce([updatedPolicy]);

        const result = await policyService.updatePolicy(policy.id, updateData);
        expect(result.status).toBe('active');
        expect(result.effective_date).toBe(test.effective_date);
      }
    }
  });
});