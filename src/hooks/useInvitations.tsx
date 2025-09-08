import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from './useOrganization';

interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
}

export function useInvitations() {
  const { toast } = useToast();
  const { organization, isAdmin } = useOrganization();
  const [loading, setLoading] = useState(false);

  const sendInvitation = async (email: string, role: string = 'user') => {
    if (!organization || !isAdmin) {
      toast({
        title: "Error",
        description: "You don't have permission to send invitations",
        variant: "destructive",
      });
      return null;
    }

    setLoading(true);
    try {
      // Send invitation using Supabase Admin API
      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          organizationId: organization.id,
          organizationName: organization.name,
          role,
        },
      });

      if (error) {
        console.error('Error sending invitation:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to send invitation",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Success",
        description: `Invitation sent to ${email}`,
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getInvitations = async () => {
    // Since we're using Supabase's native invitation system,
    // we can't easily fetch pending invitations. Return empty array.
    // Users will need to manage invitations through Supabase dashboard if needed.
    return [];
  };

  const revokeInvitation = async (invitationId: string) => {
    // Since we're using Supabase's native invitation system,
    // invitations are managed by Supabase Auth and cannot be revoked through the API.
    toast({
      title: "Info",
      description: "Invitations are managed through Supabase Auth and expire automatically",
    });
    return false;
  };

  const validateInvitation = async (token: string) => {
    // With Supabase native invitations, validation is handled by Supabase Auth
    // We don't need custom validation logic
    return null;
  };

  const acceptInvitation = async (token: string, userId: string) => {
    // With Supabase native invitations, acceptance is handled automatically
    // when users complete the signup flow from the invitation email
    return { success: false, error: 'Invitation acceptance is handled by Supabase Auth' };
  };

  return {
    sendInvitation,
    getInvitations,
    revokeInvitation,
    validateInvitation,
    acceptInvitation,
    loading,
  };
}