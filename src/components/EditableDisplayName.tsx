import { useProfile } from '@/hooks/useProfile';

export function EditableDisplayName() {
  const { displayName } = useProfile();

  return (
    <span className="text-muted-foreground">Welcome back, {displayName}</span>
  );
}