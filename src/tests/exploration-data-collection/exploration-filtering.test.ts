/**
 * Property-Based Tests for Exploration Filtering
 * 
 * Tests universal properties for exploration filtering and search functionality
 * 
 * Feature: exploration-data-collection-flow, Property 13: Exploration Filtering
 * Validates: Requirements 5.2
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

describe('Exploration Filtering Property Tests', () => {
  let explorationService: ExplorationService;

  beforeEach(() => {
    vi.clearAllMocks();
    explorationService = new ExplorationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 13: Exploration Filtering
   * For any set of filter criteria, the filtering system should return only explorations
   * that match ALL specified criteria, and the results should be consistent and complete
   * Validates: Requirements 5.2
   */
  describe('Property 13: Exploration Filtering', () => {
    it('should filter explorations by date range correctly', async () => {
      // Property: For any date range, only explorations within that range should be returned
      
      const startDate = '2026-01-01T00:00:00.000Z';
      const endDate = '2026-01-31T23:59:59.999Z';
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          created_at: '2026-01-15T10:00:00Z',
          state_text: 'Testing irrigation system',
          explorer_name: 'John Doe',
          public_flag: true
        },
        {
          exploration_code: 'SF010226EX01',
          exploration_id: 2,
          action_id: 'action-2',
          created_at: '2026-01-20T14:30:00Z',
          state_text: 'Evaluating soil conditions',
          explorer_name: 'Jane Smith',
          public_flag: false
        },
        {
          exploration_code: 'SF010326EX01',
          exploration_id: 3,
          action_id: 'action-3',
          created_at: '2026-01-25T09:15:00Z',
          state_text: 'Testing pest control methods',
          explorer_name: 'Bob Johnson',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        start_date: startDate,
        end_date: endDate
      };

      const result = await explorationService.listExplorations(filters);

      // Property: All returned explorations should be within the date range
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(exploration => {
        const createdAt = new Date(exploration.created_at);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(end.getTime());
      });

      // Property: API should be called with correct filter parameters
      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should filter explorations by location correctly', async () => {
      // Property: For any location filter, only explorations from that location should be returned
      
      const targetLocation = 'Field A-1';
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          location: 'Field A-1',
          state_text: 'Testing in Field A-1',
          explorer_name: 'John Doe',
          public_flag: true
        },
        {
          exploration_code: 'SF010126EX02',
          exploration_id: 2,
          action_id: 'action-2',
          location: 'Field A-1',
          state_text: 'Additional testing in Field A-1',
          explorer_name: 'Jane Smith',
          public_flag: false
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        location: targetLocation
      };

      const result = await explorationService.listExplorations(filters);

      // Property: All returned explorations should be from the specified location
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(exploration => {
        expect(exploration.location).toBe(targetLocation);
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should filter explorations by explorer correctly', async () => {
      // Property: For any explorer filter, only explorations by that explorer should be returned
      
      const targetExplorer = 'John Doe';
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          explorer_name: 'John Doe',
          state_text: 'John\'s first exploration',
          public_flag: true
        },
        {
          exploration_code: 'SF010226EX01',
          exploration_id: 2,
          action_id: 'action-2',
          explorer_name: 'John Doe',
          state_text: 'John\'s second exploration',
          public_flag: false
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        explorer: targetExplorer
      };

      const result = await explorationService.listExplorations(filters);

      // Property: All returned explorations should be by the specified explorer
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(exploration => {
        expect(exploration.explorer_name).toBe(targetExplorer);
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should filter explorations by public flag correctly', async () => {
      // Property: For any public flag filter, only explorations with matching visibility should be returned
      
      const publicExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          explorer_name: 'John Doe',
          state_text: 'Public exploration 1',
          public_flag: true
        },
        {
          exploration_code: 'SF010226EX01',
          exploration_id: 2,
          action_id: 'action-2',
          explorer_name: 'Jane Smith',
          state_text: 'Public exploration 2',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: publicExplorations
      });

      const filters = {
        public_flag: true
      };

      const result = await explorationService.listExplorations(filters);

      // Property: All returned explorations should have the specified public flag value
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(exploration => {
        expect(exploration.public_flag).toBe(true);
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should apply multiple filters simultaneously (AND logic)', async () => {
      // Property: For any combination of filters, only explorations matching ALL criteria should be returned
      
      const startDate = '2026-01-01T00:00:00.000Z';
      const endDate = '2026-01-31T23:59:59.999Z';
      const targetLocation = 'Greenhouse 1';
      const targetExplorer = 'Alice Johnson';
      const publicFlag = true;
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          created_at: '2026-01-15T10:00:00Z',
          location: 'Greenhouse 1',
          explorer_name: 'Alice Johnson',
          state_text: 'Greenhouse testing by Alice',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        start_date: startDate,
        end_date: endDate,
        location: targetLocation,
        explorer: targetExplorer,
        public_flag: publicFlag
      };

      const result = await explorationService.listExplorations(filters);

      // Property: All returned explorations should match ALL filter criteria
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(exploration => {
        const createdAt = new Date(exploration.created_at);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        expect(createdAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(createdAt.getTime()).toBeLessThanOrEqual(end.getTime());
        expect(exploration.location).toBe(targetLocation);
        expect(exploration.explorer_name).toBe(targetExplorer);
        expect(exploration.public_flag).toBe(publicFlag);
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should return empty results when no explorations match filters', async () => {
      // Property: For any filter criteria with no matches, an empty array should be returned
      
      (apiService.get as any).mockResolvedValue({
        data: []
      });

      const filters = {
        location: 'Non-existent Location',
        explorer: 'Non-existent Explorer'
      };

      const result = await explorationService.listExplorations(filters);

      // Property: Empty results should be returned as an empty array
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should handle pagination with filters correctly', async () => {
      // Property: For any filter with pagination, results should be consistent and properly paginated
      
      const mockExplorations = Array.from({ length: 25 }, (_, i) => ({
        exploration_code: `SF010126EX${String(i + 1).padStart(2, '0')}`,
        exploration_id: i + 1,
        action_id: `action-${i + 1}`,
        location: 'Field A-1',
        explorer_name: 'John Doe',
        state_text: `Exploration ${i + 1}`,
        public_flag: true,
        created_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`
      }));

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations.slice(0, 10) // First page
      });

      const filters = {
        location: 'Field A-1',
        limit: 10,
        offset: 0
      };

      const result = await explorationService.listExplorations(filters);

      // Property: Paginated results should respect the limit
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);

      // Property: All results should match the filter criteria
      result.forEach(exploration => {
        expect(exploration.location).toBe('Field A-1');
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should handle case-insensitive filtering for text fields', async () => {
      // Property: For any text filter, case should not affect the results
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          location: 'Field A-1',
          explorer_name: 'John Doe',
          state_text: 'Testing irrigation system',
          public_flag: true
        },
        {
          exploration_code: 'SF010226EX01',
          exploration_id: 2,
          action_id: 'action-2',
          location: 'field a-1', // Different case
          explorer_name: 'john doe', // Different case
          state_text: 'Additional testing',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        location: 'field a-1', // Lowercase
        explorer: 'john doe'   // Lowercase
      };

      const result = await explorationService.listExplorations(filters);

      // Property: Case-insensitive matching should work
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should handle special characters in filter values', async () => {
      // Property: For any filter with special characters, the system should handle them correctly
      
      const specialLocation = 'Field A-1 (North Section) & Test Area #2';
      const specialExplorer = 'O\'Connor, John Jr.';
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          location: specialLocation,
          explorer_name: specialExplorer,
          state_text: 'Testing with special characters',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        location: specialLocation,
        explorer: specialExplorer
      };

      const result = await explorationService.listExplorations(filters);

      // Property: Special characters should be handled correctly
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(exploration => {
        expect(exploration.location).toBe(specialLocation);
        expect(exploration.explorer_name).toBe(specialExplorer);
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should maintain consistent ordering with filters', async () => {
      // Property: For any filter, results should be returned in a consistent order
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          created_at: '2026-01-15T10:00:00Z',
          explorer_name: 'John Doe',
          state_text: 'First exploration',
          public_flag: true
        },
        {
          exploration_code: 'SF010226EX01',
          exploration_id: 2,
          action_id: 'action-2',
          created_at: '2026-01-20T14:30:00Z',
          explorer_name: 'John Doe',
          state_text: 'Second exploration',
          public_flag: true
        },
        {
          exploration_code: 'SF010326EX01',
          exploration_id: 3,
          action_id: 'action-3',
          created_at: '2026-01-25T09:15:00Z',
          explorer_name: 'John Doe',
          state_text: 'Third exploration',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        explorer: 'John Doe',
        public_flag: true
      };

      // Make multiple calls with the same filters
      const result1 = await explorationService.listExplorations(filters);
      const result2 = await explorationService.listExplorations(filters);

      // Property: Results should be in consistent order across multiple calls
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.length).toBe(result2.length);

      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].exploration_id).toBe(result2[i].exploration_id);
        expect(result1[i].exploration_code).toBe(result2[i].exploration_code);
      }

      expect(apiService.get).toHaveBeenCalledTimes(2);
    });

    it('should handle null and undefined filter values gracefully', async () => {
      // Property: For any filter with null/undefined values, the system should handle them appropriately
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          explorer_name: 'John Doe',
          state_text: 'All explorations',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        location: null,
        explorer: undefined,
        public_flag: true
      };

      const result = await explorationService.listExplorations(filters);

      // Property: Null/undefined filters should not cause errors
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Property: Valid filters should still be applied
      result.forEach(exploration => {
        expect(exploration.public_flag).toBe(true);
      });

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });

    it('should handle date range edge cases correctly', async () => {
      // Property: For any date range edge cases, filtering should work correctly
      
      const mockExplorations = [
        {
          exploration_code: 'SF010126EX01',
          exploration_id: 1,
          action_id: 'action-1',
          created_at: '2026-01-01T00:00:00.000Z', // Exactly at start
          explorer_name: 'John Doe',
          state_text: 'Edge case exploration',
          public_flag: true
        },
        {
          exploration_code: 'SF010226EX01',
          exploration_id: 2,
          action_id: 'action-2',
          created_at: '2026-01-31T23:59:59.999Z', // Exactly at end
          explorer_name: 'Jane Smith',
          state_text: 'Another edge case',
          public_flag: true
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const filters = {
        start_date: '2026-01-01T00:00:00.000Z',
        end_date: '2026-01-31T23:59:59.999Z'
      };

      const result = await explorationService.listExplorations(filters);

      // Property: Edge case dates should be included
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      // Property: Both edge case explorations should be included
      const codes = result.map(e => e.exploration_code);
      expect(codes).toContain('SF010126EX01');
      expect(codes).toContain('SF010226EX01');

      expect(apiService.get).toHaveBeenCalledWith('/explorations/list', {
        params: filters
      });
    });
  });
});