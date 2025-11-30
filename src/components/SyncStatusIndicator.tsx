import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function SyncStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { syncing, pendingCount } = useOfflineSync();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-700 border border-amber-200">
      <CloudOff className="h-4 w-4" />
      <span>
        {isOnline
          ? syncing ? `Syncing ${pendingCount}...` : `${pendingCount} pending`
          : `Offline${pendingCount > 0 ? ` • ${pendingCount} queued` : ''}`
        }
      </span>
    </div>
  );
}
