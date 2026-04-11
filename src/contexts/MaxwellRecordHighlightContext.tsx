import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MaxwellRecordHighlightContextType {
  maxwellRecordIds: string[];
  setMaxwellRecordIds: (ids: string[]) => void;
  clearMaxwellRecordIds: () => void;
  isFilterActive: boolean;
  setIsFilterActive: (active: boolean) => void;
}

const MaxwellRecordHighlightContext = createContext<MaxwellRecordHighlightContextType | undefined>(undefined);

export function MaxwellRecordHighlightProvider({ children }: { children: ReactNode }) {
  const [maxwellRecordIds, setMaxwellRecordIdsState] = useState<string[]>([]);
  const [isFilterActive, setIsFilterActiveState] = useState(false);

  const setMaxwellRecordIds = useCallback((ids: string[]) => {
    setMaxwellRecordIdsState(ids);
  }, []);

  const clearMaxwellRecordIds = useCallback(() => {
    setMaxwellRecordIdsState([]);
    setIsFilterActiveState(false);
  }, []);

  const setIsFilterActive = useCallback((active: boolean) => {
    setIsFilterActiveState(active);
  }, []);

  return (
    <MaxwellRecordHighlightContext.Provider
      value={{
        maxwellRecordIds,
        setMaxwellRecordIds,
        clearMaxwellRecordIds,
        isFilterActive,
        setIsFilterActive,
      }}
    >
      {children}
    </MaxwellRecordHighlightContext.Provider>
  );
}

export function useMaxwellRecordHighlight() {
  const context = useContext(MaxwellRecordHighlightContext);
  if (!context) {
    throw new Error('useMaxwellRecordHighlight must be used within MaxwellRecordHighlightProvider');
  }
  return context;
}
