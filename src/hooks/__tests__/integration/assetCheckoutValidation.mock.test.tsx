/**
 * Mock Integration Test: Asset Checkout Validation
 * 
 * Tests the TanStack Actions logic with mocked API responses
 * to validate the checkout workflow without authentication issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActionMutations } from '../../useActionMutations';
import { apiService } from '../../../lib/apiService';
import React from 'react';

// Mock the API service
vi.mock('../../../lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('Mock Integration Tests - Asset Checkout Validation', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let mockApiService: any;

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

    mockApiService = apiService as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * Test: Tool checkout workflow with mocked API
   * 
   * This test simulates the exact scenario you experienced:
   * 1. Add "Test Tool 1" to an action
   * 2. Verify the server response includes affected resources
   * 3. Verify the cache is updated correctly
   */
  it('should show Test Tool 1 as checked out after adding to action (mocked)', async () => {
    // Mock test data
    const testTool1 = {
      id: 'test-tool-1-id',
      name: 'Test Tool 1',
      category: 'Kitchen Equipment',
      status: 'available' as const,
      is_checked_out: false,
      checked_out_user_id: null
    };

    const testAction = {
      id: 'test-action-1-id',
      title: 'Test Recipe Development',
      description: 'Testing recipe that requires precise measurements',
      status: 'pending' as const,
      required_tools: []
    };

    // Setup initial cache state
    queryClient.setQueryData(['actions'], [testAction]);
    queryClient.setQueryData(['tools'], { data: [testTool1] });

    // Mock the API response for updating the action
    const mockServerResponse = {
      data: {
        ...testAction,
        id: testAction.id,
        status: 'in_progress',
        required_tools: [testTool1.id],
        updated_at: new Date().toISOString()
      },
      affectedResources: {
        tools: [{
          ...testTool1,
          is_checked_out: true,
          checked_out_user_id: 'test-user-id',
          checked_out_to: 'Test User',
          checked_out_date: new Date().toISOString()
        }]
      }
    };

    mockApiService.put.mockResolvedValueOnce(mockServerResponse);

    const { result } = renderHook(() => useActionMutations(), { wrapper });

    console.log('🔧 Adding Test Tool 1 to action (mocked)...');

    // Perform the action update
    result.current.updateAction.mutate({
      id: testAction.id,
      updates: {
        status: 'in_progress' as const,
        required_tools: [testTool1.id]
      }
    });

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(result.current.updateAction.isSuccess).toBe(true);
    }, { timeout: 5000 });

    console.log('✅ Action update completed (mocked)');

    // Verify the API was called correctly
    expect(mockApiService.put).toHaveBeenCalledWith(
      `/actions/${testAction.id}`,
      {
        status: 'in_progress',
        required_tools: [testTool1.id]
      }
    );

    // Verify the server response structure
    const serverResponse = result.current.updateAction.data;
    expect(serverResponse).toHaveProperty('data');
    expect(serverResponse).toHaveProperty('affectedResources');
    expect(serverResponse.affectedResources).toHaveProperty('tools');

    const affectedTools = serverResponse.affectedResources.tools;
    expect(affectedTools).toHaveLength(1);

    const updatedTool = affectedTools[0];
    expect(updatedTool.id).toBe(testTool1.id);
    expect(updatedTool.name).toBe('Test Tool 1');
    expect(updatedTool.is_checked_out).toBe(true);
    expect(updatedTool.checked_out_user_id).toBeDefined();

    console.log('📊 Server response tool state (mocked):', {
      id: updatedTool.id,
      name: updatedTool.name,
      is_checked_out: updatedTool.is_checked_out,
      checked_out_user_id: updatedTool.checked_out_user_id
    });

    // Verify cache was updated correctly (this is the key test!)
    const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
    expect(cachedTools).toBeDefined();
    expect(cachedTools?.data).toHaveLength(1);

    const cachedTool = cachedTools?.data.find(t => t.id === testTool1.id);
    expect(cachedTool).toBeDefined();
    expect(cachedTool?.name).toBe('Test Tool 1');
    
    // THIS IS THE CRITICAL TEST - Does the cache show the tool as checked out?
    expect(cachedTool?.is_checked_out).toBe(true);
    expect(cachedTool?.checked_out_user_id).toBeDefined();

    console.log('💾 Cached tool state (this is what Combined Assets sees):', {
      id: cachedTool?.id,
      name: cachedTool?.name,
      is_checked_out: cachedTool?.is_checked_out,
      checked_out_user_id: cachedTool?.checked_out_user_id
    });

    // Verify action cache was also updated
    const cachedActions = queryClient.getQueryData<any[]>(['actions']);
    const cachedAction = cachedActions?.find(a => a.id === testAction.id);
    expect(cachedAction?.status).toBe('in_progress');
    expect(cachedAction?.required_tools).toEqual([testTool1.id]);

    console.log('🎯 TEST RESULT: Tool checkout cache update', 
      cachedTool?.is_checked_out ? 'SUCCESS ✅' : 'FAILED ❌');
  });

  /**
   * Test: What happens when server doesn't return affectedResources
   * 
   * This test simulates a potential bug where the server response
   * doesn't include the affectedResources field
   */
  it('should handle missing affectedResources in server response', async () => {
    const testTool1 = {
      id: 'test-tool-2-id',
      name: 'Test Tool 1',
      status: 'available' as const,
      is_checked_out: false
    };

    const testAction = {
      id: 'test-action-2-id',
      status: 'pending' as const,
      required_tools: []
    };

    queryClient.setQueryData(['actions'], [testAction]);
    queryClient.setQueryData(['tools'], { data: [testTool1] });

    // Mock server response WITHOUT affectedResources (potential bug)
    const mockServerResponseWithoutAffectedResources = {
      data: {
        ...testAction,
        status: 'in_progress',
        required_tools: [testTool1.id]
      }
      // Missing affectedResources!
    };

    mockApiService.put.mockResolvedValueOnce(mockServerResponseWithoutAffectedResources);

    const { result } = renderHook(() => useActionMutations(), { wrapper });

    console.log('🔧 Testing server response without affectedResources...');

    result.current.updateAction.mutate({
      id: testAction.id,
      updates: {
        status: 'in_progress' as const,
        required_tools: [testTool1.id]
      }
    });

    await waitFor(() => {
      expect(result.current.updateAction.isSuccess).toBe(true);
    }, { timeout: 5000 });

    // Check if cache was updated despite missing affectedResources
    const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
    const cachedTool = cachedTools?.data.find(t => t.id === testTool1.id);

    console.log('💾 Tool state without affectedResources:', {
      is_checked_out: cachedTool?.is_checked_out,
      expected: true,
      result: cachedTool?.is_checked_out === true ? 'PASS' : 'FAIL - This might be the bug!'
    });

    // This test will reveal if the cache update depends on affectedResources
    if (!cachedTool?.is_checked_out) {
      console.log('🚨 POTENTIAL BUG FOUND: Cache not updated when affectedResources missing');
    }
  });

  /**
   * Test: Cache update timing and race conditions
   */
  it('should handle rapid successive tool assignments', async () => {
    const testTools = [
      { id: 'tool-1', name: 'Test Tool 1', is_checked_out: false },
      { id: 'tool-2', name: 'Test Tool 2', is_checked_out: false }
    ];

    const testAction = {
      id: 'test-action-3-id',
      status: 'pending' as const,
      required_tools: []
    };

    queryClient.setQueryData(['actions'], [testAction]);
    queryClient.setQueryData(['tools'], { data: testTools });

    // Mock multiple rapid API responses
    mockApiService.put
      .mockResolvedValueOnce({
        data: { ...testAction, required_tools: ['tool-1'] },
        affectedResources: {
          tools: [{ ...testTools[0], is_checked_out: true }]
        }
      })
      .mockResolvedValueOnce({
        data: { ...testAction, required_tools: ['tool-1', 'tool-2'] },
        affectedResources: {
          tools: [
            { ...testTools[0], is_checked_out: true },
            { ...testTools[1], is_checked_out: true }
          ]
        }
      });

    const { result } = renderHook(() => useActionMutations(), { wrapper });

    console.log('🔧 Testing rapid successive tool assignments...');

    // First assignment
    result.current.updateAction.mutate({
      id: testAction.id,
      updates: { required_tools: ['tool-1'] }
    });

    await waitFor(() => {
      expect(result.current.updateAction.isSuccess).toBe(true);
    }, { timeout: 5000 });

    // Reset for second assignment
    result.current.updateAction.reset();

    // Second assignment
    result.current.updateAction.mutate({
      id: testAction.id,
      updates: { required_tools: ['tool-1', 'tool-2'] }
    });

    await waitFor(() => {
      expect(result.current.updateAction.isSuccess).toBe(true);
    }, { timeout: 5000 });

    // Verify final cache state
    const cachedTools = queryClient.getQueryData<{ data: any[] }>(['tools']);
    const tool1 = cachedTools?.data.find(t => t.id === 'tool-1');
    const tool2 = cachedTools?.data.find(t => t.id === 'tool-2');

    console.log('💾 Final cache state after rapid assignments:', {
      tool1_checked_out: tool1?.is_checked_out,
      tool2_checked_out: tool2?.is_checked_out,
      both_checked_out: tool1?.is_checked_out && tool2?.is_checked_out
    });

    expect(tool1?.is_checked_out).toBe(true);
    expect(tool2?.is_checked_out).toBe(true);
  });
});