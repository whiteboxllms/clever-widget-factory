import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useEntityContext, EntityContext } from '@/hooks/useEntityContext';
import { PrismIcon } from '@/components/icons/PrismIcon';
import { GlobalMaxwellPanel } from '@/components/GlobalMaxwellPanel';

export function GlobalMaxwellFAB() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<EntityContext | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  
  const entityContext = useEntityContext();
  const location = useLocation();
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
  
  useEffect(() => {
    if (!isPanelOpen && fabRef.current) {
      const timer = setTimeout(() => {
        fabRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPanelOpen]);
  
  // Show FAB on entity detail pages and dashboard. Keep panel alive if already open.
  if (!entityContext && !isDashboard && !isPanelOpen) {
    return null;
  }
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentContext(entityContext);
    setIsPanelOpen(true);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setCurrentContext(entityContext);
      setIsPanelOpen(true);
    }
  };
  
  return (
    <>
      {!isPanelOpen && (entityContext || isDashboard) && (
        <button
          ref={fabRef}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="fixed bottom-4 right-4 z-[9999] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all backdrop-blur-sm cursor-pointer"
          aria-label="Open Maxwell Assistant"
          tabIndex={0}
        >
          <div className="flex items-center justify-center">
            <PrismIcon size={28} className="text-primary-foreground" />
          </div>
        </button>
      )}
      <GlobalMaxwellPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        context={currentContext}
      />
    </>
  );
}
