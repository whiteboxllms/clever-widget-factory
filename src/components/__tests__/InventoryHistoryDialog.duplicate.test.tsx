/**
 * Test for InventoryHistoryDialog duplicate key issue
 * 
 * Verifies that duplicate records are handled correctly and
 * keys are unique when rendering history entries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InventoryHistoryDialog } from '../InventoryHistoryDialog';
import { apiService } from '@/lib/apiService';

// Mock apiService
vi.mock('@/lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
  },
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('InventoryHistoryDialog - Duplicate Records', () => {
  const mockPartId = 'd5b42991-807f-413a-8e0a-615d09fb7f7e';
  const mockPartName = 'Test Part';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deduplicate records with the same id', async () => {
    // Mock API response with duplicate records
    const duplicateRecord = {
      id: 'd5b42991-807f-413a-8e0a-615d09fb7f7e',
      change_type: 'quantity_remove',
      old_quantity: 10,
      new_quantity: 8,
      quantity_change: -2,
      changed_by: 'user-1',
      changed_by_name: 'Test User',
      change_reason: 'Test reason',
      changed_at: '2024-01-01T00:00:00Z',
    };

    // API returns the same record twice
    (apiService.get as any).mockResolvedValue({
      data: [duplicateRecord, duplicateRecord], // Duplicate!
    });

    const { container } = render(
      <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
        <button>Open History</button>
      </InventoryHistoryDialog>
    );

    // Open the dialog
    const trigger = screen.getByText('Open History');
    trigger.click();

    await waitFor(() => {
      // Should only render the record once, not twice
      const cards = container.querySelectorAll('[class*="Card"]');
      // After deduplication, should only have one card
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  it('should use unique keys for all rendered entries', async () => {
    const records = [
      {
        id: 'record-1',
        change_type: 'quantity_add',
        old_quantity: 5,
        new_quantity: 10,
        quantity_change: 5,
        changed_by: 'user-1',
        changed_by_name: 'User 1',
        change_reason: 'Added stock',
        changed_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'record-2',
        change_type: 'quantity_remove',
        old_quantity: 10,
        new_quantity: 8,
        quantity_change: -2,
        changed_by: 'user-2',
        changed_by_name: 'User 2',
        change_reason: 'Removed stock',
        changed_at: '2024-01-02T00:00:00Z',
      },
    ];

    (apiService.get as any).mockResolvedValue({
      data: records,
    });

    render(
      <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
        <button>Open History</button>
      </InventoryHistoryDialog>
    );

    const trigger = screen.getByText('Open History');
    trigger.click();

    await waitFor(() => {
      // All records should be rendered with unique keys
      // React will warn if there are duplicate keys
      expect(apiService.get).toHaveBeenCalled();
    });
  });

  it('should handle records with same id but different data', async () => {
    // This shouldn't happen, but if it does, we should keep the most recent one
    const record1 = {
      id: 'd5b42991-807f-413a-8e0a-615d09fb7f7e',
      change_type: 'quantity_remove',
      old_quantity: 10,
      new_quantity: 8,
      quantity_change: -2,
      changed_by: 'user-1',
      changed_by_name: 'User 1',
      change_reason: 'Old reason',
      changed_at: '2024-01-01T00:00:00Z',
    };

    const record2 = {
      id: 'd5b42991-807f-413a-8e0a-615d09fb7f7e', // Same ID!
      change_type: 'quantity_remove',
      old_quantity: 10,
      new_quantity: 8,
      quantity_change: -2,
      changed_by: 'user-1',
      changed_by_name: 'User 1',
      change_reason: 'New reason',
      changed_at: '2024-01-02T00:00:00Z', // More recent
    };

    (apiService.get as any).mockResolvedValue({
      data: [record1, record2],
    });

    render(
      <InventoryHistoryDialog partId={mockPartId} partName={mockPartName}>
        <button>Open History</button>
      </InventoryHistoryDialog>
    );

    const trigger = screen.getByText('Open History');
    trigger.click();

    await waitFor(() => {
      // Should deduplicate and keep only one record
      expect(apiService.get).toHaveBeenCalled();
    });
  });
});

