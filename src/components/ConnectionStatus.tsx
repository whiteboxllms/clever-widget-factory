import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { offlineClient } from '@/lib/offlineClient';

export function ConnectionStatus() {
  const [status, setStatus] = useState(offlineClient.getConnectionStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(offlineClient.getConnectionStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (status.online && !status.syncing) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-600">
        <Wifi className="w-3 h-3 mr-1" />
        Online
      </Badge>
    );
  }

  if (status.online && status.syncing) {
    return (
      <Badge variant="outline" className="text-blue-600 border-blue-600">
        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
        Syncing
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-orange-600 border-orange-600">
      <WifiOff className="w-3 h-3 mr-1" />
      Offline
    </Badge>
  );
}
