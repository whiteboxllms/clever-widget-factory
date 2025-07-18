import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppSettings {
  debugMode: boolean;
}

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  toggleDebugMode: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'app-settings';

const defaultSettings: AppSettings = {
  debugMode: false,
};

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Keyboard shortcut for debug mode toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        toggleDebugMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const toggleDebugMode = () => {
    setSettings(prev => ({ ...prev, debugMode: !prev.debugMode }));
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, toggleDebugMode }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}