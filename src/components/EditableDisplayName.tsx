import { useProfile } from '@/hooks/useProfile';

export function EditableDisplayName() {
  const { displayName, favoriteColor } = useProfile();

  return (
    <span className="text-muted-foreground">
      Welcome back, <span style={{ color: favoriteColor }}>{displayName}</span>
    </span>
  );
}