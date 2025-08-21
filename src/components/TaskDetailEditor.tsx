import { useState, useEffect } from 'react';
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Save, 
  X, 
  Clock, 
  Wrench, 
  FileText, 
  Users, 
  ChevronDown,
  Plus,
  Trash2 
} from 'lucide-react';
import { LexicalEditor } from './LexicalEditor';
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  status: string;
  mission_id: string;
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  phase?: 'planning' | 'execution' | 'verification' | 'documentation';
}

interface TaskDetailEditorProps {
  task: Task;
  profiles: Profile[];
  onSave: () => void; // Just call when save is complete
  onCancel: () => void;
  isCreating?: boolean;
}

const PHASE_OPTIONS = [
  { value: 'planning', label: 'Planning', icon: FileText, color: 'bg-blue-500' },
  { value: 'execution', label: 'Execution', icon: Wrench, color: 'bg-green-500' },
  { value: 'verification', label: 'Verification', icon: Users, color: 'bg-yellow-500' },
  { value: 'documentation', label: 'Documentation', icon: FileText, color: 'bg-purple-500' }
];

export function TaskDetailEditor({ 
  task, 
  profiles, 
  onSave, 
  onCancel, 
  isCreating = false 
}: TaskDetailEditorProps) {
  const { toast } = useToast();
  const [editData, setEditData] = useState<Partial<Task>>({
    title: task.title,
    plan: task.plan || '',
    observations: task.observations || '',
    assigned_to: task.assigned_to,
    estimated_completion_date: task.estimated_completion_date,
    required_tools: task.required_tools || [],
    required_stock: task.required_stock || [],
    phase: task.phase || (task.title.toLowerCase().includes('plan') ? 'planning' : 'execution')
  });

  const [newTool, setNewTool] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const originalData = {
      title: task.title,
      plan: task.plan || '',
      observations: task.observations || '',
      assigned_to: task.assigned_to,
      estimated_completion_date: task.estimated_completion_date,
      required_tools: task.required_tools || [],
      required_stock: task.required_stock || [],
      phase: task.phase || (task.title.toLowerCase().includes('plan') ? 'planning' : 'execution')
    };

    const hasChanged = JSON.stringify(editData) !== JSON.stringify(originalData);
    setHasChanges(hasChanged);
  }, [editData, task]);

  const handleSave = async () => {
    if (!editData.title?.trim()) {
      return;
    }
    
    setIsSaving(true);
    console.log('TaskDetailEditor - Saving task data directly to database:', editData);
    
    try {
      // Convert date to ISO string for database storage
      const estimatedDuration = editData.estimated_completion_date ? 
        editData.estimated_completion_date.toISOString() : null;

      const taskData = {
        title: editData.title.trim(),
        plan: editData.plan || null,
        observations: editData.observations || null,
        assigned_to: editData.assigned_to || null,
        estimated_duration: estimatedDuration,
        required_tools: editData.required_tools || [],
        phase: editData.phase || 'execution'
      };

      // Check if this is a new task (no ID or temporary ID) or existing task
      const isNewTask = isCreating || !task.id || task.id.startsWith('temp-');
      
      if (isNewTask) {
        // Creating new task
        const { error } = await supabase
          .from('mission_tasks')
          .insert({
            ...taskData,
            mission_id: task.mission_id,
            status: 'not_started'
          });

        if (error) throw error;
        
        toast({
          title: "Task created",
          description: `"${editData.title}" has been created successfully.`
        });
      } else {
        // Updating existing task
        const { error } = await supabase
          .from('mission_tasks')
          .update(taskData)
          .eq('id', task.id);

        if (error) throw error;
        
        toast({
          title: "Task updated",
          description: `"${editData.title}" has been updated successfully.`
        });
      }

      console.log('TaskDetailEditor - Direct save completed successfully');
      onSave(); // Notify parent that save is complete
    } catch (error) {
      console.error('TaskDetailEditor - Direct save failed:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save task. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addTool = () => {
    if (newTool.trim() && !editData.required_tools?.includes(newTool.trim())) {
      setEditData(prev => ({
        ...prev,
        required_tools: [...(prev.required_tools || []), newTool.trim()]
      }));
      setNewTool('');
    }
  };

  const removeTool = (tool: string) => {
    setEditData(prev => ({
      ...prev,
      required_tools: prev.required_tools?.filter(t => t !== tool) || []
    }));
  };

  const selectedPhase = PHASE_OPTIONS.find(p => p.value === editData.phase);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isCreating ? 'Create New Task' : 'Edit Task Details'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedPhase && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`${selectedPhase.color} text-white hover:opacity-80 h-auto p-1 px-2`}
                  >
                    <selectedPhase.icon className="w-3 h-3 mr-1" />
                    {selectedPhase.label}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {PHASE_OPTIONS.map(option => (
                    <Button
                      key={option.value}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => setEditData(prev => ({ ...prev, phase: option.value as any }))}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={editData.title || ''}
      onChange={(e) => {
                const newTitle = e.target.value;
                setEditData(prev => ({ 
                  ...prev, 
                  title: newTitle,
                  phase: newTitle.toLowerCase().includes('plan') ? 'planning' : prev.phase
                }));
              }}
              placeholder="Enter task title..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <Label htmlFor="estimated_completion_date">
                <Clock className="w-4 h-4 inline mr-1" />
                Estimated Completion Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !editData.estimated_completion_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editData.estimated_completion_date ? (
                      format(editData.estimated_completion_date, "PPP")
                    ) : (
                      <span>Pick a completion date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editData.estimated_completion_date}
                    onSelect={(date) => setEditData(prev => ({ ...prev, estimated_completion_date: date }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Required Assets */}
        <div className="grid grid-cols-2 gap-6">
          {/* Required Assets */}
          <div>
            <Label className="flex items-center gap-1 mb-2">
              <Wrench className="w-4 h-4" />
              Required Assets
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  placeholder="Add an asset..."
                  onKeyPress={(e) => e.key === 'Enter' && addTool()}
                />
                <Button onClick={addTool} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {editData.required_tools && editData.required_tools.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editData.required_tools.map((tool, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tool}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeTool(tool)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Required Stock */}
          <div>
            <Label className="flex items-center gap-1 mb-2">
              <Wrench className="w-4 h-4" />
              Required Stock
            </Label>
            <div className="space-y-2">
              <Button 
                onClick={() => {/* TODO: Open stock selector */}} 
                size="sm" 
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Stock
              </Button>
              {editData.required_stock && editData.required_stock.length > 0 && (
                <div className="space-y-2">
                  {editData.required_stock.map((stock, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{stock.part_name} (Qty: {stock.quantity})</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditData(prev => ({
                            ...prev,
                            required_stock: prev.required_stock?.filter((_, i) => i !== index) || []
                          }));
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rich Text Content */}
        <Tabs defaultValue="plan" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="observations">Implementation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="plan" className="mt-4">
            <div>
              <Label>Task Plan</Label>
              <div className="mt-2 border rounded-lg">
                <LexicalEditor
                  value={editData.plan || ''}
                  onChange={(value) => setEditData(prev => ({ ...prev, plan: value }))}
                  placeholder="Describe the plan for this task..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="observations" className="mt-4">
            <div>
              <Label>Implementation Notes</Label>
              <div className="mt-2 border rounded-lg">
                <LexicalEditor
                  value={editData.observations || ''}
                  onChange={(value) => setEditData(prev => ({ ...prev, observations: value }))}
                  placeholder="Document the implementation progress and observations..."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!editData.title?.trim() || !hasChanges || isSaving}
          >
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? 'Saving...' : (isCreating ? 'Create Task' : 'Save Changes')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}