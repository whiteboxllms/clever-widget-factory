import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingInvitation {
  id: string;
  organization_id: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  organizations: {
    name: string;
  };
}

export function usePendingInvitations() {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPendingInvitations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_invitations')
        .select(`
          id,
          organization_id,
          role,
          status,
          created_at,
          expires_at,
          organizations (
            name
          )
        `)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching pending invitations:', error);
        toast({
          title: "Error",
          description: "Failed to fetch pending invitations",
          variant: "destructive",
        });
        return;
      }

      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (invitationId: string, organizationId: string) => {
    try {
      // Update invitation status to accepted
      const { error: updateError } = await supabase
        .from('pending_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (updateError) {
        console.error('Error updating invitation:', updateError);
        toast({
          title: "Error",
          description: "Failed to accept invitation",
          variant: "destructive",
        });
        return false;
      }

      // Add user to organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to accept invitations",
          variant: "destructive",
        });
        return false;
      }

      const invitation = invitations.find(inv => inv.id === invitationId);
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          role: invitation?.role || 'user',
        });

      if (memberError) {
        console.error('Error adding to organization:', memberError);
        toast({
          title: "Error",
          description: "Failed to join organization",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Invitation accepted successfully!",
      });

      // Refresh invitations list
      fetchPendingInvitations();
      return true;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      });
      return false;
    }
  };

  const declineInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('pending_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) {
        console.error('Error declining invitation:', error);
        toast({
          title: "Error",
          description: "Failed to decline invitation",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Invitation declined",
      });

      // Refresh invitations list
      fetchPendingInvitations();
      return true;
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast({
        title: "Error",
        description: "Failed to decline invitation",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPendingInvitations();
  }, []);

  return {
    invitations,
    loading,
    acceptInvitation,
    declineInvitation,
    fetchPendingInvitations,
  };
}