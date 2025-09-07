import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Send, Copy, Users } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { useInvitations } from '@/hooks/useInvitations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface OrganizationMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    full_name: string | null;
  } | null;
}

const Organization = () => {
  const { user } = useAuth();
  const { organizationId } = useParams();
  const { organization: currentOrg, isAdmin: isCurrentOrgAdmin } = useOrganization();
  const { sendInvitation, getInvitations, revokeInvitation, loading } = useInvitations();
  const { toast } = useToast();
  
  // Use the organization from URL param or fallback to current user's org
  const targetOrgId = organizationId || currentOrg?.id;
  const [targetOrganization, setTargetOrganization] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState('user');

  useEffect(() => {
    if (targetOrgId) {
      loadOrganizationData();
    }
  }, [targetOrgId]);

  useEffect(() => {
    if (isAdmin && targetOrgId) {
      loadInvitations();
      loadMembers();
    }
  }, [isAdmin, targetOrgId]);

  const loadOrganizationData = async () => {
    if (!targetOrgId) return;

    // If viewing current user's org, use existing data
    if (targetOrgId === currentOrg?.id) {
      setTargetOrganization(currentOrg);
      setIsAdmin(isCurrentOrgAdmin);
      return;
    }

    // Otherwise, fetch the specific organization
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', targetOrgId)
        .single();

      if (orgError) {
        console.error('Error loading organization:', orgError);
        return;
      }

      setTargetOrganization(orgData);

      // Check if current user is admin of this organization
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', targetOrgId)
        .eq('user_id', user?.id)
        .single();

      setIsAdmin(memberData?.role === 'admin' || memberData?.role === 'leadership');
    } catch (error) {
      console.error('Error in loadOrganizationData:', error);
    }
  };

  const loadInvitations = async () => {
    const data = await getInvitations();
    setInvitations(data);
  };

  const loadMembers = async () => {
    if (!targetOrgId) return;
    
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', targetOrgId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error loading members:', error);
      return;
    }

    // Get profile data separately for each member
    const membersWithProfiles = await Promise.all(
      (data || []).map(async (member) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', member.user_id)
          .single();
        
        return {
          ...member,
          profiles: profile
        };
      })
    );

    setMembers(membersWithProfiles);
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await sendInvitation(newInviteEmail, newInviteRole);
    if (result) {
      setNewInviteEmail('');
      setNewInviteRole('user');
      loadInvitations();
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    const success = await revokeInvitation(invitationId);
    if (success) {
      loadInvitations();
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/auth?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Copied",
      description: "Invitation link copied to clipboard",
    });
  };

  if (!targetOrganization) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading organization data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Organization Settings</h1>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Organization Name</Label>
            <p className="text-lg font-medium">{targetOrganization.name}</p>
          </div>
          {targetOrganization.subdomain && (
            <div>
              <Label>Subdomain</Label>
              <p className="text-lg font-medium">{targetOrganization.subdomain}</p>
            </div>
          )}
          <div>
            <Label>Status</Label>
            <Badge variant={targetOrganization.is_active ? "default" : "destructive"}>
              {targetOrganization.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Invitation Management (Admin Only) */}
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Send Invitation</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendInvitation} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newInviteEmail}
                      onChange={(e) => setNewInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={newInviteRole} onValueChange={setNewInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="leadership">Leadership</SelectItem>
                        <SelectItem value="contributor">Contributor</SelectItem>
                        <SelectItem value="tool_keeper">Tool Keeper</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={loading} className="w-full">
                      <Send className="w-4 h-4 mr-2" />
                      {loading ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Organization Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-muted-foreground">No members found</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">
                            {member.profiles?.full_name || 'Unknown User'}
                          </span>
                          <Badge variant="outline">{member.role}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Joined: {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-muted-foreground">No pending invitations</p>
              ) : (
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{invitation.email}</span>
                          <Badge variant="outline">{invitation.role}</Badge>
                          {invitation.accepted_at ? (
                            <Badge variant="default">Accepted</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!invitation.accepted_at && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInviteLink(invitation.id)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevokeInvitation(invitation.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Organization;