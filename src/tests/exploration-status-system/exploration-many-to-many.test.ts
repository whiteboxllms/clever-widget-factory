import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Test Suite: Exploration Many-to-Many Relationships
 * Validates: Requirements 1.1, 1.3, 1.4, 3.4, 3.5
 * 
 * Tests the many-to-many relationship between actions and explorations:
 * - Creating explorations without requiring an action
 * - Linking actions to explorations
 * - Unlinking actions from explorations
 * - Proper action_count calculation
 * - Error handling for invalid operations
 */

// Mock the API service before importing the service
vi.mock('../../lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../../services/explorationCodeGenerator', () => ({
  explorationCodeGenerator: {
    generateCode: vi.fn()
  }
}));

vi.mock('../../services/embeddingQueue', () => ({
  embeddingQueue: {
    enqueueExplorationEmbeddings: vi.fn()
  }
}));

// Import after mocking
import { explorationService } from '../../services/explorationService';
import { apiService } from '../../lib/apiService';
import { explorationCodeGenerator } from '../../services/explorationCodeGenerator';

describe('Exploration Many-to-Many Relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Exploration Without Action', () => {
    it('should create exploration without requiring any action', async () => {
      const mockExploration = {
        id: 'exp-1',
        exploration_code: 'SF010326EX01',
        status: 'in_progress',
        exploration_notes_text: null,
        metrics_text: null,
        public_flag: false,
        created_at: '2026-01-18T10:00:00Z',
        updated_at: '2026-01-18T10:00:00Z'
      };

      vi.mocked(explorationCodeGenerator.generateCode).mockResolvedValue('SF010326EX01');
      vi.mocked(apiService.post).mockResolvedValue({
        data: mockExploration
      });

      const result = await explorationService.createNewExploration();

      expect(result).toEqual(mockExploration);
      expect(result).not.toHaveProperty('primary_action_id');
      expect(apiService.post).toHaveBeenCalledWith(
        '/explorations',
        expect.objectContaining({
          exploration_code: 'SF010326EX01',
          status: 'in_progress'
        })
      );
    });

    it('should auto-generate exploration code', async () => {
      vi.mocked(explorationCodeGenerator.generateCode).mockResolvedValue('SF010326EX02');
      vi.mocked(apiService.post).mockResolvedValue({
        data: { id: 'exp-2', exploration_code: 'SF010326EX02' }
      });

      await explorationService.createNewExploration();

      expect(explorationCodeGenerator.generateCode).toHaveBeenCalled();
    });

    it('should set status to in_progress by default', async () => {
      vi.mocked(explorationCodeGenerator.generateCode).mockResolvedValue('SF010326EX03');
      vi.mocked(apiService.post).mockResolvedValue({
        data: { id: 'exp-3', status: 'in_progress' }
      });

      await explorationService.createNewExploration();

      expect(apiService.post).toHaveBeenCalledWith(
        '/explorations',
        expect.objectContaining({
          status: 'in_progress'
        })
      );
    });
  });

  describe('Link Action to Exploration', () => {
    it('should link single action to exploration', async () => {
      const mockResponse = {
        action: {
          id: 'action-1',
          title: 'Test action',
          exploration_ids: ['exp-1']
        },
        explorations: [
          {
            id: 'exp-1',
            exploration_code: 'SF010326EX01',
            action_count: 1
          }
        ]
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExploration('action-1', 'exp-1');

      expect(result).toEqual(mockResponse);
      expect(apiService.post).toHaveBeenCalledWith(
        '/actions/action-1/explorations',
        { exploration_ids: ['exp-1'] }
      );
    });

    it('should link multiple actions to same exploration', async () => {
      const mockResponse = {
        action: {
          id: 'action-2',
          exploration_ids: ['exp-1']
        },
        explorations: [
          {
            id: 'exp-1',
            action_count: 2
          }
        ]
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExplorations('action-2', ['exp-1']);

      expect(result.explorations[0].action_count).toBe(2);
    });

    it('should return updated action_count after linking', async () => {
      const mockResponse = {
        explorations: [
          {
            id: 'exp-1',
            exploration_code: 'SF010326EX01',
            action_count: 3
          }
        ]
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExploration('action-3', 'exp-1');

      expect(result.explorations[0].action_count).toBe(3);
    });

    it('should handle linking to non-existent exploration', async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        status: 404,
        message: 'Exploration not found'
      });

      await expect(
        explorationService.linkExploration('action-1', 'exp-999')
      ).rejects.toThrow();
    });

    it('should prevent linking to integrated exploration', async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        status: 409,
        message: 'Cannot link to archived exploration'
      });

      await expect(
        explorationService.linkExploration('action-1', 'exp-integrated')
      ).rejects.toThrow();
    });

    it('should handle non-existent action', async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        status: 404,
        message: 'Action not found'
      });

      await expect(
        explorationService.linkExploration('action-999', 'exp-1')
      ).rejects.toThrow();
    });
  });

  describe('Unlink Action from Exploration', () => {
    it('should unlink action from exploration', async () => {
      const mockResponse = {
        action: {
          id: 'action-1',
          exploration_ids: []
        },
        message: 'Exploration unlinked successfully'
      };

      vi.mocked(apiService.delete).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.unlinkExploration('action-1', 'exp-1');

      expect(result.action.exploration_ids).toEqual([]);
      expect(apiService.delete).toHaveBeenCalledWith(
        '/actions/action-1/explorations/exp-1'
      );
    });

    it('should handle unlinking non-existent action', async () => {
      vi.mocked(apiService.delete).mockRejectedValue({
        status: 404,
        message: 'Action not found'
      });

      await expect(
        explorationService.unlinkExploration('action-999', 'exp-1')
      ).rejects.toThrow();
    });

    it('should handle unlinking non-existent link', async () => {
      vi.mocked(apiService.delete).mockResolvedValue({
        data: {
          action: { id: 'action-1', exploration_ids: [] },
          message: 'Exploration unlinked successfully'
        }
      });

      const result = await explorationService.unlinkExploration('action-1', 'exp-999');

      expect(result.action.exploration_ids).toEqual([]);
    });
  });

  describe('Get Non-Integrated Explorations', () => {
    it('should return only non-integrated explorations', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          status: 'in_progress',
          action_count: 1
        },
        {
          id: 'exp-2',
          exploration_code: 'SF010326EX02',
          status: 'ready_for_analysis',
          action_count: 2
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.getNonIntegratedExplorations();

      expect(result).toEqual(mockExplorations);
      expect(result.every((e: any) => e.status !== 'integrated')).toBe(true);
      expect(apiService.get).toHaveBeenCalledWith(
        '/explorations/list?status=in_progress,ready_for_analysis'
      );
    });

    it('should include action_count for each exploration', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          action_count: 3
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.getNonIntegratedExplorations();

      expect(result[0]).toHaveProperty('action_count');
      expect(result[0].action_count).toBe(3);
    });

    it('should return empty array when no explorations found', async () => {
      vi.mocked(apiService.get).mockResolvedValue({
        data: []
      });

      const result = await explorationService.getNonIntegratedExplorations();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      vi.mocked(apiService.get).mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        explorationService.getNonIntegratedExplorations()
      ).rejects.toThrow('Network error');
    });
  });

  describe('Action Count Accuracy', () => {
    it('should reflect correct action_count after linking', async () => {
      const mockResponse = {
        explorations: [
          {
            id: 'exp-1',
            exploration_code: 'SF010326EX01',
            action_count: 1
          }
        ]
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExploration('action-1', 'exp-1');

      expect(result.explorations[0].action_count).toBe(1);
    });

    it('should increment action_count when linking additional action', async () => {
      const mockResponse = {
        explorations: [
          {
            id: 'exp-1',
            exploration_code: 'SF010326EX01',
            action_count: 2
          }
        ]
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExploration('action-2', 'exp-1');

      expect(result.explorations[0].action_count).toBe(2);
    });

    it('should show zero action_count for newly created exploration', async () => {
      const mockExploration = {
        id: 'exp-new',
        exploration_code: 'SF010326EX99',
        action_count: 0,
        status: 'in_progress'
      };

      vi.mocked(explorationCodeGenerator.generateCode).mockResolvedValue('SF010326EX99');
      vi.mocked(apiService.post).mockResolvedValue({
        data: mockExploration
      });

      const result = await explorationService.createNewExploration();

      expect(result.action_count).toBe(0);
    });
  });

  describe('Response Format', () => {
    it('should include all required fields in link response', async () => {
      const mockResponse = {
        action: {
          id: 'action-1',
          title: 'Test',
          exploration_ids: ['exp-1']
        },
        explorations: [
          {
            id: 'exp-1',
            exploration_code: 'SF010326EX01',
            status: 'in_progress',
            action_count: 1,
            created_at: '2026-01-18T10:00:00Z'
          }
        ]
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExploration('action-1', 'exp-1');

      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('explorations');
      expect(result.action).toHaveProperty('exploration_ids');
      expect(result.explorations[0]).toHaveProperty('action_count');
    });

    it('should include requestId in response for tracing', async () => {
      const mockResponse = {
        action: { id: 'action-1' },
        explorations: [],
        requestId: 'req-abc123'
      };

      vi.mocked(apiService.post).mockResolvedValue({
        data: mockResponse
      });

      const result = await explorationService.linkExploration('action-1', 'exp-1');

      expect(result).toHaveProperty('requestId');
    });
  });

  describe('Error Handling', () => {
    it('should handle 409 conflict when linking to integrated exploration', async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        status: 409,
        code: 'EXPLORATION_INTEGRATED',
        message: 'Cannot link to archived exploration'
      });

      await expect(
        explorationService.linkExploration('action-1', 'exp-integrated')
      ).rejects.toThrow();
    });

    it('should handle 404 when exploration not found', async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        status: 404,
        code: 'EXPLORATION_NOT_FOUND',
        message: 'Exploration not found'
      });

      await expect(
        explorationService.linkExploration('action-1', 'exp-999')
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      vi.mocked(apiService.post).mockRejectedValue(
        new Error('Network timeout')
      );

      await expect(
        explorationService.linkExploration('action-1', 'exp-1')
      ).rejects.toThrow('Network timeout');
    });
  });
});
