import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchAuthSession } from 'aws-amplify/auth';

export function TokenRefreshIndicator() {
  const { toast } = useToast();

  useEffect(() => {
    let lastRefresh = Date.now();

    const checkTokenExpiry = async () => {
      try {
        const session = await fetchAuthSession();
        const expiresAt = session.tokens?.idToken?.payload.exp;
        
        if (!expiresAt) return;

        const expiryTime = expiresAt * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiryTime - now;

        // If token expires in less than 5 minutes, show warning
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          const minutesLeft = Math.floor(timeUntilExpiry / 60000);
          
          // Only show once per refresh cycle
          if (now - lastRefresh > 4 * 60 * 1000) {
            toast({
              title: "Session expiring soon",
              description: `Your session will expire in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}. Refreshing...`,
            });
            lastRefresh = now;
          }
        }
      } catch (error) {
        console.error('Failed to check token expiry:', error);
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60 * 1000);
    checkTokenExpiry(); // Check immediately

    return () => clearInterval(interval);
  }, [toast]);

  return null;
}
