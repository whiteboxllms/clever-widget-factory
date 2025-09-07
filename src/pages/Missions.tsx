import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Rocket, Flag, Calendar, User, CheckCircle, Clock, AlertCircle, ChevronRight, ExternalLink, Wrench, Microscope, GraduationCap, Hammer, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MissionTemplates } from '@/components/MissionTemplates';
import { SimpleMissionForm } from '@/components/SimpleMissionForm';
import { MissionTaskList } from '@/components/MissionTaskList';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOrganizationId } from '@/hooks/useOrganizationId';

import { withAuth, checkUserRole as checkUserRoleAuth } from '@/lib/authUtils';
interface Mission {
  id: string;
  mission_number: number;
  title: string;
  problem_statement: string;
  resources_required: string;
  all_materials_available: boolean;
  status: string;
  created_by: string;
  qa_assigned_to: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  qa_feedback?: string;
  template_id?: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
  creator_name?: string;
  qa_name?: string;
  task_count?: number;
  completed_task_count?: number;
  tasks_with_policies_count?: number;
  tasks_with_implementation_count?: number;
}
interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}
interface Task {
  title: string;
  policy?: string;
  observations?: string;
  assigned_to: string | null;
}
const Missions = () => {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const organizationId = useOrganizationId();
  const {
    toast
  } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);
  const [isContributorOrLeadership, setIsContributorOrLeadership] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [expandedMissions, setExpandedMissions] = useState<Set<string>>(new Set());
  const [expandedProblemStatements, setExpandedProblemStatements] = useState<Set<string>>(new Set());

  // Debouncing for real-time updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Icon mapping function
  const getIconComponent = (iconName: string) => {
    const iconMap: {
      [key: string]: React.ComponentType<{
        className?: string;
      }>;
    } = {
      'Wrench': Wrench,
      'Microscope': Microscope,
      'GraduationCap': GraduationCap,
      'Hammer': Hammer,
      'Lightbulb': Lightbulb
    };
    return iconMap[iconName] || Wrench; // Default to Wrench if not found
  };
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

  // Form state for creating missions
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
    resources_required: '',
    selected_resources: [] as SelectedResource[],
    all_materials_available: false,
    qa_assigned_to: user?.id || (() => {
      throw new Error('User must be authenticated to create missions');
    })(),
    // Default to current user
    actions: [{
      title: '',
      policy: '',
      observations: '',
      assigned_to: null
    }] as Task[]
  });

  // Updated function to determine mission color based on task content analysis and QA feedback
  const getMissionTheme = (mission: Mission) => {
    // If no tasks, show blank state
    if (!mission.task_count || mission.task_count === 0) {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-task-blank-border'
      };
    }

    // Priority 1: If all tasks are completed but no QA feedback, keep yellow (mission still in progress)
    if (mission.completed_task_count === mission.task_count) {
      // If QA feedback is provided, show green (fully complete)
      if (mission.qa_feedback && mission.qa_feedback.trim()) {
        return {
          bg: 'bg-card',
          text: 'text-card-foreground',
          border: 'border-task-complete-border border-2'
        };
      }
      // If no QA feedback yet, keep yellow (mission still in progress awaiting QA)
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-task-implementation-border border-2'
      };
    }

    // Priority 2: If any tasks have implementation (in progress), show yellow
    if (mission.tasks_with_implementation_count && mission.tasks_with_implementation_count > 0) {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-task-implementation-border border-2'
      };
    }

    // Priority 3: If any tasks have plans but no implementation, show blue
    if (mission.tasks_with_policies_count && mission.tasks_with_policies_count > 0) {
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

  // Targeted state update function for real-time changes
  const updateMissionTaskCounts = useCallback((missionId: string, tasks: any[]) => {
    setMissions(prevMissions => {
      return prevMissions.map(mission => {
        if (mission.id !== missionId) return mission;
        const completedTasks = tasks.filter((task: any) => task.status === 'completed');
        const tasksWithPolicies = tasks.filter((task: any) => task.policy && task.policy.trim());
        const tasksWithImplementation = tasks.filter((task: any) => task.observations && task.observations.trim());
        return {
          ...mission,
          task_count: tasks.length,
          completed_task_count: completedTasks.length,
          tasks_with_policies_count: tasksWithPolicies.length,
          tasks_with_implementation_count: tasksWithImplementation.length
        };
      });
    });
  }, []);

  // Debounced mission refresh for structural changes
  const debouncedMissionRefresh = useCallback((delay: number = 500) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      fetchMissions();
    }, delay);
  }, []);
  useEffect(() => {
    fetchMissions();
    fetchProfiles();
    checkUserRole();

    // Subscribe to real-time changes in mission_tasks table with targeted updates
    const channel = supabase.channel('mission-tasks-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'actions'
    }, async payload => {
      console.log('Task update received:', payload);

      // For INSERT and DELETE events, we need to refresh to get accurate counts
      if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
        debouncedMissionRefresh();
        return;
      }

      // For UPDATE events, we can do targeted updates to prevent focus loss
      if (payload.eventType === 'UPDATE' && payload.new) {
        const taskData = payload.new;
        const missionId = taskData.mission_id;
        if (missionId) {
          // Fetch updated tasks for just this mission
          const {
            data: updatedTasks
          } = await supabase.from('actions').select('id, status, plan, observations').eq('mission_id', missionId);
          if (updatedTasks) {
            updateMissionTaskCounts(missionId, updatedTasks);
          }
        }
      }
    }).subscribe();
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [debouncedMissionRefresh, updateMissionTaskCounts]);
  const checkUserRole = async () => {
    if (!user) return;
    const {
      data: profile
    } = await supabase.from('profiles').select('role').eq('user_id', user.id).single();
    setIsLeadership(profile?.role === 'leadership');
    setIsContributorOrLeadership(profile?.role === 'leadership' || profile?.role === 'contributor');
  };
  const fetchProfiles = async () => {
    const {
      data,
      error
    } = await supabase.from('profiles').select('*');
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load user profiles",
        variant: "destructive"
      });
    } else {
      setProfiles(data || []);
    }
  };
  const fetchMissions = async () => {
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from('missions').select(`
        *,
        creator:profiles!missions_created_by_fkey(full_name),
        qa_person:profiles!missions_qa_assigned_to_fkey(full_name),
        actions(
          id,
          status, 
          policy,
          observations,
          linked_issue_id,
          issue_reference
        )
      `).order('created_at', {
      ascending: false
    });
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load missions",
        variant: "destructive"
      });
    } else {
      const missionsWithNames = data?.map(mission => {
        const tasks = mission.actions || [];
        const completedTasks = tasks.filter((task: any) => task.status === 'completed');
        const tasksWithPolicies = tasks.filter((task: any) => task.policy && task.policy.trim());
        const tasksWithImplementation = tasks.filter((task: any) => task.observations && task.observations.trim());
        return {
          ...mission,
          creator_name: mission.creator?.full_name || 'Unknown',
          qa_name: mission.qa_person?.full_name || 'Unassigned',
          task_count: tasks.length,
          completed_task_count: completedTasks.length,
          tasks_with_policies_count: tasksWithPolicies.length,
          tasks_with_implementation_count: tasksWithImplementation.length
        };
      }) || [];
      setMissions(missionsWithNames);

      // Update mission status based on task progress
      for (const mission of missionsWithNames) {
        if (mission.tasks_with_implementation_count > 0 && mission.status === 'planning') {
          // Auto-update mission to in_progress if any task has implementation
          await supabase.from('missions').update({
            status: 'in_progress'
          }).eq('id', mission.id);
        }

        // Auto-update mission to completed if all tasks are completed
        if (mission.task_count > 0 && mission.completed_task_count === mission.task_count && mission.status !== 'completed') {
          await supabase.from('missions').update({
            status: 'completed',
            completed_at: new Date().toISOString()
          }).eq('id', mission.id);
        }
      }
    }
    setLoading(false);
  };
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setShowTemplates(false);

    // Reset form with template data and default QA to current user
    setFormData({
      title: '',
      problem_statement: '',
      resources_required: '',
      selected_resources: [],
      all_materials_available: false,
      qa_assigned_to: user?.id || (() => {
        throw new Error('User must be authenticated to create missions');
      })(),
      // Default to current user
      actions: template.defaultTasks.length > 0 ? template.defaultTasks.map((task: any) => ({
        title: task.title,
        policy: task.policy || '',
        observations: task.observations || '',
        assigned_to: null
      })) : [{
        title: '',
        policy: '',
        observations: '',
        assigned_to: null
      }]
    });
  };
  const handleCreateMission = async () => {
    if (!user || !formData.title.trim() || !formData.problem_statement.trim() || !formData.qa_assigned_to) {
      toast({
        title: "Error",
        description: "Please fill in all required fields including QA assignment",
        variant: "destructive"
      });
      return;
    }
    try {
      // Check if user has leadership role using the enhanced auth utils
      const roleCheck = await checkUserRoleAuth('leadership');
      if (!roleCheck.hasRole) {
        toast({
          title: "Permission Error",
          description: "Only leadership can create new missions",
          variant: "destructive"
        });
        return;
      }

      // Use withAuth wrapper for the mission creation
      const result = await withAuth(async session => {
        // Create the mission
        const {
          data: missionData,
          error: missionError
        } = await supabase.from('missions').insert({
          title: formData.title,
          problem_statement: formData.problem_statement,
          plan: '',
          resources_required: formData.selected_resources.length > 0 ? formData.selected_resources.map(r => {
            const quantity = r.quantity || 1;
            const unit = r.unit || (r.type === 'part' ? 'pieces' : '');
            return `${r.name}${quantity > 1 ? `: ${quantity}${unit ? ' ' + unit : ''}` : ''}`;
          }).join(', ') : formData.resources_required,
          all_materials_available: formData.all_materials_available,
          created_by: session.user.id,
          qa_assigned_to: formData.qa_assigned_to || null,
          template_id: selectedTemplate?.id || null,
          template_name: selectedTemplate?.name || null,
          template_color: selectedTemplate?.color || null,
          template_icon: selectedTemplate?.icon?.name || null
          // mission_number will be auto-generated by the trigger
        } as any).select().single();
        if (missionError) throw missionError;

        // Create tasks for the mission if any
        const tasksToCreate = formData.actions.filter(task => task.title.trim());
        const createdTasks = [];
        const taskIdMap: Record<string, string> = {};
        
        if (tasksToCreate.length > 0) {
          const { data: tasksData, error: tasksError } = await supabase
            .from('actions')
            .insert(tasksToCreate.map(task => ({
              mission_id: missionData.id,
              title: task.title,
              policy: task.policy || null,
              observations: task.observations || null,
              assigned_to: task.assigned_to || null,
              organization_id: organizationId
            })))
            .select();
          
          if (tasksError) throw tasksError;
          
          // Create task ID mapping from temp IDs to real IDs
          tasksToCreate.forEach((task, index) => {
            const tempId = `temp-${index}`;
            if (tasksData && tasksData[index]) {
              taskIdMap[tempId] = tasksData[index].id;
            }
          });
          
          createdTasks.push(...(tasksData || []));
        }

        return { 
          missionId: missionData.id, 
          taskIdMap, 
          createdTasks 
        };
      }, 'mission creation');
      if (result.error) {
        throw new Error(result.error);
      }

      // Generate Perplexity collaboration URL
      const collaborationUrl = `https://www.perplexity.ai/spaces/stargazer-assistant-F45qc1H7SmeN5wF1nxJobg?q=${encodeURIComponent(formData.problem_statement)}`;
      toast({
        title: "Success",
        description: <div className="space-y-2">
            <p>Mission created successfully!</p>
            <a href={collaborationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline text-sm">
              🤖 Collaborate with AI on this mission →
            </a>
          </div>
      });
      setShowCreateDialog(false);
      setShowTemplates(true);
      setSelectedTemplate(null);
      resetFormData();
      fetchMissions();
      
      // Return the result for photo migration
      return result.data;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create mission",
        variant: "destructive"
      });
      throw error; // Re-throw to allow form to handle the error
    }
  };
  const handleEditClick = (mission: Mission) => {
    navigate(`/missions/${mission.id}/edit`);
  };
  const resetFormData = () => {
    setFormData({
      title: '',
      problem_statement: '',
      resources_required: '',
      selected_resources: [],
      all_materials_available: false,
      qa_assigned_to: user?.id || (() => {
        throw new Error('User must be authenticated to create missions');
      })(),
      // Default to current user
      actions: [{
        title: '',
        policy: '',
        observations: '',
        assigned_to: null
      }]
    });
  };
  const resetDialog = () => {
    setShowCreateDialog(false);
    setShowTemplates(true);
    setSelectedTemplate(null);
    resetFormData();
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
  const toggleProblemStatement = (missionId: string) => {
    setExpandedProblemStatements(prev => {
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
  return <div className="min-h-screen bg-background">
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
          
          {isLeadership && <Dialog open={showCreateDialog} onOpenChange={open => {
          setShowCreateDialog(open);
          if (open) {
            // Always start with template selection when opening
            setShowTemplates(true);
            setSelectedTemplate(null);
          }
        }}>
              <DialogTrigger asChild>
                <Button>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Mission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{getDialogTitle()}</DialogTitle>
                  <DialogDescription>
                    {showTemplates ? "Choose a template to get started quickly" : "Define your mission details"}
                  </DialogDescription>
                </DialogHeader>
                
                {showTemplates ? <MissionTemplates onSelectTemplate={handleTemplateSelect} onClose={resetDialog} /> : <SimpleMissionForm formData={formData} setFormData={setFormData} profiles={profiles} onSubmit={handleCreateMission} onCancel={resetDialog} defaultTasks={selectedTemplate?.defaultTasks} selectedTemplate={selectedTemplate} />}
              </DialogContent>
            </Dialog>}

        </div>
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {loading ? <div className="text-center py-8">Loading missions...</div> : missions.length === 0 ? <div className="text-center py-8">
              <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No missions yet</h3>
              <p className="text-muted-foreground">
                {isLeadership ? "Create your first mission to get started." : "No missions have been created yet."}
              </p>
            </div> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {missions.map(mission => {
            const missionTheme = getMissionTheme(mission);
            return <Card key={`mission-${mission.id}`} className={`hover:shadow-lg transition-shadow ${missionTheme.border}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                         <CardTitle className="flex items-center gap-2">
                           {getStatusIcon(mission.status)}
                           MISSION-{String(mission.mission_number).padStart(3, '0')}: {mission.title}
                         </CardTitle>
                         <div className="flex items-center gap-2">
                           {(mission.created_by === user?.id || isContributorOrLeadership) && <Button variant="ghost" size="sm" onClick={() => handleEditClick(mission)} className="h-6 w-6 p-0">
                               <ExternalLink className="h-3 w-3" />
                             </Button>}
                         </div>
                      </div>
                      <Collapsible open={expandedProblemStatements.has(mission.id)} onOpenChange={() => toggleProblemStatement(mission.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="h-auto p-0 text-left justify-start hover:bg-transparent">
                            <CardDescription className="flex items-center gap-2 break-words">
                              {mission.problem_statement.length > 100 ? <span className="break-words whitespace-pre-wrap">
                                  {expandedProblemStatements.has(mission.id) ? mission.problem_statement : `${mission.problem_statement.substring(0, 100)}...`}
                                </span> : <span className="break-words whitespace-pre-wrap">
                                  {mission.problem_statement}
                                </span>}
                              {mission.problem_statement.length > 100 && (expandedProblemStatements.has(mission.id) ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />)}
                            </CardDescription>
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                      <a href={`https://www.perplexity.ai/spaces/stargazer-assistant-F45qc1H7SmeN5wF1nxJobg?q=${encodeURIComponent(mission.problem_statement)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                        🤖 Collaborate with AI on this mission →
                      </a>
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
                        {mission.qa_name !== 'Unassigned' && <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            QA: {mission.qa_name}
                          </div>}
                        
                        {/* Progress indicator */}
                        {mission.task_count && mission.task_count > 0 && <div className="pt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{getProgressPercentage(mission)}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{
                        width: `${getProgressPercentage(mission)}%`
                      }} />
                            </div>
                            <div className="text-xs mt-1">
                              {mission.completed_task_count || 0} of {mission.task_count} tasks completed
                            </div>
                          </div>}
                        
                        {/* Task expansion for missions with tasks */}
                        {mission.task_count && mission.task_count > 0 && <Collapsible open={expandedMissions.has(mission.id)} onOpenChange={() => toggleMissionExpanded(mission.id)}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto p-1 mt-2">
                                <ChevronRight className={`h-4 w-4 transition-transform ${expandedMissions.has(mission.id) ? 'rotate-90' : ''}`} />
                                <span className="text-xs">
                                  {expandedMissions.has(mission.id) ? 'Hide' : 'Show'} Tasks
                                </span>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                               <MissionTaskList missionId={mission.id} profiles={profiles} canEdit={isContributorOrLeadership || mission.created_by === user?.id} missionNumber={mission.mission_number} />
                             </CollapsibleContent>
                           </Collapsible>}

                         {/* QA Feedback Section */}
                         {(isLeadership || mission.created_by === user?.id || mission.status === 'completed') && <div className={`mt-4 p-3 rounded-lg bg-muted/50 ${mission.status === 'completed' && (!mission.qa_feedback || !mission.qa_feedback.trim()) ? 'border-2 border-task-plan-border' // Blue border when ready to be filled
                  : 'border'}`}>
                             <Label className="text-sm font-medium">QA Feedback</Label>
                             <Textarea value={mission.qa_feedback || ''} onChange={async e => {
                      const newFeedback = e.target.value;
                      // Update mission locally first for immediate feedback
                      setMissions(prev => prev.map(m => m.id === mission.id ? {
                        ...m,
                        qa_feedback: newFeedback
                      } : m));
                    }} onBlur={async e => {
                      const newFeedback = e.target.value;
                      // Save to database on blur
                      try {
                        const {
                          error
                        } = await supabase.from('missions').update({
                          qa_feedback: newFeedback
                        }).eq('id', mission.id);
                        if (error) throw error;
                        toast({
                          title: "QA Feedback Saved",
                          description: "QA feedback has been updated successfully."
                        });
                      } catch (error) {
                        console.error('Error saving QA feedback:', error);
                        toast({
                          title: "Error",
                          description: "Failed to save QA feedback",
                          variant: "destructive"
                        });
                        // Revert the local change on error
                        setMissions(prev => prev.map(m => m.id === mission.id ? {
                          ...m,
                          qa_feedback: mission.qa_feedback
                        } : m));
                      }
                    }} placeholder={mission.status === 'completed' ? "Enter QA review and feedback..." : "QA feedback will be available once mission is completed"} disabled={mission.status !== 'completed'} rows={3} className="mt-1 text-sm" />
                           </div>}
                      </div>
                    </CardContent>
                  </Card>;
          })}
            </div>}
        </div>
      </main>
    </div>;
};
export default Missions;