import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle, Clock, User, Upload, Image, ChevronDown, ChevronRight, Save, X, Link, Target, Copy } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { uploadToS3, getS3Url } from '@/lib/s3Service';
import { apiService } from '@/lib/apiService';

import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { DEFAULT_DONE_DEFINITION } from "@/lib/constants";
import { useTempPhotoStorage, type TempPhoto } from "@/hooks/useTempPhotoStorage";
import { useAssetScores } from "@/hooks/useAssetScores";
import { ActionScoreDialog } from './ActionScoreDialog';
import { ActionImplementationUpdates } from './ActionImplementationUpdates';
import TiptapEditor from './TiptapEditor';
import { hasActualContent, sanitizeRichText, getActionBorderStyle, processStockConsumption } from '@/lib/utils';
import { BaseAction } from '@/types/actions';
import { autoCheckinToolsForAction } from '@/lib/autoToolCheckout';
import { generateActionUrl, copyToClipboard } from '@/lib/urlUtils';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useCognitoAuth';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface ActionPhoto {
  id: string;
  file_url: string;
  file_name: string;
}

interface ActionCardProps {
  action: BaseAction;
  profiles: Profile[];
  onUpdate: () => void;
  isEditing?: boolean;
  onSave?: (actionData: any) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  tempPhotoStorage?: ReturnType<typeof useTempPhotoStorage>;
  compact?: boolean;
  onToggleComplete?: (action: any) => void;
}

interface ImplementationUpdate {
  id: string;
  action_id: string;
  updated_by: string;
  update_text: string;
  created_at: string;
}

export function ActionCard({ action, profiles, onUpdate, isEditing = false, onSave, onCancel, onEdit, tempPhotoStorage, compact = false, onToggleComplete }: ActionCardProps) {
  const { toast } = useToast();
  const organizationId = useOrganizationId();
  const enhancedToast = useEnhancedToast();
  const { getScoreForAction } = useAssetScores();
  const { favoriteColor } = useProfile();
  const { user } = useAuth();
  const planTextareaRef = useRef<HTMLTextAreaElement>(null);
  const implementationTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [photos, setPhotos] = useState<ActionPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [existingScore, setExistingScore] = useState<any>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Focus tracking states
  const [isPolicyFocused, setIsPolicyFocused] = useState(false);
  
  // Unsaved changes tracking
  const [hasUnsavedPolicy, setHasUnsavedPolicy] = useState(false);
  
  // Auto-save states
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  
  const [editData, setEditData] = useState({
    title: action.title,
    policy: action.policy || '',
    assigned_to: action.assigned_to
  });

  // Get temp photos directly from storage instead of local state
  const tempPhotos = action.id.startsWith('temp-') && tempPhotoStorage 
    ? tempPhotoStorage.getTempPhotosForTask(action.id) 
    : [];

  // Update editData when action prop changes, but preserve local changes if focused
  useEffect(() => {
    setEditData(prev => ({
      title: action.title,
      policy: isPolicyFocused ? prev.policy : (action.policy || ''),
      assigned_to: action.assigned_to
    }));
    
    // Reset unsaved flags when action updates from external source
    if (!isPolicyFocused) setHasUnsavedPolicy(false);
  }, [action.title, action.policy, action.assigned_to, isPolicyFocused]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (isPolicyFocused && hasUnsavedPolicy) {
          savePolicy();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPolicyFocused, hasUnsavedPolicy]);

  // Auto-save implementation for plan field
  useEffect(() => {
    if (!hasUnsavedPolicy || isSavingPolicy) return;
    
    const timeoutId = setTimeout(async () => {
      setIsSavingPolicy(true);
      await savePolicy();
      setIsSavingPolicy(false);
    }, 5000); // Save after 5 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [editData.policy, hasUnsavedPolicy, isSavingPolicy]);

  // Load photos and scores when component mounts
  useEffect(() => {
    if (action.id && !action.id.startsWith('temp-')) {
      loadPhotos();
      loadExistingScore();
    }
  }, [action.id]);

  const loadExistingScore = async () => {
    if (action.id && !action.id.startsWith('temp-')) {
      const score = await getScoreForAction(action.id);
      setExistingScore(score);
    }
  };

  // Load photos from action's attachments field
  const loadPhotos = async () => {
    if (!isExpanded && !isEditing && !compact) return;
    
    // Only load real photos for saved actions
    if (!action.id.startsWith('temp-')) {
      try {
        const data = await apiService.get(`/api/actions/${action.id}`);
        
        if (data) {
          // Convert attachment URLs to photo format
          const attachmentPhotos = (data?.attachments || []).map((url: string, index: number) => ({
            id: `attachment-${index}`,
            file_url: url,
            file_name: `Attachment ${index + 1}`
          }));
          setPhotos(attachmentPhotos);
        }
      } catch (error) {
        console.error('Error loading action attachments:', error);
      }
    }
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      loadPhotos();
    }
  };

  // Load photos when editing mode starts
  useEffect(() => {
    if (isEditing) {
      loadPhotos();
    }
  }, [isEditing]);

  // Save plan to database
  const savePolicy = async () => {
    if (action.status === 'completed') return;
    
    try {
      const normalizedPolicy = sanitizeRichText(editData.policy);
      const updateData: { policy: string | null; assigned_to?: string } = { policy: normalizedPolicy };
      
      await apiService.put(`/api/actions/${action.id}`, updateData);
      
      setHasUnsavedPolicy(false);
      // Don't call onUpdate() here to prevent disruptive refreshes
      
      // Show subtle success feedback
      toast({
        title: "Policy saved",
        description: "Your policy has been automatically saved",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating action policy:', error);
      toast({
        title: "Error",
        description: "Failed to save policy",
        variant: "destructive",
      });
    }
  };


  // Plan change handler - just update local state
  const handlePolicyChange = (value: string) => {
    setEditData(prev => ({ ...prev, policy: value }));
    setHasUnsavedPolicy(value !== (action.policy || ''));
  };

  // Focus handlers
  const handlePolicyFocus = () => {
    setIsPolicyFocused(true);
  };

  const handlePolicyBlur = () => {
    // Small delay to prevent immediate clearing when switching between editor elements
    setTimeout(() => {
      setIsPolicyFocused(false);
    }, 100);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Handle temporary photo upload for temp actions
    if (action.id.startsWith('temp-')) {
      if (!tempPhotoStorage) {
        toast({
          title: "Error",
          description: "Temporary photo storage not available",
          variant: "destructive",
        });
        return;
      }

      try {
        // Process each file
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          await tempPhotoStorage.addTempPhoto(file, action.id);
        }
        
        toast({
          title: "Photos Added",
          description: `${files.length} photo${files.length > 1 ? 's' : ''} will be saved when you create the project`,
        });
      } catch (error) {
        console.error('Failed to add temporary photos:', error);
        toast({
          title: "Error",
          description: "Failed to add photos",
          variant: "destructive",
        });
      }
      
      // Clear the input
      event.target.value = '';
      return;
    }

    // Handle regular photo upload for saved actions
    setIsUploading(true);
    
    let successCount = 0;
    let errorCount = 0;

    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          // Show compression start
          const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);
          
          // Compress the image
          const compressionResult = await compressImageDetailed(
            file,
            { maxSizeMB: 0.5, maxWidthOrHeight: 1920 },
            enhancedToast.showCompressionProgress
          );
          
          // Show compression complete
          enhancedToast.showCompressionComplete(compressionResult);
          enhancedToast.dismiss(compressionToast.id);

          // Upload to S3
          const uploadToast = enhancedToast.showUploadStart(file.name, compressionResult.compressedSize);
          
          const fileName = `${Date.now()}-${file.name}`;
          const uploadResult = await uploadToS3('mission-evidence', fileName, compressionResult.file);

          if (!uploadResult.success) throw new Error(uploadResult.error);

          // Get the relative path for database storage
          const relativePath = `mission-evidence/${fileName}`;

          // Add to action's attachments array
          const currentAction = await apiService.get(`/api/actions/${action.id}`);

          const currentAttachments = currentAction?.attachments || [];
          const updatedAttachments = [...currentAttachments, relativePath];

          await apiService.put(`/api/actions/${action.id}`, { attachments: updatedAttachments });

          enhancedToast.showUploadSuccess(file.name);
          enhancedToast.dismiss(uploadToast.id);
          
          // Add to photos list
          setPhotos(prev => [...prev, {
            id: `attachment-${Date.now()}`,
            file_url: relativePath,
            file_name: file.name
          }]);

          successCount++;

        } catch (error) {
          console.error('Photo upload failed:', file.name, error);
          
          // Extract status code and detailed error information
          let statusCode: number | undefined;
          let errorMessage = 'Upload failed';
          
          if (error && typeof error === 'object') {
            // Supabase storage errors have specific structure
            if ('status' in error) {
              statusCode = error.status as number;
            }
            if ('message' in error) {
              errorMessage = error.message as string;
            } else if ('error' in error && typeof error.error === 'string') {
              errorMessage = error.error;
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          enhancedToast.showUploadError(errorMessage, file.name, statusCode);
          errorCount++;
        }
      }

      // Show summary toast if multiple files
      if (files.length > 1) {
        if (successCount > 0 && errorCount === 0) {
          toast({
            title: "All Photos Uploaded",
            description: `Successfully uploaded ${successCount} photos`,
          });
        } else if (successCount > 0 && errorCount > 0) {
          toast({
            title: "Partial Upload Success",
            description: `${successCount} photos uploaded, ${errorCount} failed`,
            variant: "destructive",
          });
        }
      }

    } finally {
      setIsUploading(false);
      // Clear the input
      event.target.value = '';
    }
  };

  const handleCompleteAction = async () => {
    // Use current editData values for validation (includes unsaved changes)
    const currentPolicy = editData.policy;
    
    // Check if plan has content
    if (!currentPolicy || !currentPolicy.trim()) {
      toast({
        title: "Policy Required",
        description: "Please add a policy before completing the action",
        variant: "destructive",
      });
      return;
    }

    // Check if there are any implementation updates
    try {
      const result = await apiService.get(`/api/action_implementation_updates?action_id=${action.id}&limit=1`);
      const updates = result.data || [];
      
      if (!updates || updates.length === 0) {
        toast({
          title: "Implementation Required",
          description: "Please add at least one implementation update before completing",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Error checking updates:', error);
    }

    setIsCompleting(true);
    
    try {
      // Process required stock consumption if any
      const requiredStock = action.required_stock || [];
      if (requiredStock.length > 0) {
        await processStockConsumption(
          requiredStock, 
          action.id, 
          currentUser.id, 
          action.title, 
          action.mission_id
        );
      }

      // Prepare update data with unsaved changes
      const normalizedPolicy = sanitizeRichText(currentPolicy);
      
      const updateData: {
        policy: string | null;
        status: string;
        completed_at: string;
        assigned_to?: string;
      } = {
        policy: normalizedPolicy,
        status: 'completed',
        completed_at: new Date().toISOString()
      };
      
      await apiService.put(`/api/actions/${action.id}`, updateData);

      // Auto-checkin tools
      try {
        await autoCheckinToolsForAction({
          actionId: action.id,
          checkinReason: 'Action completed',
          notes: 'Auto-checked in when action was completed'
        });
      } catch (checkinError) {
        console.error('Auto-checkin failed:', checkinError);
      }

      // Clear unsaved change flags since we just saved everything
      setHasUnsavedPolicy(false);

      toast({
        title: "Action Completed!",
        description: "Great work! The action has been marked as complete and stock consumption recorded.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error completing action:', error);
      toast({
        title: "Error",
        description: "Failed to complete action and record stock usage",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAssignScore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowScoreDialog(true);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!action.id || action.id.startsWith('temp-')) {
      toast({
        title: "Cannot copy link",
        description: "Please save the action first before copying its link",
        variant: "destructive",
      });
      return;
    }
    
    const actionUrl = generateActionUrl(action.id);
    const success = await copyToClipboard(actionUrl);
    
    if (success) {
      setLinkCopied(true);
      toast({
        title: "Link copied!",
        description: "Action link has been copied to your clipboard",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } else {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = () => {
    if (action.status === 'completed') {
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    }
    
    const isAssigned = Boolean(action.assigned_to);
    const hasContent = action.policy?.trim() || action.observations?.trim();
    
    if (isAssigned && hasContent) {
      return <Clock className="w-4 h-4 text-blue-600" />;
    }
    
    if (isAssigned) {
      return <User className="w-4 h-4 text-amber-600" />;
    }
    
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    if (action.status === 'completed') {
      return <Badge variant="default" className="bg-emerald-600 text-white">Completed</Badge>;
    }
    
    const isAssigned = Boolean(action.assigned_to);
    const hasContent = action.policy?.trim() || action.observations?.trim();
    
    if (isAssigned && hasContent) {
      return <Badge variant="default" className="bg-blue-600 text-white">In Progress</Badge>;
    }
    
    if (isAssigned) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Assigned</Badge>;
    }
    
    return <Badge variant="outline">Not Started</Badge>;
  };

  const theme = getActionBorderStyle(action);

  if (isEditing) {
    // Check if action should default to implementation updates based on border color logic
    const policyToCheck = action.policy || '';
    const hasPolicy = policyToCheck && 
      policyToCheck.trim() && 
      policyToCheck !== '<p></p>' && 
      policyToCheck !== '<p><br></p>' &&
      policyToCheck !== '<p>&nbsp;</p>';
    const hasPlanCommitment = action.plan_commitment === true;
    
    // Use same logic as border colors:
    // Blue border: hasPolicy && hasPlanCommitment (ready to work)
    // Yellow border: hasImplementationUpdates && hasPolicy && hasPlanCommitment (implementation in progress)
    const shouldDefaultToImplementation = hasPolicy && hasPlanCommitment;

    return (
      <Card className={`${theme.bgColor} ${theme.borderColor}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {shouldDefaultToImplementation ? 'Update Action Implementation' : 'Create New Action'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Only show title field if there's no plan commitment */}
          {!shouldDefaultToImplementation && (
            <div>
              <Label htmlFor="title">Action Title</Label>
              <Input
                id="title"
                value={editData.title}
                onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter action title..."
                className="mt-1"
                autoFocus
              />
            </div>
          )}

          {/* Only show policy field if there's no plan commitment */}
          {!shouldDefaultToImplementation && (
            <div>
              <Label htmlFor="policy">Policy</Label>
              <Textarea
                id="policy"
                value={editData.policy}
                onChange={(e) => setEditData(prev => ({ ...prev, policy: e.target.value }))}
                placeholder="Describe the policy for this action..."
                className="mt-1 min-h-[100px]"
                autoFocus={shouldDefaultToImplementation}
              />
            </div>
          )}

          {/* Show implementation updates section if there's a plan commitment */}
          {shouldDefaultToImplementation && (
            <div>
              <Label>Implementation Updates</Label>
              <div className="mt-2">
                <ActionImplementationUpdates 
                  actionId={action.id}
                  onUpdate={onUpdate}
                  profiles={profiles}
                />
              </div>
            </div>
          )}


          <div>
            <Label htmlFor="assigned_to">Assigned To</Label>
            <Select 
              value={editData.assigned_to || 'unassigned'} 
              onValueChange={(value) => setEditData(prev => ({ 
                ...prev, 
                assigned_to: value === 'unassigned' ? null : value 
              }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select assignee..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {profiles.map(profile => (
                  <SelectItem key={profile.user_id} value={profile.user_id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Photo upload for temp actions */}
          <div>
            <Label>Evidence Photos</Label>
            <div className="mt-2">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={isUploading}
                className="hidden"
                id="photo-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('photo-upload')?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Photos'}
              </Button>
            </div>

            {/* Display temp photos */}
            {tempPhotos.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground mb-2">Photos to be saved:</p>
                <div className="grid grid-cols-3 gap-2">
                  {tempPhotos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo.fileUrl}
                        alt={`Temp photo ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => tempPhotoStorage?.removeTempPhoto(photo.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={() => onSave?.(editData)}
              disabled={!editData.title.trim()}
            >
              Save Action
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // View mode
  return (
    <Card className={`${theme.bgColor} ${theme.borderColor} ${theme.textColor}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
            onClick={handleExpand}
          >
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <span className="font-medium">{action.title}</span>
                {getStatusBadge()}
              </div>
              <div className="flex items-center gap-2">
                {/* Copy Link button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className={`h-7 px-2 text-xs ${linkCopied ? 'border-green-500 border-2' : ''}`}
                  title="Copy action link"
                  disabled={!action.id || action.id.startsWith('temp-')}
                >
                  {linkCopied ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                
                {/* Score button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAssignScore}
                  className={`h-7 px-2 text-xs ${existingScore ? 'border-green-500 border-2' : ''}`}
                  title={existingScore ? "View/Edit Score" : "Assign Score"}
                >
                  <Target className="h-3 w-3" />
                </Button>
                {/* Auto-save indicators */}
                {isSavingPolicy && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Save className="w-3 h-3 animate-pulse" />
                    Saving...
                  </div>
                )}
                {hasUnsavedPolicy && !isSavingPolicy && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Save className="w-3 h-3" />
                    Unsaved
                  </div>
                )}
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardTitle>
            <div className="space-y-1">
              {action.assigned_to ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>
                    {(() => {
                      const assignedProfile = profiles.find(p => p.user_id === action.assigned_to);
                      console.log('Action assigned_to:', action.assigned_to, 'Found profile:', assignedProfile);
                      if (assignedProfile) {
                        const isCurrentUser = user?.userId === action.assigned_to;
                        const nameColor = isCurrentUser ? favoriteColor : '#6B7280';
                        
                        return (
                          <span style={{ color: nameColor }}>
                            {assignedProfile.full_name}
                          </span>
                        );
                      }
                      // Fallback: show "Assigned" if we have an assigned_to but no profile match
                      return 'Assigned (Loading...)';
                    })()}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>Unassigned</span>
                </div>
              )}
              {action.participants_details && action.participants_details.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span className="text-xs">
                    Participants: {action.participants_details.map(p => p.full_name).join(', ')}
                  </span>
                </div>
              )}
              {action.issue_reference && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Link className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span className="text-xs break-words">From: {action.issue_reference}</span>
                </div>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Plan Section */}
            <div>
              <div className="flex items-center mb-2">
                <Label className="text-sm font-medium">Plan</Label>
              </div>
              <div className="border rounded-lg min-h-[120px]">
                 <TiptapEditor
                    value={editData.policy}
                    onChange={handlePolicyChange}
                    onFocus={handlePolicyFocus}
                    onBlur={handlePolicyBlur}
                   placeholder="Describe the plan for this action..."
                 />
              </div>
            </div>

            {/* Implementation Updates Section */}
            <ActionImplementationUpdates
              actionId={action.id}
              profiles={profiles}
              onUpdate={onUpdate}
            />

            {/* Evidence Photos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Evidence Photos</Label>
                {action.status !== 'completed' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                      className="hidden"
                      id="photo-upload-view"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById('photo-upload-view')?.click()}
                      disabled={isUploading}
                      className="h-7 text-xs"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      {isUploading ? 'Uploading...' : 'Add Photos'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Display photos */}
              {(photos.length > 0 || tempPhotos.length > 0) ? (
                <div className="grid grid-cols-3 gap-3">
                  {/* Real photos */}
                  {photos.map((photo) => {
                    const photoUrl = photo.file_url.startsWith('http') 
                      ? photo.file_url 
                      : getS3Url(photo.file_url);
                    
                    return (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photoUrl}
                          alt={photo.file_name}
                          className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(photoUrl, '_blank')}
                          onError={(e) => {
                            if (!photo.file_url.startsWith('http')) {
                              // Try mission-attachments path as fallback
                              const fallbackUrl = getS3Url(`mission-attachments/${photo.file_url.split('/').pop()}`);
                              (e.currentTarget as HTMLImageElement).src = fallbackUrl;
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Temp photos for unsaved actions */}
                  {tempPhotos.map((photo, index) => (
                    <div key={`temp-${index}`} className="relative group">
                      <img
                        src={photo.fileUrl}
                        alt={`Temp photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <div className="absolute top-1 right-1 bg-amber-100 text-amber-800 text-xs px-1 rounded opacity-75">
                        Temp
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No evidence photos yet</p>
                </div>
              )}
            </div>

            {/* Save and Action Buttons */}
            {!compact && action.status !== 'completed' && (
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex gap-2">
                  {hasUnsavedPolicy && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={savePolicy}
                      disabled={isSavingPolicy}
                      className="h-8 text-xs"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {isSavingPolicy ? 'Saving Plan...' : 'Save Plan'}
                    </Button>
                  )}
                </div>
                <Button 
                  onClick={handleCompleteAction}
                  disabled={isCompleting || !action.policy?.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isCompleting ? 'Completing...' : 'Mark Complete'}
                </Button>
              </div>
            )}

            {/* Compact mode buttons */}
            {compact && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="flex items-center gap-2"
                  >
                    Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete?.(action);
                  }}
                  className={`flex items-center gap-2 ${
                    action.status === 'completed'
                      ? 'text-green-700 border-green-500 hover:bg-green-50'
                      : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {action.status === 'completed' ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Mark Incomplete
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" />
                      Mark Complete
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <ActionScoreDialog
        open={showScoreDialog}
        onOpenChange={setShowScoreDialog}
        action={{
          ...action,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }}
        existingScore={existingScore}
        onScoreUpdated={loadExistingScore}
      />
    </Card>
  );
}
