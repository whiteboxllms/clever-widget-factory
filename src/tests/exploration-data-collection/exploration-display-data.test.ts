/**
 * Property-Based Tests for Exploration Display Data
 * 
 * Tests universal properties for exploration data display and presentation
 * 
 * Feature: exploration-data-collection-flow, Property 14: Exploration Display Data
 * Validates: Requirements 5.3
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

describe('Exploration Display Data Property Tests', () => {
  let explorationService: ExplorationService;

  beforeEach(() => {
    vi.clearAllMocks();
    explorationService = new ExplorationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 14: Exploration Display Data
   * For any exploration data returned for display, it should include all required fields
   * with associated action information and be properly formatted for presentation
   * Validates: Requirements 5.3
   */
  describe('Property 14: Exploration Display Data', () => {
    it('should include all required exploration fields in display data', async () => {
      // Property: For any exploration display, all essential fields should be present
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          state_text: 'Testing new irrigation system with drip technology',
          summary_policy_text: 'Use drip irrigation with monitoring and documentation',
          exploration_notes_text: 'Initial testing shows 40% water savings',
          metrics_text: 'Water usage: 60L/m², Efficiency: 85%, Cost: $120/acre',
          key_photos: ['photo1.jpg', 'photo2.jpg'],
          explorer_name: 'John Doe',
          location: 'Field A-1',
          public_flag: true,
          created_at: '2026-01-04T10:00:00Z',
          updated_at: '2026-01-04T15:30:00Z'
        },
        {
          exploration_code: 'SF010526EX01',
          exploration_id: 2,
          action_id: 'action-456',
          state_text: 'Evaluating organic pest control methods',
          summary_policy_text: 'Apply organic compounds following safety protocols',
          exploration_notes_text: 'Reduced pest activity by 75% with minimal environmental impact',
          metrics_text: 'Pest reduction: 75%, Cost: $45/acre, Application time: 2 hours',
          key_photos: ['pest_before.jpg', 'pest_after.jpg', 'application.jpg'],
          explorer_name: 'Jane Smith',
          location: 'Greenhouse 2',
          public_flag: false,
          created_at: '2026-01-05T08:15:00Z',
          updated_at: '2026-01-05T16:45:00Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations({});

      // Property: All explorations should have required display fields
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      result.forEach(exploration => {
        // Property: Core identification fields should be present
        expect(exploration.exploration_code).toBeTruthy();
        expect(exploration.exploration_id).toBeDefined();
        expect(exploration.action_id).toBeTruthy();

        // Property: Content fields should be present
        expect(exploration.state_text).toBeTruthy();
        expect(exploration.summary_policy_text).toBeTruthy();
        expect(exploration.exploration_notes_text).toBeTruthy();
        expect(exploration.metrics_text).toBeTruthy();

        // Property: Metadata fields should be present
        expect(exploration.explorer_name).toBeTruthy();
        expect(exploration.location).toBeTruthy();
        expect(exploration.public_flag).toBeDefined();
        expect(exploration.created_at).toBeTruthy();
        expect(exploration.updated_at).toBeTruthy();

        // Property: Photo array should be present (even if empty)
        expect(exploration.key_photos).toBeDefined();
        expect(Array.isArray(exploration.key_photos)).toBe(true);
      });
    });

    it('should include associated action information in display data', async () => {
      // Property: For any exploration display, associated action data should be included
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          action_title: 'Irrigation System Upgrade',
          action_status: 'in_progress',
          action_priority: 'high',
          action_assigned_to: 'maintenance-team',
          state_text: 'Testing new irrigation system',
          summary_policy_text: 'Follow safety protocols during testing',
          exploration_notes_text: 'System performing well',
          metrics_text: 'Efficiency: 90%',
          key_photos: [],
          explorer_name: 'John Doe',
          location: 'Field A-1',
          public_flag: true,
          created_at: '2026-01-04T10:00:00Z',
          updated_at: '2026-01-04T15:30:00Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations({});

      // Property: Action information should be included
      expect(result).toBeDefined();
      expect(result.length).toBe(1);

      const exploration = result[0];
      expect(exploration.action_id).toBe('action-123');
      expect(exploration.action_title).toBe('Irrigation System Upgrade');
      expect(exploration.action_status).toBe('in_progress');
      expect(exploration.action_priority).toBe('high');
      expect(exploration.action_assigned_to).toBe('maintenance-team');
    });

    it('should handle missing or null fields gracefully in display data', async () => {
      // Property: For any exploration with missing fields, display should handle gracefully
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          state_text: 'Testing system',
          summary_policy_text: null, // Null field
          exploration_notes_text: '', // Empty field
          metrics_text: 'Basic metrics',
          key_photos: null, // Null array
          explorer_name: 'John Doe',
          location: undefined, // Undefined field
          public_flag: false,
          created_at: '2026-01-04T10:00:00Z',
          updated_at: '2026-01-04T15:30:00Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations({});

      // Property: Missing fields should not break display
      expect(result).toBeDefined();
      expect(result.length).toBe(1);

      const exploration = result[0];
      expect(exploration.exploration_code).toBeTruthy();
      expect(exploration.state_text).toBeTruthy();
      expect(exploration.metrics_text).toBeTruthy();
      expect(exploration.explorer_name).toBeTruthy();

      // Property: Null/undefined fields should be handled
      expect(exploration.summary_policy_text).toBeNull();
      expect(exploration.exploration_notes_text).toBe('');
      expect(exploration.location).toBeUndefined();
      expect(exploration.key_photos).toBeNull();
    });

    it('should format dates consistently in display data', async () => {
      // Property: For any exploration display, dates should be in consistent ISO format
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          state_text: 'Testing system',
          summary_policy_text: 'Follow protocols',
          exploration_notes_text: 'Progress notes',
          metrics_text: 'Performance data',
          key_photos: [],
          explorer_name: 'John Doe',
          location: 'Field A-1',
          public_flag: true,
          created_at: '2026-01-04T10:00:00.000Z',
          updated_at: '2026-01-04T15:30:45.123Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations({});

      // Property: Dates should be in valid ISO format
      expect(result).toBeDefined();
      expect(result.length).toBe(1);

      const exploration = result[0];
      
      // Property: Dates should be valid ISO strings
      expect(exploration.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(exploration.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Property: Dates should be parseable
      expect(() => new Date(exploration.created_at)).not.toThrow();
      expect(() => new Date(exploration.updated_at)).not.toThrow();

      // Property: Parsed dates should be valid
      const createdDate = new Date(exploration.created_at);
      const updatedDate = new Date(exploration.updated_at);
      expect(createdDate.getTime()).not.toBeNaN();
      expect(updatedDate.getTime()).not.toBeNaN();
    });

    it('should include photo information with proper structure in display data', async () => {
      // Property: For any exploration with photos, photo data should be properly structured
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          state_text: 'Testing with photos',
          summary_policy_text: 'Document with photos',
          exploration_notes_text: 'Visual documentation included',
          metrics_text: 'Photo analysis results',
          key_photos: [
            'https://example.com/photos/before.jpg',
            'https://example.com/photos/during.jpg',
            'https://example.com/photos/after.jpg'
          ],
          explorer_name: 'John Doe',
          location: 'Field A-1',
          public_flag: true,
          created_at: '2026-01-04T10:00:00Z',
          updated_at: '2026-01-04T15:30:00Z'
        },
        {
          exploration_code: 'SF010526EX01',
          exploration_id: 2,
          action_id: 'action-456',
          state_text: 'Testing without photos',
          summary_policy_text: 'No visual documentation',
          exploration_notes_text: 'Text-only documentation',
          metrics_text: 'Numerical data only',
          key_photos: [], // Empty array
          explorer_name: 'Jane Smith',
          location: 'Greenhouse 1',
          public_flag: false,
          created_at: '2026-01-05T08:00:00Z',
          updated_at: '2026-01-05T12:00:00Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations({});

      // Property: Photo arrays should be properly structured
      expect(result).toBeDefined();
      expect(result.length).toBe(2);

      const explorationWithPhotos = result[0];
      const explorationWithoutPhotos = result[1];

      // Property: Photos should be in array format
      expect(Array.isArray(explorationWithPhotos.key_photos)).toBe(true);
      expect(Array.isArray(explorationWithoutPhotos.key_photos)).toBe(true);

      // Property: Photo URLs should be strings
      explorationWithPhotos.key_photos.forEach(photo => {
        expect(typeof photo).toBe('string');
        expect(photo.length).toBeGreaterThan(0);
      });

      // Property: Empty photo arrays should be valid
      expect(explorationWithoutPhotos.key_photos.length).toBe(0);
    });

    it('should maintain data consistency across multiple display requests', async () => {
      // Property: For any exploration, display data should be consistent across requests
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          state_text: 'Consistent testing data',
          summary_policy_text: 'Consistent policy text',
          exploration_notes_text: 'Consistent notes',
          metrics_text: 'Consistent metrics',
          key_photos: ['photo1.jpg'],
          explorer_name: 'John Doe',
          location: 'Field A-1',
          public_flag: true,
          created_at: '2026-01-04T10:00:00Z',
          updated_at: '2026-01-04T15:30:00Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      // Make multiple requests
      const result1 = await explorationService.listExplorations({});
      const result2 = await explorationService.listExplorations({});

      // Property: Results should be identical across requests
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.length).toBe(result2.length);

      for (let i = 0; i < result1.length; i++) {
        const exp1 = result1[i];
        const exp2 = result2[i];

        expect(exp1.exploration_code).toBe(exp2.exploration_code);
        expect(exp1.exploration_id).toBe(exp2.exploration_id);
        expect(exp1.action_id).toBe(exp2.action_id);
        expect(exp1.state_text).toBe(exp2.state_text);
        expect(exp1.summary_policy_text).toBe(exp2.summary_policy_text);
        expect(exp1.exploration_notes_text).toBe(exp2.exploration_notes_text);
        expect(exp1.metrics_text).toBe(exp2.metrics_text);
        expect(exp1.explorer_name).toBe(exp2.explorer_name);
        expect(exp1.location).toBe(exp2.location);
        expect(exp1.public_flag).toBe(exp2.public_flag);
        expect(exp1.created_at).toBe(exp2.created_at);
        expect(exp1.updated_at).toBe(exp2.updated_at);
      }
    });

    it('should handle special characters and unicode in display data', async () => {
      // Property: For any exploration with special characters, display should preserve them
      
      const mockExplorations = [
        {
          exploration_code: 'SF010426EX01',
          exploration_id: 1,
          action_id: 'action-123',
          state_text: 'Testing with special chars: !@#$%^&*()_+-=[]{}|;:,.<>? and unicode: 🌱🚜📊💡',
          summary_policy_text: 'Policy with unicode: Temperature: 25°C, Area: 100m², Efficiency: 85%',
          exploration_notes_text: 'Notes with quotes: "excellent results" and apostrophes: it\'s working',
          metrics_text: 'Metrics with symbols: ±5%, ≥90%, ≤10%, ∞ potential',
          key_photos: ['file with spaces.jpg', 'file-with-dashes.jpg', 'file_with_underscores.jpg'],
          explorer_name: 'José María O\'Connor-Smith',
          location: 'Field A-1 (North Section) & Test Area #2',
          public_flag: true,
          created_at: '2026-01-04T10:00:00Z',
          updated_at: '2026-01-04T15:30:00Z'
        }
      ];

      (apiService.get as any).mockResolvedValue({
        data: mockExplorations
      });

      const result = await explorationService.listExplorations({});

      // Property: Special characters should be preserved
      expect(result).toBeDefined();
      expect(result.length).toBe(1);

      const exploration = result[0];
      
      // Property: Unicode and special characters should be intact
      expect(exploration.state_text).toContain('🌱🚜📊💡');
      expect(exploration.state_text).toContain('!@#$%^&*()_+-=[]{}|;:,.<>?');
      expect(exploration.summary_policy_text).toContain('25°C');
      expect(exploration.summary_policy_text).toContain('100m²');
      expect(exploration.exploration_notes_text).toContain('"excellent results"');
      expect(exploration.exploration_notes_text).toContain('it\'s working');
      expect(exploration.metrics_text).toContain('±5%');
      expect(exploration.metrics_text).toContain('≥90%');
      expect(exploration.explorer_name).toContain('José María');
      expect(exploration.explorer_name).toContain('O\'Connor-Smith');
      expect(exploration.location).toContain('(North Section) & Test Area #2');
    });

    it('should provide complete data for single exploration display', async () => {
      // Property: For any single exploration request, all detailed data should be included
      
      const explorationId = 'exploration-123';
      const mockExploration = {
        exploration_code: 'SF010426EX01',
        exploration_id: 1,
        action_id: 'action-123',
        action_title: 'Comprehensive Testing Project',
        action_status: 'in_progress',
        action_priority: 'high',
        action_assigned_to: 'research-team',
        action_created_at: '2026-01-01T09:00:00Z',
        state_text: 'Comprehensive testing of new agricultural techniques',
        summary_policy_text: 'Follow all safety protocols and document thoroughly',
        exploration_notes_text: 'Detailed observations and findings from the exploration process',
        metrics_text: 'Comprehensive metrics including efficiency, cost, and environmental impact',
        key_photos: [
          'https://example.com/photos/setup.jpg',
          'https://example.com/photos/process.jpg',
          'https://example.com/photos/results.jpg'
        ],
        explorer_name: 'Dr. Sarah Johnson',
        location: 'Research Field Alpha-7',
        public_flag: true,
        created_at: '2026-01-04T10:00:00Z',
        updated_at: '2026-01-04T15:30:00Z',
        tags: ['irrigation', 'efficiency', 'sustainability'],
        related_explorations: ['SF010326EX02', 'SF010226EX01']
      };

      (apiService.get as any).mockResolvedValue({
        data: mockExploration
      });

      const result = await explorationService.getExploration(explorationId);

      // Property: Single exploration should include all available data
      expect(result).toBeDefined();
      expect(result.exploration_code).toBe('SF010426EX01');
      expect(result.exploration_id).toBe(1);
      expect(result.action_id).toBe('action-123');

      // Property: Action details should be included
      expect(result.action_title).toBe('Comprehensive Testing Project');
      expect(result.action_status).toBe('in_progress');
      expect(result.action_priority).toBe('high');
      expect(result.action_assigned_to).toBe('research-team');
      expect(result.action_created_at).toBe('2026-01-01T09:00:00Z');

      // Property: All exploration content should be present
      expect(result.state_text).toBeTruthy();
      expect(result.summary_policy_text).toBeTruthy();
      expect(result.exploration_notes_text).toBeTruthy();
      expect(result.metrics_text).toBeTruthy();

      // Property: Metadata should be complete
      expect(result.explorer_name).toBe('Dr. Sarah Johnson');
      expect(result.location).toBe('Research Field Alpha-7');
      expect(result.public_flag).toBe(true);
      expect(result.created_at).toBeTruthy();
      expect(result.updated_at).toBeTruthy();

      // Property: Additional data should be included if available
      if (result.tags) {
        expect(Array.isArray(result.tags)).toBe(true);
      }
      if (result.related_explorations) {
        expect(Array.isArray(result.related_explorations)).toBe(true);
      }
    });

    it('should handle large datasets efficiently in display data', async () => {
      // Property: For any large dataset, display should handle efficiently
      
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        exploration_code: `SF010426EX${String(i + 1).padStart(3, '0')}`,
        exploration_id: i + 1,
        action_id: `action-${i + 1}`,
        state_text: `Testing scenario ${i + 1} with comprehensive data`,
        summary_policy_text: `Policy for scenario ${i + 1}`,
        exploration_notes_text: `Detailed notes for exploration ${i + 1}`,
        metrics_text: `Metrics and analysis for test ${i + 1}`,
        key_photos: [`photo${i + 1}_1.jpg`, `photo${i + 1}_2.jpg`],
        explorer_name: `Explorer ${i + 1}`,
        location: `Field ${String.fromCharCode(65 + (i % 26))}-${i + 1}`,
        public_flag: i % 2 === 0,
        created_at: `2026-01-${String(Math.floor(i / 3) + 1).padStart(2, '0')}T10:00:00Z`,
        updated_at: `2026-01-${String(Math.floor(i / 3) + 1).padStart(2, '0')}T15:30:00Z`
      }));

      (apiService.get as any).mockResolvedValue({
        data: largeDataset
      });

      const startTime = Date.now();
      const result = await explorationService.listExplorations({});
      const endTime = Date.now();

      // Property: Large datasets should be handled efficiently
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(100);

      // Property: Response time should be reasonable (less than 5 seconds for processing)
      expect(endTime - startTime).toBeLessThan(5000);

      // Property: All items should have required fields
      result.forEach((exploration, index) => {
        expect(exploration.exploration_code).toBeTruthy();
        expect(exploration.exploration_id).toBe(index + 1);
        expect(exploration.action_id).toBeTruthy();
        expect(exploration.state_text).toBeTruthy();
        expect(exploration.explorer_name).toBeTruthy();
        expect(exploration.location).toBeTruthy();
      });
    });
  });
});