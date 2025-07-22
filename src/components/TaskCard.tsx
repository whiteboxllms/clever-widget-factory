
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, User, Upload, Image, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { DEFAULT_DONE_DEFINITION } from "@/lib/constants";

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
}

export function TaskCard({ task, profiles, onUpdate, isEditing = false, onSave, onCancel }: TaskCardProps) {
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const implementationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const planTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded
  const [photos, setPhotos] = useState<TaskPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    plan: task.plan || '',
    observations: task.observations || '',
    assigned_to: task.assigned_to
  });

  // Load existing photos when expanded or editing
  const loadPhotos = async () => {
    if (!isExpanded && !isEditing) return;
    
    const { data, error } = await supabase
      .from('mission_attachments')
      .select('id, file_url, file_name')
      .eq('task_id', task.id);

    if (error) {
      console.error('Error loading photos:', error);
    } else {
      setPhotos(data || []);
    }
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      loadPhotos();
    }
  };

  // Load photos when editing mode starts
  useState(() => {
    if (isEditing) {
      loadPhotos();
    }
  });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
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

    } catch (error) {
      console.error('Photo upload failed:', error);
      
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
    } finally {
      setIsUploading(false);
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

  const handleSave = async () => {
    if (onSave) {
      onSave(editData);
    }
  };

  // Plan change handler - updates plan in database
  const handlePlanChange = async (value: string) => {
    setEditData(prev => ({ ...prev, plan: value }));
    
    // Debounce database updates to prevent focus loss
    if (planTimeoutRef.current) {
      clearTimeout(planTimeoutRef.current);
    }
    
    planTimeoutRef.current = setTimeout(async () => {
      if (task.status !== 'completed') {
        try {
          const updateData: { plan: string; assigned_to?: string } = { plan: value };
          
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
          // Only update task object, don't trigger full reload
        } catch (error) {
          console.error('Error updating task plan:', error);
        }
      }
    }, 1000); // Wait 1 second after user stops typing
  };

  // Fixed implementation change handler - updates status from any state except completed
  const handleImplementationChange = async (value: string) => {
    setEditData(prev => ({ ...prev, observations: value }));
    
    // Debounce database updates to prevent focus loss
    if (implementationTimeoutRef.current) {
      clearTimeout(implementationTimeoutRef.current);
    }
    
    implementationTimeoutRef.current = setTimeout(async () => {
      if (value.trim() && task.status !== 'completed') {
        try {
          // Only change status to in_progress if currently not_started or planned
          const updateData: { observations: string; status?: string; assigned_to?: string } = {
            observations: value
          };
          
          // If task is unassigned, assign it to the current user
          if (!task.assigned_to) {
            const { data: user } = await supabase.auth.getUser();
            if (user.user) {
              updateData.assigned_to = user.user.id;
            }
          }
          
          // Only update status if task is not already in progress or completed
          if (task.status === 'not_started') {
            updateData.status = 'in_progress';
          }
          
          const { error } = await supabase
            .from('mission_tasks')
            .update(updateData)
            .eq('id', task.id);

          if (error) throw error;
          // Don't call onUpdate() immediately to prevent focus loss
        } catch (error) {
          console.error('Error updating task observations:', error);
        }
      } else if (task.status === 'completed') {
        // For completed tasks, just update observations without changing status
        try {
          const updateData: { observations: string; assigned_to?: string } = {
            observations: value
          };
          
          // If task is unassigned, assign it to the current user even for completed tasks
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
        } catch (error) {
          console.error('Error updating completed task observations:', error);
        }
      }
    }, 1000); // Wait 1 second after user stops typing
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

            {/* Add Photo Upload to Edit Mode */}
            <div>
              <Label className="text-sm font-medium">Add Evidence Photo</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
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
                  {isUploading ? 'Uploading...' : 'Upload Photo'}
                </label>
              </div>
              
              {/* Show existing photos in edit mode */}
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
                <Label className="text-sm font-medium">Plan *</Label>
                {task.status !== 'completed' ? (
                  <Textarea
                    value={editData.plan}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    placeholder="What is the plan for this task?"
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
                <Label className="text-sm font-medium">Implementation *</Label>
                {task.status !== 'completed' ? (
                  <Textarea
                    value={editData.observations}
                    onChange={(e) => handleImplementationChange(e.target.value)}
                    placeholder="Add implementation notes, findings, or details..."
                    rows={3}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.observations || 'No implementation notes provided'}
                  </p>
                )}
              </div>

              {/* Photo Gallery */}
              {photos.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Evidence Photos</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
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
                  <Label className="text-sm font-medium">Add Evidence Photo</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
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
                      {isUploading ? 'Uploading...' : 'Upload Photo'}
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
