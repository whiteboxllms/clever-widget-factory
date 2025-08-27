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
  id?: string; // Include optional id field
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  status?: string;
  mission_id?: string;
  estimated_completion_date?: Date;
  actual_duration?: string;
  required_tools?: string[];
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
        .from('actions')
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
          id: task.id, // Include the task ID for proper edit detection
          title: task.title,
          plan: task.plan || '',
          observations: task.observations || '',
          assigned_to: task.assigned_to,
          status: task.status,
          mission_id: task.mission_id,
          estimated_completion_date: task.estimated_duration ? new Date(task.estimated_duration) : undefined,
          actual_duration: task.actual_duration || '',
          required_tools: task.required_tools || [],
          // phase removed - tasks no longer have phases
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

  // Save mission data explicitly
  const handleSaveMission = async (data: any) => {
    if (!user || !mission) {
      throw new Error('Cannot save mission: user not authenticated or mission not loaded');
    }
    
    // Check permissions
    const canEdit = mission.created_by === user.id || isContributorOrLeadership;
    if (!canEdit) {
      throw new Error('You do not have permission to edit this mission');
    }
    
    try {
      console.log('Saving mission data:', data);
      const { error } = await supabase
        .from('missions')
        .update({
          title: data.title,
          problem_statement: data.problem_statement,
          resources_required: data.selected_resources && data.selected_resources.length > 0 ? 
            JSON.stringify(data.selected_resources) : 
            null,
          all_materials_available: data.all_materials_available,
          qa_assigned_to: data.qa_assigned_to || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', mission.id);

      if (error) throw error;
      console.log('Mission save successful');
      
      toast({
        title: "Mission Updated",
        description: "Mission details have been saved successfully."
      });
    } catch (error) {
      console.error('Mission save failed:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save mission. Please try again.",
        variant: "destructive"
      });
      throw error;
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
          setFormData={setFormData}
          profiles={profiles} 
          onSubmit={() => handleSaveMission(formData)} 
          onCancel={handleCancel} 
          isEditing={true} 
          selectedTemplate={selectedTemplate} 
          missionId={missionId}
        />
      </main>
    </div>
  );
}