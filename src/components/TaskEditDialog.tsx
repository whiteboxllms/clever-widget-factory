import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDetailEditor } from './TaskDetailEditor';

interface Task {
  id: string;
  title: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  status: string;
  mission_id: string;
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  phase?: 'planning' | 'execution' | 'verification' | 'documentation';
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface TaskEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  profiles: Profile[];
  onSave: () => void;
  onCancel: () => void;
  isCreating?: boolean;
  missionId?: string;
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  profiles,
  onSave,
  onCancel,
  isCreating = false,
  missionId
}: TaskEditDialogProps) {
  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Create New Task' : `Edit Task: ${task.title || 'Untitled Task'}`}
          </DialogTitle>
        </DialogHeader>
        
        <TaskDetailEditor
          task={{
            ...task,
            mission_id: task.mission_id || missionId || '',
          }}
          profiles={profiles}
          onSave={handleSave}
          onCancel={handleCancel}
          isCreating={isCreating}
        />
      </DialogContent>
    </Dialog>
  );
}