/**
 * Integration Test: Offline/Online Workflows
 * 
 * Tests network disconnection and mutation queuing with real endpoints
 * Validates proper execution order when connectivity is restored
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActionMutations } from '../../useActionMutations';
import { TestDataManager } from './testDataManager';
import { NetworkSimulator } from './networkSimulator';
import { skipIfNotIntegrationEnv } from './config';
import React from 'react';

// Skip if not in integration test environment
if (skipIfNotIntegrationEnv()) {
  describe.skip('Integration Tests - Offline/Online Workflows', () => {});
} else {
  describe('Integration Tests - Offline/Online Workflows', () => {
    let queryClient: QueryClient;
    let testDataManager: TestDataManager;
    let networkSimulator: NetworkSimulator;
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
          mutations: { 
            retry: 3, // Enable retry for offline testing
            retryDelay: 1000 // Shorter delay for testing
          }
        }
      });

      networkSimulator = new NetworkSimulator();

      wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    });

    afterEach(async () => {
      networkSimulator.cleanup();
      queryClient.clear();
    });

    /**
     * Test: Offline mutation queuing and execution order
     * Validates: Requirements 7.4
     */
    it('should queue mutations while offline and execute in order when online', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        title: 'Offline Test Action',
        priority: 'low'
      });

      // Setup initial cache state
      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Go offline
      networkSimulator.goOffline();

      // Queue multiple mutations while offline
      const mutations = [
        { title: 'Offline Update 1', priority: 'medium' as const },
        { title: 'Offline Update 2', priority: 'high' as const },
        { title: 'Offline Update 3', status: 'in_progress' as const }
      ];

      // Trigger mutations while offline
      mutations.forEach((updates, index) => {
        setTimeout(() => {
          result.current.updateAction.mutate({
            id: testAction.id,
            updates
          });
        }, index * 100); // Stagger the mutations
      });

      // Wait for mutations to be queued
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify mutations are queued (not completed)
      expect(networkSimulator.getQueuedRequestCount()).toBeGreaterThan(0);
      
      // Verify optimistic updates are preserved while offline
      const offlineCache = queryClient.getQueryData<any[]>(['actions']);
      const offlineAction = offlineCache?.find(action => action.id === testAction.id);
      
      // Should have the last optimistic update
      expect(offlineAction?.title).toBe('Offline Update 3');
      expect(offlineAction?.status).toBe('in_progress');
      expect(offlineAction?.priority).toBe('high');

      // Go back online
      await networkSimulator.goOnline();

      // Wait for queued mutations to execute
      await waitFor(() => {
        return networkSimulator.getQueuedRequestCount() === 0;
      }, { timeout: 30000 });

      // Wait for final mutation to complete
      await waitFor(() => {
        expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
      }, { timeout: 15000 });

      // Verify final state matches server
      const finalCache = queryClient.getQueryData<any[]>(['actions']);
      const finalAction = finalCache?.find(action => action.id === testAction.id);
      
      // Verify the final state reflects all mutations
      expect(finalAction?.title).toBe('Offline Update 3');
      expect(finalAction?.status).toBe('in_progress');
      expect(finalAction?.priority).toBe('high');

      // Verify against database
      const dbAction = await testDataManager.getTestAction(testAction.id);
      expect(dbAction?.title).toBe(finalAction?.title);
      expect(dbAction?.status).toBe(finalAction?.status);
      expect(dbAction?.priority).toBe(finalAction?.priority);
    }, 60000);

    /**
     * Test: Network interruption during mutation
     * Validates: Requirements 7.4
     */
    it('should handle network interruption during mutation execution', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        title: 'Network Interruption Test'
      });

      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Start a mutation
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: { title: 'Updated During Network Issue' }
      });

      // Simulate network going down shortly after mutation starts
      setTimeout(() => {
        networkSimulator.goOffline();
      }, 50);

      // Wait for the mutation to be queued or fail
      await waitFor(() => {
        return result.current.updateAction.isError || 
               result.current.updateAction.isPending ||
               networkSimulator.getQueuedRequestCount() > 0;
      }, { timeout: 10000 });

      // Verify optimistic update is preserved
      const offlineCache = queryClient.getQueryData<any[]>(['actions']);
      const offlineAction = offlineCache?.find(action => action.id === testAction.id);
      expect(offlineAction?.title).toBe('Updated During Network Issue');

      // Restore network
      await networkSimulator.goOnline();

      // Wait for mutation to complete
      await waitFor(() => {
        return result.current.updateAction.isSuccess;
      }, { timeout: 20000 });

      // Verify final state
      const finalCache = queryClient.getQueryData<any[]>(['actions']);
      const finalAction = finalCache?.find(action => action.id === testAction.id);
      expect(finalAction?.title).toBe('Updated During Network Issue');

      // Verify against database
      const dbAction = await testDataManager.getTestAction(testAction.id);
      expect(dbAction?.title).toBe('Updated During Network Issue');
    }, 45000);

    /**
     * Test: Multiple offline sessions with different mutations
     * Validates: Requirements 7.4
     */
    it('should handle multiple offline/online cycles correctly', async () => {
      const testActions = await Promise.all([
        testDataManager.createTestAction({ status: 'pending', title: 'Action 1' }),
        testDataManager.createTestAction({ status: 'pending', title: 'Action 2' })
      ]);

      queryClient.setQueryData(['actions'], testActions);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // First offline session
      networkSimulator.goOffline();
      
      result.current.updateAction.mutate({
        id: testActions[0].id,
        updates: { title: 'Offline Update 1A' }
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Go online and let it sync
      await networkSimulator.goOnline();
      
      await waitFor(() => {
        return networkSimulator.getQueuedRequestCount() === 0;
      }, { timeout: 15000 });

      // Second offline session
      networkSimulator.goOffline();
      
      result.current.updateAction.mutate({
        id: testActions[1].id,
        updates: { title: 'Offline Update 2A' }
      });

      result.current.updateAction.mutate({
        id: testActions[0].id,
        updates: { priority: 'high' as const }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Go online again
      await networkSimulator.goOnline();

      await waitFor(() => {
        return networkSimulator.getQueuedRequestCount() === 0;
      }, { timeout: 15000 });

      // Verify final states
      const finalCache = queryClient.getQueryData<any[]>(['actions']);
      
      const action1 = finalCache?.find(action => action.id === testActions[0].id);
      const action2 = finalCache?.find(action => action.id === testActions[1].id);

      expect(action1?.title).toBe('Offline Update 1A');
      expect(action1?.priority).toBe('high');
      expect(action2?.title).toBe('Offline Update 2A');

      // Verify against database
      const dbAction1 = await testDataManager.getTestAction(testActions[0].id);
      const dbAction2 = await testDataManager.getTestAction(testActions[1].id);
      
      expect(dbAction1?.title).toBe(action1?.title);
      expect(dbAction1?.priority).toBe(action1?.priority);
      expect(dbAction2?.title).toBe(action2?.title);
    }, 60000);

    /**
     * Test: Offline mutation with tool assignments
     * Validates: Requirements 7.4, 7.5
     */
    it('should handle offline tool assignment mutations correctly', async () => {
      const testTools = await testDataManager.createTestTools(2);
      const toolIds = testTools.map(tool => tool.id);
      
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        required_tools: []
      });

      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Go offline and assign tools
      networkSimulator.goOffline();

      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: toolIds
        }
      });

      // Verify optimistic updates for both actions and tools
      const offlineActionsCache = queryClient.getQueryData<any[]>(['actions']);
      const offlineAction = offlineActionsCache?.find(action => action.id === testAction.id);
      expect(offlineAction?.status).toBe('in_progress');
      expect(offlineAction?.required_tools).toEqual(toolIds);

      // Go online and sync
      await networkSimulator.goOnline();

      await waitFor(() => {
        return result.current.updateAction.isSuccess;
      }, { timeout: 20000 });

      // Verify tools are properly checked out after sync
      const finalToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const updatedTools = finalToolsCache?.data.filter(tool => toolIds.includes(tool.id));
      
      updatedTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
      });

      // Verify against database
      const dbTools = await testDataManager.getTestTools(toolIds);
      dbTools.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(true);
      });
    }, 45000);

    /**
     * Test: Network latency simulation
     * Validates: Requirements 7.4, 7.8
     */
    it('should handle high latency network conditions gracefully', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        title: 'Latency Test'
      });

      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Simulate high latency network (2 seconds delay)
      networkSimulator.startSimulation({
        online: true,
        latency: 2000
      });

      const startTime = performance.now();

      result.current.updateAction.mutate({
        id: testAction.id,
        updates: { title: 'High Latency Update' }
      });

      // Verify optimistic update is immediate despite latency
      const optimisticCache = queryClient.getQueryData<any[]>(['actions']);
      const optimisticAction = optimisticCache?.find(action => action.id === testAction.id);
      expect(optimisticAction?.title).toBe('High Latency Update');

      // Wait for server response
      await waitFor(() => {
        return result.current.updateAction.isSuccess;
      }, { timeout: 15000 });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify the mutation took at least the simulated latency time
      expect(totalTime).toBeGreaterThan(2000);

      // Verify debug information reflects the actual timing
      const debugInfo = result.current.getMutationDebugInfo();
      const mutationInfo = debugInfo.find((info: any) => 
        info.mutationId.includes(testAction.id)
      );
      
      expect(mutationInfo?.duration).toBeGreaterThan(2000);
      expect(mutationInfo?.status).toBe('succeeded');

      networkSimulator.stopSimulation();
    }, 30000);
  });
}