import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, 
  X, 
  Clock, 
  Timer, 
  Wrench, 
  FileText, 
  Users, 
  ChevronDown,
  Plus,
  Trash2 
} from 'lucide-react';
import { LexicalEditor } from './LexicalEditor';

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
  estimated_duration?: string;
  actual_duration?: string;
  required_tools?: string[];
  phase?: 'planning' | 'execution' | 'verification' | 'documentation';
}

interface TaskDetailEditorProps {
  task: Task;
  profiles: Profile[];
  onSave: (taskData: Partial<Task>) => void;
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
  const [editData, setEditData] = useState<Partial<Task>>({
    title: task.title,
    plan: task.plan || '',
    observations: task.observations || '',
    assigned_to: task.assigned_to,
    estimated_duration: task.estimated_duration || '',
    actual_duration: task.actual_duration || '',
    required_tools: task.required_tools || [],
    phase: task.phase || 'execution'
  });

  const [newTool, setNewTool] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const originalData = {
      title: task.title,
      plan: task.plan || '',
      observations: task.observations || '',
      assigned_to: task.assigned_to,
      estimated_duration: task.estimated_duration || '',
      actual_duration: task.actual_duration || '',
      required_tools: task.required_tools || [],
      phase: task.phase || 'execution'
    };

    const hasChanged = JSON.stringify(editData) !== JSON.stringify(originalData);
    setHasChanges(hasChanged);
  }, [editData, task]);

  const handleSave = () => {
    if (!editData.title?.trim()) {
      return;
    }
    onSave(editData);
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
              <Badge 
                variant="secondary" 
                className={`${selectedPhase.color} text-white`}
              >
                <selectedPhase.icon className="w-3 h-3 mr-1" />
                {selectedPhase.label}
              </Badge>
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
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter task title..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phase">Phase</Label>
              <Select 
                value={editData.phase} 
                onValueChange={(value) => setEditData(prev => ({ ...prev, phase: value as any }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select 
                value={editData.assigned_to || ''} 
                onValueChange={(value) => setEditData(prev => ({ ...prev, assigned_to: value || null }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {profiles.map(profile => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="estimated_duration">
                <Clock className="w-4 h-4 inline mr-1" />
                Estimated Duration
              </Label>
              <Input
                id="estimated_duration"
                value={editData.estimated_duration || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, estimated_duration: e.target.value }))}
                placeholder="e.g., 2 hours, 30 mins"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="actual_duration">
                <Timer className="w-4 h-4 inline mr-1" />
                Actual Duration
              </Label>
              <Input
                id="actual_duration"
                value={editData.actual_duration || ''}
                onChange={(e) => setEditData(prev => ({ ...prev, actual_duration: e.target.value }))}
                placeholder="e.g., 2.5 hours"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Required Tools */}
        <div>
          <Label className="flex items-center gap-1 mb-2">
            <Wrench className="w-4 h-4" />
            Required Tools
          </Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={newTool}
                onChange={(e) => setNewTool(e.target.value)}
                placeholder="Add a tool..."
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
            disabled={!editData.title?.trim() || !hasChanges}
          >
            <Save className="w-4 h-4 mr-1" />
            {isCreating ? 'Create Task' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}