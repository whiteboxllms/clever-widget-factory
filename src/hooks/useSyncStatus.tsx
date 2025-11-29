import { useEffect, useMemo, useState } from 'react';
import { offlineDB, SyncOperation } from '@/lib/offlineDB';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { syncPendingOperations } from '@/lib/syncService';

type QueuedCounts = {
  total: number;
  byTable: Record<string, number>;
};

const LAST_SYNC_STORAGE_KEY = 'cwf:lastSyncTimestamps';

function loadLastSyncTimestamps(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LAST_SYNC_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveLastSyncTimestamps(timestamps: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, JSON.stringify(timestamps));
  } catch {
    // Ignore storage errors
  }
}

function computeQueuedCounts(operations: SyncOperation[]): QueuedCounts {
  const byTable: Record<string, number> = {};

  for (const op of operations) {
    byTable[op.table] = (byTable[op.table] ?? 0) + 1;
  }

  const total = operations.length;
  return { total, byTable };
}

export function useSyncStatus() {
  const { isOnline, isOffline } = useOfflineStatus();
  const [queuedCounts, setQueuedCounts] = useState<QueuedCounts>({ total: 0, byTable: {} });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTimestamps, setLastSyncTimestamps] = useState<Record<string, number>>(
    () => loadLastSyncTimestamps()
  );

  // Poll the queue periodically so the UI stays up to date
  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      const operations = await offlineDB.getPendingSync();
      if (cancelled) return;
      setQueuedCounts(computeQueuedCounts(operations));
    };

    void loadQueue();
    const id = setInterval(loadQueue, 10_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // When we come back online and there are queued items, trigger a sync
  useEffect(() => {
    if (!isOnline || queuedCounts.total === 0 || isSyncing) return;

    let cancelled = false;

    const runSync = async () => {
      setIsSyncing(true);
      try {
        const result = await syncPendingOperations();
        if (cancelled) return;

        // If everything succeeded, record a global last sync timestamp
        if (result.failed === 0 && result.processed > 0) {
          const now = Date.now();
          const next = { ...lastSyncTimestamps, global: now };
          setLastSyncTimestamps(next);
          saveLastSyncTimestamps(next);
        }

        // Refresh queue counts
        const operations = await offlineDB.getPendingSync();
        if (!cancelled) {
          setQueuedCounts(computeQueuedCounts(operations));
        }
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [isOnline, isSyncing, queuedCounts.total, lastSyncTimestamps]);

  const lastSync = useMemo(() => {
    const ts = lastSyncTimestamps.global;
    return ts ? new Date(ts) : null;
  }, [lastSyncTimestamps]);

  return {
    isOnline,
    isOffline,
    isSyncing,
    queuedTotal: queuedCounts.total,
    queuedByTable: queuedCounts.byTable,
    lastSync,
  };
}


