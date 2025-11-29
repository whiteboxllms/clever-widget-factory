import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/hooks/useCognitoAuth";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Trash2, Send, Users, Shield, User, Wrench, Star, Info, ToggleLeft, ToggleRight, ChevronDown, UserX, ArrowLeft } from 'lucide-react';
import { EditableOrganizationName } from '@/components/EditableOrganizationName';
import { EditableMemberName } from '@/components/EditableMemberName';
import { EditableOrganizationDomain } from '@/components/EditableOrganizationDomain';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useOrganization } from '@/hooks/useOrganization';
import { useInvitations } from '@/hooks/useInvitations';
import { useToast } from '@/hooks/use-toast';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useProfile } from '@/hooks/useProfile';
import { OrganizationValuesSection } from '@/components/OrganizationValuesSection';
import { apiService, getApiData } from '@/lib/apiService';
import { useQueryClient } from '@tanstack/react-query';


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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId } = useParams();
  const { organization: currentOrg } = useOrganization();
  const { sendInvitation, loading } = useInvitations();
  const { updateOrganization } = useOrganizations();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const { allMemberships, isLoading: profileLoading } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use the organization from URL param or fallback to current user's org
  const targetOrgId = organizationId || currentOrg?.id;
  const [targetOrganization, setTargetOrganization] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingMembers, setPendingMembers] = useState<OrganizationMember[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState('user');

  const resolvedOrgId = targetOrganization?.id || targetOrgId;
  const targetMembership = useMemo(() => {
    if (!resolvedOrgId) return null;
    return allMemberships?.find((membership) => membership.organization_id === resolvedOrgId) || null;
  }, [allMemberships, resolvedOrgId]);

  useEffect(() => {
    if (!superAdminLoading && !profileLoading) {
      loadOrganizationData();
    }
  }, [targetOrgId, isSuperAdmin, superAdminLoading, profileLoading]);

  useEffect(() => {
    if (isAdmin && targetOrganization?.id) {
      loadMembers(targetOrganization.id);
    }
  }, [isAdmin, targetOrganization?.id]);

  const invalidateOrgMembersCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['organization_members'] });
  }, [queryClient]);

  const loadOrganizationData = async () => {
    if (superAdminLoading || profileLoading) return;

    try {
      const response = await apiService.get('/organizations');
      const organizations = getApiData(response) || [];

      if (!organizations.length) {
        setTargetOrganization(null);
        setIsAdmin(isSuperAdmin);
        return;
      }

      let selectedOrganization = targetOrgId
        ? organizations.find((org: any) => org.id === targetOrgId)
        : null;

      if (!selectedOrganization) {
        selectedOrganization = organizations[0];
      }

      setTargetOrganization(selectedOrganization);

      const membershipForOrg = allMemberships?.find(
        (membership) => membership.organization_id === selectedOrganization.id
      );

      if (isSuperAdmin) {
        setIsAdmin(true);
      } else {
        const isOrgAdmin = membershipForOrg?.role === 'admin';
        setIsAdmin(!!isOrgAdmin);
      }
    } catch (error) {
      console.error('Error in loadOrganizationData:', error);
      setIsAdmin(isSuperAdmin);
    }
  };


  const loadMembers = async (orgId?: string) => {
    const effectiveOrgId = orgId || targetOrganization?.id || targetOrgId;
    console.log('[Organization] loadMembers start', { effectiveOrgId });
    if (!effectiveOrgId) return;
    
    try {
      let membersWithAuth: OrganizationMember[] = [];

      try {
        const response = await apiService.post('/api/organization-members-with-auth', {
          organizationId: effectiveOrgId
        });

        if (response?.members) {
          membersWithAuth = response.members;
        }
      } catch (functionError) {
        // Fall through to API fallback
      }

      if (membersWithAuth.length === 0) {
        const fallbackResponse = await apiService.get('/organization_members');
        const fallbackData = getApiData(fallbackResponse) || [];
        membersWithAuth = fallbackData
          .filter((member: any) => member.organization_id === effectiveOrgId)
          .map((member: any) => ({
            id: member.id || member.user_id,
            user_id: member.user_id,
            role: member.role,
            is_active: member.is_active !== false,
            organization_id: member.organization_id,
            full_name: member.full_name || member.user_id,
            auth_data: {
              email: member.cognito_user_id || member.user_id || 'Unknown',
              last_sign_in_at: member.last_sign_in_at || null,
              created_at: member.created_at || member.updated_at || new Date().toISOString()
            }
          }));
      }
      
      // Split members: those who have signed in vs those who haven't
      const signedInMembers = membersWithAuth.filter((m: any) => m.auth_data?.last_sign_in_at !== null);
      const pendingSignIn = membersWithAuth.filter((m: any) => m.auth_data?.last_sign_in_at === null);
      
      // Sort signed-in members: active members first, then inactive
      const sortedSignedInMembers = signedInMembers.sort((a: any, b: any) => {
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
      
      setMembers(sortedSignedInMembers);
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
      loadMembers(targetOrganization?.id); // Refresh to show new pending invitation
      invalidateOrgMembersCache();
    }
  };


  const handleRevokePendingMember = async (memberId: string) => {
    if (!isAdmin) return;

    try {
      await apiService.delete(`/organization_members?id=${memberId}`);

      toast({
        title: "Success",
        description: "Pending invitation revoked",
      });
      
      loadMembers(targetOrganization?.id);
      invalidateOrgMembersCache();
    } catch (error) {
      console.error('Error revoking pending membership:', error);
      toast({
        title: "Error",
        description: "Failed to revoke invitation",
        variant: "destructive",
      });
    }
  };


  const toggleMemberStatus = async (memberId: string, currentStatus: boolean) => {
    try {
      await apiService.put('/organization_members', {
        id: memberId,
        is_active: !currentStatus
      });

      toast({
        title: "Success",
        description: `Member ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
      });

      loadMembers(targetOrganization?.id);
      invalidateOrgMembersCache();
    } catch (error) {
      console.error('Error toggling member status:', error);
      toast({
        title: "Error",
        description: "Failed to update member status",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(`Are you sure you want to remove ${memberName}? This will deactivate their account.`);
    if (!confirmed) return;

    try {
      await apiService.delete(`/organization_members?id=${memberId}`);

      toast({
        title: "Success",
        description: `${memberName} has been removed`,
      });
      
      loadMembers(targetOrganization?.id);
      invalidateOrgMembersCache();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string, memberName: string) => {
    if (!isAdmin) return;

    try {
      await apiService.put('/organization_members', {
        id: memberId,
        role: newRole
      });

      toast({
        title: "Success",
        description: `${memberName}'s role has been updated to ${newRole}`,
      });
      
      loadMembers(targetOrganization?.id);
      invalidateOrgMembersCache();
    } catch (error) {
      console.error('Error updating member role:', error);
      toast({
        title: "Error",
        description: "Failed to update member role",
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
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Organization Settings</h1>
        </div>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Organization Name</Label>
            <EditableOrganizationName
              organizationId={targetOrganization.id}
              currentName={targetOrganization.name}
              onNameUpdated={loadOrganizationData}
              canEdit={isAdmin}
            />
          </div>
          <div>
            <Label>Domain</Label>
            <EditableOrganizationDomain
              organizationId={targetOrganization.id}
              currentDomain={targetOrganization.subdomain}
              onDomainUpdated={loadOrganizationData}
              canEdit={isAdmin}
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization Values */}
      <OrganizationValuesSection canEdit={isAdmin} organization={targetOrganization} />

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

            {/* Admin Role */}
            <div className="p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-foreground">Admin</h3>
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
                           <EditableMemberName 
                             memberId={member.id}
                             currentName={member.full_name}
                             email={member.auth_data?.email || 'No email available'}
                             onNameUpdated={loadMembers}
                           />
                           <div className="text-sm text-muted-foreground">{member.auth_data?.email || 'No email available'}</div>
                           <div className="flex items-center gap-2 text-sm">
                             <span className="text-muted-foreground">Role:</span>
                             {isAdmin ? (
                               <Select value={member.role} onValueChange={(value) => handleRoleChange(member.id, value, member.full_name || 'Unknown User')}>
                                 <SelectTrigger className="w-32 h-7 text-xs">
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                   <SelectItem value="user">User</SelectItem>
                                   <SelectItem value="contributor">Contributor</SelectItem>
                                   <SelectItem value="admin">Admin</SelectItem>
                                   
                                 </SelectContent>
                               </Select>
                             ) : (
                               <Badge variant="outline" className="text-xs">
                                 {member.role}
                               </Badge>
                             )}
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.full_name || 'Unknown User')}
                            className="text-xs text-destructive hover:text-destructive"
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Remove
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
                           <EditableMemberName 
                             memberId={member.id}
                             currentName={member.full_name}
                             email={member.auth_data?.email || 'No email available'}
                             onNameUpdated={loadMembers}
                           />
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

        </>
      )}
    </div>
  );
};

export default Organization;