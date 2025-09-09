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
      // Get the name from organization_members table (single source of truth)
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      setFullName(memberData?.full_name || user.user_metadata?.full_name || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Fallback to user metadata if organization member not found
      setFullName(user.user_metadata?.full_name || '');
    }
  };

  const updateFullName = async (newName: string) => {
    if (!user) return false;

    setIsLoading(true);
    try {
      // Update only the organization_members table (single source of truth)
      const { error } = await supabase
        .from('organization_members')
        .update({ full_name: newName })
        .eq('user_id', user.id);

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