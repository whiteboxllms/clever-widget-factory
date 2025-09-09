import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, Send, Copy, Users, Shield, User, Wrench, Star, Info, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';
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
  is_active: boolean;
  status?: string;
  full_name: string | null;
  auth_data?: {
    email: string;
    last_sign_in_at: string | null;
    created_at: string;
  };
}

const Organization = () => {
  const { user } = useAuth();
  const { organizationId } = useParams();
  const { organization: currentOrg, isAdmin: isCurrentOrgAdmin } = useOrganization();
  const { sendInvitation, getPendingInvitations, revokeInvitation, loading } = useInvitations();
  const { toast } = useToast();
  
  // Use the organization from URL param or fallback to current user's org
  const targetOrgId = organizationId || currentOrg?.id;
  const [targetOrganization, setTargetOrganization] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<OrganizationMember[]>([]);
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

      setIsAdmin(memberData?.role === 'leadership');
    } catch (error) {
      console.error('Error in loadOrganizationData:', error);
    }
  };

  const loadInvitations = async () => {
    const data = await getPendingInvitations();
    setInvitations(data);
  };

  const loadMembers = async () => {
    if (!targetOrgId) return;
    
    try {
      // Call the new edge function to get members with auth data
      const { data: response, error } = await supabase.functions.invoke('get-organization-members-with-auth', {
        body: { organizationId: targetOrgId }
      });

      if (error) {
        console.error('Error loading members:', error);
        return;
      }

      const membersWithAuth = response.members || [];
      
      // Split members: those who have signed in vs those who haven't
      const signedInMembers = membersWithAuth.filter((m: any) => m.auth_data.last_sign_in_at !== null);
      const pendingSignIn = membersWithAuth.filter((m: any) => m.auth_data.last_sign_in_at === null);
      
      setMembers(signedInMembers);
      setPendingMembers(pendingSignIn);
    } catch (error) {
      console.error('Error in loadMembers:', error);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await sendInvitation(newInviteEmail, newInviteRole);
    if (result) {
      setNewInviteEmail('');
      setNewInviteRole('user');
      loadInvitations();
      loadMembers(); // Refresh to show new pending invitation
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    const success = await revokeInvitation(invitationId);
    if (success) {
      loadInvitations();
      loadMembers(); // Refresh members to update pending list
    }
  };

  const handleRevokePendingMember = async (memberId: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        console.error('Error revoking pending membership:', error);
        toast({
          title: "Error",
          description: "Failed to revoke invitation",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Pending invitation revoked",
      });
      
      loadMembers();
    } catch (error) {
      console.error('Error revoking pending membership:', error);
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
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

  const toggleMemberStatus = async (memberId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ is_active: !currentStatus })
        .eq('id', memberId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update member status",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Member ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      // Reload members to show updated status
      loadMembers();
    } catch (error) {
      console.error('Error toggling member status:', error);
      toast({
        title: "Error",
        description: "Failed to update member status",
        variant: "destructive",
      });
    }
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

      {/* Roles & Permissions */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Roles & Permissions
                </div>
                <ChevronDown className="w-5 h-5 transition-transform group-data-[state=open]:rotate-180" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* User Role */}
            <div className="p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-foreground">User</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Basic member with standard access to organization resources.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• View tools and inventory</li>
                <li>• Check out/in tools</li>
                <li>• Participate in missions</li>
                <li>• Report issues</li>
                <li>• View own activities</li>
              </ul>
            </div>

            {/* Contributor Role */}
            <div className="p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-foreground">Contributor</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Enhanced member who can create and manage content, tools, and inventory.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• All User permissions</li>
                <li>• Create missions and actions</li>
                <li>• Edit mission details</li>
                <li>• Add/edit tools and inventory (with history tracking)</li>
                <li>• Manage tool maintenance</li>
                <li>• Manage mission attachments</li>
                <li>• Generate reports</li>
              </ul>
            </div>

            {/* Leadership Role */}
            <div className="p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-foreground">Leadership</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Full administrative access with member management and strategic oversight capabilities.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• All Contributor permissions</li>
                <li>• Manage organization members</li>
                <li>• Send/revoke invitations</li>
                <li>• Edit organization settings</li>
                <li>• Access analytics</li>
                <li>• Strategic planning tools</li>
                <li>• Performance analytics</li>
                <li>• Worker attribute management</li>
                <li>• Organizational reporting</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Role Assignment</p>
                <p className="text-blue-700 dark:text-blue-200">
                  Roles are hierarchical - higher roles inherit all permissions from lower roles. 
                  Choose the appropriate role based on the level of access and responsibility needed.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        </CollapsibleContent>
      </Card>
      </Collapsible>

      {/* Invitation Management (Leadership Only) */}
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
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>User - Basic member access</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="contributor">
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4" />
                            <span>Contributor - Create content</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="leadership">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>Leadership - Manage members</span>
                          </div>
                        </SelectItem>
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
            <CardContent className="space-y-6">
              {/* Active Members */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Active Members ({members.length})</h3>
                </div>
                
                {members.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active members found</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="flex-1">
                          <div className="font-medium">{member.full_name || 'Unknown User'}</div>
                          <div className="text-sm text-muted-foreground">{member.auth_data?.email || 'No email available'}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {member.role}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.is_active ? "default" : "secondary"}>
                            {member.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMemberStatus(member.id, member.is_active)}
                            className="text-xs"
                          >
                            {member.is_active ? (
                              <>
                                <ToggleLeft className="w-4 h-4 mr-1" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Invitations */}
              {pendingMembers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Pending Invitations ({pendingMembers.length})</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {pendingMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <div className="flex-1">
                          <div className="font-medium">{member.full_name || 'Unknown User'}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {member.role} • Invitation pending
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
                            Pending
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokePendingMember(member.id)}
                            className="text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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