/**
 * Integration Test: Asset Checkout Validation
 * 
 * Tests the specific scenario where adding tools to an action should
 * immediately reflect in the Combined Assets view as checked out
 * 
 * This test reproduces the reported issue where Digital Kitchen Scale
 * was added to an action but didn't show as checked out in Combined Assets
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActionMutations } from '../../useActionMutations';
import { TestDataManager } from './testDataManager';
import { skipIfNotIntegrationEnv } from './config';
import { apiService } from '../../../lib/apiService';
import React from 'react';

// Skip if not in integration test environment
if (skipIfNotIntegrationEnv()) {
  describe.skip('Integration Tests - Asset Checkout Validation', () => {});
} else {
  describe('Integration Tests - Asset Checkout Validation', () => {
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
     * Test: Digital Kitchen Scale checkout scenario
     * 
     * Reproduces the exact user scenario:
     * 1. Create an action
     * 2. Add "Test Tool 1" to required_tools
     * 3. Save the action
     * 4. Verify the tool shows as checked out in Combined Assets view
     */
    it('should show Test Tool 1 as checked out after adding to action', async () => {
      // Step 1: Create a test tool named "Test Tool 1"
      const testTool1 = await testDataManager.createTestTool({
        name: 'Test Tool 1',
        category: 'Kitchen Equipment',
        status: 'available'
      });

      // Step 2: Create a test action without any tools initially
      const testAction = await testDataManager.createTestAction({
        title: 'Test Recipe Development',
        description: 'Testing recipe that requires precise measurements',
        status: 'pending',
        required_tools: []
      });

      // Step 3: Setup initial cache state (simulating app state)
      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { 
        data: [testTool1] 
      });

      // Verify initial state - tool should not be checked out
      expect(testTool1.is_checked_out).toBe(false);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Step 4: Add Test Tool 1 to the action (simulating user action)
      console.log('🔧 Adding Test Tool 1 to action...');
      
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: [testTool1.id]
        }
      });

      // Step 5: Wait for the mutation to complete
      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      console.log('✅ Action update completed');

      // Step 6: Verify the server response includes affected resources
      const serverResponse = result.current.updateAction.data;
      expect(serverResponse).toHaveProperty('data');
      expect(serverResponse).toHaveProperty('affectedResources');
      expect(serverResponse.affectedResources).toHaveProperty('tools');
      
      const affectedTools = serverResponse.affectedResources.tools;
      expect(affectedTools).toHaveLength(1);
      
      const updatedTool = affectedTools.find((t: any) => t.id === testTool1.id);
      expect(updatedTool).toBeDefined();
      expect(updatedTool.name).toBe('Test Tool 1');
      
      console.log('📊 Server response tool state:', {
        id: updatedTool.id,
        name: updatedTool.name,
        is_checked_out: updatedTool.is_checked_out,
        checked_out_user_id: updatedTool.checked_out_user_id
      });

      // Step 7: Verify the tool is marked as checked out in server response
      expect(updatedTool.is_checked_out).toBe(true);
      expect(updatedTool.checked_out_user_id).toBeDefined();

      // Step 8: Verify cache was updated correctly (Combined Assets view data)
      const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
      expect(cachedTools).toBeDefined();
      expect(cachedTools?.data).toHaveLength(1);
      
      const cachedTool = cachedTools?.data.find(t => t.id === testTool1.id);
      expect(cachedTool).toBeDefined();
      expect(cachedTool?.name).toBe('Test Tool 1');
      expect(cachedTool?.is_checked_out).toBe(true);
      expect(cachedTool?.checked_out_user_id).toBeDefined();

      console.log('💾 Cached tool state:', {
        id: cachedTool?.id,
        name: cachedTool?.name,
        is_checked_out: cachedTool?.is_checked_out,
        checked_out_user_id: cachedTool?.checked_out_user_id
      });

      // Step 9: Verify database state directly (what Combined Assets would query)
      const dbTool = await testDataManager.getTestTool(testTool1.id);
      expect(dbTool).toBeDefined();
      expect(dbTool?.name).toBe('Test Tool 1');
      expect(dbTool?.is_checked_out).toBe(true);

      console.log('🗄️ Database tool state:', {
        id: dbTool?.id,
        name: dbTool?.name,
        is_checked_out: dbTool?.is_checked_out
      });

      // Step 10: Simulate fetching tools for Combined Assets view
      console.log('🔍 Simulating Combined Assets view data fetch...');
      
      const combinedAssetsData = await apiService.get('/tools');
      expect(combinedAssetsData).toHaveProperty('data');
      
      const toolsFromApi = combinedAssetsData.data;
      const testTool1FromApi = toolsFromApi.find((t: any) => t.id === testTool1.id);
      
      expect(testTool1FromApi).toBeDefined();
      expect(testTool1FromApi.name).toBe('Test Tool 1');
      expect(testTool1FromApi.is_checked_out).toBe(true);

      console.log('🌐 API response for Combined Assets:', {
        id: testTool1FromApi.id,
        name: testTool1FromApi.name,
        is_checked_out: testTool1FromApi.is_checked_out,
        checked_out_user_id: testTool1FromApi.checked_out_user_id,
        checked_out_to: testTool1FromApi.checked_out_to
      });

      // Step 11: Verify action was updated correctly
      const updatedAction = queryClient.getQueryData<any[]>(['actions'])?.find(a => a.id === testAction.id);
      expect(updatedAction?.status).toBe('in_progress');
      expect(updatedAction?.required_tools).toEqual([testTool1.id]);

      // Cleanup
      await testDataManager.cleanupTestAction(testAction.id);
      await testDataManager.cleanupTestTool(testTool1.id);
    }, 60000);

    /**
     * Test: Multiple tools checkout scenario
     * 
     * Tests adding multiple tools including Test Tool 1
     * to ensure all show as checked out in Combined Assets
     */
    it('should show all tools as checked out when multiple tools added to action', async () => {
      // Create multiple test tools including Test Tool 1
      const testTools = await Promise.all([
        testDataManager.createTestTool({
          name: 'Test Tool 1',
          category: 'Kitchen Equipment',
          status: 'available'
        }),
        testDataManager.createTestTool({
          name: 'Test Tool 2',
          category: 'Kitchen Equipment', 
          status: 'available'
        }),
        testDataManager.createTestTool({
          name: 'Test Tool 3',
          category: 'Kitchen Equipment',
          status: 'available'
        })
      ]);

      const toolIds = testTools.map(t => t.id);

      // Create test action
      const testAction = await testDataManager.createTestAction({
        title: 'Complex Recipe Development',
        description: 'Recipe requiring multiple kitchen tools',
        status: 'pending',
        required_tools: []
      });

      // Setup cache
      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Add all tools to action
      console.log('🔧 Adding multiple tools to action...');
      
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: toolIds
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify all tools are checked out in cache
      const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
      expect(cachedTools?.data).toHaveLength(3);
      
      for (const tool of cachedTools?.data || []) {
        expect(tool.is_checked_out).toBe(true);
        expect(tool.checked_out_user_id).toBeDefined();
        
        console.log(`✅ ${tool.name} - Checked out: ${tool.is_checked_out}`);
      }

      // Verify Test Tool 1 specifically
      const testTool1 = cachedTools?.data.find(t => t.name === 'Test Tool 1');
      expect(testTool1).toBeDefined();
      expect(testTool1?.is_checked_out).toBe(true);

      // Verify Combined Assets API response
      const combinedAssetsData = await apiService.get('/tools');
      const toolsFromApi = combinedAssetsData.data;
      
      for (const toolId of toolIds) {
        const toolFromApi = toolsFromApi.find((t: any) => t.id === toolId);
        expect(toolFromApi).toBeDefined();
        expect(toolFromApi.is_checked_out).toBe(true);
      }

      // Cleanup
      await testDataManager.cleanupTestAction(testAction.id);
      await Promise.all(testTools.map(tool => testDataManager.cleanupTestTool(tool.id)));
    }, 90000);

    /**
     * Test: Tool checkout state persistence across page refresh
     * 
     * Simulates user refreshing Combined Assets page after adding tools
     */
    it('should maintain checkout state after simulated page refresh', async () => {
      // Create Test Tool 1
      const testTool1 = await testDataManager.createTestTool({
        name: 'Test Tool 1',
        category: 'Kitchen Equipment',
        status: 'available'
      });

      const testAction = await testDataManager.createTestAction({
        title: 'Baking Project',
        status: 'pending',
        required_tools: []
      });

      // Initial setup
      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: [testTool1] });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Add tool to action
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: [testTool1.id]
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Simulate page refresh by clearing cache and refetching
      console.log('🔄 Simulating page refresh...');
      queryClient.clear();

      // Fetch fresh data (what would happen on page refresh)
      const freshToolsData = await apiService.get('/tools');
      const freshActionsData = await apiService.get('/actions');

      // Set fresh data in cache
      queryClient.setQueryData(['tools'], freshToolsData);
      queryClient.setQueryData(['actions'], freshActionsData.data);

      // Verify Test Tool 1 is still checked out
      const freshTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const freshTestTool1 = freshTools?.data.find(t => t.name === 'Test Tool 1');
      
      expect(freshTestTool1).toBeDefined();
      expect(freshTestTool1?.is_checked_out).toBe(true);

      console.log('✅ After refresh - Test Tool 1 checkout state maintained');

      // Cleanup
      await testDataManager.cleanupTestAction(testAction.id);
      await testDataManager.cleanupTestTool(testTool1.id);
    }, 60000);

    /**
     * Test: Checkout state in different tool queries
     * 
     * Tests various ways tools might be queried to ensure consistent checkout state
     */
    it('should show consistent checkout state across different tool queries', async () => {
      const testTool1 = await testDataManager.createTestTool({
        name: 'Test Tool 1',
        category: 'Kitchen Equipment',
        status: 'available'
      });

      const testAction = await testDataManager.createTestAction({
        title: 'Precision Cooking',
        status: 'pending',
        required_tools: []
      });

      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: [testTool1] });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Add tool to action
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: [testTool1.id]
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Test different ways of querying tools
      console.log('🔍 Testing different tool query methods...');

      // 1. Standard tools endpoint
      const allTools = await apiService.get('/tools');
      const toolFromAll = allTools.data.find((t: any) => t.id === testTool1.id);
      expect(toolFromAll?.is_checked_out).toBe(true);

      // 2. Tools with category filter
      const kitchenTools = await apiService.get('/tools?category=Kitchen Equipment');
      const toolFromCategory = kitchenTools.data?.find((t: any) => t.id === testTool1.id);
      expect(toolFromCategory?.is_checked_out).toBe(true);

      // 3. Tools with status filter
      const checkedOutTools = await apiService.get('/tools?status=checked_out');
      const toolFromStatus = checkedOutTools.data?.find((t: any) => t.id === testTool1.id);
      expect(toolFromStatus?.is_checked_out).toBe(true);

      console.log('✅ Consistent checkout state across all query methods');

      // Cleanup
      await testDataManager.cleanupTestAction(testAction.id);
      await testDataManager.cleanupTestTool(testTool1.id);
    }, 60000);
  });
}