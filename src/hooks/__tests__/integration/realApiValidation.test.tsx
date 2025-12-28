/**
 * Integration Test: Real API Response Validation
 * 
 * Tests action mutations against actual Lambda endpoints
 * Validates server-computed affected resources are properly cached
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActionMutations } from '../../useActionMutations';
import { TestDataManager } from './testDataManager';
import { skipIfNotIntegrationEnv } from './config';
import React from 'react';

// Skip if not in integration test environment
if (skipIfNotIntegrationEnv()) {
  describe.skip('Integration Tests - Real API Validation', () => {});
} else {
  describe('Integration Tests - Real API Validation', () => {
    let queryClient: QueryClient;
    let testDataManager: TestDataManager;
    let wrapper: React.ComponentType<{ children: React.ReactNode }>;

    beforeAll(async () => {
      testDataManager = new TestDataManager();
      await testDataManager.setupTestEnvironment();
    });

    afterAll(async () => {
      await testDataManager.teardownTestEnvironment();
    });

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false }
        }
      });

      wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    });

    afterEach(async () => {
      queryClient.clear();
    });

    /**
     * Test: Create action through real Lambda endpoint
     * Validates: Requirements 7.1
     */
    it('should create actions through actual Lambda endpoints', async () => {
      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Create action through real API
      const testAction = await testDataManager.createTestAction({
        title: 'Real API Test Action',
        description: 'Testing real Lambda endpoint',
        status: 'pending',
        priority: 'high'
      });

      expect(testAction).toBeDefined();
      expect(testAction.id).toBeDefined();
      expect(testAction.title).toBe('Real API Test Action');
      expect(testAction.status).toBe('pending');
      expect(testAction.priority).toBe('high');

      // Verify action exists in database
      const retrievedAction = await testDataManager.getTestAction(testAction.id);
      expect(retrievedAction).toBeDefined();
      expect(retrievedAction?.id).toBe(testAction.id);
    }, 30000);

    /**
     * Test: Update action and verify server-computed affected resources
     * Validates: Requirements 7.2
     */
    it('should handle server-computed affected resources correctly', async () => {
      // Create test action and tools
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        required_tools: []
      });
      
      const testTools = await testDataManager.createTestTools(2);
      const toolIds = testTools.map(tool => tool.id);

      // Setup initial cache state
      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Update action to require tools and change status
      const updateData = {
        status: 'in_progress' as const,
        required_tools: toolIds,
        title: 'Updated with tools'
      };

      result.current.updateAction.mutate({
        id: testAction.id,
        updates: updateData
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify the mutation succeeded
      expect(result.current.updateAction.isSuccess).toBe(true);
      expect(result.current.updateAction.isError).toBe(false);

      // Verify cache was updated with server response
      const updatedActionsCache = queryClient.getQueryData<any[]>(['actions']);
      expect(updatedActionsCache).toBeDefined();
      
      const updatedAction = updatedActionsCache?.find(action => action.id === testAction.id);
      expect(updatedAction).toBeDefined();
      expect(updatedAction?.status).toBe('in_progress');
      expect(updatedAction?.required_tools).toEqual(toolIds);
      expect(updatedAction?.title).toBe('Updated with tools');

      // Verify tools cache was updated with server-computed checkout status
      const updatedToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      expect(updatedToolsCache?.data).toBeDefined();
      
      // Check that tools are now marked as checked out
      const updatedTools = updatedToolsCache?.data.filter(tool => toolIds.includes(tool.id));
      expect(updatedTools).toBeDefined();
      expect(updatedTools?.length).toBe(2);
      
      // Verify server computed the checkout status correctly
      updatedTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
        expect(tool.checked_out_user_id).toBeDefined();
      });

      // Verify against actual database state
      const dbTools = await testDataManager.getTestTools(toolIds);
      dbTools.forEach(dbTool => {
        const cachedTool = updatedTools?.find(t => t.id === dbTool.id);
        expect(cachedTool?.is_checked_out).toBe(dbTool.is_checked_out);
      });
    }, 45000);

    /**
     * Test: Action completion updates tool checkout status
     * Validates: Requirements 7.2, 7.5
     */
    it('should update tool checkout status when action is completed', async () => {
      // Create test action and tools
      const testTools = await testDataManager.createTestTools(2);
      const toolIds = testTools.map(tool => tool.id);
      
      const testAction = await testDataManager.createTestAction({
        status: 'in_progress',
        required_tools: toolIds
      });

      // Setup initial cache state
      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Complete the action
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: { status: 'completed' }
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify action status updated
      const updatedActionsCache = queryClient.getQueryData<any[]>(['actions']);
      const completedAction = updatedActionsCache?.find(action => action.id === testAction.id);
      expect(completedAction?.status).toBe('completed');

      // Verify tools are no longer checked out (server should have created checkins)
      const updatedToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const updatedTools = updatedToolsCache?.data.filter(tool => toolIds.includes(tool.id));
      
      updatedTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(false);
        expect(tool.checked_out_user_id).toBeNull();
      });

      // Verify against actual database state
      const dbTools = await testDataManager.getTestTools(toolIds);
      dbTools.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(false);
      });
    }, 45000);

    /**
     * Test: Performance validation - optimistic updates are immediate
     * Validates: Requirements 7.8
     */
    it('should provide immediate optimistic updates while measuring real response times', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        title: 'Performance Test Action'
      });

      // Setup initial cache state
      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      const updateData = {
        title: 'Optimistically Updated Title',
        status: 'in_progress' as const
      };

      // Measure optimistic update timing
      const optimisticStartTime = performance.now();
      
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: updateData
      });

      // Verify optimistic update happened immediately (< 50ms)
      const optimisticEndTime = performance.now();
      const optimisticDuration = optimisticEndTime - optimisticStartTime;
      
      expect(optimisticDuration).toBeLessThan(50);

      // Verify cache was updated optimistically
      const optimisticCache = queryClient.getQueryData<any[]>(['actions']);
      const optimisticAction = optimisticCache?.find(action => action.id === testAction.id);
      expect(optimisticAction?.title).toBe('Optimistically Updated Title');
      expect(optimisticAction?.status).toBe('in_progress');

      // Wait for server response and measure total time
      const serverStartTime = performance.now();
      
      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      const serverEndTime = performance.now();
      const serverDuration = serverEndTime - serverStartTime;

      // Verify server response took longer than optimistic update
      expect(serverDuration).toBeGreaterThan(optimisticDuration);

      // Verify debug information reflects real timing
      const debugInfo = result.current.getMutationDebugInfo();
      expect(Array.isArray(debugInfo)).toBe(true);
      
      const mutationInfo = debugInfo.find((info: any) => 
        info.mutationId.includes(testAction.id)
      );
      expect(mutationInfo).toBeDefined();
      expect(mutationInfo.duration).toBeGreaterThan(0);
      expect(mutationInfo.status).toBe('succeeded');

      console.log('Performance metrics:', {
        optimisticDuration,
        serverDuration,
        debugDuration: mutationInfo.duration
      });
    }, 30000);

    /**
     * Test: Cache consistency with real server responses
     * Validates: Requirements 7.6
     */
    it('should maintain cache consistency with real server responses', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        priority: 'low'
      });

      // Setup initial cache state
      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Perform multiple updates
      const updates = [
        { priority: 'medium' as const },
        { priority: 'high' as const },
        { status: 'in_progress' as const }
      ];

      for (const update of updates) {
        result.current.updateAction.mutate({
          id: testAction.id,
          updates: update
        });

        await waitFor(() => {
          expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
        }, { timeout: 15000 });

        // Reset mutation state for next update
        result.current.updateAction.reset();
      }

      // Verify final cache state matches server
      const finalCache = queryClient.getQueryData<any[]>(['actions']);
      const finalAction = finalCache?.find(action => action.id === testAction.id);
      
      expect(finalAction?.priority).toBe('high');
      expect(finalAction?.status).toBe('in_progress');

      // Verify against actual database
      const dbAction = await testDataManager.getTestAction(testAction.id);
      expect(dbAction?.priority).toBe(finalAction?.priority);
      expect(dbAction?.status).toBe(finalAction?.status);
    }, 60000);
  });
}