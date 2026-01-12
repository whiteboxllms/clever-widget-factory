/**
 * Property-Based Tests for Backward Compatibility
 * 
 * Tests universal properties for backward compatibility with existing action workflows
 * 
 * Feature: exploration-data-collection-flow, Property 16: Backward Compatibility
 * Validates: Requirements 6.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { ActionService } from '../../services/actionService';
import { ExplorationService } from '../../services/explorationService';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  user: 'test_user',
  password: 'test_password'
};

describe('Backward Compatibility Property Tests', () => {
  let client: Client;
  let actionService: ActionService;
  let explorationService: ExplorationService;

  beforeEach(async () => {
    client = new Client(dbConfig);
    await client.connect();
    actionService = new ActionService();
    explorationService = new ExplorationService();
  });

  afterEach(async () => {
    await client.end();
  });

  /**
   * Property 16: Backward Compatibility
   * For any existing action workflow or API call pattern, the system should continue 
   * to work exactly as before, without requiring changes to existing code
   * Validates: Requirements 6.1
   */
  describe('Property 16: Backward Compatibility', () => {
    it('should support legacy action creation without exploration fields', async () => {
      // Property: For any legacy action creation call, the system should work identically to before
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Legacy action creation pattern (pre-exploration features)
      const legacyActionData = {
        title: 'Legacy Action',
        description: 'Standard maintenance task',
        policy: 'Follow existing procedures',
        status: 'not_started' as const,
        assigned_to: testUserId,
        organization_id: testOrgId,
        location: 'Workshop A',
        priority: 'medium' as const,
        due_date: new Date('2026-02-01'),
        estimated_hours: 4
      };

      const createdAction = await actionService.createAction(legacyActionData);

      // Property: All legacy fields should work exactly as before
      expect(createdAction).toMatchObject({
        title: legacyActionData.title,
        description: legacyActionData.description,
        policy: legacyActionData.policy,
        status: legacyActionData.status,
        assigned_to: legacyActionData.assigned_to,
        organization_id: legacyActionData.organization_id,
        location: legacyActionData.location,
        priority: legacyActionData.priority,
        due_date: legacyActionData.due_date,
        estimated_hours: legacyActionData.estimated_hours
      });

      // Property: New exploration fields should be null/default for legacy actions
      expect(createdAction.summary_policy_text).toBeNull();
      
      // Property: No exploration record should be created for legacy actions
      const exploration = await explorationService.getExplorationByActionId(createdAction.id);
      expect(exploration).toBeNull();

      // Property: Action should be retrievable using legacy patterns
      const retrievedAction = await actionService.getAction(createdAction.id);
      expect(retrievedAction).toMatchObject(legacyActionData);

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should support legacy action updates without affecting new fields', async () => {
      // Property: For any legacy action update, new exploration fields should remain unaffected
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create action with both legacy and new fields
      const mixedActionData = {
        title: 'Mixed Action',
        description: 'Action with both old and new fields',
        policy: 'Standard policy',
        summary_policy_text: 'Enhanced policy summary',
        status: 'not_started' as const,
        assigned_to: testUserId,
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(mixedActionData);

      // Legacy update pattern (only updating traditional fields)
      const legacyUpdate = {
        status: 'in_progress' as const,
        priority: 'high' as const,
        estimated_hours: 6
      };

      const updatedAction = await actionService.updateAction(createdAction.id, legacyUpdate);

      // Property: Legacy fields should be updated
      expect(updatedAction.status).toBe(legacyUpdate.status);
      expect(updatedAction.priority).toBe(legacyUpdate.priority);
      expect(updatedAction.estimated_hours).toBe(legacyUpdate.estimated_hours);

      // Property: New fields should remain unchanged
      expect(updatedAction.summary_policy_text).toBe(mixedActionData.summary_policy_text);
      expect(updatedAction.title).toBe(mixedActionData.title);
      expect(updatedAction.description).toBe(mixedActionData.description);
      expect(updatedAction.policy).toBe(mixedActionData.policy);

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should support legacy action listing and filtering', async () => {
      // Property: For any legacy action listing/filtering operation, results should be identical to before
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create multiple actions using legacy patterns
      const legacyActions = [
        {
          title: 'Legacy Action 1',
          description: 'First legacy action',
          status: 'not_started' as const,
          assigned_to: testUserId,
          organization_id: testOrgId,
          priority: 'high' as const
        },
        {
          title: 'Legacy Action 2',
          description: 'Second legacy action',
          status: 'in_progress' as const,
          assigned_to: testUserId,
          organization_id: testOrgId,
          priority: 'medium' as const
        },
        {
          title: 'Legacy Action 3',
          description: 'Third legacy action',
          status: 'completed' as const,
          assigned_to: testUserId,
          organization_id: testOrgId,
          priority: 'low' as const
        }
      ];

      const createdActions = [];
      for (const actionData of legacyActions) {
        const created = await actionService.createAction(actionData);
        createdActions.push(created);
      }

      // Property: Legacy filtering by status should work
      const inProgressActions = await actionService.listActions({
        status: 'in_progress',
        organization_id: testOrgId
      });
      expect(inProgressActions.length).toBe(1);
      expect(inProgressActions[0].status).toBe('in_progress');

      // Property: Legacy filtering by assigned user should work
      const userActions = await actionService.listActions({
        assigned_to: testUserId,
        organization_id: testOrgId
      });
      expect(userActions.length).toBe(3);

      // Property: Legacy filtering by priority should work
      const highPriorityActions = await actionService.listActions({
        priority: 'high',
        organization_id: testOrgId
      });
      expect(highPriorityActions.length).toBe(1);
      expect(highPriorityActions[0].priority).toBe('high');

      // Property: Legacy sorting should work
      const sortedActions = await actionService.listActions({
        organization_id: testOrgId,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      expect(sortedActions.length).toBe(3);
      // Should be sorted by creation time, newest first
      expect(new Date(sortedActions[0].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(sortedActions[1].created_at).getTime());

      // Cleanup
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });

    it('should maintain legacy API response structure', async () => {
      // Property: For any legacy API call, the response structure should be identical to before
      
      const testOrgId = randomUUID();
      
      const legacyActionData = {
        title: 'API Structure Test',
        description: 'Testing API response structure',
        status: 'not_started' as const,
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(legacyActionData);

      // Property: Response should contain all expected legacy fields
      const expectedLegacyFields = [
        'id', 'title', 'description', 'policy', 'status', 'priority',
        'assigned_to', 'organization_id', 'location', 'due_date',
        'estimated_hours', 'actual_hours', 'created_at', 'updated_at',
        'created_by', 'tags', 'attachments'
      ];

      for (const field of expectedLegacyFields) {
        expect(createdAction).toHaveProperty(field);
      }

      // Property: New fields should be present but not interfere with legacy usage
      expect(createdAction).toHaveProperty('summary_policy_text');
      
      // Property: Legacy field types should be preserved
      expect(typeof createdAction.id).toBe('string');
      expect(typeof createdAction.title).toBe('string');
      expect(typeof createdAction.description).toBe('string');
      expect(typeof createdAction.status).toBe('string');
      expect(createdAction.created_at).toBeInstanceOf(Date);
      expect(createdAction.updated_at).toBeInstanceOf(Date);

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should support legacy action status transitions', async () => {
      // Property: For any legacy status transition, the behavior should be identical to before
      
      const testOrgId = randomUUID();
      
      const actionData = {
        title: 'Status Transition Test',
        description: 'Testing legacy status transitions',
        status: 'not_started' as const,
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(actionData);

      // Property: Legacy status transitions should work
      const validTransitions = [
        { from: 'not_started', to: 'in_progress' },
        { from: 'in_progress', to: 'completed' },
        { from: 'completed', to: 'verified' }
      ];

      let currentAction = createdAction;
      for (const transition of validTransitions) {
        expect(currentAction.status).toBe(transition.from);
        
        const updatedAction = await actionService.updateAction(currentAction.id, {
          status: transition.to as any
        });
        
        expect(updatedAction.status).toBe(transition.to);
        currentAction = updatedAction;
      }

      // Property: Invalid transitions should still be rejected
      await expect(actionService.updateAction(currentAction.id, {
        status: 'not_started' as any // Invalid: can't go back from verified to not_started
      })).rejects.toThrow();

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should preserve legacy action relationships', async () => {
      // Property: For any legacy action relationships (tools, parts, etc.), they should work unchanged
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      const actionData = {
        title: 'Relationship Test Action',
        description: 'Testing legacy relationships',
        status: 'not_started' as const,
        assigned_to: testUserId,
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(actionData);

      // Property: Legacy tool associations should work
      const toolId = randomUUID();
      await actionService.associateTool(createdAction.id, toolId);
      
      const actionWithTools = await actionService.getActionWithRelationships(createdAction.id);
      expect(actionWithTools.associated_tools).toContain(toolId);

      // Property: Legacy part associations should work
      const partId = randomUUID();
      await actionService.associatePart(createdAction.id, partId, 2); // quantity: 2
      
      const actionWithParts = await actionService.getActionWithRelationships(createdAction.id);
      expect(actionWithParts.associated_parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            part_id: partId,
            quantity: 2
          })
        ])
      );

      // Property: Legacy attachment handling should work
      const attachmentData = {
        filename: 'test-document.pdf',
        url: 'https://example.com/test-document.pdf',
        type: 'document'
      };
      
      await actionService.addAttachment(createdAction.id, attachmentData);
      
      const actionWithAttachments = await actionService.getActionWithRelationships(createdAction.id);
      expect(actionWithAttachments.attachments).toEqual(
        expect.arrayContaining([
          expect.objectContaining(attachmentData)
        ])
      );

      // Cleanup
      await client.query('DELETE FROM action_tools WHERE action_id = $1', [createdAction.id]);
      await client.query('DELETE FROM action_parts WHERE action_id = $1', [createdAction.id]);
      await client.query('DELETE FROM action_attachments WHERE action_id = $1', [createdAction.id]);
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should handle legacy error scenarios identically', async () => {
      // Property: For any legacy error scenario, the error handling should be identical to before
      
      const testOrgId = randomUUID();
      
      // Property: Missing required fields should produce the same errors
      await expect(actionService.createAction({
        title: 'Missing Description'
        // Missing description and organization_id
      } as any)).rejects.toThrow('description is required');

      await expect(actionService.createAction({
        title: 'Missing Org ID',
        description: 'Has description but missing org ID'
        // Missing organization_id
      } as any)).rejects.toThrow('organization_id is required');

      // Property: Invalid field values should produce the same errors
      await expect(actionService.createAction({
        title: 'Invalid Status',
        description: 'Testing invalid status',
        status: 'invalid_status' as any,
        organization_id: testOrgId
      })).rejects.toThrow('Invalid status');

      await expect(actionService.createAction({
        title: 'Invalid Priority',
        description: 'Testing invalid priority',
        priority: 'invalid_priority' as any,
        organization_id: testOrgId
      })).rejects.toThrow('Invalid priority');

      // Property: Non-existent action operations should produce the same errors
      const nonExistentId = randomUUID();
      await expect(actionService.getAction(nonExistentId))
        .rejects.toThrow('Action not found');

      await expect(actionService.updateAction(nonExistentId, { title: 'Updated' }))
        .rejects.toThrow('Action not found');

      await expect(actionService.deleteAction(nonExistentId))
        .rejects.toThrow('Action not found');
    });

    it('should maintain legacy performance characteristics', async () => {
      // Property: For any legacy operation, performance should be equivalent or better than before
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create multiple actions to test performance
      const actionCount = 100;
      const createdActions = [];
      
      const startTime = Date.now();
      
      for (let i = 0; i < actionCount; i++) {
        const actionData = {
          title: `Performance Test Action ${i}`,
          description: `Testing performance with action ${i}`,
          status: 'not_started' as const,
          assigned_to: testUserId,
          organization_id: testOrgId
        };
        
        const created = await actionService.createAction(actionData);
        createdActions.push(created);
      }
      
      const creationTime = Date.now() - startTime;
      
      // Property: Bulk creation should complete within reasonable time
      expect(creationTime).toBeLessThan(10000); // 10 seconds for 100 actions
      
      // Property: Listing should be performant
      const listStartTime = Date.now();
      const listedActions = await actionService.listActions({
        organization_id: testOrgId,
        limit: actionCount
      });
      const listTime = Date.now() - listStartTime;
      
      expect(listTime).toBeLessThan(1000); // 1 second for listing
      expect(listedActions.length).toBe(actionCount);
      
      // Property: Individual retrieval should be fast
      const getStartTime = Date.now();
      const retrievedAction = await actionService.getAction(createdActions[0].id);
      const getTime = Date.now() - getStartTime;
      
      expect(getTime).toBeLessThan(100); // 100ms for single retrieval
      expect(retrievedAction).toBeDefined();

      // Cleanup
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });
  });
});