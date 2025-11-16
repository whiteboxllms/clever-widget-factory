import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useCognitoAuth";
import { useToast } from '@/hooks/use-toast';
import { offlineQueryConfig, offlineMutationConfig } from '@/lib/queryConfig';

const fetchProfile = async (userId: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profiles?user_id=${userId}`);
  const result = await response.json();
  return result.data?.[0] || null;
};

const updateProfile = async ({ userId, full_name, favorite_color }: { userId: string, full_name?: string, favorite_color?: string }) => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      full_name,
      favorite_color
    })
  });
  if (!response.ok) throw new Error('Failed to update');
  return response.json();
};

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.userId],
    queryFn: () => fetchProfile(user!.userId),
    enabled: !!user,
    ...offlineQueryConfig,
  });

  const mutation = useMutation({
    mutationFn: updateProfile,
    ...offlineMutationConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.userId] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateFullName = async (newName: string) => {
    if (!user) return false;
    try {
      await mutation.mutateAsync({ userId: user.userId, full_name: newName, favorite_color: profile?.favorite_color });
      return true;
    } catch {
      return false;
    }
  };

  return {
    fullName: profile?.full_name || '',
    displayName: profile?.full_name || '',
    favoriteColor: profile?.favorite_color || '#6B7280',
    updateFullName,
    isLoading: isLoading || mutation.isPending,
  };
}