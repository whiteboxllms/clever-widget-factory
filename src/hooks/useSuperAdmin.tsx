import { useProfile } from '@/hooks/useProfile';

export function useSuperAdmin() {
  const { isSuperAdmin, isLoading } = useProfile();
  return {
    isSuperAdmin: Boolean(isSuperAdmin),
    loading: isLoading,
  };
}