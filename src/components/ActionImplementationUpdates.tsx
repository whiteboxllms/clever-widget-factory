import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { apiService } from '@/lib/apiService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import TiptapEditor from './TiptapEditor';
import { useToast } from '@/hooks/use-toast';
import { ImplementationUpdate } from '@/types/actions';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { activatePlannedCheckoutsIfNeeded } from '@/lib/autoToolCheckout';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useAuth } from '@/hooks/useCognitoAuth';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';

interface ActionImplementationUpdatesProps {
  actionId: string;
  profiles: Array<{ user_id: string; full_name: string; favorite_color?: string | null }>;
  onUpdate?: () => void;
}

interface OrganizationMember {
  user_id: string;
  full_name: string;
  role: string;
  cognito_user_id: string | null;
}

export function ActionImplementationUpdates({ actionId, profiles, onUpdate }: ActionImplementationUpdatesProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const organizationId = useOrganizationId();
  const { members: orgMembers } = useOrganizationMembers();
  const [updates, setUpdates] = useState<ImplementationUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUpdateText, setNewUpdateText] = useState('');
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [allProfiles, setAllProfiles] = useState(profiles);
  const [hoveredUpdateId, setHoveredUpdateId] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdates();
  }, [actionId]);

  useEffect(() => {
    setAllProfiles(profiles);
  }, [profiles]);


  const getCurrentUser = async () => {
    // This will be handled by the useAuth hook
  };

  const fetchUpdates = async () => {
    try {
      console.log('Fetching updates for action:', actionId);
      const result = await apiService.get(`/action_implementation_updates?action_id=${actionId}`);
      const data = result.data || [];
      console.log('Fetched updates from server:', data.length, 'updates');

      // Fetch missing user profiles
      const userIds = [...new Set(data.map(update => update.updated_by))];
      const missingUserIds = userIds.filter(userId => 
        !allProfiles.some(profile => profile.user_id === userId)
      );

      if (missingUserIds.length > 0) {
        try {
          const profilePromises = missingUserIds.map(async (userId) => {
            const result = await apiService.get(`/profiles?user_id=${userId}`);
            return result.data?.[0] || null;
          });
          
          const newProfiles = (await Promise.all(profilePromises)).filter(Boolean);
          const updatedProfiles = [...allProfiles, ...newProfiles];
          setAllProfiles(updatedProfiles);
        } catch (error) {
          console.error('Error fetching missing profiles:', error);
        }
      }

      const updatesWithProfiles = (data || []).map(update => {
        const profile = allProfiles.find(p => p.user_id === update.updated_by);
        return {
          ...update,
          updated_by_profile: profile
        };
      });

      console.log('Setting updates in state:', updatesWithProfiles.length, 'updates');
      setUpdates(updatesWithProfiles);
    } catch (error) {
      console.error('Error fetching implementation updates:', error);
      toast({
        title: "Error",
        description: "Failed to load implementation updates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdateText.trim()) return;

    setIsSubmitting(true);
    try {
      if (!user) throw new Error('Not authenticated');

      await apiService.post('/action_implementation_updates', {
        action_id: actionId,
        update_text: newUpdateText,
        updated_by: user.userId
      });

      setNewUpdateText('');
      
      // Refresh updates to show the new one immediately
      await fetchUpdates();
      
      // Activate planned checkouts if plan is committed and this is the first implementation update
      if (updates.length === 0) {
        try {
          // Check if action has plan_commitment
          const actionResult = await apiService.get('/actions');
          const action = actionResult.data?.find((a: any) => a.id === actionId);
          
          if (action?.plan_commitment === true) {
            await activatePlannedCheckoutsIfNeeded(actionId, organizationId);
          }
        } catch (checkoutError) {
          console.error('Error activating planned checkouts:', checkoutError);
          // Don't fail the update if checkout fails - this is a background operation
        }
      }
      
      // Call onUpdate to update border color immediately
      onUpdate?.();

      if (updates.length > 0) {
        toast({
          title: "Update added",
          description: "Implementation update has been saved",
        });
      }
    } catch (error) {
      console.error('Error adding update:', error);
      toast({
        title: "Error",
        description: "Failed to add implementation update",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUpdate = (update: ImplementationUpdate, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEditingUpdateId(update.id);
    setEditingText(update.update_text);
  };

  const handleSaveEdit = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!editingText.trim() || !editingUpdateId) return;

    setIsSubmitting(true);
    try {
      await apiService.put('/action_implementation_updates', {
        id: editingUpdateId,
        update_text: editingText
      });

      setEditingUpdateId(null);
      setEditingText('');
      await fetchUpdates();
      
      // Don't call onUpdate for edit operations to keep action open
      // onUpdate?.();

      toast({
        title: "Update edited",
        description: "Implementation update has been updated",
      });
    } catch (error) {
      console.error('Error editing update:', error);
      toast({
        title: "Error",
        description: "Failed to edit implementation update",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEditingUpdateId(null);
    setEditingText('');
  };

  const handleDeleteUpdate = async (updateId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setIsDeleting(updateId);
    
    try {
      await apiService.delete(`/action_implementation_updates?id=${updateId}`);

      console.log('Delete successful, refreshing from server...');
      
      // Refresh from server to get updated list
      await fetchUpdates();
      
      // Show success message after refresh
      toast({
        title: "Update deleted",
        description: "Implementation update has been removed",
      });
      
      // Call onUpdate to update border color immediately
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting update:', error);
      toast({
        title: "Error",
        description: "Failed to delete implementation update",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const getProfileName = (cognitoUserId: string) => {
    // Find the user's database user_id based on their Cognito user ID
    const currentUserProfile = orgMembers.find(p => p.cognito_user_id === cognitoUserId);
    if (currentUserProfile) {
      return currentUserProfile.full_name;
    } else {
      // Fallback: check if Cognito user ID matches user_id directly (like Stefan's case)
      const profile = allProfiles.find(p => p.user_id === cognitoUserId);
      return profile?.full_name;
    }
  };

  // Get user's color from their profile preferences
  const getUserColor = (update: ImplementationUpdate) => {
    return update.updated_by_profile?.favorite_color || '#6B7280'; // Default gray if no color set
  };

  // Check if current user can edit/delete this update
  const canEditUpdate = (update: ImplementationUpdate) => {
    return user?.userId === update.updated_by;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading implementation updates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Implementation Updates Section */}
      <div>
        <div className="flex items-center mb-2">
          <Label className="text-sm font-medium text-foreground">Implementation Updates</Label>
        </div>
        
        {/* Add new update form */}
        <div className="border rounded-lg min-h-[120px]">
          <TiptapEditor
            value={newUpdateText}
            onChange={setNewUpdateText}
            placeholder="Add your implementation update..."
            className="min-h-[120px]"
            autoFocus={true}
          />
        </div>
        <div className="flex justify-end mt-2 mb-4">
          <Button 
            onClick={handleAddUpdate} 
            disabled={!newUpdateText.trim() || isSubmitting}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? 'Adding...' : 'Add Update'}
          </Button>
        </div>

        {/* Updates list */}
        {updates.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            <p className="text-sm">No updates yet. Add the first one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {updates.map((update) => {
              const userColor = getUserColor(update);
              const isEditing = editingUpdateId === update.id;
              const isDeletingThis = isDeleting === update.id;
              
              return (
                <div 
                  key={update.id} 
                  className="border rounded-lg p-3 bg-white"
                  onMouseEnter={() => setHoveredUpdateId(update.id)}
                  onMouseLeave={() => setHoveredUpdateId(null)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span 
                            className="font-medium text-xs"
                            style={{ color: userColor }}
                          >
                            {getProfileName(update.updated_by)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        {/* Show edit/delete buttons on hover and for current user's updates */}
                        {hoveredUpdateId === update.id && user?.userId === update.updated_by && (
                          <div className="flex items-center gap-3">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEdit}
                                  disabled={isSubmitting || !editingText.trim()}
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  disabled={isSubmitting}
                                  className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => handleEditUpdate(update, e)}
                                  disabled={isSubmitting || isDeletingThis}
                                  className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => handleDeleteUpdate(update.id, e)}
                                  disabled={isSubmitting || isDeletingThis}
                                  className="h-6 w-6 p-0 text-gray-600 hover:text-gray-700"
                                >
                                  {isDeletingThis ? (
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="border rounded-lg min-h-[80px]">
                          <TiptapEditor
                            value={editingText}
                            onChange={setEditingText}
                            placeholder="Edit your implementation update..."
                            className="min-h-[80px]"
                          />
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none text-sm text-foreground">
                          <div className="text-foreground" dangerouslySetInnerHTML={{ __html: update.update_text }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}