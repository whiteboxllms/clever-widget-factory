import { useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useCognitoAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useToast } from "@/hooks/use-toast";
import { useActionProfiles } from "@/hooks/useActionProfiles";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { missionsQueryKey } from '@/lib/queryKeys';
import { ArrowLeft, Rocket, Flag, Calendar, User, CheckCircle, Clock, AlertCircle, Wrench, Microscope, GraduationCap, Hammer, Lightbulb, ChevronDown, ChevronUp, Filter, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SimpleMissionForm } from '@/components/SimpleMissionForm';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { apiService } from '@/lib/apiService';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';

import { withAuth, checkUserRole as checkUserRoleAuth } from '@/lib/authUtils';
import { hasActualContent } from '@/lib/utils';
interface Mission {
  id: string;
  mission_number: number;
  title: string;
  problem_statement: string;
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
  id?: string;
  title: string;
  description?: string;
  policy?: string;
  observations?: string;
  assigned_to: string | null;
  plan_commitment?: boolean | null;
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
  const queryClient = useQueryClient();

  const fetchMissions = async () => {
    // Use apiService to include authentication headers
    const { apiService, getApiData } = await import('@/lib/apiService');
    const response = await apiService.get('/missions');
    const data = getApiData(response);
    return Array.isArray(data) ? data : [];
  };

  // Use shared query key to share cache with other components
  const { data: missions = [], isLoading: loading } = useQuery({
    queryKey: missionsQueryKey(),
    queryFn: fetchMissions,
    ...offlineQueryConfig,
  });
  
  // Use standardized profiles for consistent "Assigned to" dropdown
  const { profiles } = useActionProfiles();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { members: organizationMembers = [] } = useOrganizationMembers();

  const userRole = useMemo(() => {
    if (!user) return null;
    const member = organizationMembers.find(m => m.user_id === user.id);
    return member?.role || null;
  }, [user, organizationMembers]);

  const isAdmin = userRole === 'admin';
  const isContributorOrAdmin = userRole === 'admin' || userRole === 'contributor';
  const [expandedProblemStatements, setExpandedProblemStatements] = useState<Set<string>>(new Set());
  const [showCompletedMissions, setShowCompletedMissions] = useState(false);
  const [showBackloggedMissions, setShowBackloggedMissions] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const createMissionMutation = useMutation({
    mutationFn: async (missionData: any) => {
      return await apiService.post('/missions', missionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      toast({
        title: "Success",
        description: "Mission created successfully!"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create mission",
        variant: "destructive"
      });
    }
  });

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

  // Convert icon component to string name
  const getIconName = (iconComponent: React.ComponentType<{ className?: string }>) => {
    const iconNameMap: {
      [key: string]: string;
    } = {
      'Wrench': 'Wrench',
      'Microscope': 'Microscope',
      'GraduationCap': 'GraduationCap',
      'Hammer': 'Hammer',
      'Lightbulb': 'Lightbulb'
    };
    return iconNameMap[iconComponent.name] || 'Wrench';
  };

  // Form state for creating missions
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
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
    // Special handling for archived and removed missions
    if (mission.status === 'archived') {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-gray-400 border-2'
      };
    }
    
    if (mission.status === 'removed') {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-red-400 border-2'
      };
    }
    
    if (mission.status === 'cancelled') {
      return {
        bg: 'bg-card',
        text: 'text-card-foreground',
        border: 'border-orange-400 border-2'
      };
    }

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

    // Priority 2: If any tasks have implementation AND had first a plan, show yellow
    // This ensures proper progression: Gray → Blue → Yellow → Green
    if (mission.tasks_with_implementation_count && mission.tasks_with_implementation_count > 0 && mission.tasks_with_policies_count > 0) {
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


  const handleCreateMission = async () => {
    if (!user || !formData.title.trim() || !formData.problem_statement.trim() || !formData.qa_assigned_to) {
      toast({
        title: "Error",
        description: "Please fill in all required fields including QA assignment",
        variant: "destructive"
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID is required to create missions",
        variant: "destructive"
      });
      return;
    }
    try {
      // Check if user has admin role using the enhanced auth utils
      const roleCheck = await checkUserRoleAuth('admin');
      if (!roleCheck.hasRole) {
        toast({
          title: "Permission Error",
          description: "Only admins can create new missions",
          variant: "destructive"
        });
        return;
      }

      // Use withAuth wrapper for the mission creation
      const result = await withAuth(async session => {
        // Create the mission
        const missionResult = await apiService.post('/missions', {
          title: formData.title,
          problem_statement: formData.problem_statement,
          created_by: session.user.id,
          qa_assigned_to: formData.qa_assigned_to || null,
        });
        const missionData = missionResult.data || missionResult;

        // Handle both new tasks from form and existing orphaned tasks
        const tasksToCreate = formData.actions.filter(task => task.title.trim() && !task.id);
        const existingTasksToUpdate = formData.actions.filter(task => task.id);
        const createdTasks = [];
        const taskIdMap: Record<string, string> = {};
        
        // Create new tasks
        if (tasksToCreate.length > 0) {
          const tasksResult = await apiService.post('/actions', tasksToCreate.map(task => ({
            mission_id: missionData.id,
            title: task.title,
            description: task.description || null,
            policy: task.policy || null,
            observations: task.observations || null,
            assigned_to: task.assigned_to || null,
            plan_commitment: task.plan_commitment || false,
          })));
          const tasksData = Array.isArray(tasksResult) ? tasksResult : (tasksResult?.data || []);
          
          // Create task ID mapping from temp IDs to real IDs
          tasksToCreate.forEach((task, index) => {
            const tempId = `temp-${index}`;
            if (tasksData && tasksData[index]) {
              taskIdMap[tempId] = tasksData[index].id;
            }
          });
          
          createdTasks.push(...(tasksData || []));
        }

        // Update existing orphaned tasks with the mission ID
        if (existingTasksToUpdate.length > 0) {
          for (const task of existingTasksToUpdate) {
            const updatedTask = await apiService.put(`/actions/${task.id}`, { mission_id: missionData.id });
            createdTasks.push(updatedTask.data || updatedTask);
          }
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

  const handleCardClick = (mission: Mission) => {
    navigate(`/missions/${mission.id}/edit`);
  };
  const resetFormData = () => {
    setFormData({
      title: '',
      problem_statement: '',
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
    resetFormData();
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
      case 'cancelled':
        return <Clock className="h-4 w-4" />;
      case 'archived':
        return <Flag className="h-4 w-4" />;
      case 'removed':
        return <AlertCircle className="h-4 w-4" />;
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
      case 'cancelled':
        return 'destructive';
      case 'archived':
        return 'secondary';
      case 'removed':
        return 'destructive';
      default:
        return 'default';
    }
  };
  const getProgressPercentage = (mission: Mission) => {
    if (!mission.task_count || mission.task_count === 0) return 0;
    return Math.round((mission.completed_task_count || 0) / mission.task_count * 100);
  };
  const getDialogTitle = () => {
    return "Create New Project";
  };

  const processedMissions = useMemo(() => {
    const nameMap = new Map();
    organizationMembers.forEach(member => {
      nameMap.set(member.user_id, member.full_name);
    });
    
    return missions.map(mission => {
      const tasks = mission.actions || [];
      const completedTasks = tasks.filter((task) => task.status === 'completed');
      const tasksWithPolicies = tasks.filter((task) => hasActualContent(task.policy));
      const tasksWithImplementation = tasks.filter((task) => hasActualContent(task.observations));
      return {
        ...mission,
        creator_name: nameMap.get(mission.created_by) || 'Unknown',
        qa_name: mission.qa_assigned_to ? (nameMap.get(mission.qa_assigned_to) || 'Unassigned') : 'Unassigned',
        task_count: tasks.length,
        completed_task_count: completedTasks.length,
        tasks_with_policies_count: tasksWithPolicies.length,
        tasks_with_implementation_count: tasksWithImplementation.length
      };
    });
  }, [missions, organizationMembers]);

  // Filter missions based on status and user preferences
  const filteredMissions = processedMissions.filter(mission => {
    // Always show active missions (planning, in_progress, qa_review)
    if (['planning', 'in_progress', 'qa_review'].includes(mission.status)) {
      return true;
    }
    
    // Show completed missions if user wants to see them
    if (mission.status === 'completed') {
      return showCompletedMissions;
    }
    
    // Show backlogged missions (cancelled, archived, removed) if user wants to see them
    if (['cancelled', 'archived', 'removed'].includes(mission.status)) {
      return showBackloggedMissions;
    }
    
    return false;
  });

  // Group missions by status for better organization
  const groupedMissions = {
    active: filteredMissions.filter(m => ['planning', 'in_progress', 'qa_review'].includes(m.status)),
    completed: filteredMissions.filter(m => m.status === 'completed'),
    backlogged: filteredMissions.filter(m => ['cancelled', 'archived', 'removed'].includes(m.status))
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
              <h1 className="text-2xl font-bold">Stargazer Projects</h1>
              <p className="text-muted-foreground">Manage objectives and track progress</p>
            </div>
          </div>
          
          {isAdmin && <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{getDialogTitle()}</DialogTitle>
                  <DialogDescription>
                    Define your project details
                  </DialogDescription>
                </DialogHeader>
                
                <SimpleMissionForm 
                  formData={formData} 
                  setFormData={setFormData} 
                  profiles={profiles} 
                  onSubmit={handleCreateMission} 
                  onCancel={resetDialog} 
                  defaultTasks={[]}
                />
              </DialogContent>
            </Dialog>}

        </div>
      </header>

      {/* Compressed Filter Section */}
      <div className="border-b bg-card/50">
        <div className="px-6 py-3">
          <Collapsible open={isFilterExpanded} onOpenChange={setIsFilterExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="h-auto p-2 hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Project Filters</span>
                  {(showCompletedMissions || showBackloggedMissions) && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      <span className="text-xs text-muted-foreground">
                        ({groupedMissions.completed.length + groupedMissions.backlogged.length} hidden)
                      </span>
                    </div>
                  )}
                  {isFilterExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Label htmlFor="show-completed" className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Show Completed
                  </Label>
                  <div className="relative">
                    <input
                      id="show-completed"
                      type="checkbox"
                      checked={showCompletedMissions}
                      onChange={(e) => setShowCompletedMissions(e.target.checked)}
                      className="sr-only"
                    />
                    <div 
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        showCompletedMissions ? 'bg-primary' : 'bg-muted'
                      }`}
                      onClick={() => setShowCompletedMissions(!showCompletedMissions)}
                    >
                      <div 
                        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                          showCompletedMissions ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                        style={{ marginTop: '2px' }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Label htmlFor="show-backlogged" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Show Backlogged
                  </Label>
                  <div className="relative">
                    <input
                      id="show-backlogged"
                      type="checkbox"
                      checked={showBackloggedMissions}
                      onChange={(e) => setShowBackloggedMissions(e.target.checked)}
                      className="sr-only"
                    />
                    <div 
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        showBackloggedMissions ? 'bg-primary' : 'bg-muted'
                      }`}
                      onClick={() => setShowBackloggedMissions(!showBackloggedMissions)}
                    >
                      <div 
                        className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                          showBackloggedMissions ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                        style={{ marginTop: '2px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {loading ? <div className="text-center py-8">Loading projects...</div> : missions.length === 0 ? <div className="text-center py-8">
              <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground">
                {isAdmin ? "Create your first project to get started." : "No projects have been created yet."}
              </p>
            </div> : <div className="space-y-8">
              {/* Active Projects */}
              {groupedMissions.active.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Active Projects ({groupedMissions.active.length})
                  </h2>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {groupedMissions.active.map(mission => {
            const missionTheme = getMissionTheme(mission);
            return <Card key={`mission-${mission.id}`} className={`hover:shadow-lg transition-shadow cursor-pointer ${missionTheme.border}`} onClick={() => handleCardClick(mission)}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                         <CardTitle className="flex items-center gap-2">
                           {getStatusIcon(mission.status)}
                           PROJECT-{String(mission.mission_number).padStart(3, '0')}: {mission.title}
                         </CardTitle>
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
                          <Calendar className="h-4 w-4" />
                          {new Date(mission.created_at).toLocaleDateString()}
                        </div>
                        
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
                        

                      </div>
                    </CardContent>
                  </Card>;
                    })}
                  </div>
                </div>
              )}

              {/* Completed Projects */}
              {groupedMissions.completed.length > 0 && (
                <Collapsible open={showCompletedMissions} onOpenChange={setShowCompletedMissions}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="h-auto p-0 text-left justify-start hover:bg-transparent">
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Completed Projects ({groupedMissions.completed.length})
                        {showCompletedMissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </h2>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {groupedMissions.completed.map(mission => {
                        const missionTheme = getMissionTheme(mission);
                        return <Card key={`mission-${mission.id}`} className={`hover:shadow-lg transition-shadow cursor-pointer ${missionTheme.border}`} onClick={() => handleCardClick(mission)}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                               <CardTitle className="flex items-center gap-2">
                                 {getStatusIcon(mission.status)}
                                 MISSION-{String(mission.mission_number).padStart(3, '0')}: {mission.title}
                               </CardTitle>
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
                                <Calendar className="h-4 w-4" />
                                {new Date(mission.created_at).toLocaleDateString()}
                              </div>
                              
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
                              

                            </div>
                          </CardContent>
                        </Card>;
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Backlogged Projects */}
              {groupedMissions.backlogged.length > 0 && (
                <Collapsible open={showBackloggedMissions} onOpenChange={setShowBackloggedMissions}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="h-auto p-0 text-left justify-start hover:bg-transparent">
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Backlogged Projects ({groupedMissions.backlogged.length})
                        {showBackloggedMissions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </h2>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {groupedMissions.backlogged.map(mission => {
                        const missionTheme = getMissionTheme(mission);
                        return <Card key={`mission-${mission.id}`} className={`hover:shadow-lg transition-shadow cursor-pointer ${missionTheme.border} opacity-75`} onClick={() => handleCardClick(mission)}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                               <CardTitle className="flex items-center gap-2">
                                 {getStatusIcon(mission.status)}
                                 MISSION-{String(mission.mission_number).padStart(3, '0')}: {mission.title}
                               </CardTitle>
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
                                <Calendar className="h-4 w-4" />
                                {new Date(mission.created_at).toLocaleDateString()}
                              </div>
                              
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
                              

                            </div>
                          </CardContent>
                        </Card>;
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>}
        </div>
      </main>

    </div>;
};
export default Missions;