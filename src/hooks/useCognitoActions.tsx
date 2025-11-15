// Hook to fetch actions for current Cognito user
import { useState, useEffect } from 'react';
import { cognitoMapping } from '@/lib/cognitoMapping';
import { useAuth } from '@/hooks/useCognitoAuth';

export function useCognitoActions() {
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setActions([]);
      setLoading(false);
      return;
    }

    fetchUserActions();
  }, [user]);

  const fetchUserActions = async () => {
    try {
      setLoading(true);
      setError(null);

      const userActions = await cognitoMapping.getCurrentUserActions();
      setActions(userActions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch actions');
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentOrganizationMemberId = async () => {
    return await cognitoMapping.getCurrentOrganizationMemberId();
  };

  return {
    actions,
    loading,
    error,
    refetch: fetchUserActions,
    getCurrentOrganizationMemberId
  };
}
