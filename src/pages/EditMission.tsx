import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Archive } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleMissionForm } from '@/components/SimpleMissionForm';
import { apiService } from '@/lib/apiService';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';

import { useAuth } from "@/hooks/useCognitoAuth";
import { useToast } from "@/hooks/use-toast";
import { useActionProfiles } from "@/hooks/useActionProfiles";

interface Mission {
  id: string;
  mission_number: number;
  title: string;
  problem_statement: string;
  status: string;
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


export default function EditMission() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use standardized profiles for consistent "Assigned to" dropdown
  const { profiles } = useActionProfiles();
  const [isContributorOrAdmin, setIsContributorOrAdmin] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backlogDialogOpen, setBacklogDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
    qa_assigned_to: '',
    actions: [] as Task[]
  });
  const { members: organizationMembers = [] } = useOrganizationMembers();

  // Fetch mission data and profiles
  useEffect(() => {
    if (!missionId) {
      navigate('/missions');
      return;
    }
    
    fetchMissionData();
  }, [missionId, user]);

  useEffect(() => {
    if (!user) return;
    const userMember = organizationMembers.find(member => member.user_id === user.id);
    const contributorOrAdmin = userMember?.role === 'contributor' || userMember?.role === 'admin';
    setIsContributorOrAdmin(Boolean(contributorOrAdmin));
  }, [organizationMembers, user]);

  const fetchMissionData = async () => {
    try {
      // Fetch mission data
      const missionResult = await apiService.get('/missions');
      const missions = Array.isArray(missionResult) ? missionResult : (missionResult?.data || []);
      const missionData = missions.find(m => m.id === missionId);
      
      if (!missionData) {
        toast({
          title: "Error",
          description: "Project not found",
          variant: "destructive"
        });
        navigate('/missions');
        return;
      }

      setMission(missionData);

      // Fetch mission tasks
      const tasksResult = await apiService.get('/actions');
      const allTasks = Array.isArray(tasksResult) ? tasksResult : (tasksResult?.data || []);
      const tasksData = allTasks.filter(task => task.mission_id === missionId);

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

      // Set form data
      setFormData({
        title: missionData.title,
        problem_statement: missionData.problem_statement,
        qa_assigned_to: missionData.qa_assigned_to || '',
        actions: tasksData?.map(task => ({
          id: task.id, // Include the task ID for proper edit detection
          title: task.title,
          policy: task.policy || '',
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
        description: "Failed to load project data",
        variant: "destructive"
      });
      navigate('/missions');
    }
  };

  // Profiles are now handled by useActionProfiles hook for consistency

  // Save mission data explicitly
  const handleSaveMission = async (data: any) => {
    if (!user || !mission) {
      throw new Error('Cannot save mission: user not authenticated or mission not loaded');
    }
    
    // Check permissions
    const canEdit = mission.created_by === user.id || isContributorOrAdmin;
    if (!canEdit) {
      throw new Error('You do not have permission to edit this mission');
    }
    
    try {
      await apiService.put(`/missions/${mission.id}`, {
        title: data.title,
        problem_statement: data.problem_statement,
        qa_assigned_to: data.qa_assigned_to || null,
        updated_at: new Date().toISOString()
      });
      
      toast({
        title: "Project Updated",
        description: "Project details have been saved successfully."
      });
      
      // Navigate back to missions list after successful save
      navigate('/missions');
    } catch (error) {
      console.error('Mission save failed:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save project. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleCancel = () => {
    navigate('/missions');
  };

  // Remove mission function
  const handleRemoveMission = async () => {
    if (!user || !mission) {
      console.error('Missing user or mission data:', { user: !!user, mission: !!mission });
      return;
    }
    
      id: mission.id, 
      title: mission.title,
      currentStatus: mission.status,
      missionNumber: mission.mission_number
    });
    
    try {
      await apiService.put(`/missions/${mission.id}`, {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      });

      toast({
        title: "Project Removed",
        description: `Project PROJECT-${String(mission.mission_number).padStart(3, '0')} has been removed.`,
      });

      // Navigate back to missions
      navigate('/missions');
    } catch (error) {
      console.error('Error removing mission:', error);
      toast({
        title: "Remove Failed",
        description: `Failed to remove project: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  // Move to backlog function
  const handleMoveToBacklog = async () => {
    if (!user || !mission) {
      console.error('Missing user or mission data:', { user: !!user, mission: !!mission });
      return;
    }
    
      id: mission.id, 
      title: mission.title,
      currentStatus: mission.status,
      missionNumber: mission.mission_number
    });
    
    try {
      await apiService.put(`/missions/${mission.id}`, {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      });

      toast({
        title: "Project Moved to Backlog",
        description: `Project PROJECT-${String(mission.mission_number).padStart(3, '0')} has been moved to the backlog.`,
      });

      // Navigate back to missions
      navigate('/missions');
    } catch (error) {
      console.error('Error moving mission to backlog:', error);
      toast({
        title: "Move to Backlog Failed",
        description: `Failed to move project to backlog: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-8">Loading project...</div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-8">Project not found</div>
      </div>
    );
  }

  // Check permission
  const canEdit = mission.created_by === user?.id || isContributorOrAdmin;
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
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/missions')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Missions
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Project</h1>
              <p className="text-muted-foreground">Update the project details</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 relative">
        <SimpleMissionForm 
          formData={formData} 
          setFormData={setFormData}
          profiles={profiles} 
          onSubmit={() => handleSaveMission(formData)} 
          onCancel={handleCancel} 
          isEditing={true} 
          selectedTemplate={selectedTemplate} 
          missionId={missionId}
          onRemoveMission={() => setDeleteDialogOpen(true)}
          canRemoveMission={mission?.created_by === user?.id || isContributorOrAdmin}
          onMoveToBacklog={() => setBacklogDialogOpen(true)}
          canMoveToBacklog={mission?.created_by === user?.id || isContributorOrAdmin}
        />
      </main>

      {/* Remove Mission Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Mission</DialogTitle>
            <DialogDescription>
              Remove this mission? It'll be marked as removed and hidden from the list.
              {mission && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <strong>MISSION-{String(mission.mission_number).padStart(3, '0')}: {mission.title}</strong>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMission}>
              Remove Mission
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move to Backlog Dialog */}
      <Dialog open={backlogDialogOpen} onOpenChange={setBacklogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Mission to Backlog</DialogTitle>
            <DialogDescription>
              Move this mission to the backlog? It will be hidden from active missions but can be viewed in the backlog section.
              {mission && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <strong>MISSION-{String(mission.mission_number).padStart(3, '0')}: {mission.title}</strong>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBacklogDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleMoveToBacklog} className="text-orange-600 hover:text-orange-700 hover:border-orange-300">
              <Archive className="h-4 w-4 mr-2" />
              Move to Backlog
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}