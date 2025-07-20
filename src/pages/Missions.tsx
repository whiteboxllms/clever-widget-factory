import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Flag, Calendar, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResourceSelector } from '@/components/ResourceSelector';

interface Mission {
  id: string;
  title: string;
  problem_statement: string;
  plan: string;
  resources_required: string;
  all_materials_available: boolean;
  status: string;
  created_by: string;
  qa_assigned_to: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  creator_name?: string;
  qa_name?: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

const Missions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isLeadership, setIsLeadership] = useState(false);

  // Form state for creating missions
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
    plan: '',
    resources_required: '',
    selected_resources: [] as { id: string; name: string; quantity: number; unit: string }[],
    all_materials_available: false,
    qa_assigned_to: '',
    tasks: [{ title: '', description: '', done_definition: '', assigned_to: '' }]
  });

  useEffect(() => {
    fetchMissions();
    fetchProfiles();
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    setIsLeadership(profile?.role === 'leadership');
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load user profiles",
        variant: "destructive",
      });
    } else {
      setProfiles(data || []);
    }
  };

  const fetchMissions = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('missions')
      .select(`
        *,
        creator:profiles!missions_created_by_fkey(full_name),
        qa_person:profiles!missions_qa_assigned_to_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load missions",
        variant: "destructive",
      });
    } else {
      const missionsWithNames = data?.map(mission => ({
        ...mission,
        creator_name: mission.creator?.full_name || 'Unknown',
        qa_name: mission.qa_person?.full_name || 'Unassigned'
      })) || [];
      setMissions(missionsWithNames);
    }
    
    setLoading(false);
  };

  const handleCreateMission = async () => {
    if (!user || !formData.title.trim() || !formData.problem_statement.trim() || !formData.plan.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the mission
      const { data: missionData, error: missionError } = await supabase
        .from('missions')
        .insert({
          title: formData.title,
          problem_statement: formData.problem_statement,
          plan: formData.plan,
          resources_required: formData.selected_resources.length > 0 
            ? formData.selected_resources.map(r => `${r.name}: ${r.quantity} ${r.unit}`).join(', ')
            : formData.resources_required,
          all_materials_available: formData.all_materials_available,
          created_by: user.id,
          qa_assigned_to: formData.qa_assigned_to || null
        })
        .select()
        .single();

      if (missionError) throw missionError;

      // Create tasks for the mission
      const tasksToCreate = formData.tasks.filter(task => task.title.trim() && task.done_definition.trim());
      
      if (tasksToCreate.length > 0) {
        const { error: tasksError } = await supabase
          .from('mission_tasks')
          .insert(tasksToCreate.map(task => ({
            mission_id: missionData.id,
            title: task.title,
            description: task.description,
            done_definition: task.done_definition,
            assigned_to: task.assigned_to || null
          })));

        if (tasksError) throw tasksError;
      }

      toast({
        title: "Success",
        description: "Mission created successfully",
      });

      setShowCreateDialog(false);
      setFormData({
        title: '',
        problem_statement: '',
        plan: '',
        resources_required: '',
        selected_resources: [],
        all_materials_available: false,
        qa_assigned_to: '',
        tasks: [{ title: '', description: '', done_definition: '', assigned_to: '' }]
      });
      fetchMissions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create mission",
        variant: "destructive",
      });
    }
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4" />;
      case 'qa_review':
        return <User className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Flag className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'qa_review':
        return 'outline';
      case 'completed':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Stargazer Missions</h1>
              <p className="text-muted-foreground">Manage objectives and track progress</p>
            </div>
          </div>
          
          {isLeadership && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Mission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Mission</DialogTitle>
                  <DialogDescription>
                    Define a new mission with objectives and tasks
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="title">Mission Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter mission title"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="problem_statement">Problem Statement</Label>
                    <Textarea
                      id="problem_statement"
                      value={formData.problem_statement}
                      onChange={(e) => setFormData(prev => ({ ...prev, problem_statement: e.target.value }))}
                      placeholder="Describe the problem this mission addresses"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="plan">Plan</Label>
                    <Textarea
                      id="plan"
                      value={formData.plan}
                      onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                      placeholder="Describe the plan to solve the problem"
                      rows={3}
                    />
                  </div>
                  
                  <ResourceSelector
                    selectedResources={formData.selected_resources}
                    onResourcesChange={(resources) => 
                      setFormData(prev => ({ ...prev, selected_resources: resources }))
                    }
                  />
                  
                  {/* Additional text input for other resources */}
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
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Tasks</Label>
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
                            placeholder="Done definition (required)"
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
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateMission}>
                      Create Mission
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-8">Loading missions...</div>
          ) : missions.length === 0 ? (
            <div className="text-center py-8">
              <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No missions yet</h3>
              <p className="text-muted-foreground">
                {isLeadership ? "Create your first mission to get started." : "No missions have been created yet."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {missions.map((mission) => (
                <Card key={mission.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {getStatusIcon(mission.status)}
                        {mission.title}
                      </CardTitle>
                      <Badge variant={getStatusColor(mission.status)}>
                        {mission.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardDescription>
                      {mission.problem_statement.substring(0, 100)}
                      {mission.problem_statement.length > 100 && '...'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Created by: {mission.creator_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(mission.created_at).toLocaleDateString()}
                      </div>
                      {mission.qa_name !== 'Unassigned' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          QA: {mission.qa_name}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Missions;