import { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useCognitoAuth";
import { useToast } from '@/hooks/use-toast';

// User name mapping based on Cognito user IDs
const USER_NAMES: Record<string, string> = {
  'b8006f2b-0ec7-4107-b05a-b4c6b49541fd': 'Stefan Hamilton',
  '7871f320-d031-70a1-541b-748f221805f3': 'Stefan Hamilton', // Your current Cognito ID
  '989163e0-7011-70ee-6d93-853674acd43c': 'Carl Hilo',
  '68d173b0-60f1-70ea-6084-338e74051fcc': 'Lester Paniel', 
  'f8d11370-e031-70b4-3e58-081a2e482848': 'Vicky Yap',
  '48155769-4d22-4d36-9982-095ac9ad6b2c': 'Mae Dela Torre'
};

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
      console.log('🔍 useProfile - Current user ID:', user.userId);
      console.log('🔍 useProfile - Available names:', USER_NAMES);
      
      // Get name from mapping or fallback to email
      const mappedName = USER_NAMES[user.userId] || user.name || user.email || '';
      console.log('🔍 useProfile - Mapped name:', mappedName);
      
      setFullName(mappedName);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setFullName(user.name || user.email || '');
    }
  };

  const updateFullName = async (newName: string) => {
    if (!user) return false;

    setIsLoading(true);
    try {
      // TODO: Replace with actual database update after migration
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

  const displayName = fullName || user?.name || user?.email || '';

  return {
    fullName,
    displayName,
    updateFullName,
    isLoading,
  };
}