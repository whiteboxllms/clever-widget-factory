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
import { TaskCard } from '@/components/TaskCard';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";

import { useTempPhotoStorage } from "@/hooks/useTempPhotoStorage";
import { getStandardTasksForTemplate } from "@/lib/standardTaskBlocks";
import { TaskDetailEditor } from './TaskDetailEditor';

interface Task {
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  phase?: 'planning' | 'execution' | 'verification' | 'documentation';
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
    tasks: Task[];
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
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const tempPhotoStorage = useTempPhotoStorage();
  const [showTasks, setShowTasks] = useState(true);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [creatingNewTask, setCreatingNewTask] = useState(false);
  const [problemPhotos, setProblemPhotos] = useState<Array<{id: string; file_url: string; file_name: string}>>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load existing problem photos when editing
  useEffect(() => {
    if (isEditing && missionId) {
      loadExistingProblemPhotos();
    }
  }, [isEditing, missionId]);

  // Initialize with default tasks if provided
  useEffect(() => {
    if (defaultTasks.length > 0 && formData.tasks.length === 1 && !formData.tasks[0].title) {
      setFormData(prev => ({ 
        ...prev, 
        tasks: defaultTasks.map(task => ({ ...task, assigned_to: null }))
      }));
    }
  }, [defaultTasks]);

  const loadExistingProblemPhotos = async () => {
    if (!missionId) return;
    
    try {
      const { data: attachments, error } = await supabase
        .from('mission_attachments')
        .select('id, file_url, file_name')
        .eq('mission_id', missionId)
        .eq('attachment_type', 'evidence')
        .is('task_id', null); // Problem photos don't have task_id
      
      if (error) throw error;
      
      if (attachments) {
        setProblemPhotos(attachments);
      }
    } catch (error) {
      console.error('Failed to load existing problem photos:', error);
    }
  };

  const addTask = () => {
    setCreatingNewTask(true);
  };

  const handleCreateTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      title: taskData.title || '',
      plan: taskData.plan || '',
      observations: taskData.observations || '',
      assigned_to: taskData.assigned_to || null,
      estimated_completion_date: taskData.estimated_completion_date,
      required_stock: taskData.required_stock || [],
      required_tools: taskData.required_tools || [],
      phase: taskData.phase || 'execution'
    };
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask]
    }));
    setCreatingNewTask(false);
    
    // Show success toast
    toast({
      title: "Task created",
      description: `"${taskData.title}" has been added to the mission.`
    });
  };

  const loadStandardTasks = () => {
    const templateId = selectedTemplate?.id || 'default';
    const standardTasks = getStandardTasksForTemplate(templateId);
    
    setFormData(prev => ({
      ...prev,
      tasks: standardTasks.map(task => ({
        title: task.title,
        plan: task.description,
        observations: '',
        assigned_to: null,
        estimated_completion_date: task.estimated_completion_date,
        
        required_tools: task.required_tools || [],
        phase: task.phase
      }))
    }));
  };

  const updateTask = (index: number, taskData: Task) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? taskData : task
      )
    }));
    setEditingTaskIndex(null);
  };

  const handleEditTask = (taskData: Partial<Task>) => {
    if (editingTaskIndex === null) return;
    
    const updatedTask: Task = {
      ...formData.tasks[editingTaskIndex],
      ...taskData
    };
    
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === editingTaskIndex ? updatedTask : task
      )
    }));
    setEditingTaskIndex(null);
    
    // Show success toast
    toast({
      title: "Task updated",
      description: `"${taskData.title}" has been updated successfully.`
    });
  };

  const removeTask = async (index: number) => {
    const taskToRemove = formData.tasks[index];
    
    // If editing mode, delete from database
    if (isEditing && missionId) {
      try {
        // Get existing tasks to find the database ID
        const { data: existingTasks } = await supabase
          .from('mission_tasks')
          .select('*')
          .eq('mission_id', missionId)
          .order('created_at', { ascending: true });

        if (existingTasks && existingTasks[index]) {
          // Delete from database
          await supabase
            .from('mission_tasks')
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
      tasks: prev.tasks.filter((_, i) => i !== index)
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
      
      const fileName = `problem-${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('mission-attachments')
        .upload(fileName, compressionResult.file);

      if (uploadError) throw uploadError;

      // Save attachment record for editing mode
      if (isEditing && missionId) {
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('mission_attachments')
          .insert({
            mission_id: missionId,
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
        
        // Add to photos list with the real attachment ID
        setProblemPhotos(prev => [...prev, {
          id: attachmentData.id,
          file_url: attachmentData.file_url,
          file_name: attachmentData.file_name
        }]);
      } else {
        // For creation mode, just add to the list (will be saved later)
        enhancedToast.showUploadSuccess(file.name);
        enhancedToast.dismiss(uploadToast.id);
        
        setProblemPhotos(prev => [...prev, {
          id: Date.now().toString(),
          file_url: uploadData.path,
          file_name: file.name
        }]);
      }

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

  const removeProblemPhoto = async (photoId: string) => {
    const photo = problemPhotos.find(p => p.id === photoId);
    if (!photo) return;

    // If editing mode and photo exists in database, delete it
    if (isEditing && missionId && !photo.id.toString().startsWith('temp-') && !photo.id.toString().match(/^\d+$/)) {
      try {
        // Delete from storage
        await supabase.storage.from('mission-attachments').remove([photo.file_url]);
        
        // Delete from database
        await supabase.from('mission_attachments').delete().eq('id', photo.id);
        
        toast({
          title: "Photo removed",
          description: "Photo has been deleted successfully."
        });
      } catch (error) {
        console.error('Failed to remove photo:', error);
        toast({
          title: "Error",
          description: "Failed to remove photo",
          variant: "destructive"
        });
        return;
      }
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
              disabled={isUploading}
              className="hidden"
              id="problem-photo-upload"
            />
            <label
              htmlFor="problem-photo-upload"
              className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload Problem Photo'}
            </label>
          </div>
          
          {/* Display problem photos */}
          {problemPhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {problemPhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={`${supabase.storage.from('mission-attachments').getPublicUrl(photo.file_url).data.publicUrl}`}
                    alt={photo.file_name}
                    className="w-full h-24 object-cover rounded-md border"
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
              {profiles.filter(p => p.role === 'leadership').map((profile) => (
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
        assignedTasks={formData.tasks
          .filter(task => task.title.trim() && task.assigned_to)
          .map(task => task.title)
        }
        assignedUsers={formData.tasks
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

      {/* Tasks Section */}
      <Collapsible open={showTasks} onOpenChange={setShowTasks}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0">
            <span className="font-medium">
              Tasks {formData.tasks.filter(t => t.title.trim()).length > 0 && 
                `(${formData.tasks.filter(t => t.title.trim()).length})`}
            </span>
            {showTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-4">
          {/* Task Creation Modal */}
          {creatingNewTask && (
            <div className="mb-4">
              <TaskDetailEditor
                task={{
                  id: '',
                  title: '',
                  plan: '',
                  observations: '',
                  assigned_to: null,
                  status: 'not_started',
                  mission_id: '',
                  estimated_completion_date: undefined,
                  required_tools: [],
                  required_stock: [],
                  phase: 'execution'
                }}
                profiles={profiles}
                onSave={handleCreateTask}
                onCancel={() => setCreatingNewTask(false)}
                isCreating={true}
              />
            </div>
          )}

          {/* Task Edit Modal */}
          {editingTaskIndex !== null && (
            <div className="mb-4">
              <TaskDetailEditor
                task={{
                  id: `temp-${editingTaskIndex}`,
                  title: formData.tasks[editingTaskIndex].title,
                  plan: formData.tasks[editingTaskIndex].plan,
                  observations: formData.tasks[editingTaskIndex].observations,
                  assigned_to: formData.tasks[editingTaskIndex].assigned_to,
                  status: 'not_started',
                  mission_id: '',
                  estimated_completion_date: formData.tasks[editingTaskIndex].estimated_completion_date,
                  required_tools: formData.tasks[editingTaskIndex].required_tools,
                  required_stock: formData.tasks[editingTaskIndex].required_stock,
                  phase: formData.tasks[editingTaskIndex].phase
                }}
                profiles={profiles}
                onSave={handleEditTask}
                onCancel={() => setEditingTaskIndex(null)}
              />
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Break down your mission into specific tasks (optional)
            </p>
            <div className="flex gap-2">
              {selectedTemplate && formData.tasks.length === 0 && (
                <Button type="button" variant="outline" size="sm" onClick={loadStandardTasks}>
                  Load Standard Tasks
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>
          
          {formData.tasks.map((task, index) => (
            <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="px-2 py-1 bg-muted rounded text-xs font-medium capitalize">
                      {task.phase || 'execution'}
                    </div>
                    <h4 className="font-medium">{task.title || `Task ${index + 1}`}</h4>
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
                      <span className="font-medium">Due:</span> {task.estimated_completion_date ? format(task.estimated_completion_date, "PPP") : 'Not set'}
                    </div>
                    <div>
                      <span className="font-medium">Tools:</span> {task.required_tools?.length || 0} tools
                    </div>
                  </div>

                  {task.plan && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground font-medium">Plan:</p>
                      <div 
                        className="text-sm prose prose-sm max-w-none line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: task.plan }}
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
                    onClick={() => setEditingTaskIndex(index)}
                  >
                    Edit
                  </Button>
                  {formData.tasks.length > 1 && (
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
          ))}
        </CollapsibleContent>
      </Collapsible>
      
      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Back to Missions
        </Button>
        {!isEditing && (
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