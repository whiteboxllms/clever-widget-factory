/**
 * Property-Based Tests for Analytics Query Support
 * 
 * Tests universal properties for analytics queries across exploration data
 * 
 * Feature: exploration-data-collection-flow, Property 15: Analytics Query Support
 * Validates: Requirements 5.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { AnalyticsService, DateRange } from '../../services/analyticsService';
import { ActionService } from '../../services/actionService';
import { ExplorationService } from '../../services/explorationService';
import { PolicyService } from '../../services/policyService';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'test_db',
  user: 'test_user',
  password: 'test_password'
};

describe('Analytics Query Support Property Tests', () => {
  let client: Client;
  let analyticsService: AnalyticsService;
  let actionService: ActionService;
  let explorationService: ExplorationService;
  let policyService: PolicyService;

  beforeEach(async () => {
    client = new Client(dbConfig);
    await client.connect();
    analyticsService = new AnalyticsService();
    actionService = new ActionService();
    explorationService = new ExplorationService();
    policyService = new PolicyService();
  });

  afterEach(async () => {
    await client.end();
  });

  /**
   * Property 15: Analytics Query Support
   * For any valid date range and filter combination, analytics queries should return 
   * consistent, accurate results with proper aggregations and calculations
   * Validates: Requirements 5.5
   */
  describe('Property 15: Analytics Query Support', () => {
    it('should calculate exploration percentages correctly for any date range', async () => {
      // Property: For any date range with actions and explorations, percentage calculations should be accurate
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create test data with known ratios
      const testActions = [
        { title: 'Regular Action 1', description: 'Non-exploration action', is_exploration: false },
        { title: 'Exploration Action 1', description: 'First exploration', is_exploration: true, exploration_code: 'SF010426EX01' },
        { title: 'Regular Action 2', description: 'Another non-exploration', is_exploration: false },
        { title: 'Exploration Action 2', description: 'Second exploration', is_exploration: true, exploration_code: 'SF010426EX02' },
        { title: 'Regular Action 3', description: 'Third non-exploration', is_exploration: false }
      ];

      const createdActions = [];
      const createdExplorations = [];

      for (const actionData of testActions) {
        const fullActionData = {
          ...actionData,
          status: 'completed' as const,
          assigned_to: testUserId,
          organization_id: testOrgId
        };

        const action = await actionService.createAction(fullActionData);
        createdActions.push(action);

        if (actionData.is_exploration) {
          const exploration = await explorationService.createExploration({
            action_id: action.id,
            exploration_code: actionData.exploration_code!,
            exploration_notes_text: 'Test exploration notes',
            metrics_text: 'Test metrics',
            public_flag: true
          });
          createdExplorations.push(exploration);
        }
      }

      // Test analytics for different date ranges
      const dateRanges: DateRange[] = [
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        { start: new Date('2026-01-01'), end: new Date('2026-12-31') },
        { start: new Date('2025-12-01'), end: new Date('2026-02-01') }
      ];

      for (const dateRange of dateRanges) {
        const analytics = await analyticsService.getExplorationPercentages(dateRange, {
          organization_id: testOrgId
        });

        // Property: Total counts should be accurate
        expect(analytics.total_actions).toBe(5);
        expect(analytics.total_explorations).toBe(2);

        // Property: Percentage calculation should be correct (2/5 = 40%)
        expect(analytics.exploration_percentage).toBe(40.0);

        // Property: Date range should be preserved in response
        expect(analytics.date_range.start).toEqual(dateRange.start);
        expect(analytics.date_range.end).toEqual(dateRange.end);
      }

      // Cleanup
      for (const exploration of createdExplorations) {
        await client.query('DELETE FROM exploration WHERE id = $1', [exploration.id]);
      }
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });

    it('should handle empty datasets correctly', async () => {
      // Property: For any date range with no data, analytics should return zero values gracefully
      
      const emptyDateRange: DateRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      };

      const analytics = await analyticsService.getExplorationPercentages(emptyDateRange);

      // Property: Empty dataset should return zero values
      expect(analytics.total_actions).toBe(0);
      expect(analytics.total_explorations).toBe(0);
      expect(analytics.exploration_percentage).toBe(0);

      // Property: Date range should still be preserved
      expect(analytics.date_range.start).toEqual(emptyDateRange.start);
      expect(analytics.date_range.end).toEqual(emptyDateRange.end);
    });

    it('should support period-based breakdowns correctly', async () => {
      // Property: For any period breakdown (day, week, month), aggregations should be accurate
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create actions across different time periods
      const timeBasedActions = [
        { date: new Date('2026-01-05'), is_exploration: true, exploration_code: 'SF010526EX01' },
        { date: new Date('2026-01-05'), is_exploration: false },
        { date: new Date('2026-01-12'), is_exploration: true, exploration_code: 'SF011226EX01' },
        { date: new Date('2026-01-12'), is_exploration: false },
        { date: new Date('2026-01-19'), is_exploration: false },
        { date: new Date('2026-01-19'), is_exploration: false }
      ];

      const createdActions = [];
      const createdExplorations = [];

      for (let i = 0; i < timeBasedActions.length; i++) {
        const actionData = timeBasedActions[i];
        const action = await actionService.createAction({
          title: `Time-based Action ${i + 1}`,
          description: `Action created on ${actionData.date.toISOString()}`,
          status: 'completed' as const,
          assigned_to: testUserId,
          organization_id: testOrgId,
          created_at: actionData.date
        });
        createdActions.push(action);

        if (actionData.is_exploration) {
          const exploration = await explorationService.createExploration({
            action_id: action.id,
            exploration_code: actionData.exploration_code!,
            exploration_notes_text: 'Time-based exploration',
            metrics_text: 'Time-based metrics',
            public_flag: true
          });
          createdExplorations.push(exploration);
        }
      }

      // Test weekly breakdown
      const weeklyAnalytics = await analyticsService.getExplorationPercentagesWithBreakdown(
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        'week',
        { organization_id: testOrgId }
      );

      // Property: Breakdown should contain data for each period
      expect(weeklyAnalytics.breakdown_by_period).toBeDefined();
      expect(weeklyAnalytics.breakdown_by_period!.period).toBe('week');
      expect(weeklyAnalytics.breakdown_by_period!.data.length).toBeGreaterThan(0);

      // Property: Sum of breakdown should equal total
      const breakdownTotalActions = weeklyAnalytics.breakdown_by_period!.data
        .reduce((sum, period) => sum + period.total_actions, 0);
      const breakdownTotalExplorations = weeklyAnalytics.breakdown_by_period!.data
        .reduce((sum, period) => sum + period.total_explorations, 0);

      expect(breakdownTotalActions).toBe(weeklyAnalytics.total_actions);
      expect(breakdownTotalExplorations).toBe(weeklyAnalytics.total_explorations);

      // Property: Each period should have correct percentage calculations
      for (const period of weeklyAnalytics.breakdown_by_period!.data) {
        if (period.total_actions > 0) {
          const expectedPercentage = Math.round((period.total_explorations / period.total_actions) * 100 * 100) / 100;
          expect(period.exploration_percentage).toBe(expectedPercentage);
        } else {
          expect(period.exploration_percentage).toBe(0);
        }
      }

      // Cleanup
      for (const exploration of createdExplorations) {
        await client.query('DELETE FROM exploration WHERE id = $1', [exploration.id]);
      }
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });

    it('should analyze patterns correctly across different entity types', async () => {
      // Property: For any dataset with patterns, pattern analysis should identify them accurately
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create test data with identifiable patterns
      const patternActions = [
        { exploration_code: 'SF010426EX01', notes: 'Irrigation efficiency test' },
        { exploration_code: 'SF010426EX02', notes: 'Irrigation system comparison' },
        { exploration_code: 'SF010526EX01', notes: 'Soil moisture monitoring' },
        { exploration_code: 'SF010526EX02', notes: 'Soil analysis experiment' }
      ];

      const createdActions = [];
      const createdExplorations = [];
      const createdPolicies = [];

      // Create policies for adoption analysis
      const policy1 = await policyService.createPolicy({
        title: 'Irrigation Safety Policy',
        description_text: 'Safety procedures for irrigation work',
        status: 'active',
        created_by_user_id: testUserId
      });
      createdPolicies.push(policy1);

      const policy2 = await policyService.createPolicy({
        title: 'Soil Testing Policy',
        description_text: 'Procedures for soil testing',
        status: 'active',
        created_by_user_id: testUserId
      });
      createdPolicies.push(policy2);

      // Create actions and explorations with pattern
      for (let i = 0; i < patternActions.length; i++) {
        const patternData = patternActions[i];
        const policyId = i < 2 ? policy1.id : policy2.id; // First 2 use policy1, rest use policy2

        const action = await actionService.createAction({
          title: `Pattern Action ${i + 1}`,
          description: `Action for pattern analysis ${i + 1}`,
          status: 'completed' as const,
          assigned_to: testUserId,
          organization_id: testOrgId,
          policy_id: policyId
        });
        createdActions.push(action);

        const exploration = await explorationService.createExploration({
          action_id: action.id,
          exploration_code: patternData.exploration_code,
          exploration_notes_text: patternData.notes,
          metrics_text: 'Pattern metrics',
          public_flag: true
        });
        createdExplorations.push(exploration);
      }

      const patternAnalysis = await analyticsService.analyzePatterns(
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        { organization_id: testOrgId }
      );

      // Property: Exploration trends should identify code patterns
      expect(patternAnalysis.exploration_trends).toBeDefined();
      expect(patternAnalysis.exploration_trends.length).toBeGreaterThan(0);

      // Property: Policy adoption should show usage statistics
      expect(patternAnalysis.policy_adoption).toBeDefined();
      expect(patternAnalysis.policy_adoption.length).toBe(2); // Two policies created

      // Property: Each policy should have correct adoption counts
      const policy1Adoption = patternAnalysis.policy_adoption.find(p => p.policy_id === policy1.id);
      const policy2Adoption = patternAnalysis.policy_adoption.find(p => p.policy_id === policy2.id);

      expect(policy1Adoption).toBeDefined();
      expect(policy1Adoption!.linked_actions_count).toBe(2);
      expect(policy2Adoption).toBeDefined();
      expect(policy2Adoption!.linked_actions_count).toBe(2);

      // Property: Adoption percentages should be calculated correctly
      const totalActions = createdActions.length;
      expect(policy1Adoption!.adoption_percentage).toBe((2 / totalActions) * 100);
      expect(policy2Adoption!.adoption_percentage).toBe((2 / totalActions) * 100);

      // Cleanup
      for (const exploration of createdExplorations) {
        await client.query('DELETE FROM exploration WHERE id = $1', [exploration.id]);
      }
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
      for (const policy of createdPolicies) {
        await client.query('DELETE FROM policy WHERE id = $1', [policy.id]);
      }
    });

    it('should handle trend analysis across different time periods', async () => {
      // Property: For any time series data, trend analysis should show accurate progression
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create actions across multiple weeks with varying exploration ratios
      const weeklyData = [
        { week: 1, actions: 4, explorations: 1 }, // 25% exploration rate
        { week: 2, actions: 6, explorations: 3 }, // 50% exploration rate
        { week: 3, actions: 8, explorations: 6 }, // 75% exploration rate
        { week: 4, actions: 10, explorations: 8 } // 80% exploration rate
      ];

      const createdActions = [];
      const createdExplorations = [];

      for (const weekData of weeklyData) {
        const weekStartDate = new Date(`2026-01-${(weekData.week - 1) * 7 + 1}`);
        
        // Create actions for this week
        for (let i = 0; i < weekData.actions; i++) {
          const isExploration = i < weekData.explorations;
          const actionDate = new Date(weekStartDate.getTime() + (i * 24 * 60 * 60 * 1000)); // Spread across week
          
          const action = await actionService.createAction({
            title: `Week ${weekData.week} Action ${i + 1}`,
            description: `Action for week ${weekData.week}`,
            status: 'completed' as const,
            assigned_to: testUserId,
            organization_id: testOrgId,
            created_at: actionDate
          });
          createdActions.push(action);

          if (isExploration) {
            const exploration = await explorationService.createExploration({
              action_id: action.id,
              exploration_code: `SF${String(actionDate.getMonth() + 1).padStart(2, '0')}${String(actionDate.getDate()).padStart(2, '0')}${String(actionDate.getFullYear()).slice(-2)}EX${String(i + 1).padStart(2, '0')}`,
              exploration_notes_text: `Week ${weekData.week} exploration notes`,
              metrics_text: `Week ${weekData.week} metrics`,
              public_flag: true
            });
            createdExplorations.push(exploration);
          }
        }
      }

      const trends = await analyticsService.getExplorationTrends(
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        'week',
        { organization_id: testOrgId }
      );

      // Property: Trends should show data for each week
      expect(trends.length).toBe(weeklyData.length);

      // Property: Each trend period should have accurate counts and percentages
      for (let i = 0; i < trends.length; i++) {
        const trend = trends[i];
        const expectedData = weeklyData[i];

        expect(trend.action_count).toBe(expectedData.actions);
        expect(trend.exploration_count).toBe(expectedData.explorations);
        
        const expectedPercentage = Math.round((expectedData.explorations / expectedData.actions) * 100 * 100) / 100;
        expect(trend.exploration_percentage).toBe(expectedPercentage);

        // Property: Exploration codes should be included
        expect(trend.top_exploration_codes).toBeDefined();
        expect(trend.top_exploration_codes.length).toBe(expectedData.explorations);
      }

      // Property: Trends should show increasing exploration percentage over time
      expect(trends[0].exploration_percentage).toBeLessThan(trends[1].exploration_percentage);
      expect(trends[1].exploration_percentage).toBeLessThan(trends[2].exploration_percentage);
      expect(trends[2].exploration_percentage).toBeLessThan(trends[3].exploration_percentage);

      // Cleanup
      for (const exploration of createdExplorations) {
        await client.query('DELETE FROM exploration WHERE id = $1', [exploration.id]);
      }
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });

    it('should support complex filtering combinations', async () => {
      // Property: For any combination of filters, results should be accurate and consistent
      
      const testOrgId = randomUUID();
      const testUserId1 = randomUUID();
      const testUserId2 = randomUUID();
      
      // Create diverse test data
      const testData = [
        { location: 'Field A', explorer: testUserId1, status: 'completed', is_exploration: true, exploration_code: 'SF010426EX01' },
        { location: 'Field A', explorer: testUserId2, status: 'completed', is_exploration: false },
        { location: 'Field B', explorer: testUserId1, status: 'in_progress', is_exploration: true, exploration_code: 'SF010426EX02' },
        { location: 'Field B', explorer: testUserId2, status: 'completed', is_exploration: true, exploration_code: 'SF010426EX03' },
        { location: 'Greenhouse', explorer: testUserId1, status: 'completed', is_exploration: false }
      ];

      const createdActions = [];
      const createdExplorations = [];

      for (let i = 0; i < testData.length; i++) {
        const data = testData[i];
        const action = await actionService.createAction({
          title: `Filter Test Action ${i + 1}`,
          description: `Action for filter testing`,
          status: data.status as any,
          assigned_to: data.explorer,
          organization_id: testOrgId,
          location: data.location
        });
        createdActions.push(action);

        if (data.is_exploration) {
          const exploration = await explorationService.createExploration({
            action_id: action.id,
            exploration_code: data.exploration_code!,
            exploration_notes_text: 'Filter test exploration',
            metrics_text: 'Filter test metrics',
            public_flag: true
          });
          createdExplorations.push(exploration);
        }
      }

      // Test various filter combinations
      const filterTests = [
        {
          filters: { location: 'Field A', organization_id: testOrgId },
          expectedActions: 2,
          expectedExplorations: 1
        },
        {
          filters: { explorer: testUserId1, organization_id: testOrgId },
          expectedActions: 3,
          expectedExplorations: 2
        },
        {
          filters: { status: 'completed', organization_id: testOrgId },
          expectedActions: 4,
          expectedExplorations: 2
        },
        {
          filters: { location: 'Field B', explorer: testUserId1, organization_id: testOrgId },
          expectedActions: 1,
          expectedExplorations: 1
        }
      ];

      for (const test of filterTests) {
        const analytics = await analyticsService.getExplorationPercentages(
          { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
          test.filters
        );

        // Property: Filtered results should match expected counts
        expect(analytics.total_actions).toBe(test.expectedActions);
        expect(analytics.total_explorations).toBe(test.expectedExplorations);

        // Property: Percentage should be calculated correctly for filtered data
        const expectedPercentage = test.expectedActions > 0 
          ? Math.round((test.expectedExplorations / test.expectedActions) * 100 * 100) / 100
          : 0;
        expect(analytics.exploration_percentage).toBe(expectedPercentage);
      }

      // Cleanup
      for (const exploration of createdExplorations) {
        await client.query('DELETE FROM exploration WHERE id = $1', [exploration.id]);
      }
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });

    it('should maintain performance with large datasets', async () => {
      // Property: For any large dataset, analytics queries should complete within reasonable time
      
      const testOrgId = randomUUID();
      const testUserId = randomUUID();
      
      // Create a larger dataset for performance testing
      const largeDatasetSize = 1000;
      const explorationRatio = 0.3; // 30% explorations
      
      const createdActions = [];
      const createdExplorations = [];

      const startTime = Date.now();

      for (let i = 0; i < largeDatasetSize; i++) {
        const isExploration = i < (largeDatasetSize * explorationRatio);
        
        const action = await actionService.createAction({
          title: `Performance Test Action ${i + 1}`,
          description: `Large dataset action ${i + 1}`,
          status: 'completed' as const,
          assigned_to: testUserId,
          organization_id: testOrgId,
          location: `Location ${i % 10}` // 10 different locations
        });
        createdActions.push(action);

        if (isExploration) {
          const exploration = await explorationService.createExploration({
            action_id: action.id,
            exploration_code: `SF010426EX${String(i + 1).padStart(3, '0')}`,
            exploration_notes_text: `Performance test exploration ${i + 1}`,
            metrics_text: `Performance metrics ${i + 1}`,
            public_flag: i % 2 === 0 // 50% public
          });
          createdExplorations.push(exploration);
        }
      }

      const dataCreationTime = Date.now() - startTime;
      console.log(`Data creation took ${dataCreationTime}ms for ${largeDatasetSize} actions`);

      // Test analytics performance
      const analyticsStartTime = Date.now();
      
      const analytics = await analyticsService.getExplorationPercentages(
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        { organization_id: testOrgId }
      );
      
      const analyticsTime = Date.now() - analyticsStartTime;

      // Property: Analytics should complete within reasonable time (< 5 seconds for 1000 records)
      expect(analyticsTime).toBeLessThan(5000);

      // Property: Results should be accurate for large dataset
      expect(analytics.total_actions).toBe(largeDatasetSize);
      expect(analytics.total_explorations).toBe(Math.floor(largeDatasetSize * explorationRatio));
      expect(analytics.exploration_percentage).toBe(explorationRatio * 100);

      // Test breakdown performance
      const breakdownStartTime = Date.now();
      
      const breakdown = await analyticsService.getExplorationPercentagesWithBreakdown(
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        'week',
        { organization_id: testOrgId }
      );
      
      const breakdownTime = Date.now() - breakdownStartTime;

      // Property: Breakdown analytics should also be performant
      expect(breakdownTime).toBeLessThan(10000); // 10 seconds for breakdown
      expect(breakdown.breakdown_by_period).toBeDefined();

      // Cleanup (this might take a while, but necessary for test isolation)
      console.log('Cleaning up large dataset...');
      for (const exploration of createdExplorations) {
        await client.query('DELETE FROM exploration WHERE id = $1', [exploration.id]);
      }
      for (const action of createdActions) {
        await client.query('DELETE FROM actions WHERE id = $1', [action.id]);
      }
    });
  });
});