import { useEffect } from 'react';
import { supabase } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';
import { validateAndRefreshSession } from '@/lib/authUtils';

export function useSessionMonitor() {
  const { toast } = useToast();

  useEffect(() => {
    let sessionCheckInterval: NodeJS.Timeout;

    const startSessionMonitoring = () => {
      // Check session every 5 minutes
      sessionCheckInterval = setInterval(async () => {
        const validation = await validateAndRefreshSession();
        
        if (!validation.isValid && validation.error) {
          console.warn('Session validation failed:', validation.error);
          
          // Only show toast for certain critical errors to avoid spam
          if (validation.error.includes('refresh failed') || validation.error.includes('expired')) {
            toast({
              title: "Session Expired",
              description: "Please log out and log back in to continue",
              variant: "destructive",
            });
          }
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          clearInterval(sessionCheckInterval);
        } else if (event === 'SIGNED_IN' && session) {
          startSessionMonitoring();
        }
      }
    );

    // Start monitoring if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        startSessionMonitoring();
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, [toast]);
}