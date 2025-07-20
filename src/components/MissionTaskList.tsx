
import { useState, useEffect } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string;
  status: string;
  mission_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface MissionTaskListProps {
  missionId: string;
  profiles: Profile[];
  canEdit?: boolean;
}

export function MissionTaskList({ missionId, profiles, canEdit = false }: MissionTaskListProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [missionId]);

  const fetchTasks = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('mission_tasks')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } else {
      setTasks(data || []);
    }
    
    setLoading(false);
  };

  const handleAddTask = async (taskData: any) => {
    try {
      const { data, error } = await supabase
        .from('mission_tasks')
        .insert({
          mission_id: missionId,
          title: taskData.title,
          plan: taskData.plan,
          observations: taskData.observations,
          assigned_to: taskData.assigned_to || null
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task added successfully",
      });

      setIsAddingTask(false);
      fetchTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: "Error",
        description: "Failed to add task",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tasks</h3>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddingTask(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        )}
      </div>

      {isAddingTask && (
        <TaskCard
          task={{
            id: 'new',
            title: '',
            plan: '',
            observations: '',
            assigned_to: '',
            status: 'not_started',
            mission_id: missionId
          }}
          profiles={profiles}
          onUpdate={fetchTasks}
          isEditing={true}
          onSave={handleAddTask}
          onCancel={() => setIsAddingTask(false)}
        />
      )}

      {tasks.length === 0 && !isAddingTask ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No tasks defined for this mission.</p>
          {canEdit && (
            <p className="text-sm mt-2">Add tasks to break down the mission into manageable steps.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              profiles={profiles}
              onUpdate={fetchTasks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
