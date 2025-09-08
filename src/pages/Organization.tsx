import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Send, Copy, Users, Shield, User, Wrench, Star, Info } from 'lucide-react';
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

      {/* Roles & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Roles & Permissions
          </CardTitle>
        </CardHeader>
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

            {/* Admin Role */}
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
                <li>• Access admin analytics</li>
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
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>Admin - Manage members</span>
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