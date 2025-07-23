import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from 'lucide-react';
import { SimpleMissionForm } from "@/components/SimpleMissionForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_DONE_DEFINITION } from "@/lib/constants";
import { MissionTemplateSelector } from '@/components/MissionTemplateSelector';
import { templates } from '@/lib/missionTemplates';

interface Mission {
  id: string;
  title: string;
  problem_statement: string;
  plan: string;
  all_materials_available: boolean;
  qa_assigned_to: string;
  created_by: string;
  created_at: string;
  template_id: string | null;
  template_name: string | null;
  template_color: string | null;
  template_icon: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

export default function Missions() {
  const { toast } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    problem_statement: '',
    done_definition: '',
    selected_resources: [],
    all_materials_available: false,
    qa_assigned_to: '',
    tasks: [{ title: '', plan: '', observations: '', assigned_to: null }],
  });

  useEffect(() => {
    fetchMissions();
    fetchProfiles();
  }, []);

  const fetchMissions = async () => {
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setMissions(data || []);
    } catch (error: any) {
      console.error('Error fetching missions:', error);
      toast({
        title: "Error",
        description: "Failed to load missions",
        variant: "destructive",
      });
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        throw error;
      }
      setProfiles(data || []);
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load profiles",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      problem_statement: '',
      done_definition: '',
      selected_resources: [],
      all_materials_available: false,
      qa_assigned_to: '',
      tasks: [{ title: '', plan: '', observations: '', assigned_to: null }],
    });
    setSelectedTemplate(null);
  };

  const handleDeleteMission = async (missionId: string) => {
    if (window.confirm("Are you sure you want to delete this mission?")) {
      try {
        setIsCreating(true);
        const { error } = await supabase
          .from('missions')
          .delete()
          .eq('id', missionId);

        if (error) {
          throw error;
        }

        setMissions(missions.filter(mission => mission.id !== missionId));
        toast({
          title: "Mission Deleted",
          description: "Mission has been deleted successfully",
        });
      } catch (error: any) {
        console.error('Error deleting mission:', error);
        toast({
          title: "Error",
          description: "Failed to delete mission",
          variant: "destructive",
        });
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleCreateMission = async () => {
    if (!formData.title || !formData.problem_statement || !formData.qa_assigned_to) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      const user = await supabase.auth.getUser();
      
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      // Create the mission
      const { data: missionData, error: missionError } = await supabase
        .from('missions')
        .insert({
          title: formData.title,
          problem_statement: formData.problem_statement,
          plan: formData.done_definition || DEFAULT_DONE_DEFINITION,
          all_materials_available: formData.all_materials_available,
          qa_assigned_to: formData.qa_assigned_to,
          created_by: user.data.user.id,
          template_id: selectedTemplate?.id || null,
          template_name: selectedTemplate?.name || null,
          template_color: selectedTemplate?.color || null,
          template_icon: selectedTemplate?.icon?.name || null,
        })
        .select()
        .single();

      if (missionError) throw missionError;

      // Create tasks and collect their IDs
      const createdTasks = [];
      for (const task of formData.tasks.filter(t => t.title.trim())) {
        const { data: taskData, error: taskError } = await supabase
          .from('mission_tasks')
          .insert({
            mission_id: missionData.id,
            title: task.title,
            plan: task.plan || '',
            observations: task.observations || '',
            assigned_to: task.assigned_to,
          })
          .select()
          .single();

        if (taskError) throw taskError;
        createdTasks.push(taskData);
      }

      // Create task ID mapping for temporary photo migration
      const taskIdMap: Record<string, string> = {};
      formData.tasks.forEach((task, index) => {
        if (task.title.trim() && createdTasks[index]) {
          taskIdMap[`temp-${index}`] = createdTasks[index].id;
        }
      });

      // Return mission data and task mapping for photo migration
      return {
        missionId: missionData.id,
        taskIdMap,
        createdTasks
      };

    } catch (error) {
      console.error('Error creating mission:', error);
      toast({
        title: "Error",
        description: "Failed to create mission",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMission = async () => {
    if (!editingMission || !formData.title || !formData.problem_statement || !formData.qa_assigned_to) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);

      // Update the mission
      const { error: missionError } = await supabase
        .from('missions')
        .update({
          title: formData.title,
          problem_statement: formData.problem_statement,
          plan: formData.done_definition || DEFAULT_DONE_DEFINITION,
          all_materials_available: formData.all_materials_available,
          qa_assigned_to: formData.qa_assigned_to,
        })
        .eq('id', editingMission.id);

      if (missionError) throw missionError;

      // Update existing tasks and create new ones
      const existingTasks = await supabase
        .from('mission_tasks')
        .select('*')
        .eq('mission_id', editingMission.id);

      const createdTasks = [];
      const taskIdMap: Record<string, string> = {};

      for (let i = 0; i < formData.tasks.length; i++) {
        const task = formData.tasks[i];
        if (!task.title.trim()) continue;

        if (existingTasks.data && existingTasks.data[i]) {
          // Update existing task
          const existingTask = existingTasks.data[i];
          const { error: taskError } = await supabase
            .from('mission_tasks')
            .update({
              title: task.title,
              plan: task.plan || '',
              observations: task.observations || '',
              assigned_to: task.assigned_to,
            })
            .eq('id', existingTask.id);

          if (taskError) throw taskError;
          taskIdMap[`temp-${i}`] = existingTask.id;
          createdTasks.push(existingTask);
        } else {
          // Create new task
          const { data: taskData, error: taskError } = await supabase
            .from('mission_tasks')
            .insert({
              mission_id: editingMission.id,
              title: task.title,
              plan: task.plan || '',
              observations: task.observations || '',
              assigned_to: task.assigned_to,
            })
            .select()
            .single();

          if (taskError) throw taskError;
          taskIdMap[`temp-${i}`] = taskData.id;
          createdTasks.push(taskData);
        }
      }

      // Return mission data and task mapping for photo migration
      return {
        missionId: editingMission.id,
        taskIdMap,
        createdTasks
      };

    } catch (error) {
      console.error('Error updating mission:', error);
      toast({
        title: "Error",
        description: "Failed to update mission",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditMission = (mission: Mission) => {
    setEditingMission(mission);
    setFormData({
      title: mission.title,
      problem_statement: mission.problem_statement,
      done_definition: mission.plan,
      selected_resources: [], // You might need to fetch and set resources here
      all_materials_available: mission.all_materials_available,
      qa_assigned_to: mission.qa_assigned_to,
      tasks: [{ title: '', plan: '', observations: '', assigned_to: null }], // You might need to fetch and set tasks here
    });
    setShowForm(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Missions</h1>
        <Button onClick={() => {
          setShowForm(true);
          setEditingMission(null);
          resetForm();
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Mission
        </Button>
      </div>

      {/* Template Selection */}
      {showForm && !editingMission && (
        <MissionTemplateSelector
          templates={templates}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={(template) => {
            setSelectedTemplate(template);
            setFormData(prev => ({
              ...prev,
              tasks: template.defaultTasks ? template.defaultTasks.map(task => ({ ...task, assigned_to: null })) : [{ title: '', plan: '', observations: '', assigned_to: null }]
            }));
          }}
        />
      )}

      {showForm && (
        <SimpleMissionForm
          formData={formData}
          setFormData={setFormData}
          profiles={profiles}
          onSubmit={editingMission ? handleUpdateMission : handleCreateMission}
          onCancel={() => {
            setShowForm(false);
            setEditingMission(null);
            resetForm();
          }}
          defaultTasks={selectedTemplate?.defaultTasks || []}
          selectedTemplate={selectedTemplate}
          isEditing={!!editingMission}
          missionId={editingMission?.id}
        />
      )}

      {/* Missions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {missions.map((mission) => (
          <Card key={mission.id}>
            <CardHeader>
              <CardTitle>{mission.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{mission.problem_statement}</p>
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditMission(mission)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteMission(mission.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
