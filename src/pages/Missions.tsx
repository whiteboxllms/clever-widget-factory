import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Flag, Calendar, User, CheckCircle, Clock, AlertCircle, ChevronRight, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MissionTemplates } from '@/components/MissionTemplates';
import { SimpleMissionForm } from '@/components/SimpleMissionForm';
import { MissionTaskList } from '@/components/MissionTaskList';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DEFAULT_DONE_DEFINITION } from '@/lib/constants';

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
  task_count?: number;
  completed_task_count?: number;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface Task {
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string;
}

const Missions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set());

  // Form state for creating missions
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
    done_definition: DEFAULT_DONE_DEFINITION,
    resources_required: '',
    selected_resources: [] as { id: string; name: string; quantity?: number; unit?: string; type: 'part' | 'tool' }[],
    all_materials_available: false,
    qa_assigned_to: '',
    tasks: [{ title: '', plan: '', observations: '', assigned_to: '' }] as Task[]
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
        qa_person:profiles!missions_qa_assigned_to_fkey(full_name),
        mission_tasks(id, status)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load missions",
        variant: "destructive",
      });
    } else {
      const missionsWithNames = data?.map(mission => {
        const tasks = mission.mission_tasks || [];
        const completedTasks = tasks.filter((task: any) => task.status === 'completed');
        
        return {
          ...mission,
          creator_name: mission.creator?.full_name || 'Unknown',
          qa_name: mission.qa_person?.full_name || 'Unassigned',
          task_count: tasks.length,
          completed_task_count: completedTasks.length
        };
      }) || [];
      setMissions(missionsWithNames);
    }
    
    setLoading(false);
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setShowTemplates(false);
    
    // Reset form with template data
    setFormData({
      title: '',
      problem_statement: '',
      done_definition: DEFAULT_DONE_DEFINITION,
      resources_required: '',
      selected_resources: [],
      all_materials_available: false,
      qa_assigned_to: '',
      tasks: template.defaultTasks.length > 0 
        ? template.defaultTasks.map((task: any) => ({ 
            title: task.title, 
            plan: task.plan || '', 
            observations: task.observations || '',
            assigned_to: '' 
          }))
        : [{ title: '', plan: '', observations: '', assigned_to: '' }]
    });
  };

  const handleCreateMission = async () => {
    if (!user || !formData.title.trim() || !formData.problem_statement.trim() || !formData.done_definition.trim()) {
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
          plan: formData.done_definition,
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
      const tasksToCreate = formData.tasks.filter(task => task.title.trim());
      
      if (tasksToCreate.length > 0) {
        const { error: tasksError } = await supabase
          .from('mission_tasks')
          .insert(tasksToCreate.map(task => ({
            mission_id: missionData.id,
            title: task.title,
            plan: task.plan || null,
            observations: task.observations || null,
            assigned_to: task.assigned_to || null
          })));

        if (tasksError) throw tasksError;
      }

      // Generate Perplexity collaboration URL
      const collaborationUrl = `https://www.perplexity.ai/spaces/stargazer-assistant-F45qc1H7SmeN5wF1nxJobg?q=${encodeURIComponent(formData.problem_statement)}`;

      toast({
        title: "Success",
        description: (
          <div className="space-y-2">
            <p>Mission created successfully!</p>
            <a 
              href={collaborationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
            >
              🤖 Collaborate with AI on this mission →
            </a>
          </div>
        ),
      });

      setShowCreateDialog(false);
      setShowTemplates(true);
      setSelectedTemplate(null);
      setFormData({
        title: '',
        problem_statement: '',
        done_definition: DEFAULT_DONE_DEFINITION,
        resources_required: '',
        selected_resources: [],
        all_materials_available: false,
        qa_assigned_to: '',
        tasks: [{ title: '', plan: '', observations: '', assigned_to: '' }]
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

  const resetDialog = () => {
    setShowCreateDialog(false);
    setShowTemplates(true);
    setSelectedTemplate(null);
    setFormData({
      title: '',
      problem_statement: '',
      done_definition: DEFAULT_DONE_DEFINITION,
      resources_required: '',
      selected_resources: [],
      all_materials_available: false,
      qa_assigned_to: '',
      tasks: [{ title: '', plan: '', observations: '', assigned_to: '' }]
    });
  };

  const toggleMissionExpanded = (missionId: string) => {
    setExpandedMissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(missionId)) {
        newSet.delete(missionId);
      } else {
        newSet.add(missionId);
      }
      return newSet;
    });
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

  const getProgressPercentage = (mission: Mission) => {
    if (!mission.task_count || mission.task_count === 0) return 0;
    return Math.round((mission.completed_task_count || 0) / mission.task_count * 100);
  };

  const getDialogTitle = () => {
    if (showTemplates) {
      return "Create New Mission";
    }
    if (selectedTemplate) {
      return `Create ${selectedTemplate.name} Mission`;
    }
    return "Create New Mission";
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
                  <DialogTitle>{getDialogTitle()}</DialogTitle>
                  <DialogDescription>
                    {showTemplates 
                      ? "Choose a template to get started quickly"
                      : "Define your mission details"
                    }
                  </DialogDescription>
                </DialogHeader>
                
                {showTemplates ? (
                  <MissionTemplates 
                    onSelectTemplate={handleTemplateSelect}
                    onClose={resetDialog}
                  />
                ) : (
                  <SimpleMissionForm
                    formData={formData}
                    setFormData={setFormData}
                    profiles={profiles}
                    onSubmit={handleCreateMission}
                    onCancel={resetDialog}
                    defaultTasks={selectedTemplate?.defaultTasks}
                  />
                )}
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
                      
                      {/* Progress indicator */}
                      {mission.task_count && mission.task_count > 0 && (
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>{getProgressPercentage(mission)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${getProgressPercentage(mission)}%` }}
                            />
                          </div>
                          <div className="text-xs mt-1">
                            {mission.completed_task_count || 0} of {mission.task_count} tasks completed
                          </div>
                        </div>
                      )}
                      
                      {/* Task expansion for missions with tasks */}
                      {mission.task_count && mission.task_count > 0 && (
                        <Collapsible 
                          open={expandedMissions.has(mission.id)} 
                          onOpenChange={() => toggleMissionExpanded(mission.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto p-1 mt-2">
                              <ChevronRight 
                                className={`h-4 w-4 transition-transform ${
                                  expandedMissions.has(mission.id) ? 'rotate-90' : ''
                                }`} 
                              />
                              <span className="text-xs">
                                {expandedMissions.has(mission.id) ? 'Hide' : 'Show'} Tasks
                              </span>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <MissionTaskList
                              missionId={mission.id}
                              profiles={profiles}
                              canEdit={isLeadership || mission.created_by === user?.id}
                            />
                          </CollapsibleContent>
                        </Collapsible>
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
