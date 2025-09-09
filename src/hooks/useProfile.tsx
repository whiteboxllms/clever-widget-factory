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
      // First try to get the name from organization_members table
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (memberData?.full_name) {
        setFullName(memberData.full_name);
        return;
      }

      // Fallback to profiles table if no name in organization_members
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
      // Update the organization_members table first (primary source)
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ full_name: newName })
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error updating organization member name:', memberError);
      }

      // Also update the profiles table for backward compatibility
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { user_id: user.id, full_name: newName },
          { onConflict: 'user_id' }
        );

      if (profileError) {
        console.error('Error updating profile name:', profileError);
      }

      // If either update succeeded, consider it a success
      if (!memberError || !profileError) {
        setFullName(newName);
        toast({
          title: "Profile updated",
          description: "Your display name has been updated successfully.",
        });
        return true;
      } else {
        throw new Error('Both updates failed');
      }
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