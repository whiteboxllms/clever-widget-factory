import { Wifi, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWebSocket } from '@/hooks/useWebSocket';

const statusConfig = {
  connected: {
    label: 'Real-time connected',
    dotClass: 'bg-green-500',
    Icon: Wifi,
    iconClass: 'text-green-500',
    animate: false,
  },
  connecting: {
    label: 'Connecting...',
    dotClass: 'bg-amber-500',
    Icon: Wifi,
    iconClass: 'text-amber-500',
    animate: true,
  },
  reconnecting: {
    label: 'Reconnecting...',
    dotClass: 'bg-amber-500',
    Icon: Wifi,
    iconClass: 'text-amber-500',
    animate: true,
  },
  disconnected: {
    label: 'Real-time disconnected',
    dotClass: 'bg-red-500',
    Icon: WifiOff,
    iconClass: 'text-red-500',
    animate: false,
  },
} as const;

export function ConnectionStatusIndicator() {
  const { status } = useWebSocket();
  const config = statusConfig[status];
  const { Icon, label, dotClass, iconClass, animate } = config;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default" aria-label={label}>
          <span
            className={`inline-block h-2 w-2 rounded-full ${dotClass} ${animate ? 'animate-pulse' : ''}`}
          />
          <Icon className={`h-3.5 w-3.5 ${iconClass} ${animate ? 'animate-pulse' : ''}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
