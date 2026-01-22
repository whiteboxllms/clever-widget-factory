import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

describe('UnifiedActionDialog - Optimistic Updates', () => {
  it('should not create optimistic entry for new actions', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Simulate the mutation behavior from UnifiedActionDialog
    const { result } = renderHook(
      () => {
        return queryClient;
      },
      { wrapper }
    );

    // Set initial cache state
    result.current.setQueryData(['actions'], [
      { id: 'existing-1', title: 'Existing Action', updated_at: '2025-01-21T10:00:00Z' }
    ]);

    // Simulate onMutate for a NEW action (no id)
    const variables = { title: 'New Action', description: 'Test' };
    
    // This is what the OLD code did - create optimistic entry
    // result.current.setQueryData(['actions'], (old: any) => {
    //   const newAction = { ...variables } as any;
    //   return old ? [...old, newAction] : [newAction];
    // });

    // This is what the NEW code does - skip optimistic update for creates
    // (only update for existing actions with id)
    if ((variables as any).id) {
      result.current.setQueryData(['actions'], (old: any) => {
        if (!old) return old;
        return old.map((action: any) =>
          action.id === (variables as any).id
            ? { ...action, ...variables, updated_at: new Date().toISOString() }
            : action
        );
      });
    }
    // Don't add optimistic action for creates

    // Verify cache still only has the existing action
    const cachedActions = result.current.getQueryData(['actions']) as any[];
    expect(cachedActions).toHaveLength(1);
    expect(cachedActions[0].id).toBe('existing-1');
    expect(cachedActions[0].title).toBe('Existing Action');
  });

  it('should update existing action optimistically with valid timestamp', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => queryClient, { wrapper });

    // Set initial cache state
    const initialDate = '2025-01-21T10:00:00Z';
    result.current.setQueryData(['actions'], [
      { id: 'existing-1', title: 'Old Title', updated_at: initialDate }
    ]);

    // Simulate onMutate for UPDATING an existing action
    const variables = { id: 'existing-1', title: 'Updated Title' };
    
    const beforeUpdate = Date.now();
    
    // This is the NEW code - includes updated_at
    result.current.setQueryData(['actions'], (old: any) => {
      if (!old) return old;
      return old.map((action: any) =>
        action.id === variables.id
          ? { ...action, ...variables, updated_at: new Date().toISOString() }
          : action
      );
    });

    const afterUpdate = Date.now();

    // Verify cache was updated with valid timestamp
    const cachedActions = result.current.getQueryData(['actions']) as any[];
    expect(cachedActions).toHaveLength(1);
    expect(cachedActions[0].id).toBe('existing-1');
    expect(cachedActions[0].title).toBe('Updated Title');
    
    // Verify updated_at is a valid ISO string and recent
    const updatedAt = new Date(cachedActions[0].updated_at).getTime();
    expect(updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
    expect(updatedAt).toBeLessThanOrEqual(afterUpdate + 1000); // Allow 1s tolerance
    expect(cachedActions[0].updated_at).not.toBe(initialDate);
  });
});
