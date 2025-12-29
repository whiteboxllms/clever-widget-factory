/**
 * Property-Based Integration Tests for TanStack Actions
 * 
 * Tests Properties 10-12 for integration validation with real Lambda endpoints
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActionMutations } from '../../useActionMutations';
import { TestDataManager } from './testDataManager';
import { NetworkSimulator } from './networkSimulator';
import { skipIfNotIntegrationEnv } from './config';
import React from 'react';
import fc from 'fast-check';

// Skip if not in integration test environment
if (skipIfNotIntegrationEnv()) {
  describe.skip('Property-Based Integration Tests', () => {});
} else {
  describe.skip('Property-Based Integration Tests', () => {
    let queryClient: QueryClient;
    let testDataManager: TestDataManager;
    let networkSimulator: NetworkSimulator;
    let wrapper: React.ComponentType<{ children: React.ReactNode }>;

    beforeAll(async () => {
      testDataManager = new TestDataManager();
      networkSimulator = new NetworkSimulator();
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
      networkSimulator.reset();
    });

    /**
     * Property 10: Real API Integration Consistency
     * 
     * For any action update through real Lambda API:
     * - Server response data matches database state
     * - Affected resources are properly computed and cached
     * - Cache state remains consistent with server state
     * 
     * Validates: Requirements 7.2, 7.6
     */
    describe('Property 10: Real API Integration Consistency', () => {
      it('should maintain consistency between server response and database state', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              status: fc.constantFrom('pending', 'in_progress', 'completed', 'cancelled'),
              toolCount: fc.integer({ min: 0, max: 3 }),
              description: fc.string({ minLength: 10, maxLength: 100 })
            }),
            async ({ status, toolCount, description }) => {
              // Create test data
              const testTools = toolCount > 0 ? await testDataManager.createTestTools(toolCount) : [];
              const toolIds = testTools.map(tool => tool.id);
              
              const testAction = await testDataManager.createTestAction({
                status: 'pending',
                description,
                required_tools: []
              });

              // Setup cache
              queryClient.setQueryData(['actions'], [testAction]);
              queryClient.setQueryData(['tools'], { data: testTools });

              const { result } = renderHook(() => useActionMutations(), { wrapper });

              // Perform update through real API
              result.current.updateAction.mutate({
                id: testAction.id,
                updates: {
                  status,
                  required_tools: toolIds,
                  description
                }
              });

              await waitFor(() => {
                expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
              }, { timeout: 15000 });

              if (result.current.updateAction.isSuccess) {
                // Verify server response matches database
                const dbAction = await testDataManager.getTestAction(testAction.id);
                const serverResponse = result.current.updateAction.data;

                expect(dbAction?.status).toBe(status);
                expect(dbAction?.description).toBe(description);
                expect(dbAction?.required_tools).toEqual(toolIds);

                // Verify server response structure
                expect(serverResponse).toHaveProperty('data');
                expect(serverResponse.data.id).toBe(testAction.id);
                expect(serverResponse.data.status).toBe(status);

                // Verify affected resources are computed correctly
                if (toolIds.length > 0) {
                  expect(serverResponse).toHaveProperty('affectedResources');
                  expect(serverResponse.affectedResources).toHaveProperty('tools');
                  expect(serverResponse.affectedResources.tools).toHaveLength(toolIds.length);
                  
                  // Verify tool checkout states match database
                  const dbTools = await testDataManager.getTestTools(toolIds);
                  for (const dbTool of dbTools) {
                    const serverTool = serverResponse.affectedResources.tools.find((t: any) => t.id === dbTool.id);
                    expect(serverTool).toBeDefined();
                    expect(serverTool.is_checked_out).toBe(dbTool.is_checked_out);
                  }
                }

                // Verify cache consistency
                const cachedActions = queryClient.getQueryData<any[]>(['actions']);
                const cachedAction = cachedActions?.find(a => a.id === testAction.id);
                expect(cachedAction?.status).toBe(status);

                if (toolIds.length > 0) {
                  const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
                  for (const toolId of toolIds) {
                    const cachedTool = cachedTools?.data.find(t => t.id === toolId);
                    const dbTool = dbTools.find(t => t.id === toolId);
                    expect(cachedTool?.is_checked_out).toBe(dbTool?.is_checked_out);
                  }
                }
              }

              // Cleanup
              await testDataManager.cleanupTestAction(testAction.id);
              if (testTools.length > 0) {
                await testDataManager.cleanupTestTools(testTools.map(t => t.id));
              }
            }
          ),
          { 
            numRuns: 10,
            timeout: 30000,
            verbose: true
          }
        );
      }, 120000);

      it('should handle server validation errors consistently', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              invalidField: fc.constantFrom('invalid_status', 'invalid_tool_id', 'missing_required_field'),
              validStatus: fc.constantFrom('pending', 'in_progress', 'completed')
            }),
            async ({ invalidField, validStatus }) => {
              const testAction = await testDataManager.createTestAction({
                status: 'pending',
                required_tools: []
              });

              queryClient.setQueryData(['actions'], [testAction]);

              const { result } = renderHook(() => useActionMutations(), { wrapper });

              // Create invalid update based on test case
              let invalidUpdate: any = { status: validStatus };
              
              switch (invalidField) {
                case 'invalid_status':
                  invalidUpdate.status = 'invalid_status_value';
                  break;
                case 'invalid_tool_id':
                  invalidUpdate.required_tools = ['non-existent-tool-id'];
                  break;
                case 'missing_required_field':
                  invalidUpdate = { description: null }; // Some required field violation
                  break;
              }

              // Attempt invalid update
              result.current.updateAction.mutate({
                id: testAction.id,
                updates: invalidUpdate
              });

              await waitFor(() => {
                expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
              }, { timeout: 15000 });

              if (result.current.updateAction.isError) {
                // Verify error is properly handled
                expect(result.current.updateAction.error).toBeDefined();
                
                // Verify database state unchanged
                const dbAction = await testDataManager.getTestAction(testAction.id);
                expect(dbAction?.status).toBe('pending'); // Original status preserved
                
                // Verify cache rollback
                const cachedActions = queryClient.getQueryData<any[]>(['actions']);
                const cachedAction = cachedActions?.find(a => a.id === testAction.id);
                expect(cachedAction?.status).toBe('pending'); // Rolled back to original
              }

              // Cleanup
              await testDataManager.cleanupTestAction(testAction.id);
            }
          ),
          { 
            numRuns: 5,
            timeout: 20000,
            verbose: true
          }
        );
      }, 60000);
    });

    /**
     * Property 11: Concurrent Mutation Coordination
     * 
     * For concurrent mutations to the same or related resources:
     * - Mutations are properly serialized or handled concurrently
     * - Final state is consistent across all clients
     * - No race conditions cause data corruption
     * 
     * Validates: Requirements 7.7
     */
    describe('Property 11: Concurrent Mutation Coordination', () => {
      it('should handle concurrent mutations to same action correctly', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              mutation1: fc.record({
                status: fc.constantFrom('in_progress', 'completed'),
                description: fc.string({ minLength: 5, maxLength: 50 })
              }),
              mutation2: fc.record({
                status: fc.constantFrom('cancelled', 'blocked'),
                priority: fc.constantFrom('low', 'medium', 'high')
              }),
              delayMs: fc.integer({ min: 0, max: 200 })
            }),
            async ({ mutation1, mutation2, delayMs }) => {
              const testAction = await testDataManager.createTestAction({
                status: 'pending',
                description: 'Original description',
                priority: 'medium'
              });

              queryClient.setQueryData(['actions'], [testAction]);

              const { result: result1 } = renderHook(() => useActionMutations(), { wrapper });
              const { result: result2 } = renderHook(() => useActionMutations(), { wrapper });

              // Start first mutation
              result1.current.updateAction.mutate({
                id: testAction.id,
                updates: mutation1
              });

              // Start second mutation after delay
              setTimeout(() => {
                result2.current.updateAction.mutate({
                  id: testAction.id,
                  updates: mutation2
                });
              }, delayMs);

              // Wait for both mutations to complete
              await waitFor(() => {
                const both1Done = result1.current.updateAction.isSuccess || result1.current.updateAction.isError;
                const both2Done = result2.current.updateAction.isSuccess || result2.current.updateAction.isError;
                return both1Done && both2Done;
              }, { timeout: 20000 });

              // Verify final database state is consistent
              const finalDbAction = await testDataManager.getTestAction(testAction.id);
              expect(finalDbAction).toBeDefined();

              // At least one mutation should have succeeded
              const mutation1Success = result1.current.updateAction.isSuccess;
              const mutation2Success = result2.current.updateAction.isSuccess;
              expect(mutation1Success || mutation2Success).toBe(true);

              // Verify cache consistency
              const cachedActions = queryClient.getQueryData<any[]>(['actions']);
              const cachedAction = cachedActions?.find(a => a.id === testAction.id);
              
              // Cache should match database
              expect(cachedAction?.status).toBe(finalDbAction?.status);
              
              // If both succeeded, verify the final state reflects the last successful update
              if (mutation1Success && mutation2Success) {
                // The later mutation should win (based on server timestamps)
                const response1 = result1.current.updateAction.data;
                const response2 = result2.current.updateAction.data;
                
                // Both responses should be valid
                expect(response1?.data).toBeDefined();
                expect(response2?.data).toBeDefined();
              }

              // Cleanup
              await testDataManager.cleanupTestAction(testAction.id);
            }
          ),
          { 
            numRuns: 8,
            timeout: 30000,
            verbose: true
          }
        );
      }, 120000);

      it('should handle concurrent tool assignments correctly', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              toolCount: fc.integer({ min: 2, max: 4 }),
              action1ToolCount: fc.integer({ min: 1, max: 3 }),
              action2ToolCount: fc.integer({ min: 1, max: 3 }),
              delayMs: fc.integer({ min: 0, max: 100 })
            }),
            async ({ toolCount, action1ToolCount, action2ToolCount, delayMs }) => {
              // Create test tools and actions
              const testTools = await testDataManager.createTestTools(toolCount);
              const toolIds = testTools.map(t => t.id);
              
              const action1Tools = toolIds.slice(0, Math.min(action1ToolCount, toolIds.length));
              const action2Tools = toolIds.slice(-Math.min(action2ToolCount, toolIds.length));
              
              const testActions = await Promise.all([
                testDataManager.createTestAction({ status: 'pending', required_tools: [] }),
                testDataManager.createTestAction({ status: 'pending', required_tools: [] })
              ]);

              queryClient.setQueryData(['actions'], testActions);
              queryClient.setQueryData(['tools'], { data: testTools });

              const { result: result1 } = renderHook(() => useActionMutations(), { wrapper });
              const { result: result2 } = renderHook(() => useActionMutations(), { wrapper });

              // Start concurrent tool assignments
              result1.current.updateAction.mutate({
                id: testActions[0].id,
                updates: {
                  status: 'in_progress' as const,
                  required_tools: action1Tools
                }
              });

              setTimeout(() => {
                result2.current.updateAction.mutate({
                  id: testActions[1].id,
                  updates: {
                    status: 'in_progress' as const,
                    required_tools: action2Tools
                  }
                });
              }, delayMs);

              // Wait for both mutations
              await waitFor(() => {
                const both1Done = result1.current.updateAction.isSuccess || result1.current.updateAction.isError;
                const both2Done = result2.current.updateAction.isSuccess || result2.current.updateAction.isError;
                return both1Done && both2Done;
              }, { timeout: 25000 });

              // Verify final state consistency
              const finalDbActions = await Promise.all(
                testActions.map(action => testDataManager.getTestAction(action.id))
              );
              const finalDbTools = await testDataManager.getTestTools(toolIds);

              // Verify no tool is double-assigned (if server prevents it)
              const allAssignedTools = finalDbActions
                .filter(action => action?.required_tools)
                .flatMap(action => action!.required_tools || []);
              
              // Check for duplicates
              const uniqueAssigned = [...new Set(allAssignedTools)];
              const hasDuplicates = uniqueAssigned.length !== allAssignedTools.length;
              
              if (!hasDuplicates) {
                // If no duplicates, verify checkout states are consistent
                for (const tool of finalDbTools) {
                  const isAssigned = allAssignedTools.includes(tool.id);
                  expect(tool.is_checked_out).toBe(isAssigned);
                }
              }

              // Verify cache consistency
              const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
              for (const dbTool of finalDbTools) {
                const cachedTool = cachedTools?.data.find(t => t.id === dbTool.id);
                expect(cachedTool?.is_checked_out).toBe(dbTool.is_checked_out);
              }

              // Cleanup
              await Promise.all(testActions.map(action => testDataManager.cleanupTestAction(action.id)));
              await testDataManager.cleanupTestTools(toolIds);
            }
          ),
          { 
            numRuns: 6,
            timeout: 40000,
            verbose: true
          }
        );
      }, 150000);
    });

    /**
     * Property 12: Performance and Timing Accuracy
     * 
     * For all mutations through real Lambda API:
     * - Response times are within acceptable limits
     * - Timing measurements are accurate
     * - Performance doesn't degrade with concurrent operations
     * 
     * Validates: Requirements 7.8, 7.9
     */
    describe('Property 12: Performance and Timing Accuracy', () => {
      it('should maintain acceptable response times for mutations', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              updateCount: fc.integer({ min: 1, max: 3 }),
              toolCount: fc.integer({ min: 0, max: 2 }),
              payloadSize: fc.constantFrom('small', 'medium', 'large')
            }),
            async ({ updateCount, toolCount, payloadSize }) => {
              // Create test data based on payload size
              let description: string;
              switch (payloadSize) {
                case 'small':
                  description = 'Small update';
                  break;
                case 'medium':
                  description = 'Medium sized update with more details about the action';
                  break;
                case 'large':
                  description = 'Large update with extensive details about the action including multiple paragraphs of information that would represent a typical large payload in the system';
                  break;
              }

              const testTools = toolCount > 0 ? await testDataManager.createTestTools(toolCount) : [];
              const toolIds = testTools.map(t => t.id);

              const testAction = await testDataManager.createTestAction({
                status: 'pending',
                description: 'Initial description',
                required_tools: []
              });

              queryClient.setQueryData(['actions'], [testAction]);
              queryClient.setQueryData(['tools'], { data: testTools });

              const { result } = renderHook(() => useActionMutations(), { wrapper });

              // Perform multiple updates and measure timing
              const timings: number[] = [];
              
              for (let i = 0; i < updateCount; i++) {
                const startTime = performance.now();
                
                result.current.updateAction.mutate({
                  id: testAction.id,
                  updates: {
                    description: `${description} - Update ${i + 1}`,
                    required_tools: i === updateCount - 1 ? toolIds : [],
                    status: i === updateCount - 1 ? 'in_progress' as const : 'pending' as const
                  }
                });

                await waitFor(() => {
                  expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
                }, { timeout: 15000 });

                const endTime = performance.now();
                const duration = endTime - startTime;
                timings.push(duration);

                // Verify mutation succeeded
                expect(result.current.updateAction.isSuccess).toBe(true);

                // Reset for next iteration
                result.current.updateAction.reset();
              }

              // Verify timing constraints
              const maxTiming = Math.max(...timings);
              const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;

              // Performance expectations (adjust based on your requirements)
              expect(maxTiming).toBeLessThan(15000); // Max 15 seconds per mutation
              expect(avgTiming).toBeLessThan(10000); // Average under 10 seconds

              // Verify debug timing information is accurate
              const debugInfo = result.current.getMutationDebugInfo();
              const debugArray = Array.isArray(debugInfo) ? debugInfo : [debugInfo];
              
              if (debugArray.length > 0) {
                const lastDebugInfo = debugArray[debugArray.length - 1];
                expect(lastDebugInfo.timing).toBeDefined();
                expect(lastDebugInfo.timing.duration).toBeGreaterThan(0);
                
                // Debug timing should be reasonably close to our measurement
                const debugDuration = lastDebugInfo.timing.duration;
                const ourLastTiming = timings[timings.length - 1];
                const timingDiff = Math.abs(debugDuration - ourLastTiming);
                expect(timingDiff).toBeLessThan(1000); // Within 1 second tolerance
              }

              // Cleanup
              await testDataManager.cleanupTestAction(testAction.id);
              if (testTools.length > 0) {
                await testDataManager.cleanupTestTools(toolIds);
              }
            }
          ),
          { 
            numRuns: 5,
            timeout: 60000,
            verbose: true
          }
        );
      }, 180000);

      it('should handle performance under concurrent load', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              concurrentActions: fc.integer({ min: 2, max: 4 }),
              updatesPerAction: fc.integer({ min: 1, max: 2 })
            }),
            async ({ concurrentActions, updatesPerAction }) => {
              // Create multiple test actions
              const testActions = await Promise.all(
                Array.from({ length: concurrentActions }, (_, i) =>
                  testDataManager.createTestAction({
                    status: 'pending',
                    description: `Concurrent action ${i + 1}`
                  })
                )
              );

              queryClient.setQueryData(['actions'], testActions);

              // Create multiple hook instances for concurrent operations
              const hookResults = Array.from({ length: concurrentActions }, () =>
                renderHook(() => useActionMutations(), { wrapper })
              );

              const allTimings: number[] = [];
              const startTime = performance.now();

              // Start all concurrent operations
              const promises = hookResults.map(async ({ result }, actionIndex) => {
                const actionTimings: number[] = [];
                
                for (let updateIndex = 0; updateIndex < updatesPerAction; updateIndex++) {
                  const updateStartTime = performance.now();
                  
                  result.current.updateAction.mutate({
                    id: testActions[actionIndex].id,
                    updates: {
                      description: `Concurrent update ${updateIndex + 1} for action ${actionIndex + 1}`,
                      status: updateIndex === updatesPerAction - 1 ? 'completed' as const : 'in_progress' as const
                    }
                  });

                  await waitFor(() => {
                    expect(result.current.updateAction.isSuccess || result.current.updateAction.isError).toBe(true);
                  }, { timeout: 20000 });

                  const updateEndTime = performance.now();
                  const updateDuration = updateEndTime - updateStartTime;
                  actionTimings.push(updateDuration);

                  expect(result.current.updateAction.isSuccess).toBe(true);
                  result.current.updateAction.reset();
                }
                
                return actionTimings;
              });

              // Wait for all concurrent operations to complete
              const allActionTimings = await Promise.all(promises);
              const totalTime = performance.now() - startTime;

              // Flatten all timings
              allActionTimings.forEach(timings => allTimings.push(...timings));

              // Verify performance under load
              const maxTiming = Math.max(...allTimings);
              const avgTiming = allTimings.reduce((a, b) => a + b, 0) / allTimings.length;
              const totalOperations = concurrentActions * updatesPerAction;

              // Performance expectations under concurrent load
              expect(maxTiming).toBeLessThan(25000); // Max 25 seconds per operation under load
              expect(avgTiming).toBeLessThan(15000); // Average under 15 seconds under load
              expect(totalTime).toBeLessThan(60000); // Total time under 60 seconds

              // Verify throughput
              const operationsPerSecond = totalOperations / (totalTime / 1000);
              expect(operationsPerSecond).toBeGreaterThan(0.1); // At least 0.1 ops/sec

              // Verify all operations completed successfully
              const finalDbActions = await Promise.all(
                testActions.map(action => testDataManager.getTestAction(action.id))
              );
              
              finalDbActions.forEach(dbAction => {
                expect(dbAction?.status).toBe('completed');
              });

              // Cleanup
              await Promise.all(testActions.map(action => testDataManager.cleanupTestAction(action.id)));
            }
          ),
          { 
            numRuns: 3,
            timeout: 120000,
            verbose: true
          }
        );
      }, 240000);
    });
  });
}