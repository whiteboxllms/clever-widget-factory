import { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useCognitoAuth";

export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSuperAdminStatus = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // TODO: Replace with actual database query after migration
        // For now, set super admin for testing user
        const isTestSuperAdmin = user.email === 'stefan@stargazer-farm.com';
        setIsSuperAdmin(isTestSuperAdmin);
      } catch (error) {
        console.error('Error in checkSuperAdminStatus:', error);
        setIsSuperAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkSuperAdminStatus();
  }, [user]);

  return { isSuperAdmin, loading };
}