import { syncPendingOperations, SyncResult } from '@/lib/syncService';

type SyncCallback = (result: SyncResult) => void;

/**
 * Start periodic background sync while the app is online.
 *
 * This is intentionally conservative: a modest interval and
 * a simple online check to avoid unnecessary work.
 */
export function startBackgroundSync(
  intervalMs: number,
  onSyncComplete?: SyncCallback
): () => void {
  const runSync = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const result = await syncPendingOperations();
    onSyncComplete?.(result);
  };

  // Kick off an initial sync attempt
  void runSync();

  const id = setInterval(runSync, intervalMs);

  return () => {
    clearInterval(id);
  };
}



