import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      setFullName(profile?.full_name || user.user_metadata?.full_name || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const updateFullName = async (newName: string) => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { user_id: user.id, full_name: newName },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setFullName(newName);
      toast({
        title: "Profile updated",
        description: "Your display name has been updated successfully.",
      });
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update your display name. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = fullName || user?.user_metadata?.full_name || user?.email || '';

  return {
    fullName,
    displayName,
    updateFullName,
    isLoading,
  };
}