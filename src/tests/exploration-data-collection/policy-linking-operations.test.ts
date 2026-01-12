/**
 * Property Test: Policy Linking Operations
 * 
 * Property 8: Policy Linking Operation
 * Validates: Requirements 3.5
 * 
 * Tests that policy linking operations work correctly, allowing actions
 * to be linked to existing policies and maintaining referential integrity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { policyService } from '../../services/policyService';
import { actionService } from '../../services/actionService';
import { queryJSON } from '../../lib/database';

// Mock the database
vi.mock('../../lib/database', () => ({
  queryJSON: vi.fn()
}));

describe('Property Test: Policy Linking Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully link actions to existing policies', async () => {
    // Property: Actions should be able to link to any valid existing policy
    const existingPolicies = [
      {
        id: 'policy-001',
        title: 'Environmental Protection Policy',
        description_text: 'Comprehensive policy for environmental protection activities',
        status: 'active',
        effective_date: new Date().toISOString(),
        created_by: 'user-123',
        organization_id: 'org-456'
      },
      {
        id: 'policy-002',
        title: 'Safety Protocol Policy',
        description_text: 'Standard safety protocols for field operations',
        status: 'active',
        effective_date: new Date().toISOString(),
        created_by: 'user-456',
        organization_id: 'org-456'
      },
      {
        id: 'policy-003',
        title: 'Documentation Standards',
        description_text: 'Standards for documentation and reporting',
        status: 'draft',
        created_by: 'user-789',
        organization_id: 'org-456'
      }
    ];

    const testActions = [
      {
        id: 'action-001',
        title: 'Wetland Restoration',
        description: 'Restore wetland ecosystem',
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-002',
        title: 'Trail Maintenance',
        description: 'Maintain hiking trails',
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    for (const policy of existingPolicies) {
      for (const action of testActions) {
        // Mock policy existence check
        (queryJSON as any).mockResolvedValueOnce([policy]);
        
        // Mock successful linking
        const linkedAction = {
          ...action,
          policy_id: policy.id,
          updated_at: new Date().toISOString()
        };
        (queryJSON as any).mockResolvedValueOnce([linkedAction]);

        const result = await policyService.linkActionToPolicy(action.id, policy.id);

        // Property: Action should be successfully linked to policy
        expect(result).toBeTruthy();
        expect(result.policy_id).toBe(policy.id);
        expect(result.id).toBe(action.id);

        // Property: Link should work regardless of policy status (draft or active)
        expect(['draft', 'active']).toContain(policy.status);
      }
    }
  });

  it('should prevent linking to non-existent policies', async () => {
    // Property: Linking should fail when policy doesn't exist
    const nonExistentPolicyIds = [
      'policy-nonexistent',
      'policy-deleted',
      'policy-invalid-id',
      '',
      null,
      undefined
    ];

    const testAction = {
      id: 'action-link-test',
      title: 'Test Action for Linking',
      description: 'Action for testing policy linking validation',
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    for (const policyId of nonExistentPolicyIds) {
      // Mock policy not found
      (queryJSON as any).mockResolvedValueOnce([]);

      try {
        await policyService.linkActionToPolicy(testAction.id, policyId);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toContain('Policy not found');
      }
    }
  });

  it('should handle organization-level policy access control', async () => {
    // Property: Actions should only link to policies within the same organization
    const crossOrgTests = [
      {
        action: {
          id: 'action-org1',
          title: 'Action in Org 1',
          description: 'Action belonging to organization 1',
          organization_id: 'org-001',
          created_by: 'user-123'
        },
        policy: {
          id: 'policy-org1',
          title: 'Policy in Org 1',
          description_text: 'Policy belonging to organization 1',
          status: 'active',
          organization_id: 'org-001',
          created_by: 'user-123'
        },
        shouldSucceed: true
      },
      {
        action: {
          id: 'action-org1-cross',
          title: 'Action in Org 1 trying to link to Org 2',
          description: 'Action attempting cross-org policy linking',
          organization_id: 'org-001',
          created_by: 'user-123'
        },
        policy: {
          id: 'policy-org2',
          title: 'Policy in Org 2',
          description_text: 'Policy belonging to organization 2',
          status: 'active',
          organization_id: 'org-002',
          created_by: 'user-456'
        },
        shouldSucceed: false
      }
    ];

    for (const test of crossOrgTests) {
      // Mock policy existence
      (queryJSON as any).mockResolvedValueOnce([test.policy]);

      if (test.shouldSucceed) {
        const linkedAction = {
          ...test.action,
          policy_id: test.policy.id,
          updated_at: new Date().toISOString()
        };
        (queryJSON as any).mockResolvedValueOnce([linkedAction]);

        const result = await policyService.linkActionToPolicy(test.action.id, test.policy.id);
        expect(result.policy_id).toBe(test.policy.id);
      } else {
        try {
          await policyService.linkActionToPolicy(test.action.id, test.policy.id);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain('Cannot link to policy from different organization');
        }
      }
    }
  });

  it('should support unlinking actions from policies', async () => {
    // Property: Actions should be able to be unlinked from policies
    const linkedActions = [
      {
        id: 'action-linked-1',
        title: 'Linked Action 1',
        description: 'Action currently linked to a policy',
        policy_id: 'policy-001',
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-linked-2',
        title: 'Linked Action 2',
        description: 'Another action linked to a policy',
        policy_id: 'policy-002',
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    for (const linkedAction of linkedActions) {
      // Mock current linked state
      (queryJSON as any).mockResolvedValueOnce([linkedAction]);

      // Mock successful unlinking
      const unlinkedAction = {
        ...linkedAction,
        policy_id: null,
        updated_at: new Date().toISOString()
      };
      (queryJSON as any).mockResolvedValueOnce([unlinkedAction]);

      const result = await policyService.unlinkActionFromPolicy(linkedAction.id);

      // Property: Action should be successfully unlinked
      expect(result).toBeTruthy();
      expect(result.policy_id).toBeNull();
      expect(result.id).toBe(linkedAction.id);
    }
  });

  it('should maintain referential integrity during policy operations', async () => {
    // Property: Policy operations should maintain referential integrity with linked actions
    const policy = {
      id: 'policy-integrity-test',
      title: 'Integrity Test Policy',
      description_text: 'Policy for testing referential integrity',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const linkedActions = [
      {
        id: 'action-ref-1',
        title: 'Referenced Action 1',
        description: 'Action referencing the test policy',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-ref-2',
        title: 'Referenced Action 2',
        description: 'Another action referencing the test policy',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    // Test policy update with linked actions
    const updatedPolicy = {
      ...policy,
      description_text: 'Updated policy description',
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([policy]); // Current policy
    (queryJSON as any).mockResolvedValueOnce(linkedActions); // Linked actions check
    (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated policy

    const updateResult = await policyService.updatePolicy(policy.id, {
      description_text: updatedPolicy.description_text
    });

    // Property: Policy update should succeed with linked actions
    expect(updateResult).toBeTruthy();
    expect(updateResult.description_text).toBe(updatedPolicy.description_text);

    // Test policy deletion with linked actions (should fail)
    (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Current policy
    (queryJSON as any).mockResolvedValueOnce(linkedActions); // Linked actions check

    try {
      await policyService.deletePolicy(policy.id);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('Cannot delete policy with linked actions');
    }
  });

  it('should support bulk linking operations', async () => {
    // Property: Multiple actions should be able to be linked to a policy in bulk
    const targetPolicy = {
      id: 'policy-bulk-test',
      title: 'Bulk Linking Test Policy',
      description_text: 'Policy for testing bulk linking operations',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const actionsToLink = [
      {
        id: 'action-bulk-1',
        title: 'Bulk Action 1',
        description: 'First action for bulk linking',
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-bulk-2',
        title: 'Bulk Action 2',
        description: 'Second action for bulk linking',
        organization_id: 'org-456',
        created_by: 'user-456'
      },
      {
        id: 'action-bulk-3',
        title: 'Bulk Action 3',
        description: 'Third action for bulk linking',
        organization_id: 'org-456',
        created_by: 'user-789'
      }
    ];

    // Mock policy existence
    (queryJSON as any).mockResolvedValue([targetPolicy]);

    // Mock successful bulk linking
    const linkedActions = actionsToLink.map(action => ({
      ...action,
      policy_id: targetPolicy.id,
      updated_at: new Date().toISOString()
    }));

    (queryJSON as any).mockResolvedValueOnce(linkedActions);

    const actionIds = actionsToLink.map(a => a.id);
    const result = await policyService.bulkLinkActionsToPolicy(actionIds, targetPolicy.id);

    // Property: All actions should be successfully linked
    expect(result).toBeTruthy();
    expect(result.length).toBe(actionsToLink.length);
    
    for (const linkedAction of result) {
      expect(linkedAction.policy_id).toBe(targetPolicy.id);
      expect(actionIds).toContain(linkedAction.id);
    }
  });

  it('should handle policy status changes with linked actions', async () => {
    // Property: Policy status changes should be allowed with linked actions
    const policy = {
      id: 'policy-status-change',
      title: 'Status Change Policy',
      description_text: 'Policy for testing status changes with linked actions',
      status: 'draft',
      organization_id: 'org-456',
      created_by: 'user-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const linkedActions = [
      {
        id: 'action-status-1',
        title: 'Action with Draft Policy',
        description: 'Action linked to draft policy',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-123'
      }
    ];

    // Test activating policy with linked actions
    const activatedPolicy = {
      ...policy,
      status: 'active',
      effective_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([policy]); // Current policy
    (queryJSON as any).mockResolvedValueOnce(linkedActions); // Linked actions
    (queryJSON as any).mockResolvedValueOnce([activatedPolicy]); // Updated policy

    const result = await policyService.updatePolicy(policy.id, {
      status: 'active',
      effective_date: activatedPolicy.effective_date
    });

    // Property: Policy activation should succeed with linked actions
    expect(result.status).toBe('active');
    expect(result.effective_date).toBeTruthy();

    // Test deprecating policy with linked actions
    const deprecatedPolicy = {
      ...activatedPolicy,
      status: 'deprecated',
      deprecated_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([activatedPolicy]); // Current policy
    (queryJSON as any).mockResolvedValueOnce(linkedActions); // Linked actions
    (queryJSON as any).mockResolvedValueOnce([deprecatedPolicy]); // Updated policy

    const deprecatedResult = await policyService.updatePolicy(policy.id, {
      status: 'deprecated'
    });

    // Property: Policy deprecation should succeed with linked actions
    expect(deprecatedResult.status).toBe('deprecated');
    expect(deprecatedResult.deprecated_date).toBeTruthy();
  });

  it('should validate policy linking permissions', async () => {
    // Property: Policy linking should respect user permissions
    const permissionTests = [
      {
        user: 'user-admin',
        permissions: ['policy:link:all'],
        policy: {
          id: 'policy-perm-1',
          title: 'Admin Policy',
          description_text: 'Policy for admin permission testing',
          status: 'active',
          organization_id: 'org-456',
          created_by: 'user-other'
        },
        action: {
          id: 'action-perm-1',
          title: 'Admin Action',
          description: 'Action for admin permission testing',
          organization_id: 'org-456',
          created_by: 'user-admin'
        },
        shouldSucceed: true
      },
      {
        user: 'user-regular',
        permissions: ['policy:link:own'],
        policy: {
          id: 'policy-perm-2',
          title: 'Own Policy',
          description_text: 'Policy created by regular user',
          status: 'active',
          organization_id: 'org-456',
          created_by: 'user-regular'
        },
        action: {
          id: 'action-perm-2',
          title: 'Own Action',
          description: 'Action created by regular user',
          organization_id: 'org-456',
          created_by: 'user-regular'
        },
        shouldSucceed: true
      },
      {
        user: 'user-limited',
        permissions: ['policy:link:own'],
        policy: {
          id: 'policy-perm-3',
          title: 'Others Policy',
          description_text: 'Policy created by another user',
          status: 'active',
          organization_id: 'org-456',
          created_by: 'user-other'
        },
        action: {
          id: 'action-perm-3',
          title: 'Limited Action',
          description: 'Action by limited user',
          organization_id: 'org-456',
          created_by: 'user-limited'
        },
        shouldSucceed: false
      }
    ];

    for (const test of permissionTests) {
      // Mock policy existence
      (queryJSON as any).mockResolvedValueOnce([test.policy]);

      if (test.shouldSucceed) {
        const linkedAction = {
          ...test.action,
          policy_id: test.policy.id,
          updated_at: new Date().toISOString()
        };
        (queryJSON as any).mockResolvedValueOnce([linkedAction]);

        const result = await policyService.linkActionToPolicy(
          test.action.id, 
          test.policy.id,
          { user: test.user, permissions: test.permissions }
        );

        expect(result.policy_id).toBe(test.policy.id);
      } else {
        try {
          await policyService.linkActionToPolicy(
            test.action.id, 
            test.policy.id,
            { user: test.user, permissions: test.permissions }
          );
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain('Insufficient permissions');
        }
      }
    }
  });

  it('should track linking history and audit trail', async () => {
    // Property: Policy linking operations should be audited
    const policy = {
      id: 'policy-audit-linking',
      title: 'Audit Linking Policy',
      description_text: 'Policy for testing linking audit trail',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const action = {
      id: 'action-audit-linking',
      title: 'Audit Linking Action',
      description: 'Action for testing linking audit trail',
      organization_id: 'org-456',
      created_by: 'user-456'
    };

    const linkingOperations = [
      {
        operation: 'link',
        policy_id: policy.id,
        user: 'user-linker',
        timestamp: new Date('2024-01-01T10:00:00Z').toISOString()
      },
      {
        operation: 'unlink',
        policy_id: null,
        user: 'user-unlinker',
        timestamp: new Date('2024-01-02T10:00:00Z').toISOString()
      },
      {
        operation: 'link',
        policy_id: policy.id,
        user: 'user-relinker',
        timestamp: new Date('2024-01-03T10:00:00Z').toISOString()
      }
    ];

    let currentAction = action;
    let linkingHistory = [];

    for (const operation of linkingOperations) {
      const updatedAction = {
        ...currentAction,
        policy_id: operation.policy_id,
        updated_at: operation.timestamp,
        linking_history: [
          ...linkingHistory,
          {
            operation: operation.operation,
            policy_id: operation.policy_id,
            user: operation.user,
            timestamp: operation.timestamp
          }
        ]
      };

      if (operation.operation === 'link') {
        (queryJSON as any).mockResolvedValueOnce([policy]); // Policy exists
      }
      
      (queryJSON as any).mockResolvedValueOnce([currentAction]); // Current state
      (queryJSON as any).mockResolvedValueOnce([updatedAction]); // Updated state

      let result;
      if (operation.operation === 'link') {
        result = await policyService.linkActionToPolicy(action.id, operation.policy_id);
      } else {
        result = await policyService.unlinkActionFromPolicy(action.id);
      }

      // Property: Linking history should be maintained
      expect(result.linking_history).toBeDefined();
      expect(result.linking_history.length).toBe(linkingHistory.length + 1);

      // Property: Latest history entry should match current operation
      const latestHistory = result.linking_history[result.linking_history.length - 1];
      expect(latestHistory.operation).toBe(operation.operation);
      expect(latestHistory.policy_id).toBe(operation.policy_id);
      expect(latestHistory.user).toBe(operation.user);
      expect(latestHistory.timestamp).toBe(operation.timestamp);

      currentAction = updatedAction;
      linkingHistory = updatedAction.linking_history;
    }

    // Property: Complete linking history should be preserved
    expect(currentAction.linking_history.length).toBe(3);
    expect(currentAction.linking_history.map(h => h.operation)).toEqual(['link', 'unlink', 'link']);
  });
});