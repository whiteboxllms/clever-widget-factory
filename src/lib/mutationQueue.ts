import { offlineDB, SyncOperation } from '@/lib/offlineDB';

type MutationType = SyncOperation['type'];

type TableName = 'actions' | 'tools' | 'parts' | 'missions';

export interface QueueMutationOptions<T> {
  table: TableName;
  type: MutationType;
  recordId: string;
  data: any;
  organizationId?: string | null;
  performOnline?: () => Promise<T>;
}

/**
 * Core helper for executing or queueing a mutation.
 *
 * - If online and `performOnline` is provided, it will execute it and mirror
 *   the data into the offline cache.
 * - If offline, it will enqueue the mutation and update the local cache
 *   optimistically.
 */
export async function executeOrQueueMutation<T = unknown>(
  options: QueueMutationOptions<T>
): Promise<T | null> {
  const { table, type, recordId, data, organizationId, performOnline } = options;

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  const enqueue = async () => {
    await offlineDB.sync_queue.add({
      type,
      table,
      record_id: recordId,
      data,
      timestamp: Date.now(),
      organization_id: organizationId ?? null,
      retry_count: 0,
      last_error: null,
    });
  };

  if (!isOnline || !performOnline) {
    // Offline or no online executor provided – queue and update local cache only
    if (type === 'create' || type === 'update') {
      await offlineDB.putRecord(table, { ...data, id: recordId });
    } else if (type === 'delete') {
      await offlineDB.deleteRecord(table, recordId);
    }

    await enqueue();
    return null;
  }

  try {
    const result = await performOnline();

    // Mirror successful result into local cache as "synced"
    if (type === 'delete') {
      await offlineDB.deleteRecord(table, recordId);
    } else {
      await offlineDB.putRecord(table, { ...data, id: recordId });
    }

    return result;
  } catch (error) {
    console.warn('[MutationQueue] Online mutation failed, queuing for later sync', {
      table,
      recordId,
      type,
      error,
    });

    await enqueue();
    throw error;
  }
}




