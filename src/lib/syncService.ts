import { offlineDB, SyncOperation } from '@/lib/offlineDB';
import { apiService } from '@/lib/apiService';

export type SyncResult = {
  processed: number;
  failed: number;
};

// Map logical table names to API endpoints
const TABLE_ENDPOINTS: Record<string, string> = {
  actions: '/actions',
  tools: '/tools',
  parts: '/parts',
  missions: '/missions',
};

async function applyOperation(op: SyncOperation): Promise<void> {
  const endpointBase = TABLE_ENDPOINTS[op.table];
  if (!endpointBase) {
    console.warn('[SyncService] Unknown table, skipping operation', op.table);
    return;
  }

  const endpoint =
    op.type === 'create'
      ? endpointBase
      : `${endpointBase}/${encodeURIComponent(op.record_id)}`;

  if (op.type === 'create') {
    await apiService.post(endpoint, op.data);
  } else if (op.type === 'update') {
    await apiService.put(endpoint, op.data);
  } else if (op.type === 'delete') {
    await apiService.delete(endpoint);
  }
}

/**
 * Process all pending sync operations in FIFO order.
 */
export async function syncPendingOperations(): Promise<SyncResult> {
  const operations = await offlineDB.getPendingSync();

  if (!operations.length) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      await applyOperation(op);
      processed += 1;
    } catch (error) {
      console.error('[SyncService] Failed to apply operation', { op, error });
      failed += 1;
      // Mark the operation as failed with incremented retry_count
      if (op.id != null) {
        await offlineDB.sync_queue.update(op.id, {
          retry_count: (op.retry_count ?? 0) + 1,
          last_error: (error as Error).message,
          timestamp: Date.now(),
        });
      }
    }
  }

  // Clear queue only if everything succeeded
  if (failed === 0) {
    await offlineDB.clearSyncQueue();
  }

  return { processed, failed };
}



