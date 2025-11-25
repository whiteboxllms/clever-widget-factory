/**
 * Tests for automatic tool checkout functionality
 * 
 * These tests verify that:
 * 1. Planned checkouts are properly converted to active checkouts when actions are placed in progress
 * 2. Tool status is updated to 'checked_out' when checkouts are created
 * 3. checkout_date is set to current timestamp (not null) when activating planned checkouts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activatePlannedCheckoutsForAction } from './autoToolCheckout';
import { apiService } from './apiService';

// Mock apiService
vi.mock('./apiService', () => ({
  apiService: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('activatePlannedCheckoutsForAction', () => {
  const actionId = 'dbca01f9-cefb-4b85-96b9-78db67babd75';
  const toolId1 = 'tool-1';
  const toolId2 = 'tool-2';
  const checkoutId1 = 'checkout-1';
  const checkoutId2 = 'checkout-2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should activate planned checkouts by setting checkout_date to current timestamp', async () => {
    // Mock planned checkouts (checkout_date is null)
    const plannedCheckouts = [
      {
        id: checkoutId1,
        tool_id: toolId1,
        checkout_date: null,
        is_returned: false,
      },
      {
        id: checkoutId2,
        tool_id: toolId2,
        checkout_date: null,
        is_returned: false,
      },
    ];

    vi.mocked(apiService.get).mockResolvedValue({
      data: plannedCheckouts,
    });

    vi.mocked(apiService.put).mockResolvedValue({});

    await activatePlannedCheckoutsForAction(actionId);

    // Verify get was called to fetch checkouts
    expect(apiService.get).toHaveBeenCalledWith(
      `/checkouts?action_id=${actionId}&is_returned=false`
    );

    // Verify put was called for each planned checkout
    expect(apiService.put).toHaveBeenCalledTimes(4); // 2 checkouts * 2 calls each (checkout_date + tool status)

    // Verify checkout_date is set to a timestamp (not null)
    const checkoutDateCalls = vi.mocked(apiService.put).mock.calls.filter(
      call => call[0] === `/checkouts/${checkoutId1}` || call[0] === `/checkouts/${checkoutId2}`
    );

    expect(checkoutDateCalls.length).toBe(2);
    
    // Verify checkout_date is set to a valid ISO string (not null)
    checkoutDateCalls.forEach(call => {
      const updateData = call[1] as any;
      expect(updateData.checkout_date).toBeDefined();
      expect(updateData.checkout_date).not.toBeNull();
      expect(typeof updateData.checkout_date).toBe('string');
      // Should be a valid ISO date string
      expect(() => new Date(updateData.checkout_date)).not.toThrow();
      expect(new Date(updateData.checkout_date).toISOString()).toBe(updateData.checkout_date);
    });

    // Verify tool status is updated to checked_out
    const toolStatusCalls = vi.mocked(apiService.put).mock.calls.filter(
      call => call[0] === `/tools/${toolId1}` || call[0] === `/tools/${toolId2}`
    );

    expect(toolStatusCalls.length).toBe(2);
    toolStatusCalls.forEach(call => {
      const updateData = call[1] as any;
      expect(updateData.status).toBe('checked_out');
    });
  });

  it('should not activate checkouts that already have a checkout_date', async () => {
    // Mock mix of planned and active checkouts
    const mixedCheckouts = [
      {
        id: checkoutId1,
        tool_id: toolId1,
        checkout_date: null, // Planned checkout
        is_returned: false,
      },
      {
        id: checkoutId2,
        tool_id: toolId2,
        checkout_date: '2024-01-01T00:00:00Z', // Already active
        is_returned: false,
      },
    ];

    vi.mocked(apiService.get).mockResolvedValue({
      data: mixedCheckouts,
    });

    vi.mocked(apiService.put).mockResolvedValue({});

    await activatePlannedCheckoutsForAction(actionId);

    // Should only activate the planned checkout (checkoutId1)
    // 2 calls: checkout_date update + tool status update
    expect(apiService.put).toHaveBeenCalledTimes(2);

    // Verify only the planned checkout was updated
    expect(apiService.put).toHaveBeenCalledWith(
      `/checkouts/${checkoutId1}`,
      expect.objectContaining({
        checkout_date: expect.any(String),
      })
    );

    // Verify the already-active checkout was not updated
    expect(apiService.put).not.toHaveBeenCalledWith(
      `/checkouts/${checkoutId2}`,
      expect.anything()
    );
  });

  it('should handle empty checkout list gracefully', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: [],
    });

    await activatePlannedCheckoutsForAction(actionId);

    expect(apiService.get).toHaveBeenCalled();
    expect(apiService.put).not.toHaveBeenCalled();
  });

  it('should handle no planned checkouts (all have checkout_date)', async () => {
    const activeCheckouts = [
      {
        id: checkoutId1,
        tool_id: toolId1,
        checkout_date: '2024-01-01T00:00:00Z',
        is_returned: false,
      },
    ];

    vi.mocked(apiService.get).mockResolvedValue({
      data: activeCheckouts,
    });

    await activatePlannedCheckoutsForAction(actionId);

    expect(apiService.get).toHaveBeenCalled();
    // Should not update any checkouts since none are planned
    expect(apiService.put).not.toHaveBeenCalled();
  });

  it('should set checkout_date to current timestamp, not null', async () => {
    const plannedCheckout = [
      {
        id: checkoutId1,
        tool_id: toolId1,
        checkout_date: null,
        is_returned: false,
      },
    ];

    vi.mocked(apiService.get).mockResolvedValue({
      data: plannedCheckout,
    });

    vi.mocked(apiService.put).mockResolvedValue({});

    const beforeTime = new Date().toISOString();
    await activatePlannedCheckoutsForAction(actionId);
    const afterTime = new Date().toISOString();

    // Get the checkout_date that was set
    const checkoutUpdateCall = vi.mocked(apiService.put).mock.calls.find(
      call => call[0] === `/checkouts/${checkoutId1}`
    );

    expect(checkoutUpdateCall).toBeDefined();
    const updateData = checkoutUpdateCall![1] as any;
    
    // Verify checkout_date is not null
    expect(updateData.checkout_date).not.toBeNull();
    
    // Verify it's a valid timestamp
    const checkoutDate = new Date(updateData.checkout_date);
    expect(checkoutDate.toISOString()).toBe(updateData.checkout_date);
    
    // Verify it's within the time window of the test execution
    expect(checkoutDate.getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
    expect(checkoutDate.getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
  });

  it('should update tool status for each activated checkout', async () => {
    const plannedCheckouts = [
      {
        id: checkoutId1,
        tool_id: toolId1,
        checkout_date: null,
        is_returned: false,
      },
      {
        id: checkoutId2,
        tool_id: toolId2,
        checkout_date: null,
        is_returned: false,
      },
    ];

    vi.mocked(apiService.get).mockResolvedValue({
      data: plannedCheckouts,
    });

    vi.mocked(apiService.put).mockResolvedValue({});

    await activatePlannedCheckoutsForAction(actionId);

    // Verify tool status was updated for both tools
    expect(apiService.put).toHaveBeenCalledWith(
      `/tools/${toolId1}`,
      { status: 'checked_out' }
    );
    expect(apiService.put).toHaveBeenCalledWith(
      `/tools/${toolId2}`,
      { status: 'checked_out' }
    );
  });
});

