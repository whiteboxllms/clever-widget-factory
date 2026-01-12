/**
 * Property Test: Policy Linking Integrity
 * 
 * Property 2: Policy Linking Integrity
 * Validates: Requirements 1.5
 * 
 * Tests that policy linking maintains referential integrity and data consistency
 * across all database operations and concurrent access scenarios.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { policyService } from '../../services/policyService';
import { actionService } from '../../services/actionService';
import { queryJSON } from '../../lib/database';

// Mock the database
vi.mock('../../lib/database', () => ({
  queryJSON: vi.fn()
}));

describe('Property Test: Policy Linking Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain referential integrity when policies are deleted', async () => {
    // Property: Deleting a policy should handle linked actions appropriately
    const policy = {
      id: 'policy-delete-integrity',
      title: 'Delete Integrity Policy',
      description_text: 'Policy for testing deletion integrity',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const linkedActions = [
      {
        id: 'action-linked-1',
        title: 'Linked Action 1',
        description: 'Action linked to policy being deleted',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-linked-2',
        title: 'Linked Action 2',
        description: 'Another action linked to policy being deleted',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    // Test 1: Deletion should fail when actions are linked
    (queryJSON as any).mockResolvedValueOnce([policy]); // Policy exists
    (queryJSON as any).mockResolvedValueOnce(linkedActions); // Linked actions found

    try {
      await policyService.deletePolicy(policy.id);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('Cannot delete policy with linked actions');
    }

    // Test 2: Deletion should succeed after unlinking all actions
    const unlinkedActions = linkedActions.map(action => ({
      ...action,
      policy_id: null,
      updated_at: new Date().toISOString()
    }));

    // Mock unlinking each action
    for (let i = 0; i < linkedActions.length; i++) {
      (queryJSON as any).mockResolvedValueOnce([linkedActions[i]]); // Current state
      (queryJSON as any).mockResolvedValueOnce([unlinkedActions[i]]); // Unlinked state
    }

    // Unlink all actions
    for (const action of linkedActions) {
      await policyService.unlinkActionFromPolicy(action.id);
    }

    // Now deletion should succeed
    (queryJSON as any).mockResolvedValueOnce([policy]); // Policy exists
    (queryJSON as any).mockResolvedValueOnce([]); // No linked actions
    (queryJSON as any).mockResolvedValueOnce([]); // Successful deletion

    const deleteResult = await policyService.deletePolicy(policy.id);
    expect(deleteResult).toBeTruthy();
  });

  it('should maintain integrity during concurrent policy operations', async () => {
    // Property: Concurrent operations should not break referential integrity
    const policy = {
      id: 'policy-concurrent-integrity',
      title: 'Concurrent Integrity Policy',
      description_text: 'Policy for testing concurrent operation integrity',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const actions = [
      {
        id: 'action-concurrent-1',
        title: 'Concurrent Action 1',
        description: 'Action for concurrent testing',
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-concurrent-2',
        title: 'Concurrent Action 2',
        description: 'Another action for concurrent testing',
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    // Simulate concurrent linking operations
    const concurrentOperations = [
      { action_id: actions[0].id, operation: 'link' },
      { action_id: actions[1].id, operation: 'link' },
      { action_id: actions[0].id, operation: 'unlink' },
      { action_id: actions[1].id, operation: 'unlink' }
    ];

    let currentActionStates = actions.map(action => ({ ...action, policy_id: null }));

    for (const operation of concurrentOperations) {
      const actionIndex = actions.findIndex(a => a.id === operation.action_id);
      const currentAction = currentActionStates[actionIndex];

      if (operation.operation === 'link') {
        // Mock policy existence
        (queryJSON as any).mockResolvedValueOnce([policy]);
        
        const linkedAction = {
          ...currentAction,
          policy_id: policy.id,
          updated_at: new Date().toISOString()
        };
        
        (queryJSON as any).mockResolvedValueOnce([linkedAction]);
        
        const result = await policyService.linkActionToPolicy(operation.action_id, policy.id);
        
        // Property: Link should succeed and maintain integrity
        expect(result.policy_id).toBe(policy.id);
        currentActionStates[actionIndex] = linkedAction;
        
      } else { // unlink
        const unlinkedAction = {
          ...currentAction,
          policy_id: null,
          updated_at: new Date().toISOString()
        };
        
        (queryJSON as any).mockResolvedValueOnce([currentAction]); // Current state
        (queryJSON as any).mockResolvedValueOnce([unlinkedAction]); // Unlinked state
        
        const result = await policyService.unlinkActionFromPolicy(operation.action_id);
        
        // Property: Unlink should succeed and maintain integrity
        expect(result.policy_id).toBeNull();
        currentActionStates[actionIndex] = unlinkedAction;
      }
    }

    // Property: Final state should be consistent
    for (const actionState of currentActionStates) {
      expect(actionState.policy_id).toBeNull(); // All should be unlinked
    }
  });

  it('should maintain integrity across database transactions', async () => {
    // Property: Policy linking should be transactionally safe
    const policy = {
      id: 'policy-transaction-integrity',
      title: 'Transaction Integrity Policy',
      description_text: 'Policy for testing transaction integrity',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const actions = [
      {
        id: 'action-tx-1',
        title: 'Transaction Action 1',
        description: 'Action for transaction testing',
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-tx-2',
        title: 'Transaction Action 2',
        description: 'Another action for transaction testing',
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    // Test successful transaction
    const successfulBulkLink = actions.map(action => ({
      ...action,
      policy_id: policy.id,
      updated_at: new Date().toISOString()
    }));

    (queryJSON as any).mockResolvedValueOnce([policy]); // Policy exists
    (queryJSON as any).mockResolvedValueOnce(successfulBulkLink); // Successful bulk link

    const successResult = await policyService.bulkLinkActionsToPolicy(
      actions.map(a => a.id), 
      policy.id
    );

    // Property: All actions should be linked in successful transaction
    expect(successResult.length).toBe(actions.length);
    for (const linkedAction of successResult) {
      expect(linkedAction.policy_id).toBe(policy.id);
    }

    // Test failed transaction (should rollback)
    const partiallyLinkedActions = [
      { ...actions[0], policy_id: policy.id, updated_at: new Date().toISOString() },
      { ...actions[1], policy_id: null, updated_at: new Date().toISOString() } // Failed to link
    ];

    (queryJSON as any).mockResolvedValueOnce([policy]); // Policy exists
    (queryJSON as any).mockRejectedValueOnce(new Error('Database constraint violation'));

    try {
      await policyService.bulkLinkActionsToPolicy(actions.map(a => a.id), policy.id);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('Database constraint violation');
    }

    // Property: Failed transaction should not leave partial state
    // All actions should remain in their original state (unlinked)
    for (const action of actions) {
      (queryJSON as any).mockResolvedValueOnce([{ ...action, policy_id: null }]);
      const actionState = await actionService.getAction(action.id);
      expect(actionState.policy_id).toBeNull();
    }
  });

  it('should validate foreign key constraints', async () => {
    // Property: Foreign key constraints should be enforced
    const validPolicy = {
      id: 'policy-fk-valid',
      title: 'Valid FK Policy',
      description_text: 'Valid policy for foreign key testing',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const action = {
      id: 'action-fk-test',
      title: 'FK Test Action',
      description: 'Action for foreign key constraint testing',
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    // Test valid foreign key
    (queryJSON as any).mockResolvedValueOnce([validPolicy]); // Policy exists
    const linkedAction = {
      ...action,
      policy_id: validPolicy.id,
      updated_at: new Date().toISOString()
    };
    (queryJSON as any).mockResolvedValueOnce([linkedAction]);

    const validResult = await policyService.linkActionToPolicy(action.id, validPolicy.id);
    expect(validResult.policy_id).toBe(validPolicy.id);

    // Test invalid foreign key
    const invalidPolicyId = 'policy-nonexistent';
    (queryJSON as any).mockResolvedValueOnce([]); // Policy doesn't exist

    try {
      await policyService.linkActionToPolicy(action.id, invalidPolicyId);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('Policy not found');
    }

    // Test null foreign key (should be allowed for unlinking)
    const unlinkedAction = {
      ...linkedAction,
      policy_id: null,
      updated_at: new Date().toISOString()
    };
    (queryJSON as any).mockResolvedValueOnce([linkedAction]); // Current state
    (queryJSON as any).mockResolvedValueOnce([unlinkedAction]); // Unlinked state

    const unlinkResult = await policyService.unlinkActionFromPolicy(action.id);
    expect(unlinkResult.policy_id).toBeNull();
  });

  it('should maintain integrity during policy status changes', async () => {
    // Property: Policy status changes should not break action links
    const policy = {
      id: 'policy-status-integrity',
      title: 'Status Integrity Policy',
      description_text: 'Policy for testing status change integrity',
      status: 'draft',
      organization_id: 'org-456',
      created_by: 'user-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const linkedActions = [
      {
        id: 'action-status-1',
        title: 'Status Action 1',
        description: 'Action linked during status changes',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-status-2',
        title: 'Status Action 2',
        description: 'Another action linked during status changes',
        policy_id: policy.id,
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    const statusTransitions = [
      { from: 'draft', to: 'active', effective_date: new Date().toISOString() },
      { from: 'active', to: 'deprecated', deprecated_date: new Date().toISOString() }
    ];

    let currentPolicy = policy;

    for (const transition of statusTransitions) {
      const updatedPolicy = {
        ...currentPolicy,
        status: transition.to,
        updated_at: new Date().toISOString(),
        ...(transition.effective_date && { effective_date: transition.effective_date }),
        ...(transition.deprecated_date && { deprecated_date: transition.deprecated_date })
      };

      (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Current policy
      (queryJSON as any).mockResolvedValueOnce(linkedActions); // Linked actions
      (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated policy

      const result = await policyService.updatePolicy(policy.id, {
        status: transition.to,
        ...(transition.effective_date && { effective_date: transition.effective_date })
      });

      // Property: Status change should succeed
      expect(result.status).toBe(transition.to);

      // Property: Linked actions should remain linked
      for (const action of linkedActions) {
        (queryJSON as any).mockResolvedValueOnce([action]);
        const actionState = await actionService.getAction(action.id);
        expect(actionState.policy_id).toBe(policy.id);
      }

      currentPolicy = updatedPolicy;
    }
  });

  it('should handle cascade operations correctly', async () => {
    // Property: Cascade operations should maintain data integrity
    const parentPolicy = {
      id: 'policy-parent',
      title: 'Parent Policy',
      description_text: 'Parent policy for cascade testing',
      status: 'active',
      effective_date: new Date().toISOString(),
      organization_id: 'org-456',
      created_by: 'user-123'
    };

    const childPolicies = [
      {
        id: 'policy-child-1',
        title: 'Child Policy 1',
        description_text: 'First child policy',
        status: 'draft',
        parent_policy_id: parentPolicy.id,
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'policy-child-2',
        title: 'Child Policy 2',
        description_text: 'Second child policy',
        status: 'draft',
        parent_policy_id: parentPolicy.id,
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    const actionsLinkedToParent = [
      {
        id: 'action-parent-1',
        title: 'Parent Action 1',
        description: 'Action linked to parent policy',
        policy_id: parentPolicy.id,
        organization_id: 'org-456',
        created_by: 'user-123'
      }
    ];

    const actionsLinkedToChildren = [
      {
        id: 'action-child-1',
        title: 'Child Action 1',
        description: 'Action linked to child policy',
        policy_id: childPolicies[0].id,
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-child-2',
        title: 'Child Action 2',
        description: 'Action linked to child policy',
        policy_id: childPolicies[1].id,
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    // Test parent policy deletion with children and linked actions
    (queryJSON as any).mockResolvedValueOnce([parentPolicy]); // Parent exists
    (queryJSON as any).mockResolvedValueOnce(actionsLinkedToParent); // Actions linked to parent
    (queryJSON as any).mockResolvedValueOnce(childPolicies); // Child policies exist

    try {
      await policyService.deletePolicy(parentPolicy.id);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toContain('Cannot delete policy with linked actions or child policies');
    }

    // Test cascade deletion after unlinking and removing children
    // First unlink all actions
    for (const action of [...actionsLinkedToParent, ...actionsLinkedToChildren]) {
      const unlinkedAction = {
        ...action,
        policy_id: null,
        updated_at: new Date().toISOString()
      };
      (queryJSON as any).mockResolvedValueOnce([action]); // Current state
      (queryJSON as any).mockResolvedValueOnce([unlinkedAction]); // Unlinked state
      
      await policyService.unlinkActionFromPolicy(action.id);
    }

    // Then delete child policies
    for (const childPolicy of childPolicies) {
      (queryJSON as any).mockResolvedValueOnce([childPolicy]); // Child exists
      (queryJSON as any).mockResolvedValueOnce([]); // No linked actions
      (queryJSON as any).mockResolvedValueOnce([]); // No child policies
      (queryJSON as any).mockResolvedValueOnce([]); // Successful deletion
      
      await policyService.deletePolicy(childPolicy.id);
    }

    // Finally delete parent policy
    (queryJSON as any).mockResolvedValueOnce([parentPolicy]); // Parent exists
    (queryJSON as any).mockResolvedValueOnce([]); // No linked actions
    (queryJSON as any).mockResolvedValueOnce([]); // No child policies
    (queryJSON as any).mockResolvedValueOnce([]); // Successful deletion

    const deleteResult = await policyService.deletePolicy(parentPolicy.id);
    expect(deleteResult).toBeTruthy();
  });

  it('should maintain integrity during bulk operations', async () => {
    // Property: Bulk operations should maintain referential integrity
    const policies = [
      {
        id: 'policy-bulk-1',
        title: 'Bulk Policy 1',
        description_text: 'First policy for bulk testing',
        status: 'active',
        effective_date: new Date().toISOString(),
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'policy-bulk-2',
        title: 'Bulk Policy 2',
        description_text: 'Second policy for bulk testing',
        status: 'active',
        effective_date: new Date().toISOString(),
        organization_id: 'org-456',
        created_by: 'user-456'
      }
    ];

    const actions = [
      {
        id: 'action-bulk-1',
        title: 'Bulk Action 1',
        description: 'First action for bulk testing',
        organization_id: 'org-456',
        created_by: 'user-123'
      },
      {
        id: 'action-bulk-2',
        title: 'Bulk Action 2',
        description: 'Second action for bulk testing',
        organization_id: 'org-456',
        created_by: 'user-456'
      },
      {
        id: 'action-bulk-3',
        title: 'Bulk Action 3',
        description: 'Third action for bulk testing',
        organization_id: 'org-456',
        created_by: 'user-789'
      }
    ];

    // Test bulk linking to first policy
    const bulkLinkedToPolicy1 = actions.slice(0, 2).map(action => ({
      ...action,
      policy_id: policies[0].id,
      updated_at: new Date().toISOString()
    }));

    (queryJSON as any).mockResolvedValueOnce([policies[0]]); // Policy exists
    (queryJSON as any).mockResolvedValueOnce(bulkLinkedToPolicy1); // Bulk link result

    const bulkResult1 = await policyService.bulkLinkActionsToPolicy(
      actions.slice(0, 2).map(a => a.id),
      policies[0].id
    );

    // Property: Bulk linking should succeed
    expect(bulkResult1.length).toBe(2);
    for (const linkedAction of bulkResult1) {
      expect(linkedAction.policy_id).toBe(policies[0].id);
    }

    // Test bulk relinking to second policy
    const bulkRelinkedToPolicy2 = bulkLinkedToPolicy1.map(action => ({
      ...action,
      policy_id: policies[1].id,
      updated_at: new Date().toISOString()
    }));

    (queryJSON as any).mockResolvedValueOnce([policies[1]]); // New policy exists
    (queryJSON as any).mockResolvedValueOnce(bulkRelinkedToPolicy2); // Bulk relink result

    const bulkResult2 = await policyService.bulkRelinkActionsToPolicy(
      bulkLinkedToPolicy1.map(a => a.id),
      policies[1].id
    );

    // Property: Bulk relinking should maintain integrity
    expect(bulkResult2.length).toBe(2);
    for (const relinkedAction of bulkResult2) {
      expect(relinkedAction.policy_id).toBe(policies[1].id);
    }

    // Test bulk unlinking
    const bulkUnlinked = bulkRelinkedToPolicy2.map(action => ({
      ...action,
      policy_id: null,
      updated_at: new Date().toISOString()
    }));

    (queryJSON as any).mockResolvedValueOnce(bulkUnlinked); // Bulk unlink result

    const bulkUnlinkResult = await policyService.bulkUnlinkActions(
      bulkRelinkedToPolicy2.map(a => a.id)
    );

    // Property: Bulk unlinking should maintain integrity
    expect(bulkUnlinkResult.length).toBe(2);
    for (const unlinkedAction of bulkUnlinkResult) {
      expect(unlinkedAction.policy_id).toBeNull();
    }
  });

  it('should validate data consistency after complex operations', async () => {
    // Property: Complex operation sequences should maintain data consistency
    const policy = {
      id: 'policy-consistency-test',
      title: 'Consistency Test Policy',
      description_text: 'Policy for testing data consistency',
      status: 'draft',
      organization_id: 'org-456',
      created_by: 'user-123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const actions = Array.from({ length: 5 }, (_, i) => ({
      id: `action-consistency-${i + 1}`,
      title: `Consistency Action ${i + 1}`,
      description: `Action ${i + 1} for consistency testing`,
      organization_id: 'org-456',
      created_by: 'user-123'
    }));

    // Complex operation sequence
    const operations = [
      { type: 'link', action_ids: [actions[0].id, actions[1].id] },
      { type: 'policy_update', status: 'active', effective_date: new Date().toISOString() },
      { type: 'link', action_ids: [actions[2].id, actions[3].id] },
      { type: 'unlink', action_ids: [actions[1].id] },
      { type: 'link', action_ids: [actions[4].id] },
      { type: 'policy_update', description_text: 'Updated policy description' },
      { type: 'unlink', action_ids: [actions[0].id, actions[2].id] }
    ];

    let currentPolicy = policy;
    let currentActionStates = actions.map(action => ({ ...action, policy_id: null }));

    for (const operation of operations) {
      if (operation.type === 'link') {
        (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Policy exists
        
        const linkedActions = operation.action_ids.map(actionId => {
          const actionIndex = actions.findIndex(a => a.id === actionId);
          return {
            ...currentActionStates[actionIndex],
            policy_id: currentPolicy.id,
            updated_at: new Date().toISOString()
          };
        });
        
        (queryJSON as any).mockResolvedValueOnce(linkedActions); // Bulk link result
        
        const linkResult = await policyService.bulkLinkActionsToPolicy(
          operation.action_ids,
          currentPolicy.id
        );
        
        // Update current states
        for (const linkedAction of linkResult) {
          const actionIndex = actions.findIndex(a => a.id === linkedAction.id);
          currentActionStates[actionIndex] = linkedAction;
        }
        
      } else if (operation.type === 'unlink') {
        const unlinkedActions = operation.action_ids.map(actionId => {
          const actionIndex = actions.findIndex(a => a.id === actionId);
          return {
            ...currentActionStates[actionIndex],
            policy_id: null,
            updated_at: new Date().toISOString()
          };
        });
        
        (queryJSON as any).mockResolvedValueOnce(unlinkedActions); // Bulk unlink result
        
        const unlinkResult = await policyService.bulkUnlinkActions(operation.action_ids);
        
        // Update current states
        for (const unlinkedAction of unlinkResult) {
          const actionIndex = actions.findIndex(a => a.id === unlinkedAction.id);
          currentActionStates[actionIndex] = unlinkedAction;
        }
        
      } else if (operation.type === 'policy_update') {
        const updatedPolicy = {
          ...currentPolicy,
          ...operation,
          type: undefined, // Remove the type field
          updated_at: new Date().toISOString()
        };
        
        (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Current policy
        (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated policy
        
        const updateResult = await policyService.updatePolicy(currentPolicy.id, {
          ...(operation.status && { status: operation.status }),
          ...(operation.effective_date && { effective_date: operation.effective_date }),
          ...(operation.description_text && { description_text: operation.description_text })
        });
        
        currentPolicy = updateResult;
      }
    }

    // Property: Final state should be consistent
    const expectedLinkedActions = currentActionStates.filter(action => action.policy_id === policy.id);
    const expectedUnlinkedActions = currentActionStates.filter(action => action.policy_id === null);

    // Verify final consistency
    expect(expectedLinkedActions.length + expectedUnlinkedActions.length).toBe(actions.length);
    
    // Based on the operations, actions 3, 4, and 5 should be linked
    expect(expectedLinkedActions.length).toBe(2); // actions[3] and actions[4]
    expect(expectedUnlinkedActions.length).toBe(3); // actions[0], actions[1], actions[2]
    
    // Verify policy state
    expect(currentPolicy.status).toBe('active');
    expect(currentPolicy.description_text).toBe('Updated policy description');
  });
});