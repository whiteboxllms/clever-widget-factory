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
      // Generate a secure token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation record
      const { data: invitation, error } = await supabase
        .from('invitations')
        .insert({
          organization_id: organization.id,
          email,
          role,
          token,
          expires_at: expiresAt.toISOString(),
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: "Error",
            description: "This email has already been invited to your organization",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to create invitation",
            variant: "destructive",
          });
        }
        return null;
      }

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke('send-invitation', {
        body: {
          email,
          organizationName: organization.name,
          inviteToken: token,
          role,
        },
      });

      if (emailError) {
        console.error('Error sending invitation email:', emailError);
        toast({
          title: "Warning",
          description: "Invitation created but email failed to send",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Invitation sent to ${email}`,
        });
      }

      return invitation;
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
    if (!organization || !isAdmin) {
      return [];
    }

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }

    return data as Invitation[];
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!organization || !isAdmin) {
      toast({
        title: "Error",
        description: "You don't have permission to revoke invitations",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', organization.id);

    if (error) {
      console.error('Error revoking invitation:', error);
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Success",
      description: "Invitation revoked",
    });
    return true;
  };

  const validateInvitation = async (token: string) => {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        organization:organizations(*)
      `)
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      return null;
    }

    return data;
  };

  const acceptInvitation = async (token: string, userId: string) => {
    // Validate invitation
    const invitation = await validateInvitation(token);
    if (!invitation) {
      return { success: false, error: 'Invalid or expired invitation' };
    }

    try {
      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('token', token);

      if (inviteError) {
        return { success: false, error: 'Failed to accept invitation' };
      }

      // Add user to organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          invited_by: invitation.invited_by,
        });

      if (memberError) {
        return { success: false, error: 'Failed to add user to organization' };
      }

      return { 
        success: true, 
        organization: invitation.organization,
        role: invitation.role 
      };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: 'Failed to accept invitation' };
    }
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