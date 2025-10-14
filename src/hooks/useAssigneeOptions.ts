import { useMemo } from 'react';
import { useActionProfiles } from '@/hooks/useActionProfiles';

interface AssigneeOption {
  user_id: string;
  full_name: string;
}

export function useAssigneeOptions() {
  const { profiles, loading } = useActionProfiles();

  const options: AssigneeOption[] = useMemo(() => {
    return profiles.map(p => ({ user_id: p.user_id, full_name: p.full_name }));
  }, [profiles]);

  return { options, loading };
}


