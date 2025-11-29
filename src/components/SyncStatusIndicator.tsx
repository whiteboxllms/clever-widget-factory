import { useState } from 'react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  className?: string;
}

export function SyncStatusIndicator({ className }: SyncStatusIndicatorProps) {
  const { isOnline, isOffline, isSyncing, queuedTotal, queuedByTable, lastSync } =
    useSyncStatus();
  const [isOpen, setIsOpen] = useState(false);

  const statusLabel = isOffline
    ? 'Offline – changes will sync when you reconnect'
    : isSyncing
    ? 'Syncing changes…'
    : queuedTotal > 0
    ? 'Online – changes queued for sync'
    : 'Online – all changes synced';

  const statusColor = isOffline
    ? 'text-yellow-600 dark:text-yellow-400'
    : queuedTotal > 0 || isSyncing
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const lastSyncLabel = lastSync
    ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'No sync yet';

  const details: string[] = [];
  const tableLabels: Record<string, string> = {
    actions: 'Actions',
    tools: 'Tools',
    parts: 'Parts',
    missions: 'Projects',
  };

  Object.entries(queuedByTable).forEach(([table, count]) => {
    if (!count) return;
    const label = tableLabels[table] ?? table;
    details.push(`${label}: ${count}`);
  });

  // Small pill used when collapsed
  const pill = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-card/95 border border-border px-3 py-1 text-xs shadow-sm hover:bg-card',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          isOffline
            ? 'bg-yellow-500'
            : queuedTotal > 0 || isSyncing
            ? 'bg-blue-500'
            : 'bg-emerald-500'
        )}
      />
      <span className="truncate max-w-[8rem]">
        {isOffline ? 'Offline' : queuedTotal > 0 ? `${queuedTotal} queued` : 'Synced'}
      </span>
      <span className="text-[0.7rem] text-muted-foreground">Tap for details</span>
    </button>
  );

  if (!isOpen) {
    return pill;
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card px-3 py-2 text-xs flex flex-col gap-1 shadow-md',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isOffline
                ? 'bg-yellow-500'
                : queuedTotal > 0 || isSyncing
                ? 'bg-blue-500'
                : 'bg-emerald-500'
            )}
          />
          <span className={cn('font-medium', statusColor)}>{statusLabel}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-[0.7rem] text-muted-foreground hover:text-foreground"
        >
          Collapse
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>
          Status:{' '}
          <span className="font-medium">
            {isOffline ? 'Offline' : isSyncing ? 'Syncing' : 'Online'}
          </span>
        </span>
        <span>
          Last sync:{' '}
          <span className="font-mono">
            {isOnline ? lastSyncLabel : 'Pending (offline)'}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>
          Queued changes:{' '}
          <span className="font-medium">{queuedTotal}</span>
        </span>
        {details.length > 0 && (
          <span className="text-[0.7rem] truncate max-w-[14rem]">
            {details.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}



