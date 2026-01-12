/**
 * Property-Based Tests for Action Data Persistence
 * 
 * Tests universal properties for action data persistence with exploration support
 * 
 * Feature: exploration-data-collection-flow, Property 1: Action Data Persistence
 * Validates: Requirements 1.4
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

describe('Action Data Persistence Property Tests', () => {
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
   * Property 1: Action Data Persistence
   * For any valid action data (with or without exploration fields), 
   * the system should persist all provided fields correctly and maintain data integrity
   * Validates: Requirements 1.4
   */
  describe('Property 1: Action Data Persistence', () => {
    it('should persist all action fields correctly for exploration actions', async () => {
      // Property: For any action with exploration fields, all fields should be persisted correctly
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      const explorationActionData = {
        title: 'Test Exploration Action',
        description: 'Testing new irrigation method with sensors',
        policy: 'Follow safety protocols and document all measurements',
        summary_policy_text: 'Use PPE, document findings, monitor water usage',
        status: 'not_started' as const,
        assigned_to: testUserId,
        organization_id: testOrgId,
        is_exploration: true,
        exploration_code: 'SF010426EX01',
        location: 'Field A-1',
        priority: 'medium' as const
      };

      const createdAction = await actionService.createAction(explorationActionData);

      // Property: All provided fields should be persisted
      expect(createdAction).toMatchObject({
        title: explorationActionData.title,
        description: explorationActionData.description,
        policy: explorationActionData.policy,
        summary_policy_text: explorationActionData.summary_policy_text,
        status: explorationActionData.status,
        assigned_to: explorationActionData.assigned_to,
        organization_id: explorationActionData.organization_id,
        location: explorationActionData.location,
        priority: explorationActionData.priority
      });

      // Property: Action should have a valid ID and timestamps
      expect(createdAction.id).toBeDefined();
      expect(createdAction.created_at).toBeDefined();
      expect(createdAction.updated_at).toBeDefined();

      // Property: If is_exploration is true, exploration record should be created
      if (explorationActionData.is_exploration) {
        const exploration = await explorationService.getExplorationByActionId(createdAction.id);
        expect(exploration).toBeDefined();
        expect(exploration?.action_id).toBe(createdAction.id);
        expect(exploration?.exploration_code).toBe(explorationActionData.exploration_code);
      }

      // Cleanup
      await client.query('DELETE FROM exploration WHERE action_id = $1', [createdAction.id]);
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should persist regular actions without exploration fields', async () => {
      // Property: For any regular action (non-exploration), standard fields should be persisted correctly
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      const regularActionData = {
        title: 'Regular Maintenance Task',
        description: 'Standard equipment maintenance',
        policy: 'Follow maintenance schedule',
        status: 'not_started' as const,
        assigned_to: testUserId,
        organization_id: testOrgId,
        location: 'Workshop',
        priority: 'low' as const
      };

      const createdAction = await actionService.createAction(regularActionData);

      // Property: All provided fields should be persisted
      expect(createdAction).toMatchObject({
        title: regularActionData.title,
        description: regularActionData.description,
        policy: regularActionData.policy,
        status: regularActionData.status,
        assigned_to: regularActionData.assigned_to,
        organization_id: regularActionData.organization_id,
        location: regularActionData.location,
        priority: regularActionData.priority
      });

      // Property: summary_policy_text should be null for regular actions
      expect(createdAction.summary_policy_text).toBeNull();

      // Property: No exploration record should be created for regular actions
      const exploration = await explorationService.getExplorationByActionId(createdAction.id);
      expect(exploration).toBeNull();

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should handle optional fields correctly', async () => {
      // Property: For any action with optional fields omitted, the system should use appropriate defaults
      
      const testOrgId = randomUUID();
      
      const minimalActionData = {
        title: 'Minimal Action',
        description: 'Action with minimal required fields',
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(minimalActionData);

      // Property: Required fields should be persisted
      expect(createdAction.title).toBe(minimalActionData.title);
      expect(createdAction.description).toBe(minimalActionData.description);
      expect(createdAction.organization_id).toBe(minimalActionData.organization_id);

      // Property: Optional fields should have appropriate defaults
      expect(createdAction.status).toBe('not_started'); // Default status
      expect(createdAction.priority).toBe('medium'); // Default priority
      expect(createdAction.policy).toBeNull(); // Optional field
      expect(createdAction.summary_policy_text).toBeNull(); // Optional field
      expect(createdAction.assigned_to).toBeNull(); // Optional field

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should maintain data integrity across updates', async () => {
      // Property: For any action update, data integrity should be maintained
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      const initialData = {
        title: 'Initial Title',
        description: 'Initial description',
        status: 'not_started' as const,
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(initialData);
      const originalCreatedAt = createdAction.created_at;

      // Update the action
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        status: 'in_progress' as const,
        assigned_to: testUserId,
        summary_policy_text: 'Added summary policy'
      };

      const updatedAction = await actionService.updateAction(createdAction.id, updateData);

      // Property: Updated fields should reflect new values
      expect(updatedAction.title).toBe(updateData.title);
      expect(updatedAction.description).toBe(updateData.description);
      expect(updatedAction.status).toBe(updateData.status);
      expect(updatedAction.assigned_to).toBe(updateData.assigned_to);
      expect(updatedAction.summary_policy_text).toBe(updateData.summary_policy_text);

      // Property: Unchanged fields should remain the same
      expect(updatedAction.organization_id).toBe(initialData.organization_id);

      // Property: Timestamps should be updated appropriately
      expect(updatedAction.created_at).toEqual(originalCreatedAt); // Should not change
      expect(updatedAction.updated_at).not.toEqual(originalCreatedAt); // Should be updated

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should handle concurrent updates correctly', async () => {
      // Property: For any concurrent updates to the same action, data consistency should be maintained
      
      const testOrgId = randomUUID();
      
      const actionData = {
        title: 'Concurrent Test Action',
        description: 'Testing concurrent updates',
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(actionData);

      // Simulate concurrent updates
      const update1Promise = actionService.updateAction(createdAction.id, {
        status: 'in_progress' as const,
        priority: 'high' as const
      });

      const update2Promise = actionService.updateAction(createdAction.id, {
        assigned_to: randomUUID(),
        summary_policy_text: 'Concurrent update policy'
      });

      const [result1, result2] = await Promise.all([update1Promise, update2Promise]);

      // Property: Both updates should succeed (last write wins for conflicting fields)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Property: Final state should be consistent
      const finalAction = await actionService.getAction(createdAction.id);
      expect(finalAction).toBeDefined();
      expect(finalAction!.id).toBe(createdAction.id);

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });

    it('should validate required field constraints', async () => {
      // Property: For any action missing required fields, creation should fail with appropriate error
      
      const invalidActionData = [
        {}, // Missing all required fields
        { title: 'Title Only' }, // Missing description and organization_id
        { description: 'Description Only' }, // Missing title and organization_id
        { title: 'Title', description: 'Description' } // Missing organization_id
      ];

      for (const invalidData of invalidActionData) {
        // Property: Invalid data should result in creation failure
        await expect(actionService.createAction(invalidData as any))
          .rejects
          .toThrow();
      }
    });

    it('should handle large text fields correctly', async () => {
      // Property: For any action with large text content, the system should handle it correctly
      
      const testOrgId = randomUUID();
      const largeText = 'A'.repeat(10000); // 10KB of text
      
      const actionWithLargeText = {
        title: 'Large Text Action',
        description: largeText,
        policy: largeText,
        summary_policy_text: largeText,
        organization_id: testOrgId
      };

      const createdAction = await actionService.createAction(actionWithLargeText);

      // Property: Large text should be persisted correctly
      expect(createdAction.description).toBe(largeText);
      expect(createdAction.policy).toBe(largeText);
      expect(createdAction.summary_policy_text).toBe(largeText);

      // Property: Text length should be preserved
      expect(createdAction.description.length).toBe(10000);
      expect(createdAction.policy!.length).toBe(10000);
      expect(createdAction.summary_policy_text!.length).toBe(10000);

      // Cleanup
      await client.query('DELETE FROM actions WHERE id = $1', [createdAction.id]);
    });
  });
});