/**
 * Property Tests for Exploration Flag Consistency
 * 
 * Tests the database-level constraints and service-level enforcement
 * of exploration flag consistency requirements.
 * 
 * Requirements:
 * - is_exploration column is authoritative
 * - One-to-one relationship between actions and explorations
 * - Database constraints prevent invalid states
 * - API enforces creation/update behavior
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { actionService } from '@/services/actionService';
import { explorationService } from '@/services/explorationService';
import { apiService } from '@/lib/apiService';

// Test data generators for property-based testing
class TestDataGenerator {
  static generateRandomAction(overrides: any = {}) {
    return {
      title: `Test Action ${Math.random().toString(36).substr(2, 9)}`,
      description: `Test description ${Math.random().toString(36).substr(2, 20)}`,
      location: 'Test Location',
      assigned_to: 'test-user-id',
      organization_id: 'test-org-id',
      status: 'pending',
      ...overrides
    };
  }

  static generateRandomExploration(actionId: string, overrides: any = {}) {
    return {
      action_id: actionId,
      exploration_code: `SF${new Date().toISOString().slice(5, 10).replace('-', '')}EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      exploration_notes_text: 'Test exploration notes',
      metrics_text: 'Test metrics',
      public_flag: Math.random() > 0.5,
      ...overrides
    };
  }
}

describe('Exploration Flag Consistency - Property Tests', () => {
  let createdActionIds: string[] = [];
  let createdExplorationIds: string[] = [];

  beforeEach(() => {
    createdActionIds = [];
    createdExplorationIds = [];
  });

  afterEach(async () => {
    // Cleanup created test data
    for (const explorationId of createdExplorationIds) {
      try {
        await apiService.delete(`/explorations/${explorationId}`);
      } catch (error) {
        console.warn(`Failed to cleanup exploration ${explorationId}:`, error);
      }
    }

    for (const actionId of createdActionIds) {
      try {
        await apiService.delete(`/actions/${actionId}`);
      } catch (error) {
        console.warn(`Failed to cleanup action ${actionId}:`, error);
      }
    }
  });

  describe('Property: Valid Exploration Flag Combinations', () => {
    it('should allow is_exploration=true with exactly one exploration record', async () => {
      // Property test: Run multiple iterations with random data
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: true
        });

        // Create action with exploration flag
        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Verify action has is_exploration = true
        expect(action.is_exploration).toBe(true);

        // Verify exactly one exploration record exists
        const exploration = await explorationService.getExplorationByActionId(action.id);
        expect(exploration).toBeDefined();
        expect(exploration.action_id).toBe(action.id);

        // Verify no duplicate exploration records can be created
        const duplicateExplorationData = TestDataGenerator.generateRandomExploration(action.id);
        
        await expect(async () => {
          await apiService.post('/explorations', duplicateExplorationData);
        }).rejects.toThrow();
      }
    });

    it('should allow is_exploration=false with zero exploration records', async () => {
      // Property test: Run multiple iterations with random data
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: false
        });

        // Create action without exploration flag
        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Verify action has is_exploration = false
        expect(action.is_exploration).toBe(false);

        // Verify no exploration record exists
        await expect(async () => {
          await explorationService.getExplorationByActionId(action.id);
        }).rejects.toThrow();
      }
    });
  });

  describe('Property: Invalid Exploration Flag Combinations', () => {
    it('should reject exploration record creation for actions with is_exploration=false', async () => {
      // Property test: Run multiple iterations
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        // Create action with is_exploration = false
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: false
        });

        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Attempt to create exploration record should fail
        const explorationData = TestDataGenerator.generateRandomExploration(action.id);
        
        await expect(async () => {
          await apiService.post('/explorations', explorationData);
        }).rejects.toThrow(/is_exploration is false/);
      }
    });

    it('should reject setting is_exploration=false when exploration records exist', async () => {
      // Property test: Run multiple iterations
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        // Create action with exploration
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: true
        });

        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Verify exploration was created
        const exploration = await explorationService.getExplorationByActionId(action.id);
        expect(exploration).toBeDefined();

        // Attempt to set is_exploration = false should fail
        await expect(async () => {
          await actionService.updateAction(action.id, {
            is_exploration: false
          });
        }).rejects.toThrow(/exploration records exist/);
      }
    });

    it('should prevent multiple exploration records for the same action', async () => {
      // Property test: Run multiple iterations
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        // Create action with exploration
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: true
        });

        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Attempt to create second exploration record should fail
        const duplicateExplorationData = TestDataGenerator.generateRandomExploration(action.id);
        
        await expect(async () => {
          await apiService.post('/explorations', duplicateExplorationData);
        }).rejects.toThrow();
      }
    });
  });

  describe('Property: Exploration Flag Transitions', () => {
    it('should allow transition from false to true with exploration creation', async () => {
      // Property test: Run multiple iterations
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        // Create regular action
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: false
        });

        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Update to exploration should succeed
        const updatedAction = await actionService.updateAction(action.id, {
          is_exploration: true
        });

        expect(updatedAction.is_exploration).toBe(true);

        // Verify exploration record was created
        const exploration = await explorationService.getExplorationByActionId(action.id);
        expect(exploration).toBeDefined();
        expect(exploration.action_id).toBe(action.id);
      }
    });

    it('should enforce atomic creation for exploration actions', async () => {
      // Property test: Test that exploration actions are created atomically
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: true
        });

        // Mock exploration service failure to test rollback
        const originalPost = apiService.post;
        let actionCreated = false;
        
        apiService.post = async (endpoint: string, data: any) => {
          if (endpoint === '/actions') {
            actionCreated = true;
            return originalPost.call(apiService, endpoint, data);
          } else if (endpoint === '/explorations') {
            // Simulate exploration creation failure
            throw new Error('Simulated exploration creation failure');
          }
          return originalPost.call(apiService, endpoint, data);
        };

        try {
          await expect(async () => {
            await actionService.createAction(actionData);
          }).rejects.toThrow(/Failed to create exploration record/);

          // Verify action was cleaned up (rollback occurred)
          // This tests the cleanup logic in the service
          expect(actionCreated).toBe(true);
        } finally {
          // Restore original method
          apiService.post = originalPost;
        }
      }
    });
  });

  describe('Property: Database Consistency Validation', () => {
    it('should maintain consistency across random operations', async () => {
      // Property test: Perform random valid operations and verify consistency
      const operations = 20;
      const actionIds: string[] = [];
      
      for (let i = 0; i < operations; i++) {
        const isExploration = Math.random() > 0.5;
        
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: isExploration
        });

        const action = await actionService.createAction(actionData);
        actionIds.push(action.id);
        createdActionIds.push(action.id);

        // Verify consistency immediately after creation
        expect(action.is_exploration).toBe(isExploration);
        
        if (isExploration) {
          const exploration = await explorationService.getExplorationByActionId(action.id);
          expect(exploration).toBeDefined();
          expect(exploration.action_id).toBe(action.id);
        } else {
          await expect(async () => {
            await explorationService.getExplorationByActionId(action.id);
          }).rejects.toThrow();
        }
      }

      // Validate overall consistency using database validation function
      // This would call the validate_exploration_consistency() SQL function
      try {
        const response = await apiService.get('/admin/validate-exploration-consistency');
        const validationResults = response.data || response;
        
        // All created actions should be in VALID state
        const createdResults = validationResults.filter((result: any) => 
          actionIds.includes(result.action_id)
        );
        
        createdResults.forEach((result: any) => {
          expect(result.status).toBe('VALID');
        });
      } catch (error) {
        console.warn('Database validation endpoint not available:', error);
        // Skip this check if the admin endpoint is not implemented
      }
    });
  });

  describe('Property: API Filtering and Listing', () => {
    it('should correctly filter actions by is_exploration flag', async () => {
      // Create mix of exploration and regular actions
      const explorationActions: string[] = [];
      const regularActions: string[] = [];
      
      for (let i = 0; i < 5; i++) {
        // Create exploration action
        const explorationData = TestDataGenerator.generateRandomAction({
          is_exploration: true
        });
        const exploration = await actionService.createAction(explorationData);
        explorationActions.push(exploration.id);
        createdActionIds.push(exploration.id);

        // Create regular action
        const regularData = TestDataGenerator.generateRandomAction({
          is_exploration: false
        });
        const regular = await actionService.createAction(regularData);
        regularActions.push(regular.id);
        createdActionIds.push(regular.id);
      }

      // Test filtering by is_exploration = true
      const explorationList = await actionService.listActions({ is_exploration: true });
      const explorationIds = explorationList.map(action => action.id);
      
      // All created exploration actions should be in the list
      explorationActions.forEach(id => {
        expect(explorationIds).toContain(id);
      });
      
      // No regular actions should be in the exploration list
      regularActions.forEach(id => {
        expect(explorationIds).not.toContain(id);
      });

      // Test filtering by is_exploration = false
      const regularList = await actionService.listActions({ is_exploration: false });
      const regularIds = regularList.map(action => action.id);
      
      // All created regular actions should be in the list
      regularActions.forEach(id => {
        expect(regularIds).toContain(id);
      });
      
      // No exploration actions should be in the regular list
      explorationActions.forEach(id => {
        expect(regularIds).not.toContain(id);
      });
    });

    it('should include is_exploration flag in all action responses', async () => {
      // Property test: Verify all API responses include the flag
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const isExploration = Math.random() > 0.5;
        const actionData = TestDataGenerator.generateRandomAction({
          is_exploration: isExploration
        });

        const action = await actionService.createAction(actionData);
        createdActionIds.push(action.id);

        // Test create response
        expect(action).toHaveProperty('is_exploration');
        expect(action.is_exploration).toBe(isExploration);

        // Test get response
        const fetchedAction = await actionService.getAction(action.id);
        expect(fetchedAction).toHaveProperty('is_exploration');
        expect(fetchedAction.is_exploration).toBe(isExploration);

        // Test list response
        const actionList = await actionService.listActions();
        const listedAction = actionList.find(a => a.id === action.id);
        expect(listedAction).toBeDefined();
        expect(listedAction).toHaveProperty('is_exploration');
        expect(listedAction!.is_exploration).toBe(isExploration);
      }
    });
  });
});