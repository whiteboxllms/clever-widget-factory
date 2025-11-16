import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

export function ConnectionStatus() {
  const { isOnline } = useOfflineStatus();

  if (isOnline) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-600">
        <Wifi className="w-3 h-3 mr-1" />
        Online
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
