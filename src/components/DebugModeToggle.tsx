import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, BugOff } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function DebugModeToggle() {
  const { settings, toggleDebugMode } = useAppSettings();

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={settings.debugMode ? "default" : "outline"}
            size="sm"
            onClick={toggleDebugMode}
            className="gap-2"
          >
            {settings.debugMode ? <Bug className="h-4 w-4" /> : <BugOff className="h-4 w-4" />}
            Debug
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {settings.debugMode ? 'Disable' : 'Enable'} detailed toast messages
            <br />
            <span className="text-xs text-muted-foreground">Shortcut: Ctrl+Shift+D</span>
          </p>
        </TooltipContent>
      </Tooltip>
      
      {settings.debugMode && (
        <Badge variant="secondary" className="text-xs animate-pulse">
          Debug Active
        </Badge>
      )}
    </div>
  );
}