import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, User, Upload, Image, ChevronDown, ChevronRight, Save, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { DEFAULT_DONE_DEFINITION } from "@/lib/constants";
import { useTempPhotoStorage, type TempPhoto } from "@/hooks/useTempPhotoStorage";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface TaskPhoto {
  id: string;
  file_url: string;
  file_name: string;
}

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    plan?: string;
    observations?: string;
    assigned_to: string;
    status: string;
    mission_id: string;
  };
  profiles: Profile[];
  onUpdate: () => void;
  isEditing?: boolean;
  onSave?: (taskData: any) => void;
  onCancel?: () => void;
  tempPhotoStorage?: ReturnType<typeof useTempPhotoStorage>;
}

export function TaskCard({ task, profiles, onUpdate, isEditing = false, onSave, onCancel, tempPhotoStorage }: TaskCardProps) {
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const planTextareaRef = useRef<HTMLTextAreaElement>(null);
  const implementationTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [photos, setPhotos] = useState<TaskPhoto[]>([]);
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
    title: task.title,
    plan: task.plan || '',
    observations: task.observations || '',
    assigned_to: task.assigned_to
  });

  // Get temp photos directly from storage instead of local state
  const tempPhotos = task.id.startsWith('temp-') && tempPhotoStorage 
    ? tempPhotoStorage.getTempPhotosForTask(task.id) 
    : [];

  // Update editData when task prop changes, but preserve local changes if focused
  useEffect(() => {
    setEditData(prev => ({
      title: task.title,
      plan: isPlanFocused ? prev.plan : (task.plan || ''),
      observations: isImplementationFocused ? prev.observations : (task.observations || ''),
      assigned_to: task.assigned_to
    }));
    
    // Reset unsaved flags when task updates from external source
    if (!isPlanFocused) setHasUnsavedPlan(false);
    if (!isImplementationFocused) setHasUnsavedImplementation(false);
  }, [task.title, task.plan, task.observations, task.assigned_to, isPlanFocused, isImplementationFocused]);

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
    
    // Only load real photos for saved tasks
    if (!task.id.startsWith('temp-')) {
      const { data, error } = await supabase
        .from('mission_attachments')
        .select('id, file_url, file_name')
        .eq('task_id', task.id);

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
    if (task.status === 'completed') return;
    
    try {
      const updateData: { plan: string; assigned_to?: string } = { plan: editData.plan };
      
      // If task is unassigned, assign it to the current user
      if (!task.assigned_to) {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          updateData.assigned_to = user.user.id;
        }
      }

      const { error } = await supabase
        .from('mission_tasks')
        .update(updateData)
        .eq('id', task.id);

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
      console.error('Error updating task plan:', error);
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
      
      // If task is unassigned, assign it to the current user
      if (!task.assigned_to) {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          updateData.assigned_to = user.user.id;
        }
      }
      
      // Only update status if task is not already in progress or completed and has content
      if (task.status === 'not_started' && editData.observations.trim()) {
        updateData.status = 'in_progress';
      }
      
      const { error } = await supabase
        .from('mission_tasks')
        .update(updateData)
        .eq('id', task.id);

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
      console.error('Error updating task observations:', error);
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
    setHasUnsavedPlan(value !== (task.plan || ''));
  };

  // Implementation change handler - just update local state
  const handleImplementationChange = (value: string) => {
    setEditData(prev => ({ ...prev, observations: value }));
    setHasUnsavedImplementation(value !== (task.observations || ''));
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

    // Handle temporary photo upload for temp tasks
    if (task.id.startsWith('temp-')) {
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
          await tempPhotoStorage.addTempPhoto(file, task.id);
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

    // Handle regular photo upload for saved tasks
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
              task_id: task.id,
              mission_id: task.mission_id,
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

  const handleCompleteTask = async () => {
    // Check if plan has content
    if (!task.plan || !task.plan.trim()) {
      toast({
        title: "Plan Required",
        description: "Please add a plan before completing the task",
        variant: "destructive",
      });
      return;
    }

    // Check if implementation has content
    if (!task.observations || !task.observations.trim()) {
      toast({
        title: "Implementation Required",
        description: "Please add implementation notes before completing the task",
        variant: "destructive",
      });
      return;
    }

    setIsCompleting(true);
    
    try {
      const { error } = await supabase
        .from('mission_tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: "Task Completed!",
        description: "Great work! The task has been marked as complete.",
      });

      onUpdate();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleRemoveTempPhoto = (photoId: string) => {
    if (tempPhotoStorage) {
      tempPhotoStorage.removeTempPhoto(photoId);
      
      toast({
        title: "Photo Removed",
        description: "Photo has been removed",
      });
    }
  };

  const handleSave = async () => {
    if (onSave) {
      onSave(editData);
    }
  };

  const getTaskTheme = () => {
    // Determine task state based on content and status
    if (task.status === 'completed') {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-task-complete-border border-2'
      };
    }
    
    // Check if implementation text exists
    if (task.observations && task.observations.trim()) {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-task-implementation-border border-2'
      };
    }
    
    // Check if plan exists
    if (task.plan && task.plan.trim()) {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-task-plan-border border-2'
      };
    }
    
    // Default blank state
    return {
      bg: 'bg-card',
      text: 'text-card-foreground',
      border: 'border-task-blank-border'
    };
  };

  const getStatusIcon = () => {
    if (task.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-task-complete-border" />;
    }
    
    // Check if implementation text exists
    if (task.observations && task.observations.trim()) {
      return <Clock className="h-4 w-4 text-task-implementation-border" />;
    }
    
    // Check if plan exists
    if (task.plan && task.plan.trim()) {
      return <Clock className="h-4 w-4 text-task-plan-border" />;
    }
    
    // Default blank state
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = () => {
    if (task.status === 'completed') {
      return (
        <Badge variant="outline" className="border-task-complete-border text-task-complete-border">
          Completed
        </Badge>
      );
    }
    
    // Show badge based on actual content state, not just database status
    if (task.observations && task.observations.trim()) {
      return (
        <Badge variant="outline" className="border-task-implementation-border text-task-implementation-border">
          In Progress
        </Badge>
      );
    }
    
    if (task.plan && task.plan.trim()) {
      return (
        <Badge variant="outline" className="border-task-plan-border text-task-plan-border">
          Planned
        </Badge>
      );
    }
    
    return null;
  };

  const assignedProfile = profiles.find(p => p.user_id === task.assigned_to);

  if (isEditing) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div>
              <Label>Task Title</Label>
              <Input
                value={editData.title}
                onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>
            
            <div>
              <Label>Plan *</Label>
              <Textarea
                value={editData.plan}
                onChange={(e) => setEditData(prev => ({ ...prev, plan: e.target.value }))}
                placeholder="What is the plan for this task?"
                rows={2}
              />
            </div>
            
            <div>
              <Label>Implementation *</Label>
              <Textarea
                value={editData.observations}
                onChange={(e) => setEditData(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Implementation notes, findings, or details..."
                rows={2}
              />
            </div>
            
            <div>
              <Label>Assign To</Label>
              <Select value={editData.assigned_to} onValueChange={(value) => 
                setEditData(prev => ({ ...prev, assigned_to: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Assign to (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Photo Upload in Edit Mode */}
            <div>
              <Label className="text-sm font-medium">Add Evidence Photos</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={isUploading}
                  className="hidden"
                  id={`photo-upload-edit-${task.id}`}
                />
                <label
                  htmlFor={`photo-upload-edit-${task.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload Photos (multiple)'}
                </label>
              </div>
              
              {/* Show temporary photos for temp tasks */}
              {tempPhotos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {tempPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.fileUrl}
                        alt={photo.fileName}
                        className="w-full h-16 object-cover rounded-md border"
                      />
                      <div className="absolute top-1 right-1">
                        <Badge variant="secondary" className="text-xs">
                          Draft
                        </Badge>
                      </div>
                      <button
                        onClick={() => handleRemoveTempPhoto(photo.id)}
                        className="absolute top-1 left-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Show real photos for saved tasks */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={`${supabase.storage.from('mission-evidence').getPublicUrl(photo.file_url).data.publicUrl}`}
                        alt={photo.file_name}
                        className="w-full h-16 object-cover rounded-md border"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Task
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const theme = getTaskTheme();
  
  return (
    <Card className={`mb-4 transition-all duration-300 ${theme.bg} ${theme.border} ${task.status === 'completed' ? 'opacity-75' : ''}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className={`flex items-center gap-2 text-lg ${theme.text}`}>
                {getStatusIcon()}
                {task.title}
                {getStatusBadge()}
              </CardTitle>
              <div className="flex items-center gap-2">
                {assignedProfile && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    {assignedProfile.full_name}
                  </div>
                )}
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Plan *</Label>
                  {isSavingPlan ? (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Save className="h-3 w-3 animate-pulse" />
                      Saving...
                    </div>
                  ) : hasUnsavedPlan && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <Save className="h-3 w-3" />
                      Auto-save in 5s
                    </div>
                  )}
                </div>
                {task.status !== 'completed' ? (
                  <Textarea
                    ref={planTextareaRef}
                    value={editData.plan}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    onFocus={handlePlanFocus}
                    onBlur={handlePlanBlur}
                    placeholder="What is the plan for this task? (Auto-saves when you click away or press Ctrl+S)"
                    rows={2}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.plan || 'No plan provided'}
                  </p>
                )}
              </div>
            
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Implementation *</Label>
                  {isSavingImplementation ? (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Save className="h-3 w-3 animate-pulse" />
                      Saving...
                    </div>
                  ) : hasUnsavedImplementation && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <Save className="h-3 w-3" />
                      Auto-save in 5s
                    </div>
                  )}
                </div>
                {task.status !== 'completed' ? (
                  <Textarea
                    ref={implementationTextareaRef}
                    value={editData.observations}
                    onChange={(e) => handleImplementationChange(e.target.value)}
                    onFocus={handleImplementationFocus}
                    onBlur={handleImplementationBlur}
                    placeholder="Add implementation notes, findings, or details... (Auto-saves when you click away or press Ctrl+S)"
                    rows={3}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.observations || 'No implementation notes provided'}
                  </p>
                )}
              </div>

              {/* Photo Gallery - Show both temp and real photos */}
              {(photos.length > 0 || tempPhotos.length > 0) && (
                <div>
                  <Label className="text-sm font-medium">Evidence Photos</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                     {/* Show temporary photos */}
                     {tempPhotos.map((photo) => (
                       <div key={photo.id} className="relative group">
                         <img
                           src={photo.fileUrl}
                           alt={photo.fileName}
                           className="w-full h-24 object-cover rounded-md border"
                         />
                         <div className="absolute top-1 right-1">
                           <Badge variant="secondary" className="text-xs">
                             Draft
                           </Badge>
                         </div>
                         <button
                           onClick={() => handleRemoveTempPhoto(photo.id)}
                           className="absolute top-1 left-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                           title="Remove photo"
                         >
                           <X className="h-3 w-3" />
                         </button>
                         <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md flex items-center justify-center">
                           <Image className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                         </div>
                       </div>
                     ))}
                    
                    {/* Show real photos */}
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={`${supabase.storage.from('mission-evidence').getPublicUrl(photo.file_url).data.publicUrl}`}
                          alt={photo.file_name}
                          className="w-full h-24 object-cover rounded-md border"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md flex items-center justify-center">
                          <Image className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Photo */}
              {task.status !== 'completed' && (
                <div>
                  <Label className="text-sm font-medium">Add Evidence Photos</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                      className="hidden"
                      id={`photo-upload-${task.id}`}
                    />
                    <label
                      htmlFor={`photo-upload-${task.id}`}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? 'Uploading...' : task.id.startsWith('temp-') ? 'Add Photos (will save with mission)' : 'Upload Photos (multiple)'}
                    </label>
                  </div>
                </div>
              )}

              {/* Complete Task Button - More prominent and shows requirements */}
              {task.status !== 'completed' && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="text-xs text-muted-foreground">
                    {!task.plan?.trim() && '• Add plan '}
                    {!task.observations?.trim() && '• Add implementation '}
                    {task.plan?.trim() && task.observations?.trim() && 'Ready to complete!'}
                  </div>
                  <Button
                    variant={task.plan?.trim() && task.observations?.trim() ? "default" : "outline"}
                    size="sm"
                    onClick={handleCompleteTask}
                    disabled={isCompleting || !task.plan?.trim() || !task.observations?.trim()}
                    className={task.plan?.trim() && task.observations?.trim() ? 
                      "bg-green-600 hover:bg-green-700 text-white" : 
                      "text-xs text-muted-foreground border-muted-foreground/20 hover:border-muted-foreground/40"
                    }
                  >
                    {isCompleting ? 'Completing...' : 'Mark Complete'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
