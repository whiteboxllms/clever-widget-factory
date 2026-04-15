import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useEntityContext, EntityContext } from '@/hooks/useEntityContext';
import { GlobalMaxwellPanel } from '@/components/GlobalMaxwellPanel';
import { PrismIcon } from '@/components/icons/PrismIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function GlobalMaxwellFAB() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<EntityContext | null>(null);
  
  const entityContext = useEntityContext();
  const location = useLocation();
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
  const isFinances = location.pathname === '/finances';

  // Listen for open-maxwell events from other components (e.g. Dashboard header button)
  useEffect(() => {
    const handleOpen = () => setIsPanelOpen(true);
    window.addEventListener('open-maxwell', handleOpen);
    return () => window.removeEventListener('open-maxwell', handleOpen);
  }, []);
  
  // Keep component mounted on entity detail pages, dashboard, and finances, or if panel is already open.
  if (!entityContext && !isDashboard && !isFinances && !isPanelOpen) {
    return null;
  }
  
  return (
    <>
      {/* Floating Maxwell button on dashboard */}
      {isDashboard && !isPanelOpen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsPanelOpen(true)}
              className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              aria-label="Ask Maxwell"
            >
              <PrismIcon size={28} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Ask Maxwell</p>
          </TooltipContent>
        </Tooltip>
      )}
      <GlobalMaxwellPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        context={currentContext}
      />
    </>
  );
}
