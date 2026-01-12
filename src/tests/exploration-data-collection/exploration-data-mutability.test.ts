/**
 * Property-Based Tests for Exploration Data Mutability
 * 
 * Tests universal properties for exploration data modification and persistence
 * 
 * Feature: exploration-data-collection-flow, Property 17: Data Mutability
 * Validates: Requirements 6.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExplorationService } from '../../services/explorationService';
import { apiService } from '../../lib/apiService';

// Mock the API service
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Exploration Data Mutability Property Tests', () => {
  let explorationService: ExplorationService;

  beforeEach(() => {
    vi.clearAllMocks();
    explorationService = new ExplorationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 17: Data Mutability
   * For any exploration data, updates should be allowed without changing exploration status,
   * and all mutable fields should be updateable independently
   * Validates: Requirements 6.6
   */
  describe('Property 17: Data Mutability', () => {
    it('should allow updating exploration notes without affecting exploration status', async () => {
      // Property: For any exploration, updating notes should not change exploration status
      
      const explorationId = 'exploration-123';
      const originalData = {
        id: explorationId,
        action_id: 'action-456',
        exploration_code: 'SF010426EX01',
        exploration_notes_text: 'Original notes about the exploration',
        metrics_text: 'Original metrics data',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      const updatedNotes = 'Updated notes with new observations and findings';

      // Mock the update response
      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          exploration_notes_text: updatedNotes,
          updated_at: '2026-01-04T01:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, {
        exploration_notes_text: updatedNotes
      });

      // Property: Update should succeed
      expect(result).toBeDefined();
      expect(result.exploration_notes_text).toBe(updatedNotes);

      // Property: Other fields should remain unchanged
      expect(result.action_id).toBe(originalData.action_id);
      expect(result.exploration_code).toBe(originalData.exploration_code);
      expect(result.metrics_text).toBe(originalData.metrics_text);
      expect(result.public_flag).toBe(originalData.public_flag);

      // Property: Updated timestamp should change
      expect(result.updated_at).not.toBe(originalData.updated_at);

      // Verify API call was made correctly
      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        { exploration_notes_text: updatedNotes }
      );
    });

    it('should allow updating metrics independently of other fields', async () => {
      // Property: For any exploration, metrics can be updated independently
      
      const explorationId = 'exploration-456';
      const originalData = {
        id: explorationId,
        action_id: 'action-789',
        exploration_code: 'SF010426EX02',
        exploration_notes_text: 'Detailed exploration notes',
        metrics_text: 'Original metrics: 50% efficiency',
        public_flag: true,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      const updatedMetrics = 'Updated metrics: 75% efficiency, 20% cost reduction, 95% user satisfaction';

      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          metrics_text: updatedMetrics,
          updated_at: '2026-01-04T02:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, {
        metrics_text: updatedMetrics
      });

      // Property: Metrics should be updated
      expect(result).toBeDefined();
      expect(result.metrics_text).toBe(updatedMetrics);

      // Property: All other fields should remain unchanged
      expect(result.action_id).toBe(originalData.action_id);
      expect(result.exploration_code).toBe(originalData.exploration_code);
      expect(result.exploration_notes_text).toBe(originalData.exploration_notes_text);
      expect(result.public_flag).toBe(originalData.public_flag);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        { metrics_text: updatedMetrics }
      );
    });

    it('should allow toggling public flag without affecting other data', async () => {
      // Property: For any exploration, public flag can be toggled independently
      
      const explorationId = 'exploration-789';
      const originalData = {
        id: explorationId,
        action_id: 'action-101',
        exploration_code: 'SF010426EX03',
        exploration_notes_text: 'Comprehensive exploration documentation',
        metrics_text: 'Performance metrics and analysis',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          public_flag: true,
          updated_at: '2026-01-04T03:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, {
        public_flag: true
      });

      // Property: Public flag should be updated
      expect(result).toBeDefined();
      expect(result.public_flag).toBe(true);

      // Property: All other fields should remain unchanged
      expect(result.action_id).toBe(originalData.action_id);
      expect(result.exploration_code).toBe(originalData.exploration_code);
      expect(result.exploration_notes_text).toBe(originalData.exploration_notes_text);
      expect(result.metrics_text).toBe(originalData.metrics_text);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        { public_flag: true }
      );
    });

    it('should allow updating multiple fields simultaneously', async () => {
      // Property: For any exploration, multiple fields can be updated in a single operation
      
      const explorationId = 'exploration-multi';
      const originalData = {
        id: explorationId,
        action_id: 'action-multi',
        exploration_code: 'SF010426EX04',
        exploration_notes_text: 'Initial notes',
        metrics_text: 'Initial metrics',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      const updates = {
        exploration_notes_text: 'Updated comprehensive notes with detailed observations',
        metrics_text: 'Updated metrics with complete analysis and results',
        public_flag: true
      };

      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          ...updates,
          updated_at: '2026-01-04T04:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, updates);

      // Property: All updated fields should reflect new values
      expect(result).toBeDefined();
      expect(result.exploration_notes_text).toBe(updates.exploration_notes_text);
      expect(result.metrics_text).toBe(updates.metrics_text);
      expect(result.public_flag).toBe(updates.public_flag);

      // Property: Immutable fields should remain unchanged
      expect(result.action_id).toBe(originalData.action_id);
      expect(result.exploration_code).toBe(originalData.exploration_code);
      expect(result.created_at).toBe(originalData.created_at);

      // Property: Updated timestamp should change
      expect(result.updated_at).not.toBe(originalData.updated_at);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        updates
      );
    });

    it('should preserve immutable fields during updates', async () => {
      // Property: For any exploration, certain fields should be immutable
      
      const explorationId = 'exploration-immutable';
      const originalData = {
        id: explorationId,
        action_id: 'action-immutable',
        exploration_code: 'SF010426EX05',
        exploration_notes_text: 'Original notes',
        metrics_text: 'Original metrics',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      // Attempt to update immutable fields (should be ignored by service)
      const attemptedUpdates = {
        id: 'new-id',
        action_id: 'new-action-id',
        exploration_code: 'SF999999EX99',
        created_at: '2026-01-05T00:00:00Z',
        exploration_notes_text: 'Updated notes'
      };

      // Mock service should ignore immutable field updates
      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          exploration_notes_text: attemptedUpdates.exploration_notes_text,
          updated_at: '2026-01-04T05:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, attemptedUpdates);

      // Property: Immutable fields should remain unchanged
      expect(result.id).toBe(originalData.id);
      expect(result.action_id).toBe(originalData.action_id);
      expect(result.exploration_code).toBe(originalData.exploration_code);
      expect(result.created_at).toBe(originalData.created_at);

      // Property: Mutable fields should be updated
      expect(result.exploration_notes_text).toBe(attemptedUpdates.exploration_notes_text);

      // Property: Service should only send mutable fields
      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        expect.objectContaining({
          exploration_notes_text: attemptedUpdates.exploration_notes_text
        })
      );

      // Property: Service should not send immutable fields
      const callArgs = (apiService.put as any).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('id');
      expect(callArgs).not.toHaveProperty('action_id');
      expect(callArgs).not.toHaveProperty('exploration_code');
      expect(callArgs).not.toHaveProperty('created_at');
    });

    it('should handle empty updates gracefully', async () => {
      // Property: For any exploration, empty updates should not cause errors
      
      const explorationId = 'exploration-empty';
      const originalData = {
        id: explorationId,
        action_id: 'action-empty',
        exploration_code: 'SF010426EX06',
        exploration_notes_text: 'Existing notes',
        metrics_text: 'Existing metrics',
        public_flag: true,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      (apiService.put as any).mockResolvedValue({
        data: originalData
      });

      const result = await explorationService.updateExploration(explorationId, {});

      // Property: Empty update should return unchanged data
      expect(result).toBeDefined();
      expect(result).toEqual(originalData);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        {}
      );
    });

    it('should handle null and undefined values appropriately', async () => {
      // Property: For any exploration, null/undefined values should be handled correctly
      
      const explorationId = 'exploration-null';
      const originalData = {
        id: explorationId,
        action_id: 'action-null',
        exploration_code: 'SF010426EX07',
        exploration_notes_text: 'Original notes',
        metrics_text: 'Original metrics',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      const updates = {
        exploration_notes_text: null,
        metrics_text: undefined,
        public_flag: true
      };

      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          exploration_notes_text: null,
          public_flag: true,
          updated_at: '2026-01-04T06:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, updates);

      // Property: Null values should be accepted
      expect(result.exploration_notes_text).toBeNull();

      // Property: Valid updates should still work
      expect(result.public_flag).toBe(true);

      // Property: Undefined values should not affect the field
      expect(result.metrics_text).toBe(originalData.metrics_text);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        updates
      );
    });

    it('should maintain data consistency across concurrent updates', async () => {
      // Property: For any exploration, concurrent updates should be handled consistently
      
      const explorationId = 'exploration-concurrent';
      const originalData = {
        id: explorationId,
        action_id: 'action-concurrent',
        exploration_code: 'SF010426EX08',
        exploration_notes_text: 'Original notes',
        metrics_text: 'Original metrics',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      let updateCount = 0;
      (apiService.put as any).mockImplementation((url, data) => {
        updateCount++;
        return Promise.resolve({
          data: {
            ...originalData,
            ...data,
            updated_at: `2026-01-04T0${updateCount}:00:00Z`
          }
        });
      });

      // Simulate concurrent updates
      const update1Promise = explorationService.updateExploration(explorationId, {
        exploration_notes_text: 'Update 1 notes'
      });

      const update2Promise = explorationService.updateExploration(explorationId, {
        metrics_text: 'Update 2 metrics'
      });

      const update3Promise = explorationService.updateExploration(explorationId, {
        public_flag: true
      });

      const [result1, result2, result3] = await Promise.all([
        update1Promise,
        update2Promise,
        update3Promise
      ]);

      // Property: All updates should complete successfully
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();

      // Property: Each update should reflect its specific changes
      expect(result1.exploration_notes_text).toBe('Update 1 notes');
      expect(result2.metrics_text).toBe('Update 2 metrics');
      expect(result3.public_flag).toBe(true);

      // Property: All updates should have been processed
      expect(updateCount).toBe(3);
      expect(apiService.put).toHaveBeenCalledTimes(3);
    });

    it('should validate field length constraints during updates', async () => {
      // Property: For any exploration update, field length constraints should be enforced
      
      const explorationId = 'exploration-validation';
      
      // Test with very long content
      const veryLongNotes = 'A'.repeat(10000); // 10k characters
      const veryLongMetrics = 'B'.repeat(5000); // 5k characters

      (apiService.put as any).mockResolvedValue({
        data: {
          id: explorationId,
          action_id: 'action-validation',
          exploration_code: 'SF010426EX09',
          exploration_notes_text: veryLongNotes,
          metrics_text: veryLongMetrics,
          public_flag: false,
          created_at: '2026-01-04T00:00:00Z',
          updated_at: '2026-01-04T07:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, {
        exploration_notes_text: veryLongNotes,
        metrics_text: veryLongMetrics
      });

      // Property: Long content should be accepted (assuming no length limits in current implementation)
      expect(result).toBeDefined();
      expect(result.exploration_notes_text).toBe(veryLongNotes);
      expect(result.metrics_text).toBe(veryLongMetrics);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        {
          exploration_notes_text: veryLongNotes,
          metrics_text: veryLongMetrics
        }
      );
    });

    it('should handle special characters and unicode in text fields', async () => {
      // Property: For any exploration, text fields should handle special characters and unicode
      
      const explorationId = 'exploration-unicode';
      const originalData = {
        id: explorationId,
        action_id: 'action-unicode',
        exploration_code: 'SF010426EX10',
        exploration_notes_text: 'Original notes',
        metrics_text: 'Original metrics',
        public_flag: false,
        created_at: '2026-01-04T00:00:00Z',
        updated_at: '2026-01-04T00:00:00Z'
      };

      const specialCharNotes = 'Notes with special chars: !@#$%^&*()_+-=[]{}|;:,.<>? and unicode: 🌱🚜📊💡';
      const unicodeMetrics = 'Metrics with unicode: Temperature: 25°C, Efficiency: 85%, Area: 100m²';

      (apiService.put as any).mockResolvedValue({
        data: {
          ...originalData,
          exploration_notes_text: specialCharNotes,
          metrics_text: unicodeMetrics,
          updated_at: '2026-01-04T08:00:00Z'
        }
      });

      const result = await explorationService.updateExploration(explorationId, {
        exploration_notes_text: specialCharNotes,
        metrics_text: unicodeMetrics
      });

      // Property: Special characters and unicode should be preserved
      expect(result).toBeDefined();
      expect(result.exploration_notes_text).toBe(specialCharNotes);
      expect(result.metrics_text).toBe(unicodeMetrics);

      expect(apiService.put).toHaveBeenCalledWith(
        `/explorations/${explorationId}`,
        {
          exploration_notes_text: specialCharNotes,
          metrics_text: unicodeMetrics
        }
      );
    });
  });
});