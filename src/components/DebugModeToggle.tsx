import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, BugOff } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRef } from 'react';

export function DebugModeToggle() {
  const { settings, toggleDebugMode } = useAppSettings();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    timerRef.current = setTimeout(() => {
      toggleDebugMode();
    }, 500);
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={settings.debugMode ? "default" : "outline"}
            size="sm"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={(e) => e.preventDefault()}
            className="p-2"
            aria-label={settings.debugMode ? 'Disable debug mode' : 'Enable debug mode'}
          >
            {settings.debugMode ? <Bug className="h-4 w-4" /> : <BugOff className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Hold to {settings.debugMode ? 'disable' : 'enable'} debug mode
            <br />
            <span className="text-xs text-muted-foreground">Shortcut: Ctrl+Shift+D</span>
          </p>
        </TooltipContent>
      </Tooltip>

      {settings.debugMode && (
        <Badge variant="secondary" className="text-xs animate-pulse">
          Debug
        </Badge>
      )}
    </div>
  );
}
