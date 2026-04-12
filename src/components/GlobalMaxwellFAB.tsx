import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useEntityContext, EntityContext } from '@/hooks/useEntityContext';
import { GlobalMaxwellPanel } from '@/components/GlobalMaxwellPanel';

export function GlobalMaxwellFAB() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<EntityContext | null>(null);
  
  const entityContext = useEntityContext();
  const location = useLocation();
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';
  const isFinances = location.pathname === '/finances';
  
  // Keep component mounted on entity detail pages, dashboard, and finances, or if panel is already open.
  if (!entityContext && !isDashboard && !isFinances && !isPanelOpen) {
    return null;
  }
  
  return (
    <GlobalMaxwellPanel
      open={isPanelOpen}
      onOpenChange={setIsPanelOpen}
      context={currentContext}
    />
  );
}
