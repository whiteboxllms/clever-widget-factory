import { useState, useRef, useEffect } from 'react';
import { useEntityContext, EntityContext } from '@/hooks/useEntityContext';
import { PrismIcon } from '@/components/icons/PrismIcon';
import { GlobalMaxwellPanel } from '@/components/GlobalMaxwellPanel';

export function GlobalMaxwellFAB() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<EntityContext | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  
  // Detect if we're on an entity detail page
  const entityContext = useEntityContext();
  
  // Focus management: return focus to FAB when panel closes
  useEffect(() => {
    if (!isPanelOpen && fabRef.current) {
      // Small delay to ensure panel is fully closed
      const timer = setTimeout(() => {
        fabRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPanelOpen]);
  
  // Only render FAB when context is available (entity detail pages)
  if (!entityContext) {
    return null;
  }
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture current context when FAB is clicked
    setCurrentContext(entityContext);
    setIsPanelOpen(true);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Support Enter key to open panel
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setCurrentContext(entityContext);
      setIsPanelOpen(true);
    }
  };
  
  return (
    <>
      {/* Floating Action Button - hide when panel is open */}
      {!isPanelOpen && (
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
      
      {/* Panel */}
      <GlobalMaxwellPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        context={currentContext}
      />
    </>
  );
}
