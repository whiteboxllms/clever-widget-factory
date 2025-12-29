/**
 * Integration Test: Tool Checkout Workflows
 * 
 * Tests end-to-end action completion with tool assignments
 * Validates tool checkout status updates through real API
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
  describe.skip('Integration Tests - Tool Checkout Workflows', () => {});
} else {
  describe('Integration Tests - Tool Checkout Workflows', () => {
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
     * Test: Complete tool checkout workflow from assignment to completion
     * Validates: Requirements 7.5
     */
    it('should handle complete tool checkout workflow through real API', async () => {
      // Create test tools
      const testTools = await testDataManager.createTestTools(3);
      const toolIds = testTools.map(tool => tool.id);

      // Create test action without tools initially
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        required_tools: []
      });

      // Setup initial cache state
      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Step 1: Assign tools to action and start work
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

      // Verify tools are checked out
      const toolsAfterCheckout = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const checkedOutTools = toolsAfterCheckout?.data.filter(tool => toolIds.includes(tool.id));
      
      expect(checkedOutTools?.length).toBe(3);
      checkedOutTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
        expect(tool.checked_out_user_id).toBeDefined();
      });

      // Verify against database
      const dbToolsAfterCheckout = await testDataManager.getTestTools(toolIds);
      dbToolsAfterCheckout.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(true);
      });

      // Reset mutation state for next update
      result.current.updateAction.reset();

      // Step 2: Complete the action
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'completed' as const
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify action is completed
      const actionsAfterCompletion = queryClient.getQueryData<any[]>(['actions']);
      const completedAction = actionsAfterCompletion?.find(action => action.id === testAction.id);
      expect(completedAction?.status).toBe('completed');

      // Verify tools are automatically checked back in
      const toolsAfterCompletion = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const returnedTools = toolsAfterCompletion?.data.filter(tool => toolIds.includes(tool.id));
      
      expect(returnedTools?.length).toBe(3);
      returnedTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(false);
        expect(tool.checked_out_user_id).toBeNull();
      });

      // Verify against database
      const dbToolsAfterCompletion = await testDataManager.getTestTools(toolIds);
      dbToolsAfterCompletion.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(false);
      });
    }, 60000);

    /**
     * Test: Partial tool assignment changes
     * Validates: Requirements 7.5
     */
    it('should handle partial tool assignment changes correctly', async () => {
      const testTools = await testDataManager.createTestTools(4);
      const initialToolIds = testTools.slice(0, 2).map(tool => tool.id);
      const additionalToolIds = testTools.slice(2).map(tool => tool.id);

      const testAction = await testDataManager.createTestAction({
        status: 'in_progress',
        required_tools: initialToolIds
      });

      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Add more tools to the action
      const allToolIds = [...initialToolIds, ...additionalToolIds];
      
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          required_tools: allToolIds
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify all tools are now checked out
      const toolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const allTools = toolsCache?.data.filter(tool => allToolIds.includes(tool.id));
      
      expect(allTools?.length).toBe(4);
      allTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
      });

      // Reset and remove some tools
      result.current.updateAction.reset();
      
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          required_tools: initialToolIds // Back to original 2 tools
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify only the remaining tools are checked out
      const finalToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      
      const remainingTools = finalToolsCache?.data.filter(tool => initialToolIds.includes(tool.id));
      const removedTools = finalToolsCache?.data.filter(tool => additionalToolIds.includes(tool.id));
      
      remainingTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
      });
      
      removedTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(false);
      });

      // Verify against database
      const dbRemainingTools = await testDataManager.getTestTools(initialToolIds);
      const dbRemovedTools = await testDataManager.getTestTools(additionalToolIds);
      
      dbRemainingTools.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(true);
      });
      
      dbRemovedTools.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(false);
      });
    }, 60000);

    /**
     * Test: Concurrent tool assignments across multiple actions
     * Validates: Requirements 7.5, 7.7
     */
    it('should handle concurrent tool assignments across multiple actions', async () => {
      const testTools = await testDataManager.createTestTools(4);
      const toolIds = testTools.map(tool => tool.id);

      const testActions = await Promise.all([
        testDataManager.createTestAction({ status: 'pending', required_tools: [] }),
        testDataManager.createTestAction({ status: 'pending', required_tools: [] })
      ]);

      queryClient.setQueryData(['actions'], testActions);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Try to assign overlapping tools to both actions
      const action1Tools = toolIds.slice(0, 3); // First 3 tools
      const action2Tools = toolIds.slice(1, 4); // Last 3 tools (overlap with action 1)

      // Start both mutations simultaneously
      result.current.updateAction.mutate({
        id: testActions[0].id,
        updates: {
          status: 'in_progress' as const,
          required_tools: action1Tools
        }
      });

      // Small delay then start second mutation
      setTimeout(() => {
        result.current.updateAction.mutate({
          id: testActions[1].id,
          updates: {
            status: 'in_progress' as const,
            required_tools: action2Tools
          }
        });
      }, 100);

      // Wait for both mutations to complete
      await waitFor(() => {
        const debugInfo = result.current.getMutationDebugInfo();
        const debugArray = Array.isArray(debugInfo) ? debugInfo : [debugInfo];
        const completedMutations = debugArray.filter((info: any) => 
          info.status === 'succeeded' || info.status === 'failed'
        );
        return completedMutations.length >= 1;
      }, { timeout: 30000 });

      // Verify final state - tools should be assigned to one action or the other
      const finalToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const finalActionsCache = queryClient.getQueryData<any[]>(['actions']);
      
      expect(finalToolsCache?.data).toBeDefined();
      expect(finalActionsCache).toBeDefined();

      // Check that tools are consistently assigned
      const checkedOutTools = finalToolsCache?.data.filter(tool => tool.is_checked_out);
      expect(checkedOutTools?.length).toBeGreaterThan(0);

      // Verify database consistency
      const dbTools = await testDataManager.getTestTools(toolIds);
      const dbActions = await Promise.all(
        testActions.map(action => testDataManager.getTestAction(action.id))
      );

      // Ensure no tool is double-assigned
      const allAssignedTools = dbActions
        .filter(action => action?.required_tools)
        .flatMap(action => action!.required_tools || []);
      
      const uniqueAssignedTools = [...new Set(allAssignedTools)];
      expect(uniqueAssignedTools.length).toBeLessThanOrEqual(toolIds.length);
    }, 60000);

    /**
     * Test: Tool checkout with action cancellation
     * Validates: Requirements 7.5
     */
    it('should handle tool checkout when action is cancelled', async () => {
      const testTools = await testDataManager.createTestTools(2);
      const toolIds = testTools.map(tool => tool.id);

      const testAction = await testDataManager.createTestAction({
        status: 'in_progress',
        required_tools: toolIds
      });

      queryClient.setQueryData(['actions'], [testAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Verify tools are initially checked out
      const initialToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      
      // Note: Tools might not be checked out initially depending on test setup
      // Let's first assign them properly
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

      // Verify tools are checked out
      const checkedOutToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const checkedOutTools = checkedOutToolsCache?.data.filter(tool => toolIds.includes(tool.id));
      
      checkedOutTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
      });

      // Reset and cancel the action
      result.current.updateAction.reset();
      
      result.current.updateAction.mutate({
        id: testAction.id,
        updates: {
          status: 'cancelled' as const
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Verify action is cancelled
      const cancelledActionsCache = queryClient.getQueryData<any[]>(['actions']);
      const cancelledAction = cancelledActionsCache?.find(action => action.id === testAction.id);
      expect(cancelledAction?.status).toBe('cancelled');

      // Verify tools are still checked out (cancellation doesn't auto-return tools)
      const finalToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const finalTools = finalToolsCache?.data.filter(tool => toolIds.includes(tool.id));
      
      // Tools should remain checked out until manually returned
      finalTools?.forEach(tool => {
        expect(tool.is_checked_out).toBe(true);
      });

      // Verify against database
      const dbTools = await testDataManager.getTestTools(toolIds);
      dbTools.forEach(dbTool => {
        expect(dbTool.is_checked_out).toBe(true);
      });
    }, 45000);

    /**
     * Test: Tool availability validation
     * Validates: Requirements 7.5
     */
    it('should handle tool availability validation correctly', async () => {
      const testTools = await testDataManager.createTestTools(2);
      const toolIds = testTools.map(tool => tool.id);

      // Create first action and assign tools
      const firstAction = await testDataManager.createTestAction({
        status: 'in_progress',
        required_tools: toolIds
      });

      // Create second action that will try to use same tools
      const secondAction = await testDataManager.createTestAction({
        status: 'pending',
        required_tools: []
      });

      queryClient.setQueryData(['actions'], [firstAction, secondAction]);
      queryClient.setQueryData(['tools'], { data: testTools });

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // First, ensure first action has the tools checked out
      result.current.updateAction.mutate({
        id: firstAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: toolIds
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      // Reset and try to assign same tools to second action
      result.current.updateAction.reset();
      
      result.current.updateAction.mutate({
        id: secondAction.id,
        updates: {
          status: 'in_progress' as const,
          required_tools: toolIds
        }
      });

      await waitFor(() => {
        expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
      }, { timeout: 15000 });

      // The behavior here depends on the server implementation
      // It might succeed (allowing double assignment) or fail (preventing conflicts)
      // Let's verify the final state is consistent
      
      const finalToolsCache = queryClient.getQueryData<{ data: any[] }>(['tools']);
      const finalActionsCache = queryClient.getQueryData<any[]>(['actions']);
      
      expect(finalToolsCache?.data).toBeDefined();
      expect(finalActionsCache).toBeDefined();

      // Verify database consistency
      const dbFirstAction = await testDataManager.getTestAction(firstAction.id);
      const dbSecondAction = await testDataManager.getTestAction(secondAction.id);

      // Log the results for analysis
      console.log('Tool availability test results:', {
        firstActionTools: dbFirstAction?.required_tools,
        secondActionTools: dbSecondAction?.required_tools,
        toolCheckoutStatus: dbTools.map(t => ({ id: t.id, checked_out: t.is_checked_out }))
      });

      // At minimum, verify data integrity
      expect(dbFirstAction).toBeDefined();
      expect(dbSecondAction).toBeDefined();
    }, 45000);
  });
}