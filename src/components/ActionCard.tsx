import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, User, Upload, Image, ChevronDown, ChevronRight, Save, X, Link } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { DEFAULT_DONE_DEFINITION } from "@/lib/constants";
import { useTempPhotoStorage, type TempPhoto } from "@/hooks/useTempPhotoStorage";
import { LexicalEditor } from './LexicalEditor';

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
  action: {
    id: string;
    title: string;
    plan?: string;
    observations?: string;
    assigned_to?: string | null;
    status: string;
    mission_id?: string;
    estimated_duration?: string;
    actual_duration?: string;
    required_tools?: string[];
    linked_issue_id?: string;
    issue_reference?: string;
  };
  profiles: Profile[];
  onUpdate: () => void;
  isEditing?: boolean;
  onSave?: (actionData: any) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  tempPhotoStorage?: ReturnType<typeof useTempPhotoStorage>;
}

export function ActionCard({ action, profiles, onUpdate, isEditing = false, onSave, onCancel, onEdit, tempPhotoStorage }: ActionCardProps) {
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const planTextareaRef = useRef<HTMLTextAreaElement>(null);
  const implementationTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [photos, setPhotos] = useState<ActionPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Focus tracking states
  const [isPlanFocused, setIsPlanFocused] = useState(false);
  const [isImplementationFocused, setIsImplementationFocused] = useState(false);
  
  // Unsaved changes tracking
  const [hasUnsavedPlan, setHasUnsavedPlan] = useState(false);
  const [hasUnsavedImplementation, setHasUnsavedImplementation] = useState(false);
  
  // Auto-save states
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingImplementation, setIsSavingImplementation] = useState(false);
  
  const [editData, setEditData] = useState({
    title: action.title,
    plan: action.plan || '',
    observations: action.observations || '',
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
      plan: isPlanFocused ? prev.plan : (action.plan || ''),
      observations: isImplementationFocused ? prev.observations : (action.observations || ''),
      assigned_to: action.assigned_to
    }));
    
    // Reset unsaved flags when action updates from external source
    if (!isPlanFocused) setHasUnsavedPlan(false);
    if (!isImplementationFocused) setHasUnsavedImplementation(false);
  }, [action.title, action.plan, action.observations, action.assigned_to, isPlanFocused, isImplementationFocused]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (isPlanFocused && hasUnsavedPlan) {
          savePlan();
        } else if (isImplementationFocused && hasUnsavedImplementation) {
          saveImplementation();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlanFocused, isImplementationFocused, hasUnsavedPlan, hasUnsavedImplementation]);

  // Auto-save implementation for plan field
  useEffect(() => {
    if (!hasUnsavedPlan || isSavingPlan) return;
    
    const timeoutId = setTimeout(async () => {
      setIsSavingPlan(true);
      await savePlan();
      setIsSavingPlan(false);
    }, 5000); // Save after 5 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [editData.plan, hasUnsavedPlan, isSavingPlan]);

  // Auto-save implementation for implementation field
  useEffect(() => {
    if (!hasUnsavedImplementation || isSavingImplementation) return;
    
    const timeoutId = setTimeout(async () => {
      setIsSavingImplementation(true);
      await saveImplementation();
      setIsSavingImplementation(false);
    }, 5000); // Save after 5 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [editData.observations, hasUnsavedImplementation, isSavingImplementation]);

  // Load photos (only real photos now, temp photos come from storage)
  const loadPhotos = async () => {
    if (!isExpanded && !isEditing) return;
    
    // Only load real photos for saved actions
    if (!action.id.startsWith('temp-')) {
      const { data, error } = await supabase
        .from('mission_attachments')
        .select('id, file_url, file_name')
        .eq('task_id', action.id);

      if (error) {
        console.error('Error loading photos:', error);
      } else {
        setPhotos(data || []);
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
  const savePlan = async () => {
    if (action.status === 'completed') return;
    
    try {
      const updateData: { plan: string; assigned_to?: string } = { plan: editData.plan };
      
      // If action is unassigned, assign it to the current user
      if (!action.assigned_to) {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          updateData.assigned_to = user.user.id;
        }
      }

      const { error } = await supabase
        .from('mission_actions')
        .update(updateData)
        .eq('id', action.id);

      if (error) throw error;
      
      setHasUnsavedPlan(false);
      // Don't call onUpdate() here to prevent disruptive refreshes
      
      // Show subtle success feedback
      toast({
        title: "Plan saved",
        description: "Your plan has been automatically saved",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating action plan:', error);
      toast({
        title: "Error",
        description: "Failed to save plan",
        variant: "destructive",
      });
    }
  };

  // Save implementation to database
  const saveImplementation = async () => {
    try {
      const updateData: { observations: string; status?: string; assigned_to?: string } = {
        observations: editData.observations
      };
      
      // If action is unassigned, assign it to the current user
      if (!action.assigned_to) {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          updateData.assigned_to = user.user.id;
        }
      }
      
      // Only update status if action is not already in progress or completed and has content
      if (action.status === 'not_started' && editData.observations.trim()) {
        updateData.status = 'in_progress';
      }
      
      const { error } = await supabase
        .from('mission_actions')
        .update(updateData)
        .eq('id', action.id);

      if (error) throw error;
      
      setHasUnsavedImplementation(false);
      // Don't call onUpdate() here to prevent disruptive refreshes
      
      // Show subtle success feedback
      toast({
        title: "Implementation saved",
        description: "Your implementation has been automatically saved",
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating action observations:', error);
      toast({
        title: "Error",
        description: "Failed to save implementation",
        variant: "destructive",
      });
    }
  };

  // Plan change handler - just update local state
  const handlePlanChange = (value: string) => {
    setEditData(prev => ({ ...prev, plan: value }));
    setHasUnsavedPlan(value !== (action.plan || ''));
  };

  // Implementation change handler - just update local state
  const handleImplementationChange = (value: string) => {
    setEditData(prev => ({ ...prev, observations: value }));
    setHasUnsavedImplementation(value !== (action.observations || ''));
  };

  // Focus handlers
  const handlePlanFocus = () => {
    setIsPlanFocused(true);
  };

  const handlePlanBlur = () => {
    setIsPlanFocused(false);
    // Don't auto-save on blur to prevent focus loss when switching fields
    // Save will happen on manual save or when leaving edit mode
  };

  const handleImplementationFocus = () => {
    setIsImplementationFocused(true);
  };

  const handleImplementationBlur = () => {
    setIsImplementationFocused(false);
    // Don't auto-save on blur to prevent focus loss
    // Save will happen on manual save or when leaving edit mode
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
          description: `${files.length} photo${files.length > 1 ? 's' : ''} will be saved when you create the mission`,
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

          // Upload to Supabase
          const uploadToast = enhancedToast.showUploadStart(file.name, compressionResult.compressedSize);
          
          const fileName = `${Date.now()}-${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('mission-evidence')
            .upload(fileName, compressionResult.file);

          if (uploadError) throw uploadError;

          // Save attachment record
          const { data: attachmentData, error: attachmentError } = await supabase
            .from('mission_attachments')
            .insert({
              task_id: action.id,
              mission_id: action.mission_id,
              file_name: file.name,
              file_url: uploadData.path,
              file_type: compressionResult.file.type,
              attachment_type: 'evidence',
              uploaded_by: (await supabase.auth.getUser()).data.user?.id
            })
            .select()
            .single();

          if (attachmentError) throw attachmentError;

          enhancedToast.showUploadSuccess(file.name);
          enhancedToast.dismiss(uploadToast.id);
          
          // Add to photos list
          setPhotos(prev => [...prev, {
            id: attachmentData.id,
            file_url: attachmentData.file_url,
            file_name: attachmentData.file_name
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
    // Check if plan has content
    if (!action.plan || !action.plan.trim()) {
      toast({
        title: "Plan Required",
        description: "Please add a plan before completing the action",
        variant: "destructive",
      });
      return;
    }

    // Check if implementation has content
    if (!action.observations || !action.observations.trim()) {
      toast({
        title: "Implementation Required",
        description: "Please add implementation notes before completing the action",
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    
    try {
      const { error } = await supabase
        .from('mission_actions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: "Action Completed!",
        description: "Great work! The action has been marked as complete.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error completing action:', error);
      toast({
        title: "Error",
        description: "Failed to complete action",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const getActionTheme = () => {
    const hasPlan = action.plan?.trim();
    const hasObservations = action.observations?.trim();
    const isAssigned = Boolean(action.assigned_to);
    
    // Green border for completed actions
    if (action.status === 'completed') {
      return {
        bgColor: 'bg-emerald-50 dark:bg-emerald-950',
        borderColor: 'border-emerald-500 border-2 shadow-emerald-200 shadow-lg dark:border-emerald-600 dark:shadow-emerald-900',
        textColor: 'text-emerald-900 dark:text-emerald-100'
      };
    }
    
    // Yellow border when there's a plan
    if (hasPlan) {
      return {
        bgColor: 'bg-yellow-50 dark:bg-yellow-950',
        borderColor: 'border-yellow-500 border-2 shadow-yellow-200 shadow-lg dark:border-yellow-600 dark:shadow-yellow-900',
        textColor: 'text-yellow-900 dark:text-yellow-100'
      };
    }
    
    // Blue for assigned with observations but no plan
    if (hasObservations && isAssigned) {
      return {
        bgColor: 'bg-blue-50 dark:bg-blue-950',
        borderColor: 'border-blue-200 dark:border-blue-800',
        textColor: 'text-blue-900 dark:text-blue-100'
      };
    }
    
    // Amber for assigned but no content
    if (isAssigned) {
      return {
        bgColor: 'bg-amber-50 dark:bg-amber-950',
        borderColor: 'border-amber-200 dark:border-amber-800',
        textColor: 'text-amber-900 dark:text-amber-100'
      };
    }
    
    return {
      bgColor: 'bg-background',
      borderColor: 'border-border',
      textColor: 'text-foreground'
    };
  };

  const getStatusIcon = () => {
    if (action.status === 'completed') {
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    }
    
    const isAssigned = Boolean(action.assigned_to);
    const hasContent = action.plan?.trim() || action.observations?.trim();
    
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
    const hasContent = action.plan?.trim() || action.observations?.trim();
    
    if (isAssigned && hasContent) {
      return <Badge variant="default" className="bg-blue-600 text-white">In Progress</Badge>;
    }
    
    if (isAssigned) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Assigned</Badge>;
    }
    
    return <Badge variant="outline">Not Started</Badge>;
  };

  const theme = getActionTheme();

  if (isEditing) {
    return (
      <Card className={`${theme.bgColor} ${theme.borderColor}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create New Action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Action Title</Label>
            <Input
              id="title"
              value={editData.title}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter action title..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="plan">Plan</Label>
            <Textarea
              id="plan"
              value={editData.plan}
              onChange={(e) => setEditData(prev => ({ ...prev, plan: e.target.value }))}
              placeholder="Describe the plan for this action..."
              className="mt-1 min-h-[100px]"
            />
          </div>

          <div>
            <Label htmlFor="observations">Implementation Notes</Label>
            <Textarea
              id="observations"
              value={editData.observations}
              onChange={(e) => setEditData(prev => ({ ...prev, observations: e.target.value }))}
              placeholder="Document implementation progress..."
              className="mt-1 min-h-[100px]"
            />
          </div>

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
                {/* Auto-save indicators */}
                {(isSavingPlan || isSavingImplementation) && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Save className="w-3 h-3 animate-pulse" />
                    Saving...
                  </div>
                )}
                {(hasUnsavedPlan || hasUnsavedImplementation) && !(isSavingPlan || isSavingImplementation) && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Save className="w-3 h-3" />
                    Unsaved
                  </div>
                )}
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </CardTitle>
            <div className="space-y-1">
              {action.assigned_to && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>
                    {profiles.find(p => p.user_id === action.assigned_to)?.full_name || 'Unknown User'}
                  </span>
                </div>
              )}
              {action.issue_reference && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link className="w-3 h-3" />
                  <span className="text-xs">From: {action.issue_reference}</span>
                </div>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Plan Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Plan</Label>
                {hasUnsavedPlan && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={savePlan}
                    disabled={isSavingPlan}
                    className="h-6 text-xs"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {isSavingPlan ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>
              <div className="border rounded-lg min-h-[120px]">
                <LexicalEditor
                  value={editData.plan}
                  onChange={handlePlanChange}
                  onFocus={handlePlanFocus}
                  onBlur={handlePlanBlur}
                  placeholder="Describe the plan for this action..."
                />
              </div>
            </div>

            {/* Implementation Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Implementation</Label>
                {hasUnsavedImplementation && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={saveImplementation}
                    disabled={isSavingImplementation}
                    className="h-6 text-xs"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {isSavingImplementation ? 'Saving...' : 'Save'}
                  </Button>
                )}
              </div>
              <div className="border rounded-lg min-h-[120px]">
                <LexicalEditor
                  value={editData.observations}
                  onChange={handleImplementationChange}
                  onFocus={handleImplementationFocus}
                  onBlur={handleImplementationBlur}
                  placeholder="Document implementation progress and observations..."
                />
              </div>
            </div>

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
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={`https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/mission-evidence/${photo.file_url}`}
                        alt={photo.file_name}
                        className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(`https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/mission-evidence/${photo.file_url}`, '_blank')}
                      />
                    </div>
                  ))}
                  
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

            {/* Action Buttons */}
            {action.status !== 'completed' && (
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={handleCompleteAction}
                  disabled={isCompleting || !action.plan?.trim() || !action.observations?.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isCompleting ? 'Completing...' : 'Mark Complete'}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
