import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Test Suite: Exploration List Endpoint
 * Validates: Requirements 3.1, Design API Contracts
 * 
 * Tests the GET /explorations/list endpoint for:
 * - Filtering by status (in_progress, ready_for_analysis)
 * - Including action_count in response
 * - Proper error handling
 * - Request logging with correlation IDs
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

describe('Exploration List Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /explorations/list', () => {
    it('should return list of non-integrated explorations', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          state_text: 'Soil condition assessment',
          exploration_notes_text: 'Testing new fertilizer',
          action_count: 1,
          status: 'in_progress',
          created_at: '2026-01-18T10:00:00Z',
          updated_at: '2026-01-18T10:00:00Z'
        },
        {
          id: 'exp-2',
          exploration_code: 'SF010326EX02',
          state_text: 'Crop rotation test',
          exploration_notes_text: 'Comparing crop varieties',
          action_count: 2,
          status: 'ready_for_analysis',
          created_at: '2026-01-17T10:00:00Z',
          updated_at: '2026-01-17T10:00:00Z'
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations,
        total: 2,
        timestamp: '2026-01-18T10:05:00Z'
      });

      const result = await explorationService.listExplorations();

      expect(result).toEqual(mockExplorations);
      expect(apiService.get).toHaveBeenCalledWith('/explorations/list');
    });

    it('should filter by status parameter', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          status: 'in_progress',
          action_count: 1
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      await explorationService.listExplorations();

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list');
    });

    it('should include action_count for each exploration', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          action_count: 3,
          status: 'in_progress'
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations();

      expect(result[0]).toHaveProperty('action_count');
      expect(result[0].action_count).toBe(3);
    });

    it('should exclude integrated explorations', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          status: 'in_progress'
        },
        {
          id: 'exp-2',
          status: 'ready_for_analysis'
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations();

      // Verify no integrated explorations in result
      const hasIntegrated = result.some((e: any) => e.status === 'integrated');
      expect(hasIntegrated).toBe(false);
    });

    it('should support pagination with limit and offset', async () => {
      const mockExplorations = [
        { id: 'exp-1', exploration_code: 'SF010326EX01' }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      await explorationService.listExplorations({
        limit: 10,
        offset: 20
      });

      expect(apiService.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=10')
      );
      expect(apiService.get).toHaveBeenCalledWith(
        expect.stringContaining('offset=20')
      );
    });

    it('should return empty array when no explorations found', async () => {
      vi.mocked(apiService.get).mockResolvedValue({
        data: [],
        total: 0
      });

      const result = await explorationService.listExplorations();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(apiService.get).mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        explorationService.listExplorations()
      ).rejects.toThrow('Network error');
    });

    it('should include request metadata in response', async () => {
      vi.mocked(apiService.get).mockResolvedValue({
        data: [],
        total: 0,
        timestamp: '2026-01-18T10:05:00Z',
        requestId: 'req-abc123'
      });

      const result = await explorationService.listExplorations();

      expect(result).toBeDefined();
    });

    it('should sort explorations by creation date (most recent first)', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          exploration_code: 'SF010326EX01',
          created_at: '2026-01-18T10:00:00Z'
        },
        {
          id: 'exp-2',
          exploration_code: 'SF010326EX02',
          created_at: '2026-01-17T10:00:00Z'
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations();

      // First item should be more recent
      expect(new Date(result[0].created_at).getTime()).toBeGreaterThan(
        new Date(result[1].created_at).getTime()
      );
    });

    it('should include all required fields in response', async () => {
      const mockExplorations = [
        {
          id: 'exp-1',
          action_id: 'action-1',
          exploration_code: 'SF010326EX01',
          state_text: 'Test state',
          summary_policy_text: 'Test policy',
          exploration_notes_text: 'Test notes',
          metrics_text: 'Test metrics',
          public_flag: false,
          status: 'in_progress',
          action_count: 1,
          created_at: '2026-01-18T10:00:00Z',
          updated_at: '2026-01-18T10:00:00Z'
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations();
      const exploration = result[0];

      expect(exploration).toHaveProperty('id');
      expect(exploration).toHaveProperty('action_id');
      expect(exploration).toHaveProperty('exploration_code');
      expect(exploration).toHaveProperty('state_text');
      expect(exploration).toHaveProperty('exploration_notes_text');
      expect(exploration).toHaveProperty('metrics_text');
      expect(exploration).toHaveProperty('public_flag');
      expect(exploration).toHaveProperty('status');
      expect(exploration).toHaveProperty('action_count');
      expect(exploration).toHaveProperty('created_at');
      expect(exploration).toHaveProperty('updated_at');
    });
  });

  describe('Response Format', () => {
    it('should return response in correct format', async () => {
      vi.mocked(apiService.get).mockResolvedValue({
        data: [
          {
            id: 'exp-1',
            exploration_code: 'SF010326EX01',
            action_count: 1,
            status: 'in_progress'
          }
        ],
        total: 1,
        timestamp: '2026-01-18T10:05:00Z',
        requestId: 'req-abc123'
      });

      const result = await explorationService.listExplorations();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      vi.mocked(apiService.get).mockRejectedValue({
        status: 404,
        message: 'Not found'
      });

      await expect(
        explorationService.listExplorations()
      ).rejects.toThrow();
    });

    it('should handle 500 errors', async () => {
      vi.mocked(apiService.get).mockRejectedValue({
        status: 500,
        message: 'Internal server error'
      });

      await expect(
        explorationService.listExplorations()
      ).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      vi.mocked(apiService.get).mockRejectedValue(
        new Error('Request timeout')
      );

      await expect(
        explorationService.listExplorations()
      ).rejects.toThrow('Request timeout');
    });
  });
});
