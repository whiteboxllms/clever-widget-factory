
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResourceSelector } from '@/components/ResourceSelector';

interface Task {
  title: string;
  description: string;
  done_definition: string;
  assigned_to: string;
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
    plan: string;
    resources_required: string;
    selected_resources: Array<{ id: string; name: string; quantity?: number; unit?: string; type: 'part' | 'tool' }>;
    all_materials_available: boolean;
    qa_assigned_to: string;
    tasks: Task[];
  };
  setFormData: (data: any) => void;
  profiles: Profile[];
  onSubmit: () => void;
  onCancel: () => void;
  defaultTasks?: Task[];
}

export function SimpleMissionForm({ 
  formData, 
  setFormData, 
  profiles, 
  onSubmit, 
  onCancel,
  defaultTasks = []
}: SimpleMissionFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTasks, setShowTasks] = useState(defaultTasks.length > 0);

  // Initialize with default tasks if provided
  useState(() => {
    if (defaultTasks.length > 0 && formData.tasks.length === 1 && !formData.tasks[0].title) {
      setFormData(prev => ({ 
        ...prev, 
        tasks: defaultTasks.map(task => ({ ...task, assigned_to: '' }))
      }));
    }
  });

  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { title: '', description: '', done_definition: '', assigned_to: '' }]
    }));
  };

  const updateTask = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }));
  };

  const removeTask = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
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
        </div>
        
        <div>
          <Label htmlFor="plan">Plan *</Label>
          <Textarea
            id="plan"
            value={formData.plan}
            onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
            placeholder="Describe the plan to solve the problem"
            rows={3}
          />
        </div>
      </div>

      {/* Resources */}
      <ResourceSelector
        selectedResources={formData.selected_resources}
        onResourcesChange={(resources) => 
          setFormData(prev => ({ ...prev, selected_resources: resources }))
        }
      />
      
      {/* Additional Resources */}
      <div>
        <Label htmlFor="additional_resources">Additional Resources (not in inventory)</Label>
        <Textarea
          id="additional_resources"
          value={formData.resources_required}
          onChange={(e) => setFormData(prev => ({ ...prev, resources_required: e.target.value }))}
          placeholder="List other materials, tools, and resources needed that aren't in inventory"
          rows={2}
        />
      </div>

      {/* Advanced Options */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0">
            <span className="font-medium">Advanced Options</span>
            {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-4">
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
          
          <div>
            <Label htmlFor="qa_assigned_to">QA Assigned To</Label>
            <Select value={formData.qa_assigned_to} onValueChange={(value) => 
              setFormData(prev => ({ ...prev, qa_assigned_to: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select QA person (optional)" />
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
        </CollapsibleContent>
      </Collapsible>

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
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Break down your mission into specific tasks (optional)
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addTask}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
          
          {formData.tasks.map((task, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Task {index + 1}</Label>
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
                
                <Input
                  placeholder="Task title"
                  value={task.title}
                  onChange={(e) => updateTask(index, 'title', e.target.value)}
                />
                
                <Textarea
                  placeholder="Task description (optional)"
                  value={task.description}
                  onChange={(e) => updateTask(index, 'description', e.target.value)}
                  rows={2}
                />
                
                <Textarea
                  placeholder="Done definition (what does complete look like?)"
                  value={task.done_definition}
                  onChange={(e) => updateTask(index, 'done_definition', e.target.value)}
                  rows={2}
                />
                
                <Select value={task.assigned_to} onValueChange={(value) => 
                  updateTask(index, 'assigned_to', value)
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
            </Card>
          ))}
        </CollapsibleContent>
      </Collapsible>
      
      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          Create Mission
        </Button>
      </div>
    </div>
  );
}
