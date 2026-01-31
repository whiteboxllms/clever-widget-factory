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
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { actionsQueryKey, actionImplementationUpdatesQueryKey } from '@/lib/queryKeys';
import { BaseAction } from '@/types/actions';
import { offlineQueryConfig } from '@/lib/queryConfig';

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
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUpdateText, setNewUpdateText] = useState('');
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [hoveredUpdateId, setHoveredUpdateId] = useState<string | null>(null);

  // Use TanStack Query to fetch implementation updates
  const { data: updatesData = [], isLoading: loading } = useQuery({
    queryKey: actionImplementationUpdatesQueryKey(actionId),
    queryFn: async () => {
      const result = await apiService.get(`/action_implementation_updates?action_id=${actionId}`);
      return result.data || [];
    },
    ...offlineQueryConfig,
  });

  // Map updates with profiles (profiles are already available from props)
  const updates = (updatesData || []).map(update => {
    const profile = profiles.find(p => p.user_id === update.updated_by);
    return {
      ...update,
      updated_by_profile: profile
    };
  });

  const handleAddUpdate = async () => {
    if (!newUpdateText.trim()) return;

    setIsSubmitting(true);
    try {
      if (!user) throw new Error('Not authenticated');

      // Optimistically update the action's implementation_update_count in cache
      queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
        if (!old) return old;
        return old.map(action => 
          action.id === actionId 
            ? { ...action, implementation_update_count: (action.implementation_update_count || 0) + 1 }
            : action
        );
      });

      const response = await apiService.post('/action_implementation_updates', {
        action_id: actionId,
        update_text: newUpdateText,
        updated_by: user.userId
      });

      setNewUpdateText('');
      
      // Update cache with new update from response (no refetch needed)
      if (response.data) {
        queryClient.setQueryData<ImplementationUpdate[]>(actionImplementationUpdatesQueryKey(actionId), (old) => {
          if (!old) return [response.data];
          return [response.data, ...old];
        });
      }
      
      // Activate planned checkouts if plan is committed and this is the first implementation update
      if (updates.length === 0) {
        try {
          // Get action from cache instead of fetching all actions
          const cachedActions = queryClient.getQueryData<BaseAction[]>(actionsQueryKey());
          const action = cachedActions?.find((a: any) => a.id === actionId);
          
          // If not in cache, fetch just this single action
          if (!action) {
            const singleActionResult = await apiService.get(`/actions?id=${actionId}`);
            const singleAction = singleActionResult.data?.[0];
            if (singleAction?.plan_commitment === true) {
              await activatePlannedCheckoutsIfNeeded(actionId, organizationId);
            }
          } else if (action?.plan_commitment === true) {
            await activatePlannedCheckoutsIfNeeded(actionId, organizationId);
          }
        } catch (checkoutError) {
          // Don't fail the update if checkout fails - this is a background operation
        }
      }
      
      // Update cache with server response (in case server computed implementation_update_count)
      const newUpdate = response.data;
      if (newUpdate) {
        // The server might return updated implementation_update_count, update cache
        queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
          if (!old) return old;
          return old.map(action => {
            if (action.id === actionId) {
              // Get current count from updates array length or use optimistic value
              const newCount = updates.length + 1;
              return { ...action, implementation_update_count: newCount };
            }
            return action;
          });
        });
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
      // Rollback optimistic update on error
      queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
        if (!old) return old;
        return old.map(action => 
          action.id === actionId 
            ? { ...action, implementation_update_count: Math.max(0, (action.implementation_update_count || 0) - 1) }
            : action
        );
      });
      
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
      // Optimistically update cache
      queryClient.setQueryData<ImplementationUpdate[]>(actionImplementationUpdatesQueryKey(actionId), (old) => {
        if (!old) return old;
        return old.map(u => 
          u.id === editingUpdateId 
            ? { ...u, update_text: editingText }
            : u
        );
      });

      const response = await apiService.put(`/action_implementation_updates/${editingUpdateId}`, {
        update_text: editingText
      });

      setEditingUpdateId(null);
      setEditingText('');
      
      // Update cache with server response (in case server modified the update)
      if (response.data) {
        queryClient.setQueryData<ImplementationUpdate[]>(actionImplementationUpdatesQueryKey(actionId), (old) => {
          if (!old) return old;
          return old.map(u => u.id === editingUpdateId ? response.data : u);
        });
      }
      
      // Don't call onUpdate for edit operations to keep action open
      // onUpdate?.();

      toast({
        title: "Update edited",
        description: "Implementation update has been updated",
      });
    } catch (error) {
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
      // Store update for potential rollback
      const updateToDelete = updates.find(u => u.id === updateId);
      
      // Optimistically remove from cache
      queryClient.setQueryData<ImplementationUpdate[]>(actionImplementationUpdatesQueryKey(actionId), (old) => {
        if (!old) return old;
        return old.filter(u => u.id !== updateId);
      });
      
      // Optimistically update the action's implementation_update_count in cache
      queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
        if (!old) return old;
        return old.map(action => 
          action.id === actionId 
            ? { ...action, implementation_update_count: Math.max(0, (action.implementation_update_count || 0) - 1) }
            : action
        );
      });

      await apiService.delete(`/action_implementation_updates/${updateId}`);

      // Cache already updated optimistically above - no refetch needed
      
      // Show success message
      toast({
        title: "Update deleted",
        description: "Implementation update has been removed",
      });
      
      // Call onUpdate to update border color immediately
      onUpdate?.();
    } catch (error) {
      // Rollback optimistic update on error
      if (updateToDelete) {
        queryClient.setQueryData<ImplementationUpdate[]>(actionImplementationUpdatesQueryKey(actionId), (old) => {
          if (!old) return [updateToDelete];
          return [...old, updateToDelete].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }
      
      // Rollback cache update
      queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
        if (!old) return old;
        return old.map(action => 
          action.id === actionId 
            ? { ...action, implementation_update_count: (action.implementation_update_count || 0) + 1 }
            : action
        );
      });
      
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
            autoFocus={false}
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