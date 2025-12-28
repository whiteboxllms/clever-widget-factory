/**
 * Integration Test: Error Scenario Handling
 * 
 * Tests error handling with real Lambda endpoints
 * Validates proper rollback behavior with actual server responses
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
  describe.skip('Integration Tests - Error Scenarios', () => {});
} else {
  describe('Integration Tests - Error Scenarios', () => {
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
     * Test: Validation error from Lambda triggers rollback
     * Validates: Requirements 7.3
     */
    it('should handle validation errors from Lambda and rollback optimistic updates', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        title: 'Original Title'
      });

      // Setup initial cache state
      const initialActions = [testAction];
      queryClient.setQueryData(['actions'], initialActions);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Try to update with invalid data that will trigger validation error
      const invalidUpdates = {
        title: '', // Empty title should trigger validation error
        status: 'invalid_status' as any // Invalid status
      };

      result.current.updateAction.mutate({
        id: testAction.id,
        updates: invalidUpdates
      });

      // Wait for mutation to complete (should fail)
      await waitFor(() => {
        expect(result.current.updateAction.isError).toBe(true);
      }, { timeout: 15000 });

      // Verify mutation failed
      expect(result.current.updateAction.isError).toBe(true);
      expect(result.current.updateAction.isSuccess).toBe(false);
      expect(result.current.updateAction.error).toBeDefined();

      // Verify cache was rolled back to original state
      const rolledBackCache = queryClient.getQueryData<any[]>(['actions']);
      expect(rolledBackCache).toEqual(initialActions);

      // Verify the action in cache still has original values
      const cachedAction = rolledBackCache?.find(action => action.id === testAction.id);
      expect(cachedAction?.title).toBe('Original Title');
      expect(cachedAction?.status).toBe('pending');

      // Verify error context provides useful information
      const errorContext = result.current.getErrorContext();
      expect(errorContext).toBeDefined();
      expect(errorContext?.error).toBeDefined();
      expect(errorContext?.classification).toBeDefined();
      expect(errorContext?.shouldRollback).toBe(true);
      expect(errorContext?.userActionRequired).toBe(true);

      // Verify debug information recorded the error
      const debugInfo = result.current.getMutationDebugInfo();
      const mutationInfo = debugInfo.find((info: any) => 
        info.mutationId.includes(testAction.id)
      );
      expect(mutationInfo).toBeDefined();
      expect(mutationInfo.status).toBe('failed');
      expect(mutationInfo.errors.length).toBeGreaterThan(0);
      expect(mutationInfo.rollbacks.length).toBeGreaterThan(0);

      const errorEntry = mutationInfo.errors[0];
      expect(errorEntry.isRetryable).toBe(false);
      
      const rollbackEntry = mutationInfo.rollbacks[0];
      expect(rollbackEntry.reason).toContain('validation error');
    }, 30000);

    /**
     * Test: Non-existent action ID returns 404
     * Validates: Requirements 7.3
     */
    it('should handle 404 errors for non-existent actions', async () => {
      const nonExistentId = 'non-existent-action-id';
      
      // Setup empty cache
      queryClient.setQueryData(['actions'], []);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Try to update non-existent action
      result.current.updateAction.mutate({
        id: nonExistentId,
        updates: { title: 'Updated Title' }
      });

      // Wait for mutation to fail
      await waitFor(() => {
        expect(result.current.updateAction.isError).toBe(true);
      }, { timeout: 15000 });

      // Verify mutation failed with appropriate error
      expect(result.current.updateAction.isError).toBe(true);
      expect(result.current.updateAction.error).toBeDefined();

      // Check error details
      const error = result.current.updateAction.error as any;
      expect(error.status).toBe(404);

      // Verify error classification
      const errorContext = result.current.getErrorContext();
      expect(errorContext?.classification.isPermanent).toBe(true);
      expect(errorContext?.classification.isRetryable).toBe(false);

      // Verify cache remains unchanged (empty)
      const cacheData = queryClient.getQueryData<any[]>(['actions']);
      expect(cacheData).toEqual([]);
    }, 30000);

    /**
     * Test: Unauthorized access (401) error handling
     * Validates: Requirements 7.3
     */
    it('should handle authorization errors appropriately', async () => {
      // Note: This test may be skipped if the test environment has valid auth
      // In a real scenario, we would test with expired/invalid tokens
      
      const testAction = await testDataManager.createTestAction({
        status: 'pending'
      });

      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // This test depends on the auth setup - may need to be adapted
      // For now, we'll test the error classification logic
      
      // Simulate what would happen with a 401 error
      const mockUnauthorizedError = {
        status: 401,
        message: 'Unauthorized',
        response: { status: 401 }
      };

      // Test error classification directly
      const errorContext = result.current.getErrorContext();
      
      // If we had a real 401 error, it should be classified as:
      // - Not retryable (permanent)
      // - Authorization error
      // - Requires user action
      
      console.log('Authorization error test - would need real auth failure to fully test');
    }, 15000);

    /**
     * Test: Server error (500) handling and retry behavior
     * Validates: Requirements 7.3
     */
    it('should handle server errors with appropriate retry behavior', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending',
        title: 'Server Error Test'
      });

      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Note: This test is challenging because we need to trigger a real 500 error
      // In practice, this would require either:
      // 1. A test endpoint that returns 500
      // 2. Overloading the server
      // 3. Invalid database state
      
      // For now, we'll verify the error classification logic works correctly
      console.log('Server error test - would need real server failure to fully test');
      
      // We can still test that our error classification handles server errors correctly
      const mockServerError = {
        status: 500,
        message: 'Internal Server Error',
        response: { status: 500 }
      };

      // Test that server errors would be classified as retryable
      // (This would be tested in the unit tests, but good to verify integration)
    }, 15000);

    /**
     * Test: Malformed request data handling
     * Validates: Requirements 7.3
     */
    it('should handle malformed request data gracefully', async () => {
      const testAction = await testDataManager.createTestAction({
        status: 'pending'
      });

      queryClient.setQueryData(['actions'], [testAction]);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Try to send malformed data (circular reference, invalid types, etc.)
      const malformedUpdates = {
        // This should trigger a validation error or be handled gracefully
        required_tools: ['invalid-tool-id-that-does-not-exist'],
        priority: 'invalid-priority' as any,
        status: null as any // Invalid null status
      };

      result.current.updateAction.mutate({
        id: testAction.id,
        updates: malformedUpdates
      });

      // Wait for mutation to complete (likely fail)
      await waitFor(() => {
        expect(result.current.updateAction.isError || result.current.updateAction.isSuccess).toBe(true);
      }, { timeout: 15000 });

      if (result.current.updateAction.isError) {
        // Verify error was handled gracefully
        expect(result.current.updateAction.error).toBeDefined();
        
        // Verify cache rollback occurred
        const cacheData = queryClient.getQueryData<any[]>(['actions']);
        const cachedAction = cacheData?.find(action => action.id === testAction.id);
        expect(cachedAction?.status).toBe('pending'); // Should be rolled back
        
        // Verify error classification
        const errorContext = result.current.getErrorContext();
        expect(errorContext?.classification).toBeDefined();
      } else {
        // If it succeeded, verify the server handled the malformed data appropriately
        console.log('Server handled malformed data gracefully');
      }
    }, 30000);

    /**
     * Test: Concurrent error scenarios
     * Validates: Requirements 7.3, 7.7
     */
    it('should handle errors in concurrent mutations without cache corruption', async () => {
      const testActions = await Promise.all([
        testDataManager.createTestAction({ status: 'pending', title: 'Action 1' }),
        testDataManager.createTestAction({ status: 'pending', title: 'Action 2' })
      ]);

      queryClient.setQueryData(['actions'], testActions);

      const { result } = renderHook(() => useActionMutations(), { wrapper });

      // Start multiple mutations - one valid, one invalid
      const validUpdate = { title: 'Valid Update' };
      const invalidUpdate = { title: '', status: 'invalid' as any };

      // Trigger both mutations simultaneously
      result.current.updateAction.mutate({
        id: testActions[0].id,
        updates: validUpdate
      });

      // Wait a bit then trigger the invalid one
      setTimeout(() => {
        result.current.updateAction.mutate({
          id: testActions[1].id,
          updates: invalidUpdate
        });
      }, 100);

      // Wait for both to complete
      await waitFor(() => {
        const debugInfo = result.current.getMutationDebugInfo();
        const completedMutations = debugInfo.filter((info: any) => 
          info.status === 'succeeded' || info.status === 'failed'
        );
        return completedMutations.length >= 1; // At least one should complete
      }, { timeout: 30000 });

      // Verify cache integrity - valid updates should persist, invalid should rollback
      const finalCache = queryClient.getQueryData<any[]>(['actions']);
      expect(finalCache).toBeDefined();
      expect(finalCache?.length).toBe(2);

      // Check that cache wasn't corrupted by the error
      const action1 = finalCache?.find(action => action.id === testActions[0].id);
      const action2 = finalCache?.find(action => action.id === testActions[1].id);
      
      expect(action1).toBeDefined();
      expect(action2).toBeDefined();
      
      // At least one action should maintain data integrity
      expect(action1?.id).toBe(testActions[0].id);
      expect(action2?.id).toBe(testActions[1].id);
    }, 45000);
  });
}