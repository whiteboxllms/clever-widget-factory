import { useState, useEffect } from 'react';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Upload, Image, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResourceSelector } from '@/components/ResourceSelector';

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useImageUpload } from "@/hooks/useImageUpload";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";

import { useTempPhotoStorage } from "@/hooks/useTempPhotoStorage";
import { getStandardActionsForTemplate } from "@/lib/standardActionBlocks";
import { UnifiedActionDialog } from './UnifiedActionDialog';
import { createMissionAction, BaseAction, ActionCreationContext } from '@/types/actions';

interface Task {
  id?: string; // Add optional id field
  title: string;
  policy?: string;
  observations?: string;
  assigned_to: string | null;
  status?: string; // Add optional status field
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface SelectedResource {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  type: 'part' | 'tool';
  status: 'planned' | 'used' | 'returned';
  usedAt?: string;
  usedBy?: string;
}

interface SimpleMissionFormProps {
  formData: {
    title: string;
    problem_statement: string;
    selected_resources: SelectedResource[];
    all_materials_available: boolean;
    qa_assigned_to: string;
    actions: Task[];
  };
  setFormData: (data: any) => void;
  profiles: Profile[];
  onSubmit: () => Promise<any>;
  onCancel: () => void;
  defaultTasks?: Task[];
  selectedTemplate?: {
    id: string;
    name: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  isEditing?: boolean;
  missionId?: string; // Add mission ID prop
}

export function SimpleMissionForm({ 
  formData, 
  setFormData, 
  profiles, 
  onSubmit, 
  onCancel,
  defaultTasks = [],
  selectedTemplate,
  isEditing = false,
  missionId // Add mission ID parameter
}: SimpleMissionFormProps) {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const { uploadImages, isUploading: isImageUploading } = useImageUpload();
  const enhancedToast = useEnhancedToast();
  const tempPhotoStorage = useTempPhotoStorage();
  const [showTasks, setShowTasks] = useState(true);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [creatingNewTask, setCreatingNewTask] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [problemPhotos, setProblemPhotos] = useState<Array<{id: string; file_url: string; file_name: string}>>([]);

  // Helper function to reload tasks from database
  const loadTasksFromDatabase = async () => {
    if (!missionId) return;
    
    try {
      const { data: tasksData, error } = await supabase
        .from('actions')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const updatedTasks = tasksData?.map(task => ({
        id: task.id,
        title: task.title,
        policy: task.policy || '',
        observations: task.observations || '',
        assigned_to: task.assigned_to,
        status: task.status,
        mission_id: task.mission_id,
        estimated_completion_date: task.estimated_duration ? new Date(task.estimated_duration) : undefined,
        actual_duration: task.actual_duration || '',
        required_tools: task.required_tools || []
      })) || [];

      setFormData(prev => ({ ...prev, actions: updatedTasks }));
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  // Load existing problem photos when editing
  useEffect(() => {
    if (isEditing && missionId) {
      loadExistingProblemPhotos();
    }
  }, [isEditing, missionId]);

  // Initialize with default tasks if provided
  useEffect(() => {
    if (defaultTasks.length > 0 && formData.actions.length === 1 && !formData.actions[0].title) {
      setFormData(prev => ({ 
        ...prev, 
        actions: defaultTasks.map(task => ({ ...task, assigned_to: null }))
      }));
    }
  }, [defaultTasks]);

  const loadExistingProblemPhotos = async () => {
    if (!missionId) return;
    
    try {
      console.log('Loading photos for mission:', missionId);
      
      const { data: attachments, error } = await supabase
        .from('mission_attachments')
        .select('id, file_url, file_name')
        .eq('mission_id', missionId)
        .eq('attachment_type', 'evidence')
        .is('task_id', null); // Problem photos don't have task_id
      
      console.log('Photo query result:', { attachments, error });
      
      if (error) throw error;
      
      if (attachments && attachments.length > 0) {
        console.log('Setting problem photos:', attachments);
        setProblemPhotos(attachments);
      } else {
        console.log('No problem photos found for mission');
        setProblemPhotos([]);
      }
    } catch (error) {
      console.error('Failed to load existing problem photos:', error);
      setProblemPhotos([]);
    }
  };

  const addTask = () => {
    setCreatingNewTask(true);
    setTaskDialogOpen(true);
  };

  const handleCreateTask = async () => {
    // Reload task list from database to reflect new task
    if (isEditing && missionId) {
      loadTasksFromDatabase();
    } else {
      // During mission creation, fetch any orphaned actions created for this organization
      // that don't have a mission_id yet and add them to the form
      try {
        const { data: orphanedActions, error } = await supabase
          .from('actions')
          .select('*')
          .is('mission_id', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (orphanedActions && orphanedActions.length > 0) {
          // Convert to form data format and add to existing actions
          const newActions = orphanedActions.map(action => ({
            id: action.id,
            title: action.title,
            policy: action.policy || '',
            observations: action.observations || '',
            assigned_to: action.assigned_to,
            status: action.status,
            estimated_completion_date: action.estimated_duration ? new Date(action.estimated_duration) : undefined,
            required_tools: action.required_tools || []
          }));

          setFormData(prev => ({ 
            ...prev, 
            actions: [...prev.actions.filter(a => a.title.trim()), ...newActions]
          }));
        }
      } catch (error) {
        console.error('Error loading orphaned actions:', error);
      }
    }
    setCreatingNewTask(false);
    setTaskDialogOpen(false);
  };

  const loadStandardTasks = () => {
    const templateId = selectedTemplate?.id || 'default';
    const standardTasks = getStandardActionsForTemplate(templateId);
    
    setFormData(prev => ({
      ...prev,
      actions: standardTasks.map(task => ({
        title: task.title,
        policy: task.description,
        observations: '',
        assigned_to: null,
        estimated_completion_date: undefined,
        required_tools: task.required_tools || []
      }))
    }));
  };

  const updateTask = (index: number, taskData: Task) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((task, i) => 
        i === index ? taskData : task
      )
    }));
    setEditingTaskIndex(null);
  };

  const handleEditTask = () => {
    // Reload task list from database to reflect changes
    if (isEditing && missionId) {
      loadTasksFromDatabase();
    }
    setEditingTaskIndex(null);
    setTaskDialogOpen(false);
  };

  const removeTask = async (index: number) => {
    const taskToRemove = formData.actions[index];
    
    // If editing mode, delete from database
    if (isEditing && missionId) {
      try {
        // Get existing tasks to find the database ID
        const { data: existingTasks } = await supabase
          .from('actions')
          .select('*')
          .eq('mission_id', missionId)
          .order('created_at', { ascending: true });

        if (existingTasks && existingTasks[index]) {
          // Delete from database
          await supabase
            .from('actions')
            .delete()
            .eq('id', existingTasks[index].id);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        toast({
          title: "Error",
          description: "Failed to delete task from database",
          variant: "destructive"
        });
        return;
      }
    }

    // Update local state
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
    setEditingTaskIndex(null);
    
    // Show success toast
    toast({
      title: "Task removed",
      description: `"${taskToRemove.title}" has been removed from the mission.`
    });
  };

  const handleProblemPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Use the standard image upload pattern
      const result = await uploadImages(file, {
        bucket: 'mission-evidence',
        generateFileName: (file) => `problem-${Date.now()}-${file.name}`,
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920
      });

      // Handle both single result and array result
      const uploadResult = Array.isArray(result) ? result[0] : result;

      // Save attachment record for editing mode
      if (isEditing && missionId) {
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('mission_attachments')
          .insert({
            mission_id: missionId,
            file_name: file.name,
            file_url: uploadResult.fileName, // Use fileName from result
            file_type: file.type,
            attachment_type: 'evidence',
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            organization_id: organizationId
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;
        
        // Add to photos list with the real attachment ID
        setProblemPhotos(prev => [...prev, {
          id: attachmentData.id,
          file_url: attachmentData.file_url,
          file_name: attachmentData.file_name
        }]);
      } else {
        // For creation mode, just add to the list (will be saved later)
        setProblemPhotos(prev => [...prev, {
          id: Date.now().toString(),
          file_url: uploadResult.fileName,
          file_name: file.name
        }]);
      }

    } catch (error) {
      console.error('Photo upload failed:', error);
      // Error handling is already done by useImageUpload hook
    }
  };

  const removeProblemPhoto = async (photoId: string) => {
    const photo = problemPhotos.find(p => p.id === photoId);
    if (!photo) return;

    // If editing mode, try to delete from database (UUID format indicates it's a saved photo)
    if (isEditing && missionId) {
      try {
        console.log('Attempting to delete photo:', { photoId, photoUrl: photo.file_url });
        
        // Delete from database first
        const { error: dbError } = await supabase
          .from('mission_attachments')
          .delete()
          .eq('id', photo.id);
        
        if (dbError) {
          console.error('Database deletion error:', dbError);
          throw dbError;
        }
        
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('mission-evidence')
          .remove([photo.file_url]);
        
        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Don't throw - storage deletion failure shouldn't block the operation
        }
        
        toast({
          title: "Photo removed",
          description: "Photo has been deleted successfully."
        });
      } catch (error) {
        console.error('Failed to remove photo:', error);
        toast({
          title: "Error",
          description: "Failed to remove photo from database",
          variant: "destructive"
        });
        return;
      }
    } else {
      // For non-editing mode or temp photos, just show local removal
      toast({
        title: "Photo removed",
        description: "Photo has been removed."
      });
    }

    // Remove from local state
    setProblemPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  // Enhanced onSubmit to handle temporary photo migration
  const handleSubmit = async () => {
    try {
      // Call onSubmit and get the result with mission and task IDs
      const result = await onSubmit();
      
      // If there are temporary photos and we got task mapping, migrate them
      if (tempPhotoStorage.tempPhotos.length > 0 && result && typeof result === 'object' && 'missionId' in result && 'taskIdMap' in result) {
        await tempPhotoStorage.migrateTempPhotos(result.taskIdMap, result.missionId);
      }
    } catch (error) {
      console.error('Error during mission creation:', error);
      // Don't cleanup temp photos if there was an error - user might want to retry
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Header */}
      {selectedTemplate && !isEditing && (
        <div className={`${selectedTemplate.color} text-foreground rounded-lg p-4 mb-6`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/30">
              <selectedTemplate.icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{selectedTemplate.name}</h3>
              <p className="text-sm text-foreground/80">Define your mission details below</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Mission Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter mission title"
          />
        </div>
        
        <div>
          <Label htmlFor="problem_statement">Problem Statement *</Label>
          <Textarea
            id="problem_statement"
            value={formData.problem_statement}
            onChange={(e) => setFormData(prev => ({ ...prev, problem_statement: e.target.value }))}
            placeholder="Describe the problem this mission addresses"
            rows={3}
          />
          <div className="mt-2">
            <a 
              href="https://www.perplexity.ai/spaces/stargazer-assistant-F45qc1H7SmeN5wF1nxJobg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              https://www.perplexity.ai/spaces/stargazer-assistant-F45qc1H7SmeN5wF1nxJobg
            </a>
          </div>
        </div>

        {/* Problem Photos */}
        <div>
          <Label className="text-sm font-medium">Problem Evidence Photos</Label>
          <div className="mt-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleProblemPhotoUpload}
              disabled={isImageUploading}
              className="hidden"
              id="problem-photo-upload"
            />
            <label
              htmlFor="problem-photo-upload"
              className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {isImageUploading ? 'Uploading...' : 'Upload Problem Photo'}
            </label>
          </div>
          
          {/* Display problem photos */}
          {problemPhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {problemPhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={`${supabase.storage.from('mission-evidence').getPublicUrl(photo.file_url).data.publicUrl}`}
                    alt={photo.file_name}
                    className="w-full h-24 object-cover rounded-md border"
                    onError={(e) => {
                      console.log('Failed to load image from mission-evidence, trying mission-attachments bucket');
                      const target = e.target as HTMLImageElement;
                      const fallbackUrl = supabase.storage.from('mission-attachments').getPublicUrl(photo.file_url).data.publicUrl;
                      console.log('Trying fallback URL:', fallbackUrl);
                      target.src = fallbackUrl;
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md flex items-center justify-center">
                    <Image className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <button
                    onClick={() => removeProblemPhoto(photo.id)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        

        {/* QA Assignment - Required Field */}
        <div>
          <Label htmlFor="qa_assigned_to">QA Assigned To *</Label>
          <Select value={formData.qa_assigned_to} onValueChange={(value) => 
            setFormData(prev => ({ ...prev, qa_assigned_to: value }))
          }>
            <SelectTrigger>
              <SelectValue placeholder="Select QA person" />
            </SelectTrigger>
            <SelectContent>
              {profiles.filter(p => p.role === 'admin').map((profile) => (
                <SelectItem key={profile.user_id} value={profile.user_id}>
                  {profile.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Materials Available Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="all_materials_available"
            checked={formData.all_materials_available}
            onCheckedChange={(checked) => 
              setFormData(prev => ({ ...prev, all_materials_available: !!checked }))
            }
          />
          <Label htmlFor="all_materials_available">
            All planned materials are available for this project
          </Label>
        </div>
      </div>

      {/* Resources */}
      <ResourceSelector
        selectedResources={formData.selected_resources}
        onResourcesChange={(resources) => 
          setFormData(prev => ({ ...prev, selected_resources: resources }))
        }
        assignedTasks={formData.actions
          .filter(task => task.title.trim() && task.assigned_to)
          .map(task => task.title)
        }
        assignedUsers={formData.actions
          .filter(task => task.assigned_to)
          .map(task => ({
            user_id: task.assigned_to,
            full_name: profiles.find(p => p.user_id === task.assigned_to)?.full_name || 'Unknown'
          }))
          .filter((user, index, self) => 
            index === self.findIndex(u => u.user_id === user.user_id)
          ) // Remove duplicates
        }
        missionId={missionId}
      />

      {/* Actions Section */}
      <Collapsible open={showTasks} onOpenChange={setShowTasks}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0">
            <span className="font-medium">
              Actions {formData.actions.filter(t => t.title.trim()).length > 0 && 
                `(${formData.actions.filter(t => t.title.trim()).length})`}
            </span>
            {showTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-4">
          {/* Action Creation Modal */}
          <UnifiedActionDialog
            open={taskDialogOpen && creatingNewTask}
            onOpenChange={(open) => {
              setTaskDialogOpen(open);
              if (!open) setCreatingNewTask(false);
            }}
            context={{
              type: 'mission',
              parentId: missionId,
              prefilledData: createMissionAction(missionId || '')
            }}
            profiles={profiles}
            onActionSaved={handleCreateTask}
            isCreating={true}
          />

          {/* Action Edit Modal */}
          <UnifiedActionDialog
            open={taskDialogOpen && editingTaskIndex !== null && formData.actions && formData.actions[editingTaskIndex] !== undefined}
            onOpenChange={(open) => {
              setTaskDialogOpen(open);
              if (!open) setEditingTaskIndex(null);
            }}
            action={editingTaskIndex !== null && formData.actions && formData.actions[editingTaskIndex] ? {
              id: formData.actions[editingTaskIndex].id || '',
              title: formData.actions[editingTaskIndex].title,
              description: '',
              policy: formData.actions[editingTaskIndex].policy,
              observations: formData.actions[editingTaskIndex].observations,
              assigned_to: formData.actions[editingTaskIndex].assigned_to,
              status: formData.actions[editingTaskIndex].status || 'not_started',
              mission_id: missionId || '',
              estimated_duration: formData.actions[editingTaskIndex].estimated_completion_date?.toISOString(),
              required_tools: formData.actions[editingTaskIndex].required_tools,
              required_stock: formData.actions[editingTaskIndex].required_stock,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              attachments: []
            } as BaseAction : undefined}
            profiles={profiles}
            onActionSaved={handleEditTask}
          />
          
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Break down your mission into specific actions (optional)
            </p>
            <div className="flex gap-2">
              {selectedTemplate && formData.actions.length === 0 && (
                <Button type="button" variant="outline" size="sm" onClick={loadStandardTasks}>
                  Load Standard Actions
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Action
              </Button>
            </div>
          </div>
          
          {formData.actions.map((task, index) => {
            // Determine border color based on action status
            const getActionBorderColor = () => {
              const hasPolicy = task.policy?.trim();
              
              // Green border for completed actions  
              if (task.status === 'completed') {
                return 'border-emerald-500 border-2 shadow-emerald-200 shadow-lg';
              }
              
              // Blue border when there's a plan (ready to work)
              if (hasPolicy) {
                return 'border-blue-500 border-2 shadow-blue-200 shadow-lg';
              }
              
              // Yellow border when assigned but no plan yet (in progress)
              if (task.assigned_to) {
                return 'border-yellow-500 border-2 shadow-yellow-200 shadow-lg';
              }
              
              // Default border
              return 'border';
            };

            return (
            <div key={index} className={`${getActionBorderColor()} rounded-lg p-4 hover:shadow-md transition-shadow`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {/* Phase display removed - tasks no longer have phases */}
                    <h4 className="font-medium">{task.title || `Action ${index + 1}`}</h4>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Assigned:</span> {
                        task.assigned_to 
                          ? profiles.find(p => p.user_id === task.assigned_to)?.full_name || 'Unknown'
                          : 'Unassigned'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Completion:</span> {
                        task.estimated_completion_date 
                          ? format(task.estimated_completion_date, "MMM d, yyyy")
                          : 'Not set'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Tools:</span> {task.required_tools?.length || 0} tools
                    </div>
                  </div>

                  {task.policy && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground font-medium">Policy:</p>
                      <div 
                        className="text-sm prose prose-sm max-w-none line-clamp-2 break-words overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: task.policy }}
                      />
                    </div>
                  )}

                  {/* Show temp photo count */}
                  {tempPhotoStorage.getTempPhotosForTask(`temp-${index}`).length > 0 && (
                    <p className="text-xs text-blue-600 mt-2">
                      📸 {tempPhotoStorage.getTempPhotosForTask(`temp-${index}`).length} photo(s) attached
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setEditingTaskIndex(index);
                      setTaskDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  {formData.actions.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeTask(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
          })}
        </CollapsibleContent>
      </Collapsible>
      
      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          {isEditing ? 'Back to Missions' : 'Cancel'}
        </Button>
        {isEditing ? (
          <Button 
            onClick={onSubmit}
            variant="default"
          >
            Save Mission
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            className={selectedTemplate ? `${selectedTemplate.color} hover:opacity-90` : ''}
          >
            Create Mission
          </Button>
        )}
      </div>
    </div>
  );
}