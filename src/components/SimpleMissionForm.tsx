import { useState, useEffect, useCallback } from 'react';
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Plus, Trash2, Archive, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { apiService, getApiData } from '@/lib/apiService';
import { useAuth } from '@/hooks/useCognitoAuth';

import { useTempPhotoStorage } from "@/hooks/useTempPhotoStorage";
import { hasActualContent } from "@/lib/utils";
import { getStandardActionsForTemplate } from "@/lib/standardActionBlocks";
import { UnifiedActionDialog } from './UnifiedActionDialog';
import { createMissionAction, BaseAction, ActionCreationContext } from '@/types/actions';

interface Task {
  id?: string; // Add optional id field
  title: string;
  description?: string;
  policy?: string;
  observations?: string;
  assigned_to: string | null;
  status?: string; // Add optional status field
  estimated_completion_date?: Date;
  required_tools?: string[];
  plan_commitment?: boolean | null;
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  attachments?: string[];
}

interface Tool {
  id: string;
  name: string;
  serial_number?: string;
  status?: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}


interface SimpleMissionFormProps {
  formData: {
    title: string;
    problem_statement: string;
    actions: Task[];
  };
  setFormData: (data: (prev: {
    title: string;
    problem_statement: string;
    actions: Task[];
  }) => {
    title: string;
    problem_statement: string;
    actions: Task[];
  }) => void;
  profiles: Profile[];
  onSubmit: () => Promise<{ missionId: string; taskIdMap: Record<string, string> } | void>;
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
  onRemoveMission?: () => void;
  canRemoveMission?: boolean;
  onMoveToBacklog?: () => void;
  canMoveToBacklog?: boolean;
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
  missionId, // Add mission ID parameter
  onRemoveMission,
  canRemoveMission = false,
  onMoveToBacklog,
  canMoveToBacklog = false
}: SimpleMissionFormProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const tempPhotoStorage = useTempPhotoStorage();
  const { user } = useAuth();

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const result = await apiService.get('/tools');
      let toolsData = result.data || [];
      
      // Filter out removed tools client-side
      toolsData = toolsData.filter((tool: Tool) => tool.status !== 'removed');
      
      // Sort by name
      toolsData.sort((a: Tool, b: Tool) => a.name.localeCompare(b.name));
      
      setTools(toolsData);
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const getToolDetails = (toolNames: string[]) => {
    return toolNames
      .map(name => tools.find(tool => tool.name === name))
      .filter((tool): tool is Tool => tool !== undefined);
  };
  const [showTasks, setShowTasks] = useState(true);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [creatingNewTask, setCreatingNewTask] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [draftMissionId, setDraftMissionId] = useState<string | null>(null);

  // Convert icon component to string name for database storage
  const getIconName = (iconComponent: React.ComponentType<{ className?: string }>) => {
    const iconMap: { [key: string]: string } = {
      'Wrench': 'Wrench',
      'Microscope': 'Microscope', 
      'GraduationCap': 'GraduationCap',
      'Hammer': 'Hammer',
      'Lightbulb': 'Lightbulb'
    };
    return iconMap[iconComponent.name] || 'Wrench';
  };

  // Helper function to reload tasks from database
  const loadTasksFromDatabase = useCallback(async () => {
    if (!missionId) return;
    
    try {
      const response = await apiService.get('/actions');
      const allTasks = getApiData(response) || [];
      const tasksData = allTasks.filter((task: any) => task.mission_id === missionId);
      
      // Sort by updated_at descending
      tasksData.sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      const updatedTasks = tasksData.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        policy: task.policy || '',
        observations: task.observations || '',
        assigned_to: task.assigned_to,
        status: task.status,
        plan_commitment: task.plan_commitment || false,
        mission_id: task.mission_id,
        estimated_completion_date: task.estimated_duration ? new Date(task.estimated_duration) : undefined,
        actual_duration: task.actual_duration || '',
        required_tools: task.required_tools || [],
        required_stock: Array.isArray(task.required_stock) ? task.required_stock as { part_id: string; quantity: number; part_name: string; }[] : [],
        attachments: task.attachments || []
      }));

      setFormData(prev => ({ ...prev, actions: updatedTasks }));
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [missionId, setFormData]);

  // Load tasks from database when editing a mission
  useEffect(() => {
    if (isEditing && missionId) {
      loadTasksFromDatabase();
    }
  }, [isEditing, missionId, loadTasksFromDatabase]);

  // Remove default blank action for custom missions (no template) in create mode
  useEffect(() => {
    if (!isEditing && !selectedTemplate && formData.actions.length === 1 && !formData.actions[0].title?.trim()) {
      setFormData(prev => ({ ...prev, actions: [] }));
    }
  }, [isEditing, selectedTemplate, formData.actions.length, formData.actions, setFormData]);

  // Initialize with default tasks if provided
  useEffect(() => {
    if (defaultTasks.length > 0 && formData.actions.length === 1 && !formData.actions[0].title) {
      setFormData(prev => ({ 
        ...prev, 
        actions: defaultTasks.map(task => ({ ...task, assigned_to: null }))
      }));
    }
  }, [defaultTasks]);

  const addTask = async () => {
    // If this is the first action and we're in create mode, create a draft mission first
    if (!isEditing && !draftMissionId && formData.actions.length === 0) {
      try {
        if (!user) {
          toast({
            title: "Error",
            description: "User not authenticated",
            variant: "destructive"
          });
          return;
        }

        // Create draft mission
        const response = await apiService.post('/missions', {
          title: formData.title || 'Draft Mission',
          problem_statement: formData.problem_statement || 'Draft mission - details to be filled',
          created_by: user.id,
          template_id: selectedTemplate?.id || null,
          template_name: selectedTemplate?.name || null,
          template_color: selectedTemplate?.color || null,
          template_icon: selectedTemplate?.icon ? getIconName(selectedTemplate.icon) : null,
          status: 'draft' // Mark as draft
        });
        
        const missionData = getApiData(response) || response;
        
        setDraftMissionId(missionData.id);
        toast({
          title: "Draft Mission Created",
          description: "Mission created as draft. Actions will be saved immediately."
        });
      } catch (error) {
        console.error('Error creating draft mission:', error);
        toast({
          title: "Error",
          description: "Failed to create draft mission",
          variant: "destructive"
        });
        return;
      }
    }

    setCreatingNewTask(true);
    setTaskDialogOpen(true);
  };

  const mapActionToTask = (action: any): Task => ({
    id: action.id,
    title: action.title,
    description: action.description || '',
    policy: action.policy || '',
    observations: action.observations || '',
    assigned_to: action.assigned_to,
    status: action.status,
    plan_commitment: action.plan_commitment || false,
    estimated_completion_date: action.estimated_duration ? new Date(action.estimated_duration) : undefined,
    required_tools: (action.required_tools || []) as string[],
    required_stock: (Array.isArray(action.required_stock) ? action.required_stock : []) as { part_id: string; quantity: number; part_name: string; }[],
    attachments: (action.attachments || []) as string[]
  });

  const handleCreateTask = async () => {
    // Reload task list from database to reflect new task
    if (isEditing && missionId) {
      loadTasksFromDatabase();
    }
    setCreatingNewTask(false);
    setTaskDialogOpen(false);
  };

  const handleActionCreated = (saved?: any) => {
    if (!saved) return handleCreateTask();
    const task = mapActionToTask(saved);
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions.filter(a => a.title.trim()), task]
    }));
    setCreatingNewTask(false);
    setTaskDialogOpen(false);
  };

  const handleActionEdited = (saved?: any) => {
    if (!saved) return handleEditTask();
    const task = mapActionToTask(saved);
    const index = editingTaskIndex;
    if (index === null) return handleEditTask();
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((t, i) => (i === index ? task : t))
    }));
    setEditingTaskIndex(null);
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
    } else if (draftMissionId) {
      // During draft mission creation, load tasks from the draft mission
      handleCreateTask();
    } else {
      // Fallback: refresh only the edited action from DB so changes appear
      const index = editingTaskIndex;
      const edited = index !== null ? formData.actions[index] : null;
      if (edited?.id) {
        (async () => {
          try {
            const response = await apiService.get('/actions');
            const allActions = getApiData(response) || [];
            const data = allActions.find((action: any) => action.id === edited.id);
            if (!data) return;
            const updated: Task = {
              id: data.id,
              title: data.title,
              description: data.description || '',
              policy: data.policy || '',
              observations: data.observations || '',
              assigned_to: data.assigned_to,
              status: data.status,
              plan_commitment: data.plan_commitment || false,
              estimated_completion_date: data.estimated_duration ? new Date(data.estimated_duration) : undefined,
              required_tools: (data.required_tools || []) as string[],
              required_stock: (Array.isArray(data.required_stock) ? data.required_stock : []) as { part_id: string; quantity: number; part_name: string; }[],
              attachments: (data.attachments || []) as string[]
            };
            setFormData(prev => ({
              ...prev,
              actions: prev.actions.map((t, i) => (i === index ? updated : t))
            }));
          } catch (error) {
            console.error('Error fetching action:', error);
          }
        })();
      }
    }
    setEditingTaskIndex(null);
    setTaskDialogOpen(false);
  };

  const removeTask = async (index: number) => {
    const taskToRemove = formData.actions[index];
    
    // If editing mode, delete from database
    if (isEditing && missionId && taskToRemove.id) {
      try {
        // Delete from database using API
        await apiService.delete(`/actions?id=${taskToRemove.id}`);
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

  // Enhanced onSubmit to handle temporary photo migration
  const handleSubmit = async () => {
    try {
      // If we have a draft mission, update it instead of creating new
      if (draftMissionId) {
        if (!user) {
          toast({
            title: "Error",
            description: "User not authenticated",
            variant: "destructive"
          });
          return;
        }

        // Update the draft mission to final status
        await apiService.put(`/missions/${draftMissionId}`, {
          title: formData.title,
          problem_statement: formData.problem_statement,
          status: 'active' // Change from draft to active
        });

        toast({
          title: "Mission Updated",
          description: "Draft mission has been finalized successfully"
        });

        // Navigate to missions page
        window.location.href = '/missions';
        return;
      }

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
              <p className="text-sm text-foreground/80">Define your project details below</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Project Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter project title"
          />
        </div>
        
        <div>
          <Label htmlFor="problem_statement">Background *</Label>
          <Textarea
            id="problem_statement"
            value={formData.problem_statement}
            onChange={(e) => setFormData(prev => ({ ...prev, problem_statement: e.target.value }))}
            placeholder="What are you at and what does success looks like"
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

      </div>


      {/* Actions Section */}
      <Collapsible open={showTasks} onOpenChange={setShowTasks}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full p-0">
            <div className="flex items-center gap-3 w-full">
              <span className="font-medium">
                Actions {formData.actions.filter(t => t.title.trim()).length > 0 && 
                  `(${formData.actions.filter(t => t.title.trim()).length})`}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Break down your mission into specific actions (optional)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {showTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
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
              parentId: draftMissionId || missionId,
              prefilledData: createMissionAction(draftMissionId || missionId || '')
            }}
            profiles={profiles}
            onActionSaved={(saved) => handleActionCreated(saved)}
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
              description: formData.actions[editingTaskIndex].description || '',
              policy: formData.actions[editingTaskIndex].policy,
              observations: formData.actions[editingTaskIndex].observations,
              assigned_to: formData.actions[editingTaskIndex].assigned_to,
              status: formData.actions[editingTaskIndex].status || 'not_started',
              plan_commitment: formData.actions[editingTaskIndex].plan_commitment || false,
              mission_id: missionId || '',
              estimated_duration: formData.actions[editingTaskIndex].estimated_completion_date?.toISOString(),
              required_tools: formData.actions[editingTaskIndex].required_tools,
              required_stock: formData.actions[editingTaskIndex].required_stock,
              attachments: formData.actions[editingTaskIndex].attachments,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            } as BaseAction : undefined}
            profiles={profiles}
            onActionSaved={(saved) => handleActionEdited(saved)}
          />
          
          <div className="flex items-center gap-3">
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
            // Progression: Gray (no border) → Blue (plan + commitment) → Yellow (implementation) → Green (completed)
            const getActionBorderColor = () => {
              const hasPolicy = hasActualContent(task.policy);
              const hasObservations = hasActualContent(task.observations);
              const hasPlanCommitment = task.plan_commitment === true;
              
              // Green border for completed actions  
              if (task.status === 'completed') {
                return 'border-emerald-500 border-2 shadow-emerald-200 shadow-lg';
              }
              
              // Yellow border when there's implementation AND there was first a plan
              if (hasObservations && hasPolicy && hasPlanCommitment) {
                return 'border-yellow-500 border-2 shadow-yellow-200 shadow-lg';
              }
              
              // Blue border when there's a plan AND commitment (ready to work)
              if (hasPolicy && hasPlanCommitment) {
                return 'border-blue-500 border-2 shadow-blue-200 shadow-lg';
              }
              
              // Default border (gray - no special styling)
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
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Assigned:</span> {
                        task.assigned_to 
                          ? profiles.find(p => p.user_id === task.assigned_to)?.full_name || 'Unknown'
                          : 'Unassigned'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Tools:</span> {task.required_tools?.length || 0} tools
                      {task.required_tools && task.required_tools.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {getToolDetails(task.required_tools).map((tool, toolIndex) => (
                            <div key={toolIndex} className="text-xs text-muted-foreground">
                              • {tool.name}
                              {tool.serial_number && (
                                <span className="ml-1 font-mono">({tool.serial_number})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
      <div className="flex justify-between pt-4 border-t">
        {/* Left side - Action buttons (only when editing) */}
        {isEditing && (
          <div className="flex items-center gap-1">
            {/* Remove Mission button */}
            {canRemoveMission && onRemoveMission && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={onRemoveMission}
                      className="flex items-center gap-2 text-gray-500 hover:text-red-600 hover:border-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove Mission</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Move to Backlog button */}
            {canMoveToBacklog && onMoveToBacklog && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={onMoveToBacklog}
                      className="flex items-center gap-2 text-gray-500 hover:text-orange-600 hover:border-orange-300"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Move to Backlog</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
        
        {/* Right side - Cancel and Save/Create buttons */}
        <div className="flex space-x-2 ml-auto">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {isEditing ? (
            <Button 
              onClick={onSubmit}
              variant="default"
            >
              Save
            </Button>
          ) : (
            (() => {
              const isCreateValid = Boolean(
                formData.title && formData.title.trim() &&
                formData.problem_statement && formData.problem_statement.trim()
              );
              // Use blue color scheme for primary action button with good contrast
              const enabledClasses = 'bg-blue-600 text-white hover:bg-blue-700 opacity-100';
              const disabledClasses = 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed';
              const baseClasses = 'transition-colors';
              const colorClasses = selectedTemplate ? `${selectedTemplate.color} text-white opacity-100 hover:opacity-90` : enabledClasses;
              return (
                <Button
                  onClick={handleSubmit}
                  disabled={!isCreateValid}
                  className={`${baseClasses} ${isCreateValid ? colorClasses : disabledClasses}`}
                >
                  {draftMissionId ? 'Finalize Project' : 'Create Project'}
                </Button>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}