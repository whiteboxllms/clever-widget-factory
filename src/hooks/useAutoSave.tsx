
import { useEffect, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UseAutoSaveOptions {
  delay?: number;
  onSave?: (data: any) => Promise<void>;
  enabled?: boolean;
}

export const useAutoSave = (data: any, options: UseAutoSaveOptions = {}) => {
  const { delay = 2000, onSave, enabled = true } = options;
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedDataRef = useRef<string>('');
  const isSavingRef = useRef(false);

  const debouncedSave = useCallback(async () => {
    if (!enabled || !onSave || isSavingRef.current) return;

    const currentDataString = JSON.stringify(data);
    
    // Don't save if data hasn't changed
    if (currentDataString === lastSavedDataRef.current) return;

    try {
      isSavingRef.current = true;
      await onSave(data);
      lastSavedDataRef.current = currentDataString;
      
      // Show subtle success indicator
      toast({
        description: "Changes saved automatically",
        duration: 2000,
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast({
        description: "Failed to save changes automatically",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      isSavingRef.current = false;
    }
  }, [data, onSave, enabled, toast]);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(debouncedSave, delay);

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, debouncedSave, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving: isSavingRef.current,
    forceSave: debouncedSave,
  };
};
