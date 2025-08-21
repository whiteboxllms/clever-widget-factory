import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { SimpleMissionForm } from '@/components/SimpleMissionForm';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Mission {
  id: string;
  title: string;
  problem_statement: string;
  status: string;
  resources_required: string;
  all_materials_available: boolean;
  qa_assigned_to: string;
  created_by: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
}

interface Task {
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  estimated_duration?: string;
  actual_duration?: string;
  required_tools?: string[];
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

export default function EditMission() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [mission, setMission] = useState<Mission | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isContributorOrLeadership, setIsContributorOrLeadership] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
    selected_resources: [] as SelectedResource[],
    all_materials_available: false,
    qa_assigned_to: '',
    tasks: [] as Task[]
  });

  // Fetch mission data and profiles
  useEffect(() => {
    if (!missionId) {
      navigate('/missions');
      return;
    }
    
    fetchMissionData();
    fetchProfiles();
    checkUserPermissions();
  }, [missionId, user]);

  const fetchMissionData = async () => {
    try {
      const { data: missionData, error: missionError } = await supabase
        .from('missions')
        .select('*')
        .eq('id', missionId)
        .single();

      if (missionError) throw missionError;
      
      if (!missionData) {
        toast({
          title: "Error",
          description: "Mission not found",
          variant: "destructive"
        });
        navigate('/missions');
        return;
      }

      setMission(missionData);

      // Fetch mission tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('mission_tasks')
        .select('*')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true });

      if (tasksError) throw tasksError;

      // Create template object from stored mission data
      let missionTemplate = null;
      if (missionData.template_name) {
        missionTemplate = {
          id: missionData.template_name.toLowerCase().replace(/\s+/g, '-'),
          name: missionData.template_name,
          color: missionData.template_color || 'blue',
          icon: null // We'll handle icon separately if needed
        };
        setSelectedTemplate(missionTemplate);
      }

      // Parse resources if they exist
      let parsedResources: SelectedResource[] = [];
      if (missionData.resources_required) {
        try {
          parsedResources = JSON.parse(missionData.resources_required);
        } catch (e) {
          // Fallback for old string format
          parsedResources = [];
        }
      }

      // Set form data
      setFormData({
        title: missionData.title,
        problem_statement: missionData.problem_statement,
        selected_resources: parsedResources,
        all_materials_available: missionData.all_materials_available || false,
        qa_assigned_to: missionData.qa_assigned_to || '',
        tasks: tasksData?.map(task => ({
          title: task.title,
          plan: task.plan || '',
          observations: task.observations || '',
          assigned_to: task.assigned_to,
          estimated_duration: task.estimated_duration || '',
          actual_duration: task.actual_duration || '',
          required_tools: task.required_tools || [],
          phase: (task.phase as 'planning' | 'execution' | 'verification' | 'documentation') || 'execution'
        })) || []
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching mission:', error);
      toast({
        title: "Error",
        description: "Failed to load mission data",
        variant: "destructive"
      });
      navigate('/missions');
    }
  };

  const fetchProfiles = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else {
      setProfiles(profilesData || []);
    }
  };

  const checkUserPermissions = async () => {
    if (!user) return;
    
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const contributorOrLeadership = userProfile?.role === 'contributor' || userProfile?.role === 'leadership';
    setIsContributorOrLeadership(contributorOrLeadership);
  };

  const handleAutoSaveMission = async (updatedFormData: any) => {
    if (!user || !mission || !updatedFormData.title.trim() || !updatedFormData.problem_statement.trim() || !updatedFormData.qa_assigned_to) {
      return;
    }

    try {
      // Check if user has permission to edit this mission
      const canEdit = mission.created_by === user.id || isContributorOrLeadership;
      if (!canEdit) return;

      // Update mission
      await supabase
        .from('missions')
        .update({
          title: updatedFormData.title,
          problem_statement: updatedFormData.problem_statement,
          resources_required: updatedFormData.selected_resources.length > 0 ? 
            JSON.stringify(updatedFormData.selected_resources) : 
            updatedFormData.selected_resources.map(r => r.name).join(', '),
          all_materials_available: updatedFormData.all_materials_available,
          qa_assigned_to: updatedFormData.qa_assigned_to || null
        })
        .eq('id', mission.id);

    } catch (error) {
      console.error('Error auto-saving mission:', error);
    }
  };

  const handleAutoSaveTask = async (taskIndex: number, taskData: any) => {
    if (!user || !mission) return;

    try {
      // Check if user has permission to edit this mission
      const canEdit = mission.created_by === user.id || isContributorOrLeadership;
      if (!canEdit) return;

      // Get existing task or create new one
      const { data: existingTasks } = await supabase
        .from('mission_tasks')
        .select('*')
        .eq('mission_id', mission.id)
        .order('created_at', { ascending: true });

      if (existingTasks && existingTasks[taskIndex]) {
        // Update existing task
        await supabase
          .from('mission_tasks')
          .update({
            title: taskData.title,
            plan: taskData.plan || null,
            observations: taskData.observations || null,
            assigned_to: taskData.assigned_to,
            estimated_duration: taskData.estimated_completion_date?.toISOString() || null,
            required_tools: taskData.required_tools || [],
            required_stock: taskData.required_stock || [],
            phase: taskData.phase || 'execution'
          })
          .eq('id', existingTasks[taskIndex].id);
      } else if (taskData.title.trim()) {
        // Create new task
        await supabase
          .from('mission_tasks')
          .insert({
            mission_id: mission.id,
            title: taskData.title,
            plan: taskData.plan || null,
            observations: taskData.observations || null,
            assigned_to: taskData.assigned_to,
            status: 'not_started',
            estimated_duration: taskData.estimated_completion_date?.toISOString() || null,
            required_tools: taskData.required_tools || [],
            required_stock: taskData.required_stock || [],
            phase: taskData.phase || 'execution'
          });
      }

    } catch (error) {
      console.error('Error auto-saving task:', error);
    }
  };

  const handleCancel = () => {
    navigate('/missions');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-8">Loading mission...</div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-8">Mission not found</div>
      </div>
    );
  }

  // Check permission
  const canEdit = mission.created_by === user?.id || isContributorOrLeadership;
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-8">
          <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to edit this mission.</p>
          <Button onClick={() => navigate('/missions')} className="mt-4">
            Back to Missions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/missions')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Missions
            </Button>
          </div>
          
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('/missions')} className="cursor-pointer">
                  Missions
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Edit Mission</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          <h1 className="text-2xl font-bold mt-2">Edit Mission</h1>
          <p className="text-muted-foreground">Update the mission details</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <SimpleMissionForm 
          formData={formData} 
          setFormData={(newFormData) => {
            setFormData(newFormData);
            // Auto-save mission data when basic info changes
            if (newFormData.title !== formData.title || 
                newFormData.problem_statement !== formData.problem_statement ||
                newFormData.qa_assigned_to !== formData.qa_assigned_to ||
                newFormData.all_materials_available !== formData.all_materials_available ||
                JSON.stringify(newFormData.selected_resources) !== JSON.stringify(formData.selected_resources)) {
              handleAutoSaveMission(newFormData);
            }
            // Handle task changes - additions, updates, and deletions
            if (JSON.stringify(newFormData.tasks) !== JSON.stringify(formData.tasks)) {
              // Check for deletions (old tasks that are not in new tasks)
              if (newFormData.tasks.length < formData.tasks.length) {
                // Tasks were removed - the component handles database deletion
                // No additional action needed here since removeTask handles it
              } else {
                // Handle additions and updates
                newFormData.tasks.forEach((task, index) => {
                  if (JSON.stringify(task) !== JSON.stringify(formData.tasks[index])) {
                    handleAutoSaveTask(index, task);
                  }
                });
              }
            }
          }} 
          profiles={profiles} 
          onSubmit={() => Promise.resolve()} 
          onCancel={handleCancel} 
          isEditing={true} 
          selectedTemplate={selectedTemplate} 
          missionId={missionId}
        />
      </main>
    </div>
  );
}